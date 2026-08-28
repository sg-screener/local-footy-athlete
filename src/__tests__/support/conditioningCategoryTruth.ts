import fs from 'fs';
import path from 'path';
import { stripComments } from './sourceText';
import { CONDITIONING_TEMPLATES, type ConditioningQuality } from '../../data/conditioningTemplates';
import { composeConditioningRows, demandCategoryFor, poolForCategoryPublic,
  selectConditioningTemplate, type AthleteConditioningCategory } from '../../rules/conditioningSelection';

type Check = (label: string, value: boolean, detail?: string) => void;

// C12's retired categoryToFlavour closure is not a current contract. Its
// no-silent-category-loss protection now executes the actual selection owner.
export function conditioningCategoryTruth(ok: Check) {
  const expected: Record<AthleteConditioningCategory, readonly ConditioningQuality[]> = {
    aerobic_base: ['aerobic_capacity'], tempo: ['aerobic_capacity'], sprint: ['acceleration', 'top_end_speed', 'repeat_sprint'],
    vo2: ['aerobic_power'], glycolytic: ['anaerobic'], cod_decel: ['cod_decel'], recovery_flush: ['flush'],
  };
  const vocabulary = (file: string, name: string): string[] => {
    const source = stripComments(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'));
    const start = source.indexOf(`export type ${name} =`), end = source.indexOf(';', start);
    const found = start >= 0 && end > start;
    ok(`[C12 current] ${name} declaration is found before reading its vocabulary`, found);
    const values = found ? [...source.slice(start, end).matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]) : [];
    ok(`[C12 current] ${name} has a nonempty, fully accounted vocabulary`, values.length >= 6
      && new Set(values).size === values.length && values.every(value => Object.hasOwn(expected, value)), JSON.stringify(values));
    return values;
  };
  const planner = vocabulary('rules/offseasonSubphasePolicy.ts', 'OffseasonConditioningCategory');
  const selector = vocabulary('rules/conditioningSelection.ts', 'AthleteConditioningCategory');
  ok('[C12 current] every planner category reaches selection without a lossy flavour conversion',
    planner.length >= 6 && planner.every(c => selector.includes(c)));
  ok('[C12 current] expected categories exactly cover the current selector', selector.length === Object.keys(expected).length
    && Object.keys(expected).every(c => selector.includes(c)));
  for (const category of selector as AthleteConditioningCategory[]) {
    if (!Object.hasOwn(expected, category)) continue;
    const pool = poolForCategoryPublic(category);
    ok(`[C12 current] ${category}: nonempty pool contains only its intended qualities`,
      !!pool?.length && pool.every(t => expected[category].includes(t.quality)), JSON.stringify(pool?.map(t => t.quality)));
    for (const role of [undefined, 'required_core', 'planner_selected_core'] as const) {
      ok(`[C12 current] ${category}/${role}: ordinary demand preserves category identity`, demandCategoryFor(category, role) === category);
    }
    for (const miniCycleNumber of [1, 2]) {
      try {
        const selected = selectConditioningTemplate({ category, dateStr: '2026-07-13', miniCycleNumber,
          noTeamTrainingWeek: true, availableMachines: ['bike', 'air_bike', 'row', 'ski'] });
        ok(`[C12 current] ${category}/${miniCycleNumber}: selection and composed prescription retain the requested quality`,
          expected[category].includes(selected.quality) && pool?.some(t => t.name === selected.name)
          && composeConditioningRows(selected, '2026-07-13').some(row => row.exercise.name === selected.name), selected.name);
      } catch (error) {
        ok(`[C12 current] ${category}/${miniCycleNumber}: selection and composed prescription retain the requested quality`, false, String(error));
      }
    }
  }
  ok('[C12 current] COD is reachable as COD, not declared missing or relabelled glycolytic',
    poolForCategoryPublic('cod_decel')?.length === CONDITIONING_TEMPLATES.filter(t => t.quality === 'cod_decel').length
      && poolForCategoryPublic('cod_decel')?.every(t => t.quality === 'cod_decel') === true);
  for (const role of ['optional_flush', 'optional_recovery_aerobic'] as const) {
    ok(`[C12 current] ${role}: recovery demand selects flush rather than ordinary aerobic work`,
      demandCategoryFor('aerobic_base', role) === 'recovery_flush');
  }
  ok('[C12 current] absent demand is not silently invented', demandCategoryFor(undefined, undefined) === undefined);
}
