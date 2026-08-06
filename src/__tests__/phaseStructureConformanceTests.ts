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
 * PAID 2026-08-06. "Declare, then place" gives the week a visible, authored
 * "Short Flush" on its strength day, typed `optional_flush` so `:127`'s
 * arithmetic is untouched. It was held because a SECOND planner
 * (`fixtureMinimalReplan`) re-roled that flush to `required_core` when the week
 * was rebuilt, laundering the athlete's offer into required work — so it landed
 * on top of Sam's two rulings rather than alone:
 *
 *   ruling 1 — ONE OWNER derives the §18 conditioning role from the contract
 *     plus the week (`section18EffectiveWeekEvaluator`). Every other writer
 *     stops deciding it.
 *   ruling 2 — the offer does not survive a fixture change. The rebuilt week
 *     re-derives clean.
 *
 * They are interdependent and could not land apart: with the flush content
 * surviving, it is earlier in training order and takes the core slot ruling 1
 * gives, so the freed day loses the hard session it should build — the same
 * defect inverted. See `docs/1B_ONE_OWNER_DERIVATION_DESIGN_2026-08-06.md`,
 * `docs/1B_FLUSH_OFFER_RULINGS_2026-08-06.md` and
 * `docs/FLUSH_OFFER_RULING_2026-08-05.md`.
 *
 * Cell 7 pins the half of the ruling that must not regress — the offer must
 * never move the core count. Cell 8 pins both directions of ruling 2.
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
import { createOrUpdateInjuryEpisode } from '../store/injuryEpisodeTransaction';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
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
 * red fails outright.
 *
 * 1b's three entries (cells 5, 7 and 8) were deleted here on 2026-08-06 by the
 * commit that paid them — Sam's rulings 1 and 2, built as one move. The
 * mechanism stays armed: it is what makes the next declared red pay for itself
 * too.
 *
 * Cell 10's entry was deleted on 2026-08-06 by the commit that paid it, and the
 * list is EMPTY again. It took three commits and two layers: the rule change
 * was built and reverted first because it was not sufficient alone
 * (`docs/FINDING_3_BUILD_MEASUREMENT_2026-08-06.md` — with the rule changed a
 * PLACEMENT owner spread the identical demand over six working days instead of
 * five and §18 refused the week), and the placement owner was reassessed before
 * being touched, per CLAUDE.md's escalation rule
 * (`docs/FINDING_3_PLACEMENT_REASSESSMENT_2026-08-06.md`). The declaration
 * outliving one commit is the mechanism working, not the mechanism failing.
 *
 * An EMPTY list is the healthy state. The staleness check below is what keeps it
 * honest: a declared red that stops redding fails the suite until its entry
 * goes, so no entry can quietly outlive the defect it describes.
 */
interface DeclaredRed {
  readonly id: string;
  readonly matches: RegExp;
  readonly paidBy: string;
}

const DECLARED_RED: ReadonlyArray<DeclaredRed> = [];

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

/**
 * The week as the APP'S OWN OWNER reads it — never a contract and a week
 * assembled by hand. The contract stored on the microcycle predates any injury
 * recorded after generation, and pairing it with the resolved week reports
 * three phantom blocking violations and an empty `prohibitedPatterns`
 * (FINDING_3_SUBSTITUTE_BEFORE_REDUCE_2026-08-06.md, "a trap worth
 * recording"). `rebaseAcceptedEffectiveWeek` rebases the contract first.
 */
function acceptedWeek(target: string = NEXT): {
  contract: {
    strengthPatterns: { prohibitedPatterns: string[]; requiredSafePatterns: string[] };
    authorisedReductions: { metric: string; reducedTarget: number; reason: string }[];
  };
  evaluation: {
    blockingViolations: unknown[];
    ledger: { mainStrength: { achievedCount: number } };
  };
} {
  return quiet(() => rebaseAcceptedEffectiveWeek({
    surfaces: useProgramStore.getState(),
    weekStart: target,
    profile: useProfileStore.getState().onboardingData,
    markedDays: useProgramStore.getState().acceptedMaterialContext.markedDays,
  } as never)) as never;
}

/** Record an injury through the guided door the athlete actually uses. */
async function recordInjury(args: {
  id: string;
  bodyPart: string;
  bucket: string;
  severity: number;
  rules: string[];
}): Promise<void> {
  await quietAsync(() => createOrUpdateInjuryEpisode({
    constraint: {
      id: args.id,
      type: 'injury',
      bodyPart: args.bodyPart,
      bucket: args.bucket,
      severity: args.severity,
      status: 'active',
      startDate: TODAY,
      lastUpdatedAt: `${TODAY}T09:00:00.000Z`,
      source: 'guided_injury_flow',
      rules: args.rules,
      safeFocus: ['Pain-free work for unaffected regions'],
      advice: [],
      modifierAffects: ['current_week', 'future_generation'],
      presentationOnlyDismiss: true,
    },
    sourceActor: 'athlete',
    sourceSurface: 'guided_injury_flow',
    todayISO: TODAY,
  } as never));
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

  /**
   * THE OTHER FACE OF RULING 2, and the one no suite could see until the offer
   * became repairable (Sam, 2026-08-06 —
   * `docs/1B_OFFER_SURVIVAL_RULINGS_2026-08-06.md`).
   *
   * Cell 8 removes the game, so the rebuilt week is a BYE build whose authored
   * `optionalFlush.min` is 0 — it correctly comes back with no offer, and a
   * week that simply stops offering looks identical to one that was never meant
   * to. MOVING the fixture is the case that tells them apart: the week is still
   * a game week, its policy still declares an offer, and ruling 2 clears the
   * old one. If nothing re-presents it, the athlete loses the flush Bible `:81`
   * authors for every remaining game week — silently, because it is optional.
   *
   * "The app always presents it" is a property of the WEEK at all times, not of
   * the moment it was generated. This is that sentence as a test.
   */
  await run('9 moving the fixture leaves the week still offering (Sam 2026-08-06)', async () => {
    reachWorldByActing();
    await shiftTo('In-season');
    const standing = week();
    assert(standing.filter((day) => conditioningRoleOf(day) === 'optional_flush').length === 1,
      'the standing week does not carry its single offer, so a move cannot be shown to '
      + `preserve one. Roles: ${standing.map((day) => `${day.date}=${conditioningRoleOf(day) ?? '-'}`).join(' ')}`);
    const saturday = standing.find((day) => new Date(`${day.date}T12:00:00`).getDay() === 6);
    assert(saturday, 'the derived week has no Saturday fixture to move');
    const friday = standing.find((day) => new Date(`${day.date}T12:00:00`).getDay() === 5);
    assert(friday, 'the derived week has no Friday to move the fixture to');

    quiet(() => rebuildLocalWeek({
      baseProfile: useProfileStore.getState().onboardingData,
      newGameDay: 'Friday',
      scope: 'weekOverlay',
      targetDate: friday.date,
      clearOverlayDate: saturday.date,
      manageCalendarFixture: true,
      todayISO: TODAY,
    } as never));

    const moved = week();
    const stillAGameWeek = moved.some((day) => {
      const workout = (day as unknown as { workout?: Workout | null }).workout;
      return workout?.workoutType === 'Game';
    });
    assert(stillAGameWeek,
      `the move left the week with no fixture at all, so it is no longer the case this `
      + `cell is about. Week: ${shape(moved)}`);
    const offers = moved.filter((day) => conditioningRoleOf(day) === 'optional_flush');
    assert(offers.length === 1,
      `after moving the fixture the week presents ${offers.length} offer(s), not the one its `
      + 'policy still declares. Sam 2026-08-05: "the app always presents it; doing it is the '
      + 'athlete\'s choice" — ruled 2026-08-06 to be a property of the week at all times, not '
      + `of the moment it was generated. Week: ${shape(moved)} roles: `
      + `${moved.map((day) => `${day.date}=${conditioningRoleOf(day) ?? '-'}`).join(' ')}`);
  });

  /**
   * FINDING 3 — THE INJURY PATH REDUCES WHERE THE BIBLE SAYS SUBSTITUTE.
   *
   * DECLARED RED. Measured, root-caused and specified in
   * `docs/FINDING_3_SUBSTITUTE_BEFORE_REDUCE_2026-08-06.md`; not built, because
   * the fix is one expression and validating it is a unit of its own (every
   * injured week gains sessions, which moves both generation goldens).
   *
   * Bible `:4755` "Substitute before reducing frequency"; `:4688`'s repair
   * order puts the typed reduction LAST, after relocate and substitute; `:72`
   * and `:93` "continue to do work on unaffected areas… get as much work as you
   * can in around the injury"; `:1917` "Keep unaffected work in where possible."
   *
   * `section18SafetyPolicy` caps `main_strength_frequency` at
   * `requiredSafe.length` — the number of surviving PATTERNS. Prohibit squat
   * and hinge and the week may hold at most two strength sessions, not because
   * two is all the athlete can safely do but because two patterns remain.
   * Pattern count constrains VARIETY; frequency is a different quantity.
   *
   * The cell asserts what the Bible asks for and NOT the mechanism, so it stays
   * true whichever way Sam rules the fix: the week keeps its sessions, and no
   * day is emptied. It deliberately also pins what must NOT move — squat and
   * hinge stay prohibited, and the week stays §18-conformant — so a "fix" that
   * simply stopped restricting the injured patterns would fail here rather than
   * pass.
   */
  await run('10 an injury keeps unaffected work rather than reducing frequency (Bible :4755, :72, :93)', async () => {
    reachWorldByActing();
    const before = week();
    const beforeSessions = before.filter((day) =>
      !!(day as unknown as { workout?: Workout | null }).workout).length;
    assert(beforeSessions > 0, 'the uninjured week derived no sessions at all');
    const beforeStrength = acceptedWeek().evaluation.ledger.mainStrength.achievedCount;
    assert(beforeStrength > 0,
      'the uninjured week carries no main strength at all, so the frequency assertion '
      + 'below would pass vacuously');

    await recordInjury({
      id: 'injury-hamstring-phase-structure',
      bodyPart: 'hamstring',
      bucket: 'hamstring',
      severity: 6,
      rules: ['No sprinting or high-speed running', 'No heavy hinge work'],
    });

    const after = week();
    const accepted = acceptedWeek();

    // WHAT MUST NOT MOVE — the injury is still doing its job.
    const prohibited = accepted.contract.strengthPatterns.prohibitedPatterns;
    assert(prohibited.includes('squat') && prohibited.includes('hinge'),
      'the hamstring injury no longer prohibits squat and hinge, so this cell would pass '
      + `by not restricting the athlete at all. Prohibited: ${JSON.stringify(prohibited)}`);
    assert(accepted.evaluation.blockingViolations.length === 0,
      `the injured week carries ${accepted.evaluation.blockingViolations.length} blocking `
      + 'violation(s) — keeping the work must not come at the cost of a week §18 refuses');

    const afterSessions = after.filter((day) =>
      !!(day as unknown as { workout?: Workout | null }).workout).length;
    assert(afterSessions >= beforeSessions,
      `the injured week lost a session (${beforeSessions} → ${afterSessions}). Bible :4755 — `
      + '"Substitute before reducing frequency"; :72 — "continue to do work on unaffected '
      + 'areas"; :93 — "get as much work as you can in around the injury". The frequency was '
      + 'reduced to the number of surviving PATTERNS instead, which is a constraint on '
      + `variety, not on how often the athlete may train. Injured week: ${shape(after)}`);

    // THE RULING ITSELF, and not merely "a day still has something on it".
    //
    // The session-count assertion above passes with the frequency cap still in
    // place at the Contract v2 policy — the capped days keep a workout, they
    // just stop carrying main strength. Measured by mutation on 2026-08-06:
    // reverting that site alone left this cell green. Frequency is what the
    // ruling holds, so frequency is what the cell states.
    const afterStrength = accepted.evaluation.ledger.mainStrength.achievedCount;
    assert(afterStrength >= beforeStrength,
      `the injured week lost main-strength FREQUENCY (${beforeStrength} → ${afterStrength} `
      + 'sessions) while push and pull were both still safe. Ruled 2026-08-06 '
      + '(docs/FINDING_3_RULING_2026-08-06.md) on Bible :4755: a restricted week HOLDS its '
      + 'selected strength frequency and fills the freed days with safe work; the frequency '
      + `falls only when NO safe pattern remains. Safe patterns here: ${
        JSON.stringify(accepted.contract.strengthPatterns.requiredSafePatterns)}. Injured `
      + `week: ${shape(after)}`);
  });

  /**
   * THE OTHER SIDE OF THE SAME RULING — where reducing frequency IS correct.
   *
   * `:1913` 8-10/10: "pause affected training entirely; rest/recovery or
   * clearly unaffected work only". With every main pattern restricted there is
   * no safe substitution left to make, so the frequency reduction is the
   * honest answer rather than an evasion of one — and it must not regress when
   * the 6/10 cap above is removed.
   *
   * This cell is why the fix is `requiredSafe.length === 0` and not a deletion.
   */
  await run('11 a whole-body restriction still reduces the frequency (Bible :1913, ruled 2026-08-06)', async () => {
    reachWorldByActing();
    const beforeStrength = acceptedWeek().evaluation.ledger.mainStrength.achievedCount;
    assert(beforeStrength > 0, 'the uninjured week carries no main strength at all');

    // Two areas at the pause band leave no main pattern safe: a lower-body
    // restriction takes squat and hinge, and an upper-body one at 8-10/10
    // takes push AND pull (`resolveRestrictedMainStrengthPatterns`).
    await recordInjury({
      id: 'injury-hamstring-wholebody-phase-structure',
      bodyPart: 'hamstring',
      bucket: 'hamstring',
      severity: 9,
      rules: ['No sprinting or high-speed running', 'No hinge work'],
    });
    await recordInjury({
      id: 'injury-shoulder-wholebody-phase-structure',
      bodyPart: 'shoulder',
      bucket: 'shoulder',
      severity: 9,
      rules: ['No pressing', 'No pulling'],
    });

    const accepted = acceptedWeek();
    const patterns = accepted.contract.strengthPatterns;
    assert(patterns.requiredSafePatterns.length === 0,
      'this cell needs a week with NO safe main pattern, and the two pause-band injuries '
      + `left ${JSON.stringify(patterns.requiredSafePatterns)} safe (prohibited: `
      + `${JSON.stringify(patterns.prohibitedPatterns)}). It would otherwise assert the `
      + 'reduction on a week the ruling says must KEEP its frequency.');

    const reduction = accepted.contract.authorisedReductions.find((entry) =>
      entry.metric === 'main_strength_frequency' && entry.reason === 'injury_restriction');
    assert(reduction !== undefined && reduction.reducedTarget === 0,
      'a whole-body restriction no longer records the main-strength frequency reduction. '
      + 'Bible :1913 (8-10/10): "pause affected training entirely… clearly unaffected work '
      + 'only" — with no safe pattern there is nothing to substitute, so the reduction is '
      + `correct here and must survive the 6/10 fix. Reductions: ${JSON.stringify(
        accepted.contract.authorisedReductions.map((entry) =>
          `${entry.metric}->${entry.reducedTarget}(${entry.reason})`))}`);

    const afterStrength = accepted.evaluation.ledger.mainStrength.achievedCount;
    assert(afterStrength === 0,
      `the week still prescribes ${afterStrength} main-strength session(s) with every `
      + `pattern prohibited. Week: ${shape(week())}`);
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
