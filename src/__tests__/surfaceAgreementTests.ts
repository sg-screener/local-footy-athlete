/**
 * L-P1 / L-P3 — EVERY SURFACE TELLS THE SAME STORY. STAGE 3 REDS.
 *
 * Sam's 2026-07-29 render split, three defects, all with doors that reported
 * ACCEPTED (`plan_change_add_category_accepted`,
 * `program_control_move_session_accepted`) — the domain agreed with itself every
 * time, so every one of these is a surface composing its own answer:
 *
 *   1. Add FBS to the G+1 recovery Sunday. Card said "Recovery + Recovery
 *      Session", detail title said "Recovery Session + Full Body Strength",
 *      content showed recovery only. THREE surfaces, THREE stories.
 *   2. Add hard intervals to a recovery day. The card dropped recovery entirely;
 *      the detail embedded the intervals INSIDE the recovery template. The
 *      inverse split.
 *   3. Move Tue -> Sat. The Tuesday card rendered internal planner vocabulary —
 *      "Aerobic conditioning component (25m…)" — to an athlete.
 *
 * ARMED IN `test:bible` SINCE TASK 6 (2026-07-31). Sam's process ruling was that
 * the gate stays green after every stage and the surface laws enter the bible IN
 * THEIR GREEN COMMIT, not before. This is that commit: the menu (Task 4), the week
 * card (Task 5) and the day-detail title/content (Task 6) all render from
 * `project()`, and the L-P1/L-P3 cells hold against it. A failure exits 1.
 *
 * WHAT THE LAW IS, AND WHY IT IS PHRASED THIS WAY. The assertion is
 * `surface === projection`, never `surface_a === surface_b`. Two surfaces that
 * drifted together would satisfy the weaker form, and surfaces agreeing with each
 * other's mistakes is the whole failure being replaced. The CANONICAL answer is
 * `buildProgramTabProjectedWeek` -> `project()`, and each pixel-bearing surface is
 * compared to IT. That is exactly the finding the reassessment named: no screen
 * imported it, so every screen was free to differ.
 *
 * STATUS, 2026-07-31 — read this before trusting a result.
 *
 *   - Cell 1 PASSES. READ WHAT THAT DOES AND DOES NOT MEAN. Since Task 6 the
 *     detail comparison here reads `projectDayDetail`, which is what
 *     `DayWorkoutScreenV2` uses for its TITLE and its attached-part line — and
 *     `projectDayDetail` maps `parts` one-to-one, so those two lists agree by
 *     construction. What the cell holds is that they STAY that way: a filter or a
 *     `kind` branch added to the detail surface reds it. It does NOT compare the
 *     rendered CONTENT: the athlete's session list is filled by D13's separate
 *     composition (`buildSessionTemplate`), and the law that crosses those two
 *     representations lives in `athleteActionWalkerTests` as
 *     `L-P3 TEMPLATE = PROJECTION`, because only the walker reaches real
 *     generated weeks by acting. That law reds today, in four declared shapes
 *     owned by D13 — so the content half of "one story" is watched, and it is
 *     not yet true.
 *   - Cell 2's surface half PASSES. Its remaining red, and cell 4's, are ONE
 *     domain gap — the G+1 Sunday resolves as REST with no workout in every world
 *     this harness can act its way to — declared below as
 *     `g1_sunday_is_rest_not_a_recovery_day`, owned outside this unit, stale-
 *     checked, and never counted as a pass.
 *   - Cell 3 PASSES over the whole visible horizon.
 *
 * The `harness-enters-below-the-door` note this header used to carry is HALF paid:
 * the detail surface is callable and it is the one the screen calls for its
 * words. The content list entered a harness only when
 * `L-P3 TEMPLATE = PROJECTION` was written, and it went red immediately.
 *
 * Run: npm run test:surface-agreement
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — surface agreement is an on-device law');
};
process.env.TZ = 'Australia/Melbourne';

import type { TrainingProgram, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { PlanChange } from '../utils/planChangeTypes';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { applyPlanChange, listPlanChangeOptionsForDay } from '../utils/planChangeProducer';
import { getSessionComponents } from '../utils/sessionComponents';
import { project } from '../rules/projectVisibleWeek';
import { projectDayDetail } from '../rules/visibleDayDetail';
import { athleteVisibleStrings } from '../rules/visibleProjection';
import { isSignedCopyText } from '../rules/signedCopy';
import {
  samExport8Profile,
  SAM_EXPORT_8_TODAY_ISO,
  SAM_EXPORT_8_CURRENT_WEEK,
} from './support/samDeviceExport8Fixture';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

/**
 * A DECLARED DOMAIN GAP — the walker's `DECLARED_RED` pattern, in this suite.
 *
 * This suite is ARMED (Task 6): it is in `test:bible` and a failure exits 1. Two
 * of its four cells assert something that is true of Sam's DEVICE and not of any
 * world this harness can reach by acting, and the reason is one gap sitting
 * upstream of every surface — so the honest move is neither to delete the cells
 * nor to soften what they assert, but to name the gap, pin the exact message it
 * produces, and let the assertion stand behind it word for word.
 *
 * The three properties that make this a ratchet rather than a mute button, all
 * borrowed from `athleteActionWalkerTests`:
 *
 *   1. THE ASSERTION IS UNCHANGED. Not loosened, not skipped early, not wrapped
 *      in a conditional. It runs, it fails, and the failure is matched against a
 *      declared message. L13: "cells go green by surfaces converging, never by
 *      asking less" — nothing here went green.
 *   2. STALE DECLARATIONS FAIL. If a declared gap stops producing its message,
 *      the suite fails and the entry has to be deleted. A gap cannot outlive the
 *      defect it names.
 *   3. IT IS VISIBLE IN THE OUTPUT AND IT IS NOT A PASS. Declared gaps print as
 *      `GAP` and are counted separately from `passed`, so no run of this suite
 *      can be read as "four cells agree".
 */
interface DeclaredDomainGap {
  id: string;
  /**
   * WHICH CELLS THIS MAY EXPLAIN. Scoped by name, not global: a matcher loose
   * enough to be useful is loose enough to absorb a future red in a DIFFERENT
   * cell that happens to contain the same phrase, and a gap that can swallow an
   * unrelated failure has stopped being a declaration. Matched against the cell
   * name as a prefix.
   */
  cells: readonly string[];
  /** The exact failure this explains. Cut from the message, not guessed at. */
  matches: RegExp;
  why: string;
  owner: string;
  expiresWhen: string;
}

const DECLARED_DOMAIN_GAPS: readonly DeclaredDomainGap[] = [
  {
    id: 'g1_sunday_is_rest_not_a_recovery_day',
    cells: ['(2) adding hard conditioning', '(4) a recovery day is offered'],
    matches: /the projection no longer shows recovery at all|is not considered to have a session/,
    why: 'ONE GAP, TWO CELLS, AND IT IS UPSTREAM OF EVERY SURFACE. Cells 2 and 4 '
      + 'both describe the Sunday after his Saturday fixture as a RECOVERY day — '
      + 'cell 2 asks that adding hard intervals to it must not delete the recovery '
      + 'already there, cell 4 that it be offered the same menu as any other day. '
      + 'Probed on the world this harness actually reaches: that Sunday resolves '
      + '`source: "rest"` with NO workout at all, so there is no recovery for the '
      + 'add to conserve and no session for the menu to act on. Game-proximity '
      + 'recovery is resolver-owned derived filler regenerated every render '
      + '(`isResolverOwnedDerivedSession`), never a composed placeholder — the '
      + 'reassessment names this exactly: "a recovery day whose content is '
      + 'resolver-owned derived filler has no composed placeholder ... so it '
      + 'presents as NOT A SESSION, and the menu collapses to add-only. That is '
      + 'defect 4, and it is not a menu bug: the menu is correctly reporting a '
      + 'projection that does not consider a recovery day to be a day." Cell 2\'s '
      + 'red used to be hidden behind an `UnsignedCopyError` thrown one assertion '
      + 'earlier; Task 6 paid that half (the row names an add places are registered '
      + 'now, and its L-P1/L-P3 surface assertions PASS), which uncovered the '
      + 'domain half underneath. A carried red shadowing the one behind it is a '
      + 'shape this branch has already been caught by once (commit 3f879d4). '
      + 'WHAT IS UNEXERCISED WHILE THIS STANDS, recorded so nobody reads the gap '
      + 'as narrower than it is: cell 4 aborts on its FIRST assertion '
      + '(`hasSession`), so its `canRemove` and `!move.refusal` assertions have '
      + 'not run since this entry was written. When the gap closes, those two are '
      + 'unproven and must be treated as new, not as regressions.',
    owner: 'the recovery-as-a-day-type owner — reassessment staging step 5 '
      + '("Recovery as a day type; REST as a kind. Re-verify §18 counting '
      + 'explicitly"), which is a DOMAIN unit with a Bible question attached '
      + '(reassessment "what this does NOT settle", item 3), not a surface task. '
      + 'Raised for Sam in the buttons/UI boundary report.',
    expiresWhen: 'a G+1 Sunday projects as a real day with real parts, so adding '
      + 'to it conserves what was there and its menu offers what any other day\'s '
      + 'does.',
  },
];

const gapsHit = new Set<string>();
let gapped = 0;

function declaredGapFor(cell: string, message: string): DeclaredDomainGap | null {
  return DECLARED_DOMAIN_GAPS.find((gap) =>
    gap.cells.some((scope) => cell.startsWith(scope)) && gap.matches.test(message)) ?? null;
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const gap = declaredGapFor(name, message);
    if (gap) {
      gapped += 1;
      gapsHit.add(gap.id);
      console.log(`  GAP  ${name}\n      declared domain gap: ${gap.id}`
        + `\n      owner: ${gap.owner}\n      ${message}`);
      return;
    }
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined;
  console.debug = () => undefined; console.info = () => undefined;
  console.log = () => undefined;
  try { return body(); } finally {
    console.warn = warn; console.error = error;
    console.debug = debug; console.info = info; console.log = log;
  }
}

const TODAY = SAM_EXPORT_8_TODAY_ISO;
const WEEK = SAM_EXPORT_8_CURRENT_WEEK;

function mondayFor(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  parsed.setDate(parsed.getDate() - ((parsed.getDay() + 6) % 7));
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

/** THE CARD's source — `useScheduleState` -> `resolveWeekWithConditioning`. */
function cardWeek(week: string): ResolvedDay[] {
  return quiet(() => resolveWeekWithConditioning(week, buildScheduleStateImperative()));
}

/** THE CANONICAL answer — the one single derivation of accepted state today. */
function projectedWeek(week: string): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: week, todayISO: TODAY,
    state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

function dayFrom(days: ResolvedDay[], date: string): ResolvedDay | undefined {
  return days.find((day) => day.date === date);
}

/** The part list a surface would show. The ONLY plural, per the ruling. */
function partIds(workout: Workout | null | undefined): string[] {
  return getSessionComponents(workout ?? null).map((part) => String(part.id));
}

function reachHisWorldByActing(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useCoachMutationHistoryStore.setState({ entries: [] } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1, selectedPhase: 'Pre-season', phaseEntryWeekStartISO: '2026-07-13',
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  const his = program.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  assert(his, 'his week is not in the generated program');
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: his,
    todayWorkout: null, isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'surface-agreement:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  // His fixture: the Saturday game that makes Sunday G+1 recovery.
  quiet(() => useCalendarStore.getState().setGameDay('2026-08-01', TODAY));
}

function tap(change: PlanChange) {
  const date = (change as { date?: string; fromDate?: string }).date
    ?? (change as { fromDate?: string }).fromDate ?? TODAY;
  return quiet(() => applyPlanChange({
    change, visibleWeek: cardWeek(mondayFor(date)), todayISO: TODAY,
    setManualOverride: (target, workout, context) =>
      useProgramStore.getState().setManualOverride(target, workout, context),
  }));
}

/**
 * THE DETAIL SURFACE'S OWN STORY, AND THE PROJECTION'S — from the real path.
 *
 * Until Task 6 this read `composeDayDetail`, the composition `useDayWorkout`
 * performed at render: five booleans and three row buckets, which is how a day
 * carrying strength AND recovery told the athlete "Strength". That composition no
 * longer reaches a screen. `projectDayDetail` (`rules/visibleDayDetail.ts`) is
 * what `DayWorkoutScreenV2` renders now — title, attached-part line and section
 * list — so the comparison below is against the function that actually draws the
 * pixels, not against a stand-in for it.
 *
 * WHAT THIS CELL PROVES AND WHAT IT DOES NOT, STATED PLAINLY. `projectDayDetail`
 * maps `parts`, so the two lists agree by construction — that IS the ruled end
 * state (reassessment §4: "`parts` is the ONLY plural ... two surfaces reading one
 * list cannot disagree", and defects 1 and 2 become *unrepresentable*). What the
 * assertion holds is that it STAYS that way: a filter, a `kind` branch or a
 * "recovery renders differently" case added to the detail surface reds here and
 * in the walker on the next run. It is NOT a cross-representation check, and it
 * must not be read as one: the words this covers are the title and the
 * attached-part line, not the rendered session list, which D13's
 * `buildSessionTemplate` composes separately. That comparison is
 * `L-P3 TEMPLATE = PROJECTION` in `athleteActionWalkerTests` — the walker,
 * because only the walker reaches real generated weeks — and it is red today in
 * four declared shapes. The teeth in THIS suite that do not depend on the
 * construction live below, in cell 2's own two assertions about what the DOMAIN
 * carries after an add.
 */
function detailAndProjectionKinds(week: string, date: string): {
  detail: string[]; projection: string[];
} {
  const projected = project({ week: projectedWeek(week), weekStart: week });
  const day = projected.days.find((candidate) => candidate.date === date) ?? null;
  const detail = projectDayDetail(day);
  return {
    detail: Array.from(new Set((detail?.sections ?? []).map((section) => String(section.kind)))).sort(),
    projection: Array.from(new Set((day?.parts ?? []).map((part) => String(part.kind)))).sort(),
  };
}

/** L-P1 + L-P3 for one day, against the canonical projection. */
function assertSurfacesAgree(date: string, context: string): void {
  const week = mondayFor(date);
  const canonical = dayFrom(projectedWeek(week), date);
  const card = dayFrom(cardWeek(week), date);
  assert(canonical, `${context}: the projection has no ${date}`);

  // L-P1: the card IS the projection, not merely consistent with something else.
  const canonicalName = canonical.workout?.name ?? null;
  const cardName = card?.workout?.name ?? null;
  assert(cardName === canonicalName,
    `${context} — L-P1: the week card and the projection name ${date} differently. `
    + `card "${cardName}" / projection "${canonicalName}". One day, two stories.`);

  // L-P3: parts conservation. Same ids, same order, same count.
  const canonicalParts = partIds(canonical.workout);
  const cardParts = partIds(card?.workout);
  assert(JSON.stringify(cardParts) === JSON.stringify(canonicalParts),
    `${context} — L-P3: parts differ on ${date}. card ${JSON.stringify(cardParts)} / `
    + `projection ${JSON.stringify(canonicalParts)}. \`parts\` is the only plural; `
    + 'a surface that shows a different list has composed its own.');

  // THE THIRD SURFACE — what the day-detail screen renders, from the real path.
  const { detail: detailKinds, projection: canonicalKinds } =
    detailAndProjectionKinds(week, date);
  assert(JSON.stringify(detailKinds) === JSON.stringify(canonicalKinds),
    `${context} — L-P3: the DETAIL screen and the projection disagree about what is `
    + `on ${date}. detail ${JSON.stringify(detailKinds)} / projection `
    + `${JSON.stringify(canonicalKinds)}. This is the third story: the detail `
    + 'composes its own account at render.');
}

console.log('\n-- Surface agreement (L-P1/L-P3) — ARMED, in test:bible since Task 6 --');

run('(1) adding strength to the G+1 recovery Sunday tells ONE story', () => {
  reachHisWorldByActing();
  const added = tap({ kind: 'add_category', date: '2026-08-02', category: 'strength_full' } as PlanChange);
  assert(added.outcome === 'applied',
    `the door refused the add (${added.outcome}: "${added.message}") — this cell is `
    + 'about surfaces, and the tape shows the door accepting');
  assertSurfacesAgree('2026-08-02', 'defect 1, G+1 recovery Sunday + Full Body Strength');
});

run('(2) adding hard conditioning to a recovery day keeps recovery visible', () => {
  reachHisWorldByActing();
  const added = tap({ kind: 'add_category', date: '2026-08-02', category: 'conditioning_hard' } as PlanChange);
  assert(added.outcome === 'applied',
    `the door refused the add (${added.outcome}: "${added.message}")`);
  assertSurfacesAgree('2026-08-02', 'defect 2, recovery day + hard intervals');

  // The inverse split, named: the card dropped recovery, the detail swallowed the
  // intervals into the recovery template. Either way, BOTH parts exist and both
  // surfaces must show both.
  const canonical = dayFrom(projectedWeek(mondayFor('2026-08-02')), '2026-08-02');
  const parts = partIds(canonical?.workout);
  // ORDERED SO THE SURFACE CLAIM RUNS FIRST. The recovery-conservation assertion
  // below is a declared domain gap and aborts the cell; the conditioning claim is
  // about the surface this task owns and would otherwise never be reached.
  assert(parts.some((part) => part === 'conditioning' || part === 'finisher'),
    `defect 2: the conditioning the athlete added is not a part — `
    + `${JSON.stringify(parts)}. It was embedded inside the recovery template `
    + 'instead of standing beside it.');
  assert(parts.includes('recovery') || parts.includes('recovery_addon'),
    `defect 2: after adding conditioning the projection no longer shows recovery at `
    + `all — parts ${JSON.stringify(parts)}. Adding work to a day must not delete `
    + 'the work already on it.');
});

run('(3) no surface renders internal planner vocabulary', () => {
  // The generator appends ' + easy off-feet aerobic conditioning component' to
  // `allocation.focus` (coachingEngine.ts:1262, :6500) and
  // `resolveSessionDisplayName`'s last precedence rule is a cleaned name/focus
  // pass-through — so planner scratch reaches the glass through a punctuation
  // tidier. Asserted over the WHOLE visible horizon, not one date: this is a
  // vocabulary law, and the day it surfaces on is an accident of allocation.
  reachHisWorldByActing();
  const banned = [
    'conditioning component',
    'off-feet',
    'planner',
    'allocation',
    'appPrescribed',
    'plannerSelected',
  ];
  const offences: string[] = [];
  for (const week of [WEEK, '2026-08-03', '2026-08-10']) {
    for (const day of projectedWeek(week)) {
      const name = day.workout?.name ?? '';
      for (const phrase of banned) {
        if (name.toLowerCase().includes(phrase.toLowerCase())) {
          offences.push(`${day.date}: "${name}" (contains "${phrase}")`);
        }
      }
    }
  }
  assert(offences.length === 0,
    'defect 3 — L-P2: internal vocabulary reached an athlete-facing name:\n        '
    + `${offences.join('\n        ')}\n      Athlete-facing words come from the `
    + 'signed-copy sheet; `allocation.focus` must be structurally unable to reach '
    + 'a card.');
});

run('(5) L-P2 — every word the migrated surfaces render is signed', () => {
  // THE RUNTIME HALF OF L-P2, ARMED (Task 11).
  //
  // Cell 3 above is the law stated as a BLOCKLIST: six phrases that must not
  // appear. A blocklist only ever catches the leak somebody already found —
  // "off-feet" was on it because Sam saw it on his phone. This is the same law
  // stated as an ALLOWLIST, which is the only form that can catch the next one:
  // every string the four migrated surfaces put on the glass must be IN the
  // signed-copy sheet, not merely absent from a list of known-bad words.
  //
  // `athleteVisibleStrings` is the projection's own enumeration of what a day
  // would render — day headline, refusal, every part headline and detail, every
  // row name, prescription and cue (`visibleProjection.ts`). It is collected
  // from the PROJECTION rather than by scraping components on purpose: the law
  // is that the projection is the only source, so a surface that shows something
  // this does not return has composed it, and cells 1-4 are what hold the
  // surfaces to the projection.
  //
  // WHY THIS IS NOT VACUOUS EVEN THOUGH `project()` ONLY EVER CALLS
  // `signedCopy()`. `SignedCopy` is a branded string, and a brand is a compile-
  // time claim: one `as SignedCopy` cast, one template literal assembled from
  // two signed halves, one `${}` interpolation of a number that no entry
  // templates, and the type still passes while the athlete reads something
  // nobody authored. `isSignedCopyText` re-derives the claim at runtime against
  // the filled text of every registered entry. It is also the assertion that
  // FAILS if a future edit reintroduces a pass-through: Task 11 deleted
  // `resolveSessionDisplayName`'s cleaned-focus rule, and if it came back, a
  // strength part on a legacy day would resolve to planner text, miss
  // `STRENGTH_HEADLINE_ID_BY_LABEL`, and — were `partHeadline` ever to return it
  // rather than fall through — land here.
  //
  // OVER THE WHOLE VISIBLE HORIZON, not one date: the same reason cell 3 gives.
  // Which day a gap surfaces on is an accident of allocation.
  reachHisWorldByActing();
  const offences: string[] = [];
  for (const week of [WEEK, '2026-08-03', '2026-08-10']) {
    const projected = quiet(() => project({ week: projectedWeek(week), weekStart: week }));
    for (const day of projected.days) {
      for (const text of athleteVisibleStrings(day)) {
        if (!isSignedCopyText(text)) {
          offences.push(`${day.date}: "${text}"`);
        }
      }
    }
  }
  assert(offences.length === 0,
    `L-P2: the projection rendered ${offences.length} string(s) that are not in the `
    + `signed-copy sheet:\n        ${offences.join('\n        ')}\n      `
    + 'Athlete-facing words come from an authored source or a Sam ruling.');
});

run('(4) a recovery day is offered the same capabilities as any other day', () => {
  // Sam's ruling 3: recovery is a day type like any other — same menu
  // capabilities, same editing rules. The menu derives capability from
  // `workout.sections.map(kind)` and `hasSession = workout !== null`, and a G+1
  // recovery day is resolver-owned derived filler with no composed placeholder,
  // so it presents as not-a-day and collapses to add-only.
  reachHisWorldByActing();
  const recoveryDay = quiet(() => listPlanChangeOptionsForDay({
    visibleWeek: cardWeek(mondayFor('2026-08-02')), date: '2026-08-02', todayISO: TODAY,
  }));
  assert(recoveryDay.hasSession,
    'defect 4: the G+1 recovery Sunday is not considered to have a session, so the '
    + 'menu offers add only. Recovery is a day type like any other.');
  assert(recoveryDay.canRemove,
    'defect 4: a recovery day cannot be removed while a strength day can');
  assert(!recoveryDay.move.refusal,
    `defect 4: a recovery day is offered no move — "${recoveryDay.move.refusal?.message}"`);
});

// STALE DECLARATIONS FAIL — a gap that stopped happening is a cell that went
// green, and the commit that turned it green owes the deletion of its entry.
const staleGaps = DECLARED_DOMAIN_GAPS.filter((gap) => !gapsHit.has(gap.id));
if (staleGaps.length > 0) {
  failed += staleGaps.length;
  for (const gap of staleGaps) {
    failures.push(`declared domain gap no longer reds: ${gap.id}`);
    console.error(`  FAIL declared domain gap "${gap.id}" no longer reds — delete the `
      + 'entry, do not leave it carrying debt that is already paid.');
  }
}

console.log(`\nSurface agreement totals: ${passed} passed, ${gapped} declared gap(s), `
  + `${failed} failed`);
// ARMED IN TASK 6. This suite is in `test:bible` and a failure exits 1 — the
// process ruling was that the surface laws enter the gate IN THEIR GREEN COMMIT,
// and this is it: the surfaces moved onto `project()` and the L-P1/L-P3 cells
// hold against it. The `process.exit(0)` softener that lived here is gone with
// the stage it belonged to. What is NOT green is declared above and counted
// separately, never as a pass.
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
