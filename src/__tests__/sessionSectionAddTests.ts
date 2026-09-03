/** Real onboarding → section Add → unchanged existing rows → exact reopen. */
(global as any).__DEV__ = true;
const storage = new Map<string, string>();
(globalThis as any).window = { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
} };
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './support/athleteJourney';
import { athleteAnswers, ARCHETYPES } from './compilerYear/catalog';
import { applyPlanChange } from '../utils/planChangeProducer';
import type { PlanChangeCategoryId } from '../utils/planChangeTypes';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { getEffectiveGameDates } from '../utils/sessionResolver';
import { useProfileStore } from '../store/profileStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { resolveTapSwapEnvironment, assessTapSwapCandidateSafety } from '../utils/tapSwapHierarchy';
import { legalAddFamilies, legalAddCandidates, addExerciseSectionContext, type AddFamilyId, type AddLeafId } from '../utils/addExerciseCandidates';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { buildSessionTemplate } from '../utils/sessionTemplate';
import { buildSessionExecutionPlan } from '../utils/sessionExecutionChecklist';
import { getSessionComponentRows } from '../utils/sessionComponents';
import { exerciseProgrammingAllows } from '../utils/exerciseFilter';
import { sourceMutation } from './support/sourceMutation';
import { useProgramStore } from '../store/programStore';
import { compileCanonicalAthleteEditedWeek } from '../rules/canonicalWeeklyAthleteEditCompiler';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();
let passed = 0, failed = 0;
function check(label: string, value: unknown, detail?: unknown) {
  if (value) passed++; else { failed++; console.error(`FAIL ${label}`, detail ?? ''); }
}
const date = '2026-08-24';
const coordinates: [PlanChangeCategoryId, AddFamilyId, AddLeafId][] = [
  ['strength_full', 'strength', 'upper_push'],
  ['conditioning_light', 'conditioning', 'easy_flush'],
  ['mobility', 'mobility', 'mobility_drills'],
  ['primer', 'primer', 'power'],
  ['prehab', 'accessories', 'upper_accessories'],
  ['recovery', 'recovery', 'breathing'],
  // A seventh coordinate, `['primer', 'optional', 'upper_push']`, stood here
  // from R-273 (2026-08-29). R-288 (2026-08-31, aa81147b) removed the Primer's
  // three optional rows — a Primer is exactly seven low-fatigue rows with no
  // Optional Work cluster, and "athletes who want more work add a separate
  // Strength session" — so a freshly composed Primer offers no Optional
  // section to Add into (measured green at c3f16708, red from 289a35b8 on).
  // R-288's own guard (`test:primer-session`) holds the absence; the Optional
  // Work Add route is still exercised by `optional remains no-penalty` below
  // whenever a coordinate reaches that section.
];
async function main() {
  for (const gender of ['male', 'female'] as const) {
    const start = await coldStartThroughOnboarding({ profile: athleteAnswers({ ...ARCHETYPES[6], gender, extraGame: false }), installDayISO: date });
    check(`${gender}: real valid onboarding`, !start.onboardingRefusal);
    const read = () => quiet(() => deriveVisibleWeekLive(date, date));
    for (const [category, section, requestedLeaf] of coordinates) {
      const label = `${gender}/${category}/${section}`;
      const changed = quiet(() => applyPlanChange({ change: { kind: 'swap_category', date, category },
        visibleWeek: read(), todayISO: date, applyOverride: () => undefined }));
      check(`${label}: actual session type door`, changed.ok, changed);
      let workout = read().find(day => day.date === date)!.workout!;
      check(`${label}: reached named session shape`, category === 'primer' ? workout.composedOptionalKind === 'primer' : workout.exercises.length > 0);
      const beforePlan = buildSessionExecutionPlan({ workout, template: buildSessionTemplate(workout), mobilityFlow: null });
      check(`${label}: the rendered session actually offers this section`, beforePlan.sections.some(item => item.id === section));
      if (category === 'conditioning_light') {
        const cards = buildSessionTemplate(workout).items.flatMap(item =>
          item.kind === 'exercise' && item.presentation === 'conditioning_phase'
            ? [{ modality: item.modalityLabel, copy: String(item.row.notes ?? '') }]
            : []);
        check(`${label}: added Conditioning session uses explicit typed effort wording`,
          cards.length > 0 && cards.every(card => !!card.modality && card.modality !== 'Run'
            && /^Effort: (?:[1-9]|10)\/10$/m.test(card.copy) && !/\bMAS\b/.test(card.copy)), cards);
      }
      const profile = useProfileStore.getState().onboardingData;
      const environment = resolveTapSwapEnvironment({ scheduleState: buildScheduleStateImperative(), date,
        gameDates: [...getEffectiveGameDates(buildScheduleStateImperative(), date)], profile,
        activeConstraints: useCoachUpdatesStore.getState().activeConstraints, readinessSignal: null });
      const args = { environment, profile, section, sessionKind: workout.composedOptionalKind,
        existingExerciseNames: workout.exercises.map(row => row.exercise.name) };
      const families = legalAddFamilies(args);
      check(`${label}: chooser preserves section context`, families.length === 1 && families[0].id === section);
      const leaves = families.flatMap(family => family.groups.flatMap(group => group.leaves));
      if (category === 'prehab') check(`${label}: authored Accessories context excludes main-lift drawers`,
        leaves.every(item => ['lower_accessories', 'upper_accessories', 'upper_arms_shoulders', 'midline_carries'].includes(item.id)));
      const leaf = leaves.find(item => item.id === requestedLeaf)?.id ?? leaves[0]?.id;
      check(`${label}: real legal leaf exists`, !!leaf);
      if (!leaf) continue;
      const candidates = legalAddCandidates({ ...args, leaf });
      check(`${label}: actual candidate list obeys safety owner`, candidates.length > 0 && candidates.every(candidate => assessTapSwapCandidateSafety(candidate.name, environment).safe));
      if (category === 'primer') check(`${label}: Primer route is enforced`, candidates.every(candidate => exerciseProgrammingAllows(candidate.name, { ...environment, route: 'primer' })));
      const candidate = candidates[0];
      if (!candidate) continue;
      const existing = workout.exercises.map(row => ({ id: row.id, name: row.exercise.name, sets: row.prescribedSets, reps: row.prescribedRepsMin, kg: row.prescribedWeightKg }));
      const result = await quietAsync(() => executeProgramControlActionDurably({ type: 'add_exercise',
        source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only',
        payload: { date, exercise: { ...candidate, weight: candidate.weightKg ?? undefined,
          ...addExerciseSectionContext(section, leaf, workout.composedOptionalKind) } },
        requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: date }));
      check(`${label}: actual Add accepted`, result.ok, result);
      workout = read().find(day => day.date === date)!.workout!;
      const added = workout.exercises.find(row => row.exercise.name === candidate.name)!;
      check(`${label}: all existing prescriptions survive`, existing.every(before => workout.exercises.some(row => row.id === before.id
        && row.exercise.name === before.name && row.prescribedSets === before.sets && row.prescribedRepsMin === before.reps && row.prescribedWeightKg === before.kg)));
      const template = buildSessionTemplate(workout);
      const plan = buildSessionExecutionPlan({ workout, template, mobilityFlow: null });
      check(`${label}: added row belongs to intended section exactly once`, !!added && plan.items.filter(item => item.id === `exercise:${added.id}`).length === 1
        && plan.sections.find(s => s.id === section)?.items.some(item => item.id === `exercise:${added.id}`), { candidate: candidate.name, added, items: plan.items.map(i => [i.id, i.label, i.sectionId]) });
      if (section === 'conditioning') check(`${label}: conditioning stays conditioning`, added?.role === 'conditioning'
        && getSessionComponentRows(workout).conditioningRows.some(row => row.id === added.id));
      if (section === 'optional') check(`${label}: optional remains no-penalty`, added?.optionalNoPenalty === true);
      if (category === 'strength_full') {
        const mutation = sourceMutation<typeof import('../rules/canonicalWeeklyAthleteEditCompiler')>(require.resolve('../rules/canonicalWeeklyAthleteEditCompiler'),
          'current?.exerciseEditedPlacementId === placement.constraintId', 'false');
        const args = { workouts: [workout], weekStartISO: date, constraints: useProgramStore.getState().userRemovalConstraints };
        const retainsAdded = (rows: ReturnType<typeof compileCanonicalAthleteEditedWeek>) => rows.some(w => w.exercises.some(row => row.id === added.id));
        check(`${label}: mutation restoring the old placement loses the exact added row`, retainsAdded(compileCanonicalAthleteEditedWeek(args))
          && !retainsAdded(mutation.compileCanonicalAthleteEditedWeek(args)));
      }
      if (section === 'mobility') {
        const mutation = sourceMutation<typeof import('../utils/sessionExecutionChecklist')>(require.resolve('../utils/sessionExecutionChecklist'),
          'return item.row.sessionSection;', "return 'strength';");
        const bad = mutation.buildSessionExecutionPlan({ workout, template, mobilityFlow: null });
        check(`${label}: mutation routing additions to Strength fails section membership`, !bad.sections.find(s => s.id === 'mobility')?.items.some(item => item.id === `exercise:${added.id}`)
          && plan.sections.find(s => s.id === 'mobility')?.items.some(item => item.id === `exercise:${added.id}`));
      }

      const before = JSON.stringify(plan);
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      workout = read().find(day => day.date === date)!.workout!;
      check(`${label}: all sections and prescriptions survive process restart`, boot.ok && JSON.stringify(buildSessionExecutionPlan({ workout, template: buildSessionTemplate(workout), mobilityFlow: null })) === before);
    }
    // A conditioning block already owns its original row IDs. The extra row must
    // not disappear or be misrepresented as an alternative to the original work.
    quiet(() => applyPlanChange({ change: { kind: 'swap_category', date, category: 'strength_full' }, visibleWeek: read(), todayISO: date, applyOverride: () => undefined }));
    const attach = quiet(() => applyPlanChange({ change: { kind: 'add_category', date, category: 'conditioning_light' }, visibleWeek: read(), todayISO: date, applyOverride: () => undefined }));
    let workout = read().find(day => day.date === date)!.workout!;
    check(`${gender}: reached combined strength/conditioning`, attach.ok && getSessionComponentRows(workout).strengthRows.length > 0 && getSessionComponentRows(workout).conditioningRows.length > 0);
    const attachedCards = buildSessionTemplate(workout).items.flatMap(item =>
      item.kind === 'exercise' && item.presentation === 'conditioning_phase'
        ? [{ modality: item.modalityLabel, copy: String(item.row.notes ?? '') }]
        : []);
    check(`${gender}: attached Conditioning session uses explicit typed effort wording`,
      attachedCards.length > 0 && attachedCards.every(card => !!card.modality && card.modality !== 'Run'
        && /^Effort: (?:[1-9]|10)\/10$/m.test(card.copy) && !/\bMAS\b/.test(card.copy)), attachedCards);
    const profile = useProfileStore.getState().onboardingData;
    const env = resolveTapSwapEnvironment({ scheduleState: buildScheduleStateImperative(), date, gameDates: [], profile, activeConstraints: [], readinessSignal: null });
    const candidate = legalAddCandidates({ environment: env, profile, section: 'conditioning', leaf: 'easy_flush', existingExerciseNames: workout.exercises.map(row => row.exercise.name) })[0];
    check(`${gender}: combined section has an eligible addition`, !!candidate);
    if (candidate) {
      const originalIds = buildSessionExecutionPlan({ workout, template: buildSessionTemplate(workout), mobilityFlow: null }).items.map(item => item.id);
      const add = await quietAsync(() => executeProgramControlActionDurably({ type: 'add_exercise', source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only',
        payload: { date, exercise: { ...candidate, ...addExerciseSectionContext('conditioning', 'easy_flush') } }, requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: date }));
      workout = read().find(day => day.date === date)!.workout!;
      const plan = buildSessionExecutionPlan({ workout, template: buildSessionTemplate(workout), mobilityFlow: null });
      check(`${gender}: combined Add retains every original execution item`, add.ok && originalIds.every(id => plan.items.some(item => item.id === id)));
      check(`${gender}: extra conditioning renders outside original option block`, plan.sections.find(s => s.id === 'conditioning')?.items.some(item => item.label === candidate.name));
      const signature = JSON.stringify(plan);
      const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
      workout = read().find(day => day.date === date)!.workout!;
      check(`${gender}: combined addition reopens unchanged`, boot.ok && JSON.stringify(buildSessionExecutionPlan({ workout, template: buildSessionTemplate(workout), mobilityFlow: null })) === signature);
    }
    // The combined day clears its container purity marker. Each authored
    // section must retain its own identity, row order and Add restrictions.
    for (const base of ['primer', 'prehab'] as const) {
      for (const attached of ['conditioning_light', 'recovery', 'strength_upper'] as const) {
        const label = `${gender}/${base}+${attached}`;
        const reset = quiet(() => applyPlanChange({ change: { kind: 'swap_category', date, category: base },
          visibleWeek: read(), todayISO: date, applyOverride: () => undefined }));
        let combined = read().find(day => day.date === date)!.workout!;
        const sectionId = base === 'primer' ? 'primer' : 'accessories';
        const original = buildSessionExecutionPlan({ workout: combined, template: buildSessionTemplate(combined), mobilityFlow: null })
          .sections.find(section => section.id === sectionId)!;
        check(`${label}: starts with a real authored section`, reset.ok && original?.items.length > 0);
        const attach = quiet(() => applyPlanChange({ change: { kind: 'add_category', date, category: attached },
          visibleWeek: read(), todayISO: date, applyOverride: () => undefined }));
        combined = read().find(day => day.date === date)!.workout!;
        let plan = buildSessionExecutionPlan({ workout: combined, template: buildSessionTemplate(combined), mobilityFlow: null });
        const own = plan.sections.find(section => section.id === sectionId)!;
        check(`${label}: combined session preserves section label, row order and typed context`, attach.ok
          && own?.label === original.label && own.sessionKind === base
          && JSON.stringify(own.items.map(item => item.id)) === JSON.stringify(original.items.map(item => item.id)));
        if (base === 'primer' && attached === 'conditioning_light') {
          const mutation = sourceMutation<typeof import('../utils/sessionExecutionChecklist')>(require.resolve('../utils/sessionExecutionChecklist'),
            "if (kind === 'primer') return 'primer';", "if (kind === 'primer') return 'strength';");
          const broken = mutation.buildSessionExecutionPlan({ workout: combined, template: buildSessionTemplate(combined), mobilityFlow: null });
          check(`${label}: mutation losing typed Primer identity is detected`, !!own && !broken.sections.some(section => section.id === 'primer'));
        }
        const args = { environment: env, profile, section: sectionId as AddFamilyId, sessionKind: own?.sessionKind,
          existingExerciseNames: combined.exercises.map(row => row.exercise.name) };
        const leaf = base === 'primer' ? 'power' : 'upper_accessories';
        const candidates = legalAddCandidates({ ...args, leaf });
        check(`${label}: section-specific Add has safe candidates`, candidates.length > 0
          && candidates.every(candidate => assessTapSwapCandidateSafety(candidate.name, env).safe));
        if (base === 'primer') check(`${label}: combined Primer cannot widen to general manual eligibility`,
          candidates.every(candidate => exerciseProgrammingAllows(candidate.name, { ...env, route: 'primer' })));
        const candidate = candidates[0];
        if (!candidate) continue;
        const beforeIds = plan.items.map(item => item.id);
        const result = await quietAsync(() => executeProgramControlActionDurably({ type: 'add_exercise',
          source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' }, scope: 'today_only',
          payload: { date, exercise: { ...candidate, ...addExerciseSectionContext(sectionId, leaf, own.sessionKind) } },
          requiresRebuild: false, createsActiveModifier: false, oneOffOnly: true }, { todayISO: date }));
        combined = read().find(day => day.date === date)!.workout!;
        plan = buildSessionExecutionPlan({ workout: combined, template: buildSessionTemplate(combined), mobilityFlow: null });
        check(`${label}: Add stays in the authored section and preserves every sibling`, result.ok
          && plan.sections.find(section => section.id === sectionId)?.items.some(item => item.label === candidate.name)
          && beforeIds.every(id => plan.items.some(item => item.id === id)));
        const signature = JSON.stringify(plan);
        const reboot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
        combined = read().find(day => day.date === date)!.workout!;
        check(`${label}: combined authored section and Add survive restart`, reboot.ok
          && JSON.stringify(buildSessionExecutionPlan({ workout: combined, template: buildSessionTemplate(combined), mobilityFlow: null })) === signature);
      }
    }
    // A section context cannot widen canonical safety. Test the actual canonical
    // equipment, injury severity and fixture inputs rather than a parallel filter.
    for (const section of ['strength', 'conditioning', 'mobility', 'accessories', 'recovery', 'optional'] as AddFamilyId[]) {
      for (const patch of [{ availableEquipmentTags: ['bodyweight'] as any, availableEquipment: ['bodyweight'] as any },
        { injurySeverities: { shoulder: 7 } }, { daysToGame: 1, experienceLevel: 'Complete beginner' as const }]) {
        const environment = { ...env, ...patch };
        const candidates = legalAddFamilies({ environment, profile, section }).flatMap(family => family.groups.flatMap(group => group.leaves.flatMap(leaf => legalAddCandidates({ environment, profile, section, leaf: leaf.id }))));
        check(`${gender}/${section}/${JSON.stringify(patch)}: context cannot bypass safety`, candidates.every(candidate => assessTapSwapCandidateSafety(candidate.name, environment).safe));
        if (candidates.length === 0) check(`${gender}/${section}: empty safety result has no pretend choices`, legalAddFamilies({ environment, profile, section }).length === 0);
      }
    }
  }
  console.log(`Section Add: ${passed} passed, ${failed} failed`); totalsPrinted(failed);
  console.log('NOT COVERED: native touch/layout (separate real-onboarding simulator tape); physical phones.');
  process.exitCode = failed ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
