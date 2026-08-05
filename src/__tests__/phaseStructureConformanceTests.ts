/**
 * A DERIVED WEEK CONFORMS TO ITS PHASE'S AUTHORED STRUCTURE — door-pass findings
 * 1a and 1b, ruled by Sam 2026-08-06 from existing law.
 *
 * Measured first, ruled second: see
 * `docs/R3_DOOR_PASS_FINDINGS_BIBLE_MEASUREMENT_2026-08-06.md`. This suite is
 * the conformance target, and every assertion below cites the Bible rather than
 * taste.
 *
 * ── 1a — THE CLUB FACT IS PHASE-SCOPED AT DERIVATION ───────────────────────
 *
 * Bible `:107` (Off-season, "How hard can the app push"): "very. **no team
 * training or games** means conditioning is controlled = no outside forces
 * actign on the athlete."
 * Bible `:108` (Off-season, "Ideal weekly structure") contains no team training
 * anywhere in it.
 * Bible `:1289` names a no-team-training week as "late off-season, the
 * Christmas break".
 *
 * Team training is a CLUB-SEASON fact. It is true while the club is training,
 * and the Bible's off-season is the part of the year when it is not.
 *
 * Sam's ruling, by north star: the stored answer is NEVER touched. Off-season
 * DERIVATION ignores it, so returning to Pre-season restores the club fact by
 * itself with no write, no migration and nothing to lose. That is the same
 * boundary `onboardingToCoachingInputs` already reasons at — "we union at the
 * engine-input boundary, NOT in `applyPhaseShift`… the stored profile keeps the
 * user's original preferences untouched".
 *
 * ── 1b — THE IN-SEASON WEEK MEETS ITS AUTHORED SHAPE ───────────────────────
 *
 * Bible `:81` names THREE ideal in-season weekly structures. All three carry
 * "optional flushout/ aerobic conditioning off-leg" on the strength days, and
 * all three end "sunday rest or recovery".
 *
 * NOT PAID — and the reason is now MEASURED rather than guessed. "Declare, then
 * place" was built as approved and it works: the week carries a visible, authored
 * "Short Flush" on its strength day, typed `optional_flush` so `:127`'s
 * arithmetic is untouched. It is held on `fix/1b-flush-offer` because a SECOND
 * planner (`fixtureMinimalReplan`) re-roles that flush to `required_core` when
 * the week is rebuilt, laundering the athlete's offer into required work. See
 * `docs/1B_FLUSH_OFFER_ARCHITECTURE_REASSESSMENT_2026-08-06.md` and its addendum.
 * Sam's ruling: `docs/FLUSH_OFFER_RULING_2026-08-05.md`.
 *
 * So cells 5 and 7 stay DECLARED RED. Cell 7 is new and pins the half of the
 * ruling that must not regress when 1b does land — the offer must never move the
 * core count.
 *
 * Only ONE of the two 1b cells was a conditioning defect. The empty Sunday was
 * not: the resolver already returns a TYPED rest day (`source`/`indicator` both
 * `rest`), which `:81`'s "rest **or** recovery" permits. That cell reddened
 * because its instrument read names, and a typed rest day has none. It is
 * re-scoped to a control, and what remains of it is a SURFACE question carried
 * to Sam as copy — never invented here.
 *
 * ── WHAT MUST NOT MOVE ─────────────────────────────────────────────────────
 *
 * Bible `:110`: "Weeks 1-2 (early off-season) are the OPTIONAL block —
 * everything optional, zero completed sessions is a valid honest week". The
 * measurement found every post-shift off-season session `optional` and that is
 * CORRECT. Cell 3 pins it so 1a's fix cannot quietly promote them.
 *
 * Run: npm run test:phase-structure
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const disk = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => { disk.set(key, value); },
    removeItem: (key: string) => { disk.delete(key); },
    clear: () => { disk.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — phase structure is derived on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import type { TrainingProgram, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { commitRebuiltProgram, rebuildLocalWeek } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { commitProfileProgramTransaction } from '../store/profileProgramTransaction';
import { isTeamTrainingSession } from '../utils/teamTraining';
import { projectConditioningVisibleIdentity } from '../utils/conditioningVisibleIdentity';
import { addDaysISO } from '../utils/programBlockState';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import {
  samDevicePass20260805Profile,
  SAM_PASS_20260805_TODAY_ISO,
  SAM_PASS_20260805_CURRENT_WEEK,
  SAM_PASS_20260805_ENTRY_WEEK,
  SAM_PASS_20260805_GENERATION_DAY,
  SAM_PASS_20260805_MARKED_DAYS,
} from './support/samDevicePass20260805Fixture';

const TODAY = SAM_PASS_20260805_TODAY_ISO;
const WEEK = SAM_PASS_20260805_CURRENT_WEEK;
/** A full future week — nothing pinned as history. */
const NEXT = addDaysISO(WEEK, 7);

/**
 * DECLARED-RED (the evening suite's mechanism): a declared red that STOPS
 * redding owes the deletion of its entry in the greening commit; an UNDECLARED
 * red fails outright. 1a and 1b are separate commits by Sam's ordering, and 1b
 * is not written yet — so its two cells are declared here and their entries are
 * deleted by the commit that pays them.
 */
interface DeclaredRed {
  readonly id: string;
  readonly matches: RegExp;
  readonly paidBy: string;
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [
  { id: '5', matches: /ZERO visible conditioning/, paidBy: 'finding 1b' },
  { id: '7', matches: /ZERO sessions as `optional_flush`/, paidBy: 'finding 1b' },
  { id: '8', matches: /session\(s\) typed `optional_flush`, not the single offer/, paidBy: 'ruling 1 + ruling 2' },
];

const declaredRedHits = new Set<string>();

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
    const message = error instanceof Error ? error.message : String(error);
    const declared = DECLARED_RED.find(
      (entry) => name.startsWith(entry.id) && entry.matches.test(message),
    );
    if (declared) {
      declaredRedHits.add(declared.id);
      passed += 1;
      console.log(`  RED (declared: ${declared.id}, paid by ${declared.paidBy}) ${name}`);
      console.log(`      ${message.split('\n')[0]}`);
      return;
    }
    failed += 1;
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

function reachWorldByActing(): void {
  disk.clear();
  resetStoresToFreshInstall('phase-structure');
  const profile = samDevicePass20260805Profile();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    weekAcceptance: 'forward_decision',
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
    reason: 'phase-structure:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

async function shiftTo(phase: 'Off-season' | 'Pre-season' | 'In-season'): Promise<void> {
  const stored = useProfileStore.getState().onboardingData;
  const result = await quietAsync(() => commitProfileProgramTransaction({
    change: {
      kind: 'profile_setup',
      patch: {
        seasonPhase: phase,
        ...(phase === 'In-season' ? { usualGameDay: 'Saturday', gameDay: 'Saturday' } : {}),
        preferredTrainingDays: stored.preferredTrainingDays,
        trainingDaysPerWeek: stored.trainingDaysPerWeek,
        teamTrainingDays: stored.teamTrainingDays,
        teamTrainingDaysPerWeek: stored.teamTrainingDaysPerWeek,
      },
    },
    todayISO: TODAY,
    sourceSurface: 'phase_shift',
  } as never)) as { ok: boolean; message?: string; reason?: string };
  assert(result.ok,
    `the shift to ${phase} refused: ${result.message ?? ''} (${result.reason ?? ''})`);
}

function week(target: string = NEXT): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(target, buildScheduleStateImperative()));
}

function shape(days: ResolvedDay[]): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map((day) => {
    const workout = (day as unknown as { workout?: Workout | null }).workout;
    return `${names[new Date(`${day.date}T12:00:00`).getDay()]} ${workout?.name ?? '—'}`;
  }).join(' | ');
}

function teamSessions(days: ResolvedDay[]): ResolvedDay[] {
  return days.filter((day) => {
    const workout = (day as unknown as { workout?: Workout | null }).workout;
    return !!workout && isTeamTrainingSession(workout);
  });
}

/** The §18 conditioning role the derived day actually carries, if any. */
function conditioningRoleOf(day: ResolvedDay): string | null {
  const workout = (day as unknown as { workout?: (Workout & {
    section18ConditioningRole?: string;
  }) | null }).workout;
  return workout?.section18ConditioningRole ?? null;
}

/** Every component on the day — the stacked parts, not just the headline. */
function componentsOf(day: ResolvedDay): string[] {
  const workout = (day as unknown as { workout?: Workout | null }).workout;
  const attached = (day as unknown as { attachedActivities?: { name?: string }[] })
    .attachedActivities ?? [];
  return [
    ...(workout?.name ? [workout.name] : []),
    ...attached.map((activity) => activity.name ?? '').filter(Boolean),
  ];
}

const main = async () => {
  console.log('\n-- A derived week conforms to its phase\'s authored structure --');

  // ══ 1a ══════════════════════════════════════════════════════════════════
  await run('1 off-season derives no team training (Bible :107, :108, :1289)', async () => {
    reachWorldByActing();
    const before = teamSessions(week());
    assert(before.length > 0,
      'the pre-season week this suite starts from has no team training at all, so the '
      + 'off-season assertion below would pass vacuously');
    await shiftTo('Off-season');
    const after = teamSessions(week());
    assert(after.length === 0,
      `off-season derived ${after.length} team-training session(s) — `
      + `${after.map((day) => day.date).join(', ')}. Bible :107: "no team training or games `
      + 'means conditioning is controlled = no outside forces actign on the athlete"; the '
      + `off-season ideal week (:108) contains none. Derived week: ${shape(week())}`);
  });

  await run('2 the stored club fact is untouched by the shift', async () => {
    reachWorldByActing();
    const stored = useProfileStore.getState().onboardingData;
    const days = [...(stored.teamTrainingDays ?? [])];
    const perWeek = stored.teamTrainingDaysPerWeek;
    assert(days.length > 0, 'the world has no stored team days to preserve');
    await shiftTo('Off-season');
    const after = useProfileStore.getState().onboardingData;
    assert(JSON.stringify(after.teamTrainingDays ?? []) === JSON.stringify(days)
      && after.teamTrainingDaysPerWeek === perWeek,
      'the off-season shift EDITED the athlete\'s stored club fact '
      + `(${JSON.stringify(days)} → ${JSON.stringify(after.teamTrainingDays)}). Sam's ruling `
      + 'is phase-scoping at DERIVATION, not clearing the answer: nothing stored is '
      + 'destroyed, so nothing has to be restored');
  });

  await run('3 returning to pre-season restores team training by itself', async () => {
    reachWorldByActing();
    const before = teamSessions(week()).map((day) => day.date).sort();
    await shiftTo('Off-season');
    assert(teamSessions(week()).length === 0, 'off-season still derives team training');
    await shiftTo('Pre-season');
    const restored = teamSessions(week()).map((day) => day.date).sort();
    assert(restored.length === before.length,
      `coming back to pre-season derived ${restored.length} team session(s), not the `
      + `${before.length} the athlete's club fact says. The answer was never edited, so it `
      + 'must come back on its own — that is the whole reason for scoping at derivation');
  });

  // ══ WHAT MUST NOT MOVE ══════════════════════════════════════════════════
  await run('4 early off-season stays all-optional (Bible :110)', async () => {
    reachWorldByActing();
    await shiftTo('Off-season');
    const days = week().filter((day) =>
      !!(day as unknown as { workout?: Workout | null }).workout);
    assert(days.length > 0, 'the off-season week derived no sessions at all');
    const compulsory = days.filter((day) => {
      const workout = (day as unknown as { workout?: Workout & { sessionTier?: string } }).workout;
      return workout?.sessionTier !== 'optional' && workout?.sessionTier !== 'recovery';
    });
    assert(compulsory.length === 0,
      `${compulsory.length} session(s) came back compulsory in weeks 1-2 of off-season `
      + `(${compulsory.map((day) => day.date).join(', ')}). Bible :110 — "Weeks 1-2 (early `
      + 'off-season) are the OPTIONAL block - everything optional, zero completed sessions '
      + 'is a valid honest week". This was CORRECT before 1a and must stay correct');
  });

  // ══ 1b ══════════════════════════════════════════════════════════════════
  /**
   * This cell used to look for a conditioning WORD in the day's headline name or
   * its attached activities. That instrument could not see the shape Bible :81
   * actually authors — "optional flushout/ aerobic conditioning off-leg" ON the
   * strength days — because a flush attached to a strength day is composed as a
   * PART inside the session (D13's composition model), and the day keeps its
   * strength headline. It reported zero correctly only because the week genuinely
   * had nothing.
   *
   * It now asks the app's own canonical owner of visible conditioning identity,
   * `projectConditioningVisibleIdentity` — the same projection the athlete's
   * screen reads. That is both stronger and narrower than the old regex, which
   * would have been satisfied by an ordinary "Barbell Row" on an upper-pull day.
   */
  await run('5 the in-season week carries its optional conditioning (Bible :81)', async () => {
    reachWorldByActing();
    await shiftTo('In-season');
    const days = week();
    const visible = days
      .map((day) => ({
        day,
        identity: projectConditioningVisibleIdentity(
          (day as unknown as { workout?: Workout | null }).workout),
      }))
      .filter((entry) => entry.identity !== null);
    assert(visible.length > 0,
      'the in-season week derived ZERO visible conditioning. All three of Bible :81\'s '
      + 'ideal structures carry "optional flushout/ aerobic conditioning off-leg" on the '
      + 'strength days, and :1242 — "In-season conditioning should support performance and '
      + `freshness". Derived week: ${shape(days)}`);
    const flush = visible.filter((entry) => entry.identity?.structureFamily === 'aerobic_flush');
    assert(flush.length > 0,
      'the in-season week derived visible conditioning, but none of it reads as the FLUSH '
      + `Bible :81 authors — got ${visible.map((entry) => entry.identity?.structureFamily).join(', ')}. `
      + `Derived week: ${shape(days)}`);
  });

  /**
   * RE-SCOPED 2026-08-06, approved by Sam, and the re-scope is a MEASUREMENT not
   * a concession. This cell used to demand a NAMED component on Sunday and was
   * declared red as a 1b conditioning defect. It is not one: the derived Sunday
   * already comes back `source: 'rest', indicator: 'rest'` — a TYPED rest day —
   * and Bible `:81` says "sunday rest **or** recovery", so the typed rest day is
   * conformant. The cell only ever reddened because `componentsOf` reads
   * `workout.name` plus attached activity names, and a typed rest day carries a
   * null workout and so contributes no NAME.
   *
   * So the derivation was right and the assertion was measuring the wrong thing.
   * What remains is a SURFACE question — whether the athlete sees words saying
   * the day is a rest day — which is a copy item, ships PROPOSED for Sam under
   * the copy law, and is not invented here. See the boundary report.
   *
   * As a control this cell now pins the thing 1b must not break: the flush
   * placement below must never consume Sunday or leave it untyped.
   */
  await run('6 the in-season week ends in a TYPED rest day, never an untyped gap (Bible :81)', async () => {
    reachWorldByActing();
    await shiftTo('In-season');
    const days = week();
    const sunday = days.find((day) => new Date(`${day.date}T12:00:00`).getDay() === 0);
    assert(sunday, 'the derived week has no Sunday at all');
    const typed = sunday as unknown as { source?: string; indicator?: string };
    assert(typed.source === 'rest' && typed.indicator === 'rest',
      `Sunday came back typed source=${typed.source ?? 'null'} indicator=`
      + `${typed.indicator ?? 'null'}, not the rest day Bible :81 ends on ("sunday rest or `
      + 'recovery") and :79 names ("the day after a game: rest or recovery day"). An UNTYPED '
      + 'gap and a typed rest day are not the same thing — only the typed day can be '
      + `rendered as a decision. Derived week: ${shape(days)}`);
  });

  await run('7 the offer never counts toward the in-season target (Bible :127, Sam 2026-08-05)', async () => {
    reachWorldByActing();
    await shiftTo('In-season');
    const days = week();
    const flush = days.filter((day) => conditioningRoleOf(day) === 'optional_flush');
    assert(flush.length > 0,
      'the in-season week typed ZERO sessions as `optional_flush`. Sam\'s ruling '
      + '(docs/FLUSH_OFFER_RULING_2026-08-05.md): "The optional flushout is a REQUIRED OFFER '
      + 'on every in-season week: the app always presents it; doing it is the athlete\'s '
      + `choice". Derived week: ${shape(days)}`);
    const appCore = days.filter((day) => {
      const role = conditioningRoleOf(day);
      return role === 'required_core' || role === 'planner_selected_core';
    });
    assert(appCore.length === 0,
      `the offer moved the :127 arithmetic — ${appCore.length} app session(s) came back typed `
      + `as CORE conditioning (${appCore.map((day) => day.date).join(', ')}). Measured before `
      + '1b, this week had zero: two team trainings plus the game already satisfy the '
      + 'in-season conditioning target, and Sam\'s ruling says the flush "does not count '
      + 'toward :127\'s in-season conditioning target arithmetic — TT + game still satisfy '
      + 'the target; the flush rides as the always-present optional". A flush that promoted '
      + `itself to core would be the ruling's other half broken. Derived week: ${shape(days)}`);
  });

  /**
   * RULING 2 (Sam, 2026-08-06, "2a" — `docs/1B_FLUSH_OFFER_RULINGS_2026-08-06.md`):
   * the flush is the PLANNER'S OFFER, not an athlete decision, so it does not
   * survive a fixture change. The week re-derives clean.
   *
   * Both halves are asserted here because they fail in opposite directions and
   * a suite that only checked one would pass on the other's bug:
   *
   *   while the fixture stands — the flush is placed AND STAYS typed
   *     `optional_flush`. This is the regression that held 1b: a second planner
   *     re-roled it to `required_core`, laundering the athlete's offer into
   *     required work.
   *   after the game is removed — no flush anywhere, and the week equals the
   *     measured no-1b baseline: Saturday carries the hard conditioning session
   *     the freed day should build.
   *
   * The baseline in the assertion is MEASURED in this world, not assumed: before
   * 1b, removing the game from this week yields `Sat Hard Conditioning`
   * (`required_core`, glycolytic) with every other day unchanged.
   */
  await run('8 the offer never re-roles, and never survives a fixture change (ruling 2)', async () => {
    reachWorldByActing();
    await shiftTo('In-season');
    const standing = week();
    const flush = standing.filter((day) => conditioningRoleOf(day) === 'optional_flush');
    assert(flush.length === 1,
      `while the fixture stands the week carries ${flush.length} session(s) typed `
      + '`optional_flush`, not the single offer the in-season policy declares. Roles: '
      + `${standing.map((day) => `${day.date}=${conditioningRoleOf(day) ?? '-'}`).join(' ')}`);

    const saturday = standing.find((day) => new Date(`${day.date}T12:00:00`).getDay() === 6);
    assert(saturday, 'the derived week has no Saturday to clear');
    quiet(() => rebuildLocalWeek({
      baseProfile: useProfileStore.getState().onboardingData,
      newGameDay: null,
      scope: 'weekOverlay',
      targetDate: saturday.date,
      manageCalendarFixture: true,
      todayISO: TODAY,
    } as never));

    const rebuilt = week();
    const survivors = rebuilt.filter((day) => conditioningRoleOf(day) === 'optional_flush');
    assert(survivors.length === 0,
      `the flush SURVIVED the fixture-change rebuild on ${survivors.map((day) => day.date).join(', ')}. `
      + 'Ruling 2: the flush is the planner\'s offer, not an athlete decision — the rebuilt '
      + `week re-derives clean and bye-build's authored min is 0. Rebuilt week: ${shape(rebuilt)}`);

    const freed = rebuilt.find((day) => day.date === saturday.date);
    const freedRole = freed ? conditioningRoleOf(freed) : null;
    assert(freedRole === 'required_core',
      `the freed Saturday came back role=${freedRole ?? 'null'}, not the required core `
      + 'conditioning the no-1b baseline builds there. Measured before 1b, removing this '
      + 'game yields Sat "Hard Conditioning" (required_core, glycolytic) — a flush that '
      + 'quietly satisfied the core floor is exactly how that session went missing. '
      + `Rebuilt week: ${shape(rebuilt)}`);
  });

  console.log(`\n  phase structure conformance totals: ${passed} passed, ${failed} failed`);

  const stale = DECLARED_RED.filter((entry) => !declaredRedHits.has(entry.id));
  if (stale.length > 0) {
    console.error(`DECLARED RED NO LONGER REDS — delete the entry:\n  ${
      stale.map((entry) => `${entry.id} (paid by ${entry.paidBy})`).join('\n  ')}`);
    totalsPrinted(failed + stale.length);
    process.exit(1);
  }

  totalsPrinted(failed);
  if (failed > 0) {
    console.log('\n  FAILURES');
    for (const failure of failures) console.log(`   - ${failure}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('phase structure conformance suite crashed', error);
  process.exit(1);
});
