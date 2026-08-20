/**
 * WHICH RUNG DID EACH PAIRING ACTUALLY COME FROM? — the exact knee 7/10 example.
 *
 * Read-only. Rebuilds the `standard-in-season-week` world through the real
 * generator, takes Monday's session, and for EVERY row the injury makes unsafe
 * prints what rungs 1-4 offered and what rung 5 offered, separately.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => localStorageData.get(k) ?? null,
    setItem: (k: string, v: string) => { localStorageData.set(k, v); },
    removeItem: (k: string) => { localStorageData.delete(k); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => { throw new Error('NETWORK DISABLED'); };
process.env.TZ = 'Australia/Melbourne';

/* eslint-disable import/first */
import type { TrainingProgram, Workout } from '../src/types/domain';
import { addDaysISO } from '../src/utils/programBlockState';
import { useProgramStore } from '../src/store/programStore';
import { useProfileStore } from '../src/store/profileStore';
import { useCalendarStore } from '../src/store/calendarStore';
import { useCoachUpdatesStore } from '../src/store/coachUpdatesStore';
import { useReadinessStore } from '../src/store/readinessStore';
import { generateProgramLocally } from '../src/services/api/generateProgram';
import { commitRebuiltProgram } from '../src/utils/weekRebuild';
import { resolveWeekWithConditioning } from '../src/utils/sessionResolver';
import { buildScheduleStateImperative } from '../src/utils/coachWeekDiff';
import { resetStoresToFreshInstall } from '../src/__tests__/support/freshInstallStores';
import { quiet, setJourneyClock } from '../src/__tests__/support/athleteJourney';
import { buildGuidedInjuryConstraint, GUIDED_INJURY_SEVERITY_OPTIONS, type GuidedInjuryFlowResult } from '../src/utils/guidedInjuryControl';
import { resolveTapSwapEnvironment, assessTapSwapCandidateSafety, injuryRequiresChange } from '../src/utils/tapSwapHierarchy';
import { planInjuryRecomposition, sessionRowNames } from '../src/utils/injurySessionRecomposition';
import { walkInjuryFallbackLadder, INJURY_FALLBACK_RUNGS } from '../src/rules/injuryFallbackLadder';
import { exerciseSessionFamily } from '../src/rules/exerciseSessionFamily';
import { classifyExerciseRiskForBucket } from '../src/rules/injuryExerciseRisk';
import { finerPatternIdentityOf } from '../src/rules/injuryFallbackLadder';
import { buildSessionInjuryReview } from '../src/utils/sessionInjuryReview';
import { DEV_E2E_STANDARD_PROFILE } from '../src/dev/e2e/devE2EStandardProfile';
import { legalAddCandidates } from '../src/utils/addExerciseCandidates';
import { deriveInjurySessionAdjustment } from '../src/utils/injurySessionAdjustment';

const INSTALL = '2026-07-13';
const TODAY = process.env.PROBE_DATE ?? INSTALL;
const AREA = process.env.PROBE_AREA ?? 'Knee';
const BAND = process.env.PROBE_BAND ?? 'moderate';
const REGION = (process.env.PROBE_REGION ?? 'lower_body') as never;

function mondayFor(d: string): string {
  const p = new Date(`${d}T12:00:00Z`);
  return addDaysISO(d, -((p.getUTCDay() + 6) % 7));
}

function install(): string {
  localStorageData.clear();
  resetStoresToFreshInstall('probe-injury-review-pairings');
  const profile = DEV_E2E_STANDARD_PROFILE;
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  setJourneyClock(INSTALL);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: INSTALL, previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'In-season' as never,
      phaseEntryWeekStartISO: mondayFor(INSTALL),
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const settled = program.microcycles[0]!;
  const weekStart = String(settled.startDate).slice(0, 10);
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {}, selectedDate: weekStart,
    reason: 'probe:generate',
  }));
  useProgramStore.setState({ currentMicrocycle: settled } as never);
  return weekStart;
}

function workoutOn(dateISO: string, weekStartISO: string): Workout | null {
  const week = quiet(() => resolveWeekWithConditioning(weekStartISO, buildScheduleStateImperative()));
  const day = week.find((d) => d.date === dateISO);
  return ((day as { workout?: Workout } | undefined)?.workout) ?? null;
}

function sweep(weekStart: string): void {
  const cases: { region: string; area: string }[] = [
    { region: 'lower_body', area: 'Knee' },
    { region: 'lower_body', area: 'Hamstring' },
    { region: 'lower_body', area: 'Hip' },
    { region: 'lower_body', area: 'Groin' },
    { region: 'lower_body', area: 'Calf / Achilles' },
    { region: 'lower_body', area: 'Ankle / foot' },
    { region: 'back_midline', area: 'Lower back' },
    { region: 'upper_body', area: 'Shoulder' },
    { region: 'upper_body', area: 'Elbow' },
    { region: 'upper_body', area: 'Neck' },
  ];
  const week = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
  const days = (week as any[]).filter((d) => d.workout?.exercises?.length);
  console.log('\n══ SWEEP: does ANY rung 1-4 ever accept at the 6-7 band? ══');
  console.log('  area                 day         rows  unsafe  r1-4 accepted  r5 accepted  chosen tier');
  for (const c of cases) {
    const option = GUIDED_INJURY_SEVERITY_OPTIONS.find((o) => o.severityBand === 'moderate')!;
    for (const day of days) {
      const dateISO = day.date as string;
      setJourneyClock(dateISO);
      const constraint = buildGuidedInjuryConstraint({
        region: c.region as never, area: c.area, severity: option.severity,
        severityBand: option.severityBand, adjustmentLevel: option.adjustmentLevel,
        triggers: [], seriousSymptoms: false,
      }, { todayISO: dateISO });
      const primaryInjury = constraint.bucket
        ? { bucket: constraint.bucket as never, severity: constraint.severity, seriousSymptoms: false }
        : null;
      const env = resolveTapSwapEnvironment({
        date: dateISO, profile: useProfileStore.getState().onboardingData,
        activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[dateISO],
        primaryInjury,
      });
      const w = workoutOn(dateISO, weekStart);
      const plan = planInjuryRecomposition({ workout: w, environment: env, primaryInjury });
      if (plan.unsafeRows.length === 0) continue;
      let r14 = 0; let r5 = 0;
      const taken = sessionRowNames(w).filter((n) => !plan.unsafeRows.includes(n));
      for (const row of plan.unsafeRows) {
        const section = exerciseSessionFamily(row);
        const { evaluations } = walkInjuryFallbackLadder({
          exercise: row, region: constraint.bucket as never,
          isLegal: (n: string) => assessTapSwapCandidateSafety(n, env).safe,
          explainLegality: (n: string) => assessTapSwapCandidateSafety(n, env).reason,
          avoidNames: taken,
        });
        const ok = (rungId: string) => evaluations.filter((e) => e.rung === rungId && !e.rejection)
          .filter((e) => !section || exerciseSessionFamily(e.name) === section).length;
        r14 += ok('same_movement_safer_variation') + ok('nearest_safe_secondary_compound')
          + ok('accessory_or_isometric') + ok('safe_adjacent_pattern');
        r5 += ok('unaffected_body_area');
      }
      const tiers = Array.from(new Set(plan.substitutions.map((x) => x.to.hierarchyTier))).join('/') || 'none';
      console.log(`  ${c.area.padEnd(20)} ${dateISO}  ${String(sessionRowNames(w).length).padStart(4)}`
        + `  ${String(plan.unsafeRows.length).padStart(6)}  ${String(r14).padStart(13)}  ${String(r5).padStart(11)}  ${tiers}`);
    }
  }
}

function main(): void {
  const weekStart = install();
  if (process.env.PROBE_SWEEP) { sweep(weekStart); return; }
  setJourneyClock(TODAY);
  const workout = workoutOn(TODAY, weekStart);
  const option = GUIDED_INJURY_SEVERITY_OPTIONS.find((o) => o.severityBand === BAND)!;
  const answer: GuidedInjuryFlowResult = {
    region: REGION, area: AREA, severity: option.severity,
    severityBand: option.severityBand, adjustmentLevel: option.adjustmentLevel,
    triggers: ['Squatting / lunging'], seriousSymptoms: false,
  };
  const constraint = buildGuidedInjuryConstraint(answer, { todayISO: TODAY });
  const primaryInjury = constraint.bucket
    ? { bucket: constraint.bucket as never, severity: constraint.severity, seriousSymptoms: false }
    : null;
  const environment = resolveTapSwapEnvironment({
    date: TODAY,
    profile: useProfileStore.getState().onboardingData,
    activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
    readinessSignal: useReadinessStore.getState().signalsByDate[TODAY],
    primaryInjury,
  });

  // THE WHOLE WEEK, so a proposal cannot add upper work the athlete already has.
  const week = quiet(() => resolveWeekWithConditioning(weekStart, buildScheduleStateImperative()));
  console.log('\n── THE WEEK THIS SESSION SITS IN ──');
  for (const day of week as any[]) {
    const w = day.workout;
    if (!w) { console.log(`  ${day.date}  (rest)`); continue; }
    console.log(`  ${day.date}  ${w.workoutType}`);
    for (const row of (w.exercises ?? [])) {
      const nm = row.exercise?.name ?? row.name ?? '?';
      const dose = JSON.stringify(row).slice(0, 240);
      console.log(`      ${String(nm).padEnd(34)} [${exerciseSessionFamily(nm) ?? 'unplaced'}]`);
      if (day.date === TODAY) console.log(`           ${dose}`);
    }
  }

  const rows = sessionRowNames(workout);
  console.log(`\n══ ${TODAY} · ${AREA} ${constraint.severity}/10 (${BAND}) ═════════════════`);
  console.log(`session          : ${workout?.workoutType ?? '?'} — ${rows.length} rows`);
  rows.forEach((r, i) => console.log(
    `  ${String(i + 1).padStart(2)}. ${r.padEnd(34)} [${exerciseSessionFamily(r) ?? 'unplaced'}]`
    + `${injuryRequiresChange(r, environment) ? '   ← UNSAFE' : ''}`));

  const plan = planInjuryRecomposition({ workout, environment, primaryInjury });
  const review = buildSessionInjuryReview({ date: TODAY, constraint });
  console.log(`\n── WHAT THE ATHLETE IS SHOWN TODAY ──`);
  console.log(review.headline);
  for (const change of review.changes) {
    console.log(`  ${change.from} -> ${change.to ?? '(withheld)'}   [tier: ${change.tier ?? 'none'}]`);
    console.log(`      "${change.explanation}"`);
  }
  console.log(`  untouched: ${JSON.stringify(review.untouched)}`);
  console.log(`  untrained: ${JSON.stringify(review.untrainedInWords)}`);

  console.log(`\n── RUNG BY RUNG, FOR EVERY UNSAFE ROW ──`);
  const taken = rows.filter((n) => !plan.unsafeRows.includes(n));
  for (const row of plan.unsafeRows) {
    const section = exerciseSessionFamily(row);
    const { evaluations } = walkInjuryFallbackLadder({
      exercise: row,
      region: constraint.bucket as never,
      isLegal: (name: string) => assessTapSwapCandidateSafety(name, environment).safe,
      explainLegality: (name: string) => assessTapSwapCandidateSafety(name, environment).reason,
      avoidNames: taken,
    });
    console.log(`\n  ${row}  [${section ?? 'unplaced'}]`);
    for (const rung of INJURY_FALLBACK_RUNGS) {
      const atRung = evaluations.filter((e) => e.rung === rung.id);
      const accepted = atRung.filter((e) => !e.rejection)
        .map((e) => e.name)
        .filter((n) => !section || exerciseSessionFamily(n) === section);
      const mark = rung.rank <= 4 ? 'PER-EXERCISE' : 'session-level';
      console.log(`    rung ${rung.rank} ${rung.id.padEnd(30)} (${mark}) considered ${String(atRung.length).padStart(3)}  accepted-in-section ${accepted.length}`
        + (accepted.length ? `  -> ${accepted.slice(0, 6).join(', ')}` : ''));
    }
    const chosen = plan.substitutions.find((s) => s.from === row);
    console.log(`    CHOSEN: ${chosen ? `${chosen.to.name}  [tier ${chosen.to.hierarchyTier}]` : '(withheld)'}`);
  }

  // ── THE MENU A SESSION-LEVEL ADJUSTMENT WOULD CHOOSE FROM ────────────────
  const inTheWeek = new Set<string>();
  for (const day of week as any[]) {
    for (const r of (day.workout?.exercises ?? [])) {
      const nm = String(r.exercise?.name ?? r.name ?? '').trim().toLowerCase();
      if (nm) inTheWeek.add(nm);
    }
  }
  const { evaluations } = walkInjuryFallbackLadder({
    exercise: 'Back Squat',
    region: constraint.bucket as never,
    isLegal: (name: string) => assessTapSwapCandidateSafety(name, environment).safe,
    explainLegality: (name: string) => assessTapSwapCandidateSafety(name, environment).reason,
    avoidNames: [],
  });
  const pool = evaluations
    .filter((e) => e.rung === 'unaffected_body_area' && !e.rejection)
    .map((e) => e.name)
    .filter((n) => exerciseSessionFamily(n) === 'strength');
  const byPattern = new Map<string, { name: string; risk: string; inWeek: boolean }[]>();
  for (const name of pool) {
    const risk = String(classifyExerciseRiskForBucket(name, constraint.bucket as never));
    const pattern = String(finerPatternIdentityOf(name));
    byPattern.set(pattern, [...(byPattern.get(pattern) ?? []),
      { name, risk, inWeek: inTheWeek.has(name.toLowerCase()) }]);
  }
  console.log(`\n── RUNG-5 MENU (legal, in-section), BY PATTERN ──`);
  console.log(`   week already carries: ${JSON.stringify([...inTheWeek])}`);
  for (const [pattern, entries] of [...byPattern].sort()) {
    const good = entries.filter((e) => e.risk === 'good');
    const fresh = good.filter((e) => !e.inWeek);
    const dupes = good.filter((e) => e.inWeek).map((e) => e.name);
    console.log(`   ${pattern.padEnd(20)} good ${String(good.length).padStart(2)}  not-in-week ${String(fresh.length).padStart(2)}`
      + (dupes.length ? `  ALREADY IN WEEK: ${dupes.join(', ')}` : ''));
    if (fresh.length) console.log(`        ${fresh.slice(0, 8).map((e) => e.name).join(', ')}`);
    const nonGood = entries.filter((e) => e.risk !== 'good');
    if (nonGood.length) console.log(`        (non-good admitted by the gate: ${nonGood.map((e) => `${e.name}:${e.risk}`).slice(0, 6).join(', ')})`);
  }

  // ── R-124: WHAT THE SESSION-LEVEL BLOCK ACTUALLY CHOOSES ──────────────────
  const weekNames: string[] = [];
  for (const day of week as any[]) {
    for (const r of (day.workout?.exercises ?? [])) {
      const nm = String(r.exercise?.name ?? r.name ?? '').trim();
      if (nm) weekNames.push(nm);
    }
  }
  const kept = plan.untouched;
  const keptSets = (workout?.exercises ?? [])
    .filter((r: any) => kept.includes(String(r.exercise?.name ?? r.name ?? '').trim()))
    .reduce((n: number, r: any) => n + (r.prescribedSets ?? 0), 0);
  const adjustment = deriveInjurySessionAdjustment({
    workout,
    environment,
    profile: useProfileStore.getState().onboardingData,
    bodyPart: constraint.bodyPart,
    weekExerciseNames: weekNames,
    pausedRowNames: (plan as any).pausedRows,
  });
  const added = adjustment?.added ?? [];
  console.log(`\n── R-124 SESSION-LEVEL BLOCK ──`);
  console.log(`  paused (${(plan as any).pausedRows.length}): ${JSON.stringify((plan as any).pausedRows)}`);
  console.log(`  kept   (${kept.length}): ${JSON.stringify(kept)}  [${keptSets} sets]`);
  console.log(`  added  (${added.length}):`);
  for (const a of added) console.log(`      ${a.name.padEnd(24)} ${a.sets} x ${a.repsMin}-${a.repsMax}`
    + `${a.weightKg !== null ? ` @ ${a.weightKg}kg` : ''}${a.perSide ? ' per side' : ''}`
    + `${a.prescriptionType ? `  (${a.prescriptionType})` : ''}`);
  console.log(`  summary: "${adjustment?.summary ?? '(none)'}"`);

  // ── THE DOSE THE APP'S OWN ADD DOOR WOULD GIVE THESE, WITH THE INJURY LIVE ──
  console.log(`\n── ADD-DOOR DOSES (knee ${constraint.severity}/10 active) ──`);
  const addArgs: any = {
    date: TODAY, workoutType: workout?.workoutType ?? 'Strength',
    existingExerciseNames: rows,
    profile: useProfileStore.getState().onboardingData,
    environment,
  };
  for (const leaf of ['upper_pull', 'upper_push', 'upper_accessories', 'midline_carries'] as const) {
    const list = legalAddCandidates({ ...addArgs, leaf });
    console.log(`   ${leaf} (${list.length} legal)`);
    for (const c of list.slice(0, 40)) {
      console.log(`      ${String((c as any).name).padEnd(34)} ${JSON.stringify(c)}`);
    }
  }
}

main();


/* ── THE MENU THE SESSION-LEVEL ADJUSTMENT WOULD CHOOSE FROM ────────────────
 * Every rung-5 candidate that is legal, in-section, rated `good` (never merely
 * `caution`) for this bucket, and NOT already somewhere in this week — grouped
 * by the pattern it trains, so a proposal can be one coherent block instead of
 * five arbitrary rows. */
export function printSessionLevelMenu(): void {}
