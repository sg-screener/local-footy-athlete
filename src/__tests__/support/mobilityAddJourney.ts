import { athleteAnswers } from '../compilerYear/catalog';
import { visibleSignature } from '../compilerYear/invariants';
import { coldStartThroughOnboarding, quiet, quietAsync, relaunchApp } from './athleteJourney';
import { deriveVisibleWeekLive } from '../../utils/deriveVisibleWeek';
import { applyPlanChange, listPlanChangeOptionsForDay, planChangeCategoryAddsSessionKind } from '../../utils/planChangeProducer';
import { snapshotProjectedDay } from '../../utils/coachRevisionProposal';
import { undoLastDecision } from '../../store/undoLastDecision';
import { getSessionComponentRows } from '../../utils/sessionComponents';

export async function mobilityAddJourney(storage: Map<string, string>, ok: (label: string, value: boolean, detail?: string) => void) {
  const date = '2026-09-28';
  for (const gender of ['male', 'female'] as const) for (const category of [
    'strength_upper', 'conditioning_light', 'gunshow', 'primer', 'prehab',
  ] as const) {
    const profile = athleteAnswers({ id: `mobility-add-${gender}`, gender,
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      experience: '5+ years', equipment: 'commercial', initialPhase: 'Off-season',
      clubDays: [], gameDay: null, extraGame: false });
    profile.seasonFinishedOn = '2026-09-27';
    const installed = await quietAsync(() => coldStartThroughOnboarding({ profile, installDayISO: date }));
    if (installed.onboardingRefusal) throw Error(JSON.stringify(installed.onboardingRefusal));
    const view = () => quiet(() => deriveVisibleWeekLive(date, date));
    const before = view();
    const target = before.find(d => d.workout?.composedOptionalKind === 'mobility');
    if (!target) throw Error('No generated Mobility-only day; do not substitute a strength fixture');
    const label = `${gender}/Mobility+${category}`;
    const baseline = visibleSignature(before);
    const options = quiet(() => listPlanChangeOptionsForDay({ visibleWeek: before, date: target.date, todayISO: date }));
    ok(`${label}: actual Mobility is recovery, not strength in the menu`, options.visibleSessionKinds.join() === 'recovery', JSON.stringify(options.visibleSessionKinds));
    const blockedByDuplicate = options.visibleSessionKinds.includes(planChangeCategoryAddsSessionKind(category));
    ok(`${label}: Add type is not blocked as duplicate strength`, options.canAdd && options.visibleSessionCount < 2 && !blockedByDuplicate);
    const result = quiet(() => applyPlanChange({ change: { kind: 'add_category', date: target.date, category },
      visibleWeek: before, todayISO: date, applyOverride: () => undefined }));
    const after = view();
    const current = after.find(d => d.date === target.date)!;
    const originalNames = target.workout!.exercises.map(r => r.exercise.name);
    const originalIds = target.workout!.exercises.map(r => r.id);
    const addedIds = current.workout!.exercises.filter(r => !originalIds.includes(r.id)).map(r => r.id);
    const finalNames = current.workout?.exercises.map(r => r.exercise.name) ?? [];
    ok(`${label}: accepted Add keeps original Mobility and adds content`, result.ok && finalNames.length > originalNames.length &&
      originalNames.every(n => finalNames.includes(n)), JSON.stringify({ result, originalNames, finalNames }));
    const snapshot = snapshotProjectedDay(current);
    ok(`${label}: both visible component kinds survive`, !!snapshot.workout?.sections.some(s => s.kind === 'recovery') &&
      !!snapshot.workout?.sections.some(s => s.kind === planChangeCategoryAddsSessionKind(category)), JSON.stringify(snapshot.workout?.sections.map(s => s.kind)));
    const active = visibleSignature(after);
    const boot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
    ok(`${label}: added day survives restart`, boot.ok && visibleSignature(view()) === active);
    const remove = quiet(() => applyPlanChange({ change: { kind: 'remove_session', date: target.date, scope: 'recovery' },
      visibleWeek: view(), todayISO: date, applyOverride: () => undefined }));
    const removedDay = view().find(d => d.date === target.date);
    const removedNames = removedDay?.workout?.exercises.map(r => r.exercise.name) ?? [];
    const addedNames = finalNames.filter(n => !originalNames.includes(n));
    const removedIds = removedDay?.workout?.exercises.map(r => r.id) ?? [];
    ok(`${label}: Remove Mobility retains the added component`, remove.ok && originalIds.every(id => !removedIds.includes(id)) &&
      addedIds.every(id => removedIds.includes(id)), JSON.stringify({ remove, removedNames }));
    const removed = visibleSignature(view());
    const removeBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
    ok(`${label}: component Remove survives restart`, removeBoot.ok && visibleSignature(view()) === removed);
    const undoRemove = await quietAsync(() => undoLastDecision());
    ok(`${label}: Undo component Remove restores the combined day`, undoRemove.outcome === 'undone' && visibleSignature(view()) === active);
    const destination = view().find(d => d.date !== target.date && (!d.workout || d.workout.exercises.length === 0));
    if (!destination) throw Error('Mobility Move witness needs a genuinely empty destination');
    const move = quiet(() => applyPlanChange({ change: { kind: 'move_session', fromDate: target.date, toDate: destination.date, scope: 'recovery' },
      visibleWeek: view(), todayISO: date, applyOverride: () => undefined }));
    const movedView = view();
    const movedFrom = movedView.find(d => d.date === target.date)?.workout?.exercises.map(r => r.exercise.name) ?? [];
    const movedTo = movedView.find(d => d.date === destination.date)?.workout?.exercises.map(r => r.exercise.name) ?? [];
    const movedComponents = getSessionComponentRows(movedView.find(d => d.date === destination.date)?.workout);
    ok(`${label}: moved Mobility has one typed component, never duplicate recovery or strength`,
      movedComponents.mobilityRows.length === originalIds.length && movedComponents.recoveryRows.length === 0 && movedComponents.strengthRows.length === 0);
    ok(`${label}: Move transfers only Mobility and conserves every original row`, move.ok && originalNames.every(n => movedTo.includes(n)) &&
      addedNames.every(n => movedFrom.includes(n)), JSON.stringify({ move, movedFrom, movedTo }));
    const moved = visibleSignature(movedView);
    const moveBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
    ok(`${label}: component Move survives restart`, moveBoot.ok && visibleSignature(view()) === moved);
    const undoMove = await quietAsync(() => undoLastDecision());
    ok(`${label}: Undo component Move restores combined day`, undoMove.outcome === 'undone' && visibleSignature(view()) === active);
    const undo = await quietAsync(() => undoLastDecision());
    ok(`${label}: latest Undo restores original week`, undo.outcome === 'undone' && visibleSignature(view()) === baseline, JSON.stringify(undo));
    const secondBoot = await quietAsync(() => relaunchApp({ storage, todayISO: date }));
    ok(`${label}: undone week survives restart`, secondBoot.ok && visibleSignature(view()) === baseline);
  }
}
