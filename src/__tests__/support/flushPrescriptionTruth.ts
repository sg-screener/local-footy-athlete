import { CONDITIONING_TEMPLATES, type ConditioningModality } from '../../data/conditioningTemplates';
import { composeConditioningRows, longestWorkIntervalMinutes, poolForCategoryPublic, renderableModalities,
  resolveTemplateByName, selectConditioningTemplate, templateDurationMinutes, workoutTypeForTemplate } from '../../rules/conditioningSelection';
import { conditioningAthletePrescription } from '../../rules/conditioningDisplay';
import { parseConditioningDose, doseMidpoint, doseSeconds } from '../../rules/conditioningDose';
import { buildConditioningBlock, resolvedBlockModality } from '../../data/defaultProgram';
import { conditioningModeLabel } from '../../utils/conditioningVisibleIdentity';
import { athleteAnswers, ARCHETYPES } from '../compilerYear/catalog';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { visibleSignature } from '../compilerYear/invariants';
import { presetEquipmentAnswer } from './equipmentAnswerFixture';
import { compileInjuryConditioning } from '../../rules/canonicalInjuryConditioning';
import { buildGuidedInjuryConstraint } from '../../utils/guidedInjuryControl';
import { applyConditioningModalityToWorkout } from '../../utils/coachModalitySwap';
import { extractVisibleProgramItemsFromWorkout } from '../../utils/visibleProgramReadModel';
import { evaluateSection18EffectiveWeek } from '../../rules/section18EffectiveWeekEvaluator';
import { useProgramStore } from '../../store/programStore';
import { formatConditioningRowPrescription } from '../../screens/home/dayWorkoutHelpers';
import { buildSessionTemplate } from '../../utils/sessionTemplate';

type Check = (label: string, value: boolean, detail?: string) => void;
const machines = ['bike', 'air_bike', 'row', 'ski'] as const;
const retired = 'Bodyweight Circuit (no-equipment fallback)';

/** R-266: actual composed prescriptions, not presence-of-field assertions. */
export async function flushPrescriptionTruth(storage: Map<string, string>, ok: Check) {
  const flushes = CONDITIONING_TEMPLATES.filter(t => t.quality === 'flush');
  ok('flush: all seven saved template identities remain resolvable', flushes.length === 7
    && flushes.every(t => resolveTemplateByName(t.name) === t));
  for (const t of flushes) for (const minimum of [false, true]) {
    const rows = composeConditioningRows(t, '2026-07-13', { authoredMinimumDose: minimum });
    const row = rows.at(-1)!;
    const dose = conditioningAthletePrescription(t, row.prescribedSets);
    ok(`flush/${t.name}/${minimum}: fixed interval headline has one target, not a repeated range`,
      formatConditioningRowPrescription(row) === `${row.prescribedSets} × ${row.prescribedRepsMin} sec`,
      formatConditioningRowPrescription(row));
    ok(`flush/${t.name}/${minimum}: genuine interval ranges remain displayed`,
      formatConditioningRowPrescription({ ...row, prescribedRepsMax: row.prescribedRepsMin + 30 })
        === `${row.prescribedSets} × ${row.prescribedRepsMin}-${row.prescribedRepsMin + 30} sec`);
    const displayedSeconds = (text: string) => {
      const parsed = parseConditioningDose(text);
      return parsed.ok ? doseSeconds(parsed.quantity)?.min : undefined;
    };
    const workSeconds = displayedSeconds(dose.work), restSeconds = displayedSeconds(dose.recovery);
    ok(`flush/${t.name}/${minimum}: complete session is under 15 minutes, with no extra warm-up`,
      templateDurationMinutes(t) < 15 && rows.length === 1, JSON.stringify({ minutes: templateDurationMinutes(t), rows }));
    ok(`flush/${t.name}/${minimum}: timed dose agrees with numeric rounds/rest and displayed total`,
      workSeconds === row.prescribedRepsMin && workSeconds === row.prescribedRepsMax && row.prescriptionType === 'duration'
      && restSeconds === row.restSeconds
      && row.prescribedSets * ((workSeconds ?? Number.NaN) + row.restSeconds) === templateDurationMinutes(t) * 60
      && displayedSeconds(dose.totalSessionTime) === templateDurationMinutes(t) * 60
      && row.notes!.includes(`Total: ${dose.totalSessionTime}`), row.notes);
    ok(`flush/${t.name}/${minimum}: easy throughout, with the retired timer instructions removed`,
      /Intensity: Very easy, 2–3\/10/.test(row.notes!)
      && !/including transitions|first round|preparation|finish when the timer/i.test(row.notes!)
      && !/MAS|hard|3–6/.test(row.notes!), row.notes);
    ok(`flush/${t.name}/${minimum}: recovery classification retained`, workoutTypeForTemplate(t) === 'Recovery');
    for (let mask = 1; mask < 16; mask++) {
      const kit = machines.filter((_, i) => mask & (1 << i));
      const allowed = renderableModalities(t);
      ok(`flush/${t.name}/${minimum}/${kit}: every available supported ergo is permitted, never running`,
        machines.every(m => allowed.includes(m)) && !allowed.includes('run'), JSON.stringify(allowed));
      const selected = selectConditioningTemplate({ category: 'recovery_flush', dateStr: '2026-07-13',
        offFeet: true, availableMachines: kit, preferredTemplateName: t.name });
      const mode = resolvedBlockModality(t.name, 'mixed', kit);
      const block = buildConditioningBlock('aerobic', rows, 'finisher', mode, kit)!;
      const sequence = block.options[0].modalitySequence ?? [];
      const label = conditioningModeLabel(mode, sequence) ?? '';
      ok(`flush/${t.name}/${minimum}/${kit}: selected/displayed machine order is feasible and explicit`,
        selected.name === t.name && sequence.length > 0 && sequence.every(m => kit.includes(m as never))
        && /Bike|RowErg|SkiErg/.test(label) && !/unavailable|Mixed modalities/.test(label), JSON.stringify({ selected: selected.name, sequence, label }));
    }
  }
  for (const t of CONDITIONING_TEMPLATES) {
    const row = composeConditioningRows(t, '2026-07-13').at(-1)!;
    const count = parseConditioningDose(conditioningAthletePrescription(t, row.prescribedSets).setsRounds);
    ok(`prescription/${t.name}: numeric rounds agree with the displayed resolved branch`,
      !count.ok || row.prescribedSets === Math.round(doseMidpoint(count.quantity)));
    const changed = { ...t, modalityNotes: 'ANY modality. Run, Bike, Air Bike, Ski, Row.' };
    ok(`eligibility/${t.name}: descriptive prose cannot change permitted modalities`,
      JSON.stringify(renderableModalities(t)) === JSON.stringify(renderableModalities(changed)));
  }
  const steady = resolveTemplateByName('Steady Blocks (3×8 min or 4×6 min)')!;
  ok('eligibility: the signed eight-minute upper branch still owns the safety cap',
    longestWorkIntervalMinutes(steady) === 8);
  const hard = resolveTemplateByName('Classic 4×4')!;
  ok('eligibility: unrelated hard-conditioning eight-minute ceiling is unchanged',
    !renderableModalities({ ...hard, workPeriod: '9 min hard' }).some(m => ['row', 'ski', 'air_bike'].includes(m)));
  ok('retirement: original Bodyweight Circuit remains readable, with no invented movements',
    resolveTemplateByName(retired)?.workPeriod === '30–40 s per movement × 4 movements');
  ok('retirement: automatic pool excludes Bodyweight Circuit',
    !poolForCategoryPublic('glycolytic').some(t => t.name === retired));
  for (const kit of [[], ['bike'], ['row'], machines] as readonly (readonly ConditioningModality[])[]) {
    const selected = selectConditioningTemplate({ category: 'glycolytic', dateStr: '2026-07-13',
      availableMachines: kit, runOnly: kit.length === 0, preferredTemplateName: retired });
    ok(`retirement/${kit}: explicit preference cannot resurrect an incomplete automatic prescription`, selected.name !== retired);
  }
  let noMachineRefused = false;
  try { selectConditioningTemplate({ category: 'recovery_flush', dateStr: '2026-07-13', offFeet: true, availableMachines: [] }); }
  catch { noMachineRefused = true; }
  ok('flush: empty machine pool refuses instead of restoring an ineligible fallback', noMachineRefused);

  // Metamorphic compiler checks start from an actual generated combined day.
  // Only explicit inputs change: template, available machines and injury facts.
  // No handcrafted or directly persisted workout fixture is used.
  const date = '2026-07-13';
  const profile = { ...athleteAnswers({ ...ARCHETYPES[2], days: ['Monday', 'Wednesday'], initialPhase: 'In-season' }),
    equipmentAnswer: presetEquipmentAnswer('commercial_gym', date) };
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: date }));
  if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
  const view = () => quiet(() => deriveVisibleWeekLive(date, date));
  const actual = view().find(d => d.date === date)!.workout!;
  if (!actual.conditioningBlock?.options.length) throw Error('G+2 flush not reached');
  const owned = new Set(actual.conditioningBlock.options.flatMap(o => o.exerciseIds));
  const lifting = actual.exercises.filter(r => !owned.has(r.id));
  const contract = useProgramStore.getState().currentProgram!.microcycles[0].exposureContractV2!;
  if (!lifting.some(r => r.section18Evidence?.role === 'main_strength')) throw Error('Combined-day lifting not reached');
  const shoulder = buildGuidedInjuryConstraint({ region: 'upper_body', area: 'Shoulder', severity: 4,
    severityBand: 'slight', adjustmentLevel: 'slight', seriousSymptoms: false, triggers: ['pressing'] }, { todayISO: date });
  const knee = buildGuidedInjuryConstraint({ region: 'lower_body', area: 'Knee', severity: 4,
    severityBand: 'slight', adjustmentLevel: 'slight', seriousSymptoms: false, triggers: ['running'] }, { todayISO: date });
  for (const t of flushes) for (let mask = 0; mask < 16; mask++) {
    const kit = machines.filter((_, i) => mask & (1 << i));
    const narrowedProfile = { ...profile, equipmentAnswer: { ...profile.equipmentAnswer,
      modalities: Object.fromEntries(kit.map(m => [m === 'bike' ? 'bike_erg' : m, 'have' as const])) } };
    const rows = composeConditioningRows(t, date, { authoredAtISO: `${date}T00:00:00.000Z` });
    const mode = resolvedBlockModality(t.name, 'mixed', kit);
    const block = buildConditioningBlock('aerobic', rows, 'finisher', mode, kit)!;
    const candidate = { ...actual, exercises: [...lifting, ...rows], conditioningBlock: block };
    for (const severity of [1, 4, 6, 9]) for (const [injury, constraints] of [['shoulder', [shoulder]], ['knee', [knee]], ['both', [shoulder, knee]]] as const) {
      const result = quiet(() => compileInjuryConditioning({ workout: candidate, profile: narrowedProfile,
        dateISO: date, constraints: constraints.map(constraint => ({ ...constraint, severity })) }));
      const options = result.conditioningBlock?.options ?? [];
      const credit = evaluateSection18EffectiveWeek({ contract, workouts: [result], weekStart: date }).ledger.conditioning;
      const suitable = injury === 'knee' ? kit : severity === 1 ? kit.filter(m => m !== 'air_bike') : kit.filter(m => m === 'bike');
      ok(`flush/${t.name}/${kit}/${injury}/${severity}: only suitable available machines survive injury compilation`,
        suitable.length === 0 ? options.length === 0 : options.length > 0 && options.every(o =>
          !!o.modalitySequence?.length && o.modalitySequence.every(m => suitable.includes(m as never))), JSON.stringify(options));
      ok(`flush/${t.name}/${kit}/${injury}: recovery role never earns fitness-conditioning credit`,
        !options.length || (result.section18ConditioningRole === 'optional_flush'
          && result.section18Evidence?.conditioningStress !== 'hard'
          && credit.appCoreCount === 0 && credit.optionalFlushCount === 1), JSON.stringify(credit));
      if (options.length) ok(`flush/${t.name}/${kit}/${injury}: actual visible total matches resolved dose`,
        extractVisibleProgramItemsFromWorkout(result).filter(i => i.source === 'conditioning_option')
          .every(i => i.durationMinutes === templateDurationMinutes(t)));
      if (options.length) {
        const cards = buildSessionTemplate(result).items.flatMap(item =>
          item.kind === 'exercise' && item.presentation === 'conditioning_phase'
            ? [{ modality: item.modalityLabel, copy: String(item.row.notes ?? '') }]
            : []);
        ok(`flush/${t.name}/${kit}/${injury}: injury-adjusted cards use the selected typed intensity unit`,
          cards.length > 0 && cards.every(card => card.modality === 'Run'
            ? /^Intensity:/m.test(card.copy)
            : !!card.modality && /^Effort: (?:[1-9]|10)\/10$/m.test(card.copy)
              && !/\bMAS\b/.test(card.copy)), JSON.stringify(cards));
      }
    }
    for (const machine of kit) {
      const changed = applyConditioningModalityToWorkout(candidate, { fromModality: null,
        toModality: machine === 'air_bike' ? 'bike' : machine, bikeLabel: machine === 'air_bike' ? 'assault' : 'standard' });
      ok(`flush/${t.name}/${kit}/${machine}: modality changes preserve the whole easy dose and lifting`,
        changed.conditioningBlock.options[0].modalitySequence?.join(',') === machine
        && JSON.stringify(changed.exercises) === JSON.stringify(candidate.exercises)
        && changed.conditioningBlock.options[0].durationMinutes === templateDurationMinutes(t));
    }
  }
  const before = visibleSignature(view());
  const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
  ok('flush: actual combined-day prescription and machine sequence survive restart', boot.ok && before === visibleSignature(view()));
}
