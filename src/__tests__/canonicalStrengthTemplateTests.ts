/* Real onboarding -> picker templates -> canonical row identity -> accepted edit/restart. */
(global as { __DEV__?: boolean }).__DEV__ = true;
process.env.TZ = 'Australia/Melbourne';
const storage = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { ARCHETYPES, athleteAnswers, YEAR_START, plusDays } from './compilerYear/catalog';
import { STRENGTH_SESSION_VARIANTS } from '../data/strengthSessionVariants';
import { buildCoachRevisionTemplateWorkout } from '../utils/coachRevisionTemplates';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { visibleSignature } from './compilerYear/invariants';
import { applyPlanChange } from '../utils/planChangeProducer';
import { undoLastDecision } from '../store/undoLastDecision';
import { COMPOSER_ROW_PROVENANCE } from '../rules/materialiseComposedWeek';
import { getCoachRevisionTemplateContext } from '../utils/coachRevisionTemplateContext';
import { composedRowIsLegal } from '../rules/composedRowLegality';
import { resolveEquipmentAvailability } from '../utils/equipmentAvailability';
import { createTemporaryEquipmentFact, temporaryFactScope } from '../rules/temporarySourceFact';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { buildGuidedInjuryConstraint } from '../utils/guidedInjuryControl';

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail = '') {
  if (ok) passed++; else failures.push(label);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${detail}`}`);
}
async function main() {
  {
    for (const athlete of [ARCHETYPES[0], ARCHETYPES[2], ARCHETYPES[3]]) {
      const profile = athleteAnswers(athlete);
      await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: YEAR_START }));
      const composition = getCoachRevisionTemplateContext(YEAR_START).strengthComposition;
      check(`${athlete.id} carries the real phase and block identity into selection`,
        composition?.seasonPhase === athlete.initialPhase && composition.blockStartISO === YEAR_START && composition.blockNumber === 1);
      for (const variant of STRENGTH_SESSION_VARIANTS) {
        const workout = quiet(() => buildCoachRevisionTemplateWorkout(variant.templateId, YEAR_START));
        const rows = workout?.exercises ?? [];
        check(`${athlete.id}/${variant.id} is composed with typed roles and canonical IDs`,
          rows.length > 0 && rows.every(row => row.section18Evidence?.provenance === COMPOSER_ROW_PROVENANCE
            && row.exerciseId === row.exercise?.id && !row.exerciseId.startsWith('tag-')),
          JSON.stringify(rows.map(row => ({name: row.exercise?.name, id: row.exerciseId, evidence: row.section18Evidence}))));
        check(`${athlete.id}/${variant.id} only selects reachable equipment`, rows.length > 0 &&
          rows.every(row => composedRowIsLegal(row.exercise?.name ?? '', resolveEquipmentAvailability(profile, [], YEAR_START))));
      }
    }
    check('retired independent strength builder is absent',
      require('../utils/sessionBuilder').buildTagAwareSession === undefined);
    const composer = require('../rules/composeWeek');
    const original = composer.composeWeek;
    let caught = false;
    composer.composeWeek = () => { throw new Error('mutation: shared composer unavailable'); };
    try { buildCoachRevisionTemplateWorkout('strength_upper_push', YEAR_START); }
    catch (error) { caught = String(error).includes('mutation: shared composer unavailable'); }
    finally { composer.composeWeek = original; }
    check('mutation: picker cannot silently bypass a broken shared composer', caught);
  }

  await quietAsync(() => coldStartThroughOnboarding({ profile: athleteAnswers(ARCHETYPES[2]), installDayISO: YEAR_START }));
  const read = () => quiet(() => deriveVisibleWeekLive(YEAR_START, YEAR_START));
  const before = visibleSignature(read());
  const target = read().find(day => !day.workout || day.workout.workoutType === 'Rest');
  check('real generated week has an empty target for the add door', !!target);
  if (!target) throw new Error('no add target');
  const result = quiet(() => applyPlanChange({ change: {kind: 'add_template', date: target.date,
    templateId: 'strength_upper_push'}, visibleWeek: read(), todayISO: YEAR_START, applyOverride: () => undefined }));
  check('canonical strength template is accepted through the actual add door', result.ok, JSON.stringify(result));
  const after = visibleSignature(read());
  check('add changes the visible week', after !== before);
  const restart = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('accepted strength template survives restart exactly', restart.ok && visibleSignature(read()) === after, restart.error);
  const undo = await quietAsync(() => undoLastDecision());
  check('Undo after restart restores the prior week', undo.outcome === 'undone' && visibleSignature(read()) === before);

  const equipmentDate = plusDays(YEAR_START, 2);
  const fullKit = buildCoachRevisionTemplateWorkout('strength_upper_push', equipmentDate);
  const equipmentFact = createTemporaryEquipmentFact({ observedDate: YEAR_START,
    scope: temporaryFactScope({ kind: 'window', from: equipmentDate, until: equipmentDate }),
    mode: 'only', equipmentTags: ['bodyweight', 'dumbbells'], sourceSurface: 'test' });
  const equipment = await quietAsync(() => transactTemporarySourceFact({ operation: 'create', fact: equipmentFact, todayISO: YEAR_START }));
  check('dated equipment fact is accepted through its real door', !['safely_rejected', 'conflicted'].includes(equipment.outcome));
  const restrictedKit = buildCoachRevisionTemplateWorkout('strength_upper_push', equipmentDate);
  check('future-date template uses that date’s equipment, not today’s', !!restrictedKit?.exercises.length &&
    restrictedKit.exercises.every(row => composedRowIsLegal(row.exercise?.name ?? '', ['bodyweight', 'dumbbells'])) &&
    JSON.stringify(restrictedKit.exercises) !== JSON.stringify(fullKit?.exercises));
  const equipmentRestart = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('dated template selection is identical after restart', equipmentRestart.ok &&
    JSON.stringify(buildCoachRevisionTemplateWorkout('strength_upper_push', equipmentDate)) === JSON.stringify(restrictedKit),
    JSON.stringify({ before: restrictedKit, after: buildCoachRevisionTemplateWorkout('strength_upper_push', equipmentDate) }));
  await quietAsync(() => transactTemporarySourceFact({ operation: 'resolve', factId: equipmentFact.factId, todayISO: YEAR_START }));
  check('clearing temporary equipment restores the exact original template',
    JSON.stringify(buildCoachRevisionTemplateWorkout('strength_upper_push', equipmentDate)) === JSON.stringify(fullKit),
    JSON.stringify({ before: fullKit, after: buildCoachRevisionTemplateWorkout('strength_upper_push', equipmentDate) }));

  const constraint = buildGuidedInjuryConstraint({ region: 'lower_body', area: 'knee', severity: 7,
    severityBand: 'moderate', adjustmentLevel: 'moderate', triggers: ['running'], seriousSymptoms: false }, { todayISO: YEAR_START });
  const injury = await quietAsync(() => executeProgramControlActionDurably({ type: 'set_injury_modifier',
    scope: 'current_and_future', payload: { constraint }, source: { screen: 'my_status', surface: 'status_card', initiatedBy: 'tap' },
    requiresRebuild: false, createsActiveModifier: true, oneOffOnly: false }, { todayISO: YEAR_START }));
  check('injury is accepted through the real door', injury.ok, injury.message);
  const injured = buildCoachRevisionTemplateWorkout('strength_full_body', YEAR_START);
  check('picker follows canonical injury prohibitions rather than the old selector', !!injured?.exercises.length &&
    injured.exercises.filter(row => row.section18Evidence?.role === 'main_strength').every(row =>
      row.section18Evidence?.mainStrengthPattern !== 'squat' && row.section18Evidence?.mainStrengthPattern !== 'hinge'));
  const injuryRestart = await quietAsync(() => relaunchApp({ storage, todayISO: YEAR_START }));
  check('injury-constrained template survives restart exactly', injuryRestart.ok &&
    JSON.stringify(buildCoachRevisionTemplateWorkout('strength_full_body', YEAR_START)) === JSON.stringify(injured),
    JSON.stringify({ before: injured, after: buildCoachRevisionTemplateWorkout('strength_full_body', YEAR_START) }));
  console.log(`Canonical strength templates: ${passed} passed; ${failures.length} failures`);
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
