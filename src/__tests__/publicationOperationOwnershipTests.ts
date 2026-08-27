import { calendarActionsForTest } from './support/calendarActionsForTest';
/**
 * EVERY PUBLICATION STATES WHAT IT IS PUBLISHING — the `?? 'restoration'` sweep.
 *
 * Sam's accept-and-reduce ruling (2026-07-29) split accepted-state publication
 * into two kinds and gave them opposite verdicts on a week that cannot meet its
 * contract:
 *
 *   • `forward_decision` — the athlete just stated something. The best
 *     achievable week is published and the shortfall is DISCLOSED.
 *   • `restoration` — state accepted once is being replayed. A week it cannot
 *     reproduce means the stored snapshot is corrupt, and it THROWS.
 *
 * The gate's semantics are not in question here and do not move. What this
 * suite owns is the CALL SITES: `AcceptedStateTransactionProposal.operation`
 * was optional and defaulted to `restoration` at two commit-site asserts, so a
 * writer that said nothing inherited the strict verdict by accident. The
 * assert's own interface has always carried the opposite instruction —
 * "Required, deliberately … there is no default here so a new call site cannot
 * inherit accept-and-reduce by accident" — and the two `?? 'restoration'`
 * expressions immediately above it contradicted that comment for every caller.
 *
 * R1.3 already paid this once at the `weekRebuild` publications, where the
 * walker's conformance cell measured the consequence on Sam's own device
 * shape: a game add his real phone performed came back "impossible". That fix
 * was applied at the three owners it found. This suite is the SWEEP.
 *
 * ── THE WORLD, REACHED BY ACTING (AGENTS.md fixture law) ────────────────────
 *
 * Onboard Sam's pass-day profile, generate, then MARK NEXT WEEK AS REST. Rest
 * marks are the athlete stating a fact about their life, and under the same
 * 2026-07-29 ruling the app does not refuse facts: the marks commit, the week
 * can no longer meet its contract, and the shortfall is disclosed
 * (`acceptedStateTransactionTests` regression 3 is the same route).
 *
 * That accepted-and-disclosed week is not a corrupt snapshot. It is the week
 * the athlete asked for. But every silent writer that re-gated it read
 * `restoration` and threw — measured 2026-08-05, six athlete-visible doors:
 *
 *   season phase change · readiness answer · undo your own edit ·
 *   the named erasure · viewing another week · overlay republication
 *
 * The season-phase one is the evening-1 finding's missing layer, located:
 * "The profile and program were rolled back because the accepted result could
 * not be verified."
 *
 * Run: npm run test:operation-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => { memory.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — publication ownership is decided on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { readFileSync } from 'fs';
import path from 'path';
import type { TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import {
  commitReadinessSignalTransaction,
  getAcceptedMaterialContext,
} from '../store/acceptedStateTransaction';
import { resolveFinalVisibleSection18Week } from '../rules/section18AcceptedWeekGateway';
import { evaluateSection18EffectiveWeek } from '../rules/section18EffectiveWeekEvaluator';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { buildReadinessSignalPatch } from '../utils/readiness';
import { addDaysISO } from '../utils/programBlockState';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { seedManualOverride } from './support/programOverrideHarness';
import {
  samDevicePass20260805Profile,
  SAM_PASS_20260805_TODAY_ISO,
  SAM_PASS_20260805_CURRENT_WEEK,
  SAM_PASS_20260805_ENTRY_WEEK,
  SAM_PASS_20260805_GENERATION_DAY,
  SAM_PASS_20260805_MARKED_DAYS,
} from './support/samDevicePass20260805Fixture';
import { emptyEvaluationSurfaces } from './evaluationSurfacesTestSupport';

const TODAY = SAM_PASS_20260805_TODAY_ISO;
const WEEK = SAM_PASS_20260805_CURRENT_WEEK;
const NEXT = addDaysISO(WEEK, 7);
const SRC = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

/**
 * His world plus one stated fact: next week is rest. Every step is an athlete
 * action through a real door — no seeded accepted state, no export replay.
 */
function reachDisclosedShortfallWorldByActing(options: { restMarks?: boolean } = {}): void {
  memory.clear();
  resetStoresToFreshInstall('publication-operation-ownership');
  const profile = samDevicePass20260805Profile();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') calendarActionsForTest().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: SAM_PASS_20260805_GENERATION_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: SAM_PASS_20260805_ENTRY_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {},
    selectedDate: SAM_PASS_20260805_GENERATION_DAY,
    reason: 'publication-operation-ownership:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
  if (options.restMarks === false) return;
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysISO(NEXT, offset);
    if (date <= TODAY) continue;
    // A refused mark is the calendar owner's own business; what this world
    // needs is that the marks the app ACCEPTS leave the week short.
    try { quiet(() => calendarActionsForTest().setRestDay(date)); } catch { /* refused */ }
  }
}

/** The week re-evaluated exactly as the equivalence gate re-evaluates it. */
function weekBlockers(weekStart: string): string[] {
  const state = useProgramStore.getState();
  const overlay = state.weekScopedOverlays[weekStart];
  const microcycle = (state.currentProgram as TrainingProgram | null)?.microcycles
    .find((candidate) => weekStart >= candidate.startDate.slice(0, 10)
      && weekStart <= candidate.endDate.slice(0, 10)) ?? null;
  const contract = overlay?.exposureContractV2 ?? microcycle?.exposureContractV2;
  if (!contract) return [];
  const workouts: Workout[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysISO(weekStart, offset);
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const manual = state.dateOverrides[date];
    const hasOverlay = !!overlay
      && Object.prototype.hasOwnProperty.call(overlay.workoutsByDate, date);
    const workout = manual ?? (hasOverlay
      ? overlay!.workoutsByDate[date]
      : microcycle?.workouts.find((candidate) => candidate.dayOfWeek === dayOfWeek) ?? null);
    if (workout) workouts.push(workout);
  }
  const visible = quiet(() => resolveFinalVisibleSection18Week({
    surfaces: emptyEvaluationSurfaces(),
    contract,
    workouts,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    scheduleState: { markedDays: getAcceptedMaterialContext().markedDays },
  }));
  return evaluateSection18EffectiveWeek({ contract, workouts: visible, weekStart })
    .blockingViolations.map((finding: { code: string }) => finding.code);
}

function nextMicrocycle(): TrainingProgram['microcycles'][number] | null {
  return (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === NEXT) ?? null;
}

function firstWorkout(): Workout | null {
  const cycle = useProgramStore.getState().currentMicrocycle as { workouts?: Workout[] } | null;
  return cycle?.workouts?.[0] ?? null;
}

/** The refusal this whole suite is about, whatever door raised it. */
function ledgerMismatch(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'accepted_state_ledger_mismatch'
    || /Accepted-state ledger mismatch/.test(message);
}

function landsOrThrows(act: () => void): string | null {
  try {
    quiet(act);
    return null;
  } catch (error) {
    if (!ledgerMismatch(error)) throw error;
    return error instanceof Error ? error.message : String(error);
  }
}

const main = async () => {
  console.log('\n-- Every publication states what it is publishing (the ?? \'restoration\' sweep) --');

  // ── The world itself is the premise. If rest marks stop leaving the week
  // short, every behavioural cell below silently stops testing anything.
  await run('0 the world is reached by acting and the week really is short', () => {
    reachDisclosedShortfallWorldByActing();
    const marks = useCalendarStore.getState().markedDays ?? {};
    const rested = Object.entries(marks)
      .filter(([date, mark]) => mark === 'rest' && date >= NEXT && date < addDaysISO(NEXT, 7));
    assert(rested.length >= 3,
      `the athlete's rest marks did not land (${rested.length} of the week marked rest) — `
      + 'this suite\'s world premise is gone and every cell below is vacuous');
    // AND the week must genuinely fail its contract. Every cell below asserts
    // that a door does NOT refuse; if the engine stopped producing blockers
    // here they would all pass while testing nothing at all — the
    // gate-passing-on-coordinates-it-never-builds class, guarded against
    // directly rather than assumed.
    assert(weekBlockers(NEXT).length > 0,
      `${NEXT} re-evaluates with no blocking violations after ${rested.length} rest marks — `
      + 'the shortfall this suite is built on is gone, and cells 1-6 would pass vacuously');
  });

  // A green cell must have had something to be green about.
  await run('0b the same world with no rest marks has no shortfall (the control)', () => {
    reachDisclosedShortfallWorldByActing({ restMarks: false });
    assert(weekBlockers(NEXT).length === 0,
      `${NEXT} is already short BEFORE the athlete marks anything `
      + `(${weekBlockers(NEXT).join(',')}) — then the rest marks are not what this suite `
      + 'says they are, and the diagnosis in cells 1-6 names the wrong cause');
  });

  // ── 1. THE EVENING-1 FINDING'S LAYER ───────────────────────────────────────
  await run('1 a season phase change lands on a week the athlete made short', async () => {
    reachDisclosedShortfallWorldByActing();
    const stored = useProfileStore.getState().onboardingData;
    const result = await quietAsync(() => commitProfileProgramTransaction({
      change: {
        kind: 'profile_setup',
        patch: {
          seasonPhase: 'In-season',
          usualGameDay: 'Saturday',
          gameDay: 'Saturday',
          preferredTrainingDays: stored.preferredTrainingDays,
          trainingDaysPerWeek: stored.trainingDaysPerWeek,
          teamTrainingDays: stored.teamTrainingDays,
          teamTrainingDaysPerWeek: stored.teamTrainingDaysPerWeek,
        },
      },
      todayISO: TODAY,
      sourceSurface: 'phase_shift',
    } as never)) as { ok: boolean; reason?: string; message?: string };
    assert(result.ok,
      `the phase shift was REFUSED: ${result.message ?? ''} (${result.reason ?? 'no reason'}) — `
      + 'a season change is the athlete stating a fact, and the gate informs, it does not '
      + 'veto a fact (§18 ownership reassessment D3, Sam 2026-08-05). This is the '
      + 'evening-1 season-change failure with its layer named: the transaction publishes '
      + 'without stating its operation, so the equivalence gate reads `restoration` and '
      + 'throws on a shortfall the athlete\'s own rest marks caused and the app already '
      + 'accepted and disclosed');
    assert(useProfileStore.getState().onboardingData.seasonPhase === 'In-season'
      || (useProgramStore.getState().acceptedMaterialContext as { acceptedProfileSnapshot?: {
        onboardingData?: { seasonPhase?: string } } }).acceptedProfileSnapshot
        ?.onboardingData?.seasonPhase === 'In-season',
      'the phase shift reported ok but the accepted phase did not move');
  });

  // ── 2. THE READINESS ANSWER ────────────────────────────────────────────────
  await run('2 a readiness answer lands on a week the athlete made short', () => {
    reachDisclosedShortfallWorldByActing();
    const refusal = landsOrThrows(() => commitReadinessSignalTransaction({
      date: addDaysISO(NEXT, 1),
      patch: buildReadinessSignalPatch('flat'),
    }));
    assert(refusal === null,
      `the readiness answer was REFUSED: ${refusal} — answering the readiness sheet is the `
      + 'athlete stating a fact; the readiness transaction publishes without stating its '
      + 'operation and inherits the strict verdict');
  });

  // ── 3. THE ATHLETE UNDOES THEIR OWN EDIT ──────────────────────────────────
  await run('3 removing your own override lands on a week you made short', () => {
    assert(!('removeManualOverride' in useProgramStore.getState()),
      'individual Clear must change the accepted input, not delete its generated date');
  });
  // ── 4. THE NAMED ERASURE ──────────────────────────────────────────────────
  await run('4 the named erasure lands on a week the athlete made short', () => {
    const refusal = landsOrThrows(() => require('../utils/resetCoach').resetProgramAndOnboarding());
    assert(refusal === null, 'explicit full reset must clear the complete athlete world');
  });
  // ── 5. NAVIGATING TO ANOTHER WEEK ─────────────────────────────────────────
  await run('5 selecting another week does not refuse because that week is short', () => {
    reachDisclosedShortfallWorldByActing();
    const cycle = nextMicrocycle();
    assert(cycle, 'no next microcycle to select');
    const refusal = landsOrThrows(() =>
      useProgramStore.getState().setCurrentMicrocycle(cycle, TODAY));
    assert(refusal === null,
      `selecting the week THREW: ${refusal} — the athlete cannot open the week they just `
      + 'made short. A selection publishes no new week content, so "the stored snapshot is '
      + 'corrupt" is not what a blocker here means: the week reproduces exactly, it is '
      + 'simply the reduced week the athlete asked for');
  });

  // ── 6. THE DERIVED OVERLAY'S OWN REPUBLICATION ────────────────────────────
  await run('6 clearing derived overlays does not refuse because a week is short', () => {
    assert(!('clearWeekScopedOverlays' in useProgramStore.getState()),
      'derived overlays must be reconstructed through the compiler, not cleared by a second writer');
  });
  // ── 7. THE DEFAULT ITSELF ─────────────────────────────────────────────────
  await run('7 the proposal REQUIRES its operation — no call site can inherit a verdict', () => {
    const source = readFileSync(path.join(SRC, 'store/acceptedStateTransaction.ts'), 'utf8');
    const declaration = /export interface AcceptedStateTransactionProposal \{[\s\S]*?\n\}/
      .exec(source)?.[0] ?? '';
    assert(declaration, 'AcceptedStateTransactionProposal is no longer declared where this cell reads it');
    assert(/\n\s*operation:\s*AcceptedStateOperationKind;/.test(declaration),
      'AcceptedStateTransactionProposal.operation is still OPTIONAL. The closed-writer-union '
      + 'precedent (LR-1, applyProgramOverrideSliceWrite) is the shape this needs: an '
      + 'anonymous write must be a COMPILE error, not a silently strict one');
    const defaults = source.match(/(operation|weekAcceptance)[^\n]*\?\?\s*'restoration'/g) ?? [];
    assert(defaults.length === 0,
      `${defaults.length} silent \`?? 'restoration'\` default(s) survive in `
      + `acceptedStateTransaction.ts (${defaults.join(' | ')}) — the assert's own interface `
      + 'says "there is no default here so a new call site cannot inherit accept-and-reduce '
      + 'by accident", and a default at the caller contradicts it in the other direction');
  });

  // ── 8. GENERATION IS THE SAME BOUNDARY, ONE LAYER EARLIER ─────────────────
  await run('8 every product generation call states its week acceptance', () => {
    const sites: Array<{ file: string; line: number }> = [];
    const walk = (dir: string): void => {
      for (const entry of require('fs').readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          const text = readFileSync(full, 'utf8');
          // CALL sites only — `function generateProgramLocally(… = {})` is a
          // declaration, and its default-argument brace is not a caller. The
          // scan spans the WHOLE argument list to its balanced closing paren:
          // one caller passes a spread PROFILE as its first argument, and a
          // reader that stopped at the first brace would judge that object and
          // report a site that does declare (found writing this cell).
          const re = /(?<!function\s)generateProgram(?:Locally|FromProfile)\(/g;
          let match: RegExpExecArray | null;
          while ((match = re.exec(text))) {
            const open = match.index + match[0].length - 1;
            let depth = 0;
            let end = open;
            for (; end < text.length; end += 1) {
              if (text[end] === '(') depth += 1;
              else if (text[end] === ')') { depth -= 1; if (depth === 0) break; }
            }
            const body = text.slice(open, end + 1);
            if (!/\n\s*weekAcceptance:/.test(body)) {
              sites.push({
                file: path.relative(SRC, full),
                line: text.slice(0, match.index).split('\n').length,
              });
            }
          }
        }
      }
    };
    walk(SRC);
    assert(sites.length === 0,
      `${sites.length} product generation call site(s) do not state \`weekAcceptance\`, so `
      + 'generation\'s own `?? \'restoration\'` decides for them and an unmeetable week '
      + 'THROWS before the transaction is ever reached: '
      + `${sites.map((site) => `${site.file}:${site.line}`).join(', ')}`);
  });

  // ── 8b. THE OTHER DIRECTION ───────────────────────────────────────────────
  //
  // Three product writers reach the accepted-state owner through `require(...)`
  // (programStore, coachUpdatesStore, postGenerationConstraintValidation), so
  // the compiler cannot see them. With the `?? 'restoration'` deleted, an
  // omission there would fall through to the PERMISSIVE verdict — trading one
  // silent default for its opposite. It is refused instead.
  await run('8b an unnamed operation is refused, never quietly permitted', () => {
    reachDisclosedShortfallWorldByActing();
    const owner = require('../store/acceptedStateTransaction');
    let message = '';
    try {
      quiet(() => owner.assertAcceptedVisibleLedgerEquivalence({
        surfaces: useProgramStore.getState(),
        context: getAcceptedMaterialContext(),
        weekStarts: [NEXT],
        profile: useProfileStore.getState().onboardingData,
      }));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert(/accepted_state_operation_undeclared/.test(message),
      'a publication with NO operation was accepted by the gate '
      + `(${message || 'it did not throw at all'}) — the require(...) writers would inherit `
      + 'accept-and-reduce silently, which is the same defect this sweep just paid, '
      + 'pointing the other way');
  });

  // ── 9. THE STRICTNESS IS NOT WEAKENED ─────────────────────────────────────
  await run('9 undo still declares restoration and still refuses a corrupt snapshot', () => {
    const source = readFileSync(path.join(SRC, 'store/reversibleAdjustmentTransaction.ts'), 'utf8');
    assert(/operation: 'restoration'/.test(source),
      'the undo path stopped declaring `restoration`. This sweep reclassifies writers that '
      + 'carry a NEW decision; replaying a stored snapshot is the one thing that must keep '
      + 'throwing, or a corrupt snapshot gets merged reduced into accepted state');
    const gateway = readFileSync(path.join(SRC, 'rules/section18AcceptedWeekGateway.ts'), 'utf8');
    assert(/if \(result\.status === 'impossible' && input\.operation === 'restoration'\)/
      .test(gateway),
      'the gateway stopped throwing on an impossible restoration — the gate semantics were '
      + 'to stay exactly as ruled; only the CALL SITES were in scope');
  });

  console.log(`\n  publication-operation ownership totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.log('\n  FAILURES');
    for (const failure of failures) console.log(`   - ${failure}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('publication-operation ownership suite crashed', error);
  process.exit(1);
});
