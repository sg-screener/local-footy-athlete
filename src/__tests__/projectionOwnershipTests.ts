/**
 * `project()` IS THE ONE PROJECTION — and it changes nothing yet.
 *
 * Stage 2 of the build. Before any surface renders from a new owner, that owner
 * must be proven equivalent to the one it succeeds: `buildProgramTabProjectedWeek`
 * is today's single derivation of accepted state, and `project()` must agree with
 * it on every day the matrix reaches. A new owner that quietly changes the week
 * while claiming to unify it would be the worst possible version of this unit.
 *
 * WHAT IS PINNED:
 *   1. EQUIVALENCE — `project()`'s parts match the components of the week
 *      `buildProgramTabProjectedWeek` produces, day for day.
 *   2. ONE DERIVATION — `project()` and `projectParts()` never disagree, because
 *      they are the same derivation asked two questions rather than two
 *      projections.
 *   3. RULING 3, RECOVERY — a recovery part gets the same capabilities as a
 *      strength part in the same position, and counts toward NOTHING.
 *   4. REST IS NOT EMPTINESS — a rest day and an empty training day are different
 *      kinds, so no consumer can conflate them.
 *   5. NO INVENTED WORDS — `project()` raises rather than composing a headline
 *      that Sam has not signed.
 *
 * Run: npm run test:projection-ownership
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
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

import type { TrainingProgram } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { getSessionComponents } from '../utils/sessionComponents';
import { project, projectParts } from '../rules/projectVisibleWeek';
import { projectDayDetail, visibleDayLeadHeadline } from '../rules/visibleDayDetail';
import { UnsignedCopyError, isSignedCopyText, signedCopy } from '../rules/signedCopy';
import { PART_COUNTS_TOWARD_LOAD } from '../rules/visibleProjection';
import { samExport8Profile, SAM_EXPORT_8_TODAY_ISO, SAM_EXPORT_8_CURRENT_WEEK } from './support/samDeviceExport8Fixture';

let passed = 0; let failed = 0; const failures: string[] = [];
function assert(c: unknown, d: string): asserts c { if (!c) throw new Error(d); }
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(name); console.error(`  FAIL ${name}\n      ${e instanceof Error ? e.message : e}`); }
}
function quiet<T>(b: () => T): T {
  const w = console.warn, e = console.error, d = console.debug, i = console.info, l = console.log;
  console.warn = console.error = console.debug = console.info = console.log = (() => undefined) as never;
  try { return b(); } finally { console.warn = w; console.error = e; console.debug = d; console.info = i; console.log = l; }
}

const TODAY = SAM_EXPORT_8_TODAY_ISO;
const WEEK = SAM_EXPORT_8_CURRENT_WEEK;

function world(): void {
  localStorageData.clear();
  const profile = samExport8Profile();
  useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  const program = quiet(() => generateProgramLocally(profile, {
    todayISO: '2026-07-13', previousProgram: null,
    seasonPhaseClock: { protocolVersion: 1, selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: '2026-07-13', originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state' },
  })) as TrainingProgram;
  const his = program.microcycles.find((m) => m.startDate.slice(0, 10) === WEEK) ?? null;
  useProgramStore.setState({
    currentProgram: program, currentMicrocycle: his, todayWorkout: null,
    isGenerating: false, isLoading: false, error: null, blockState: null,
    acceptedMaterialContext: {
      markedDays: {}, readinessSignalsByDate: {}, activeConstraints: [], activeInjury: null,
      revision: 1, lastTransaction: 'projection-ownership:generate',
      injuryEpisodes: [], temporarySourceFacts: [],
      acceptedCompositionBase: null, acceptedProfileSnapshot: null,
    },
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {}, sessionFeedback: {}, weightOverrides: {},
  } as never);
  quiet(() => useCalendarStore.getState().setGameDay('2026-08-01', TODAY));
}

function projected(week: string): ResolvedDay[] {
  return quiet(() => buildProgramTabProjectedWeek({
    mondayISO: week, todayISO: TODAY, state: buildScheduleStateImperative(),
    overrideContexts: useProgramStore.getState().overrideContexts ?? {},
  }));
}

const WEEKS = [WEEK, '2026-08-03', '2026-08-10'];

console.log('\n-- Projection ownership --');

run('project() agrees with the derivation it succeeds, every day', () => {
  world();
  for (const week of WEEKS) {
    const days = projected(week);
    const mine = projectParts({ week: days, weekStart: week });
    assert(mine.days.length === days.length,
      `${week}: project() produced ${mine.days.length} days for ${days.length}`);
    for (const [index, day] of days.entries()) {
      const componentCount = getSessionComponents(day.workout ?? null).length;
      const partCount = mine.days[index].parts.length;
      const expected = day.workout ? componentCount : 0;
      assert(partCount === expected,
        `${day.date}: project() has ${partCount} parts, the derivation it succeeds `
        + `has ${expected}. A new owner must change nothing before any surface `
        + 'renders from it.');
    }
  }
});

run('project() evaluates without throwing and every headline is registered copy', () => {
  // TASK 2 (buttons/UI unit, 2026-07-31): `project()` now has a full registered
  // vocabulary (`projectionCopy.ts`) and rows populated, so the positive claim
  // replaces the old exception-tolerant one — a THROW here is now a real
  // regression, not an accepted outcome. Still proves `project()` and
  // `projectParts()` are one derivation, not two: their part counts must agree.
  world();
  for (const week of WEEKS) {
    const days = projected(week);
    const structural = projectParts({ week: days, weekStart: week });
    const visible = project({ week: days, weekStart: week });
    assert(visible.days.length === structural.days.length,
      `${week}: project() produced ${visible.days.length} days, projectParts() `
      + `${structural.days.length}`);
    for (const [index, day] of visible.days.entries()) {
      assert(isSignedCopyText(day.headline),
        `${day.date}: unregistered day headline "${day.headline}"`);
      assert(day.parts.length === structural.days[index].parts.length,
        `${day.date}: project() and projectParts() disagree about part count — one `
        + 'derivation, not two');
      for (const part of day.parts) {
        assert(isSignedCopyText(part.headline),
          `${day.date}/${part.id}: unregistered part headline "${part.headline}"`);
        assert(Array.isArray(part.rows), `${day.date}/${part.id}: rows is not an array`);
        for (const row of part.rows) {
          assert(isSignedCopyText(row.name),
            `${day.date}/${part.id}: unregistered row name "${row.name}"`);
          assert(isSignedCopyText(row.prescription),
            `${day.date}/${part.id}: unregistered row prescription "${row.prescription}"`);
          if (row.cue) {
            assert(isSignedCopyText(row.cue),
              `${day.date}/${part.id}: unregistered row cue "${row.cue}"`);
          }
        }
      }
    }
  }
});

run('projecting ONE day equals projecting the week and picking that day out', () => {
  // THE COMMENT THAT WAS A CLAIM, MADE INTO A LAW — 2026-07-31.
  //
  // `planChangeProducer.projectedDay(day)` projects a single-day week (`[day]`,
  // `weekStart: day.date`) rather than the real week, because the menu is listed
  // once per day per surface render and per day per action in the walker. Its
  // docblock asserted the shortcut is EXACT — `projectParts` maps each day
  // independently, no cross-day derivation, no week-level state — and the
  // buttons/UI boundary report carried the same claim as a handover warning
  // aimed at one named future trigger: cross-day RECOVERY derivation, a G+1
  // reading G's fixture.
  //
  // Sam retired that trigger on 2026-07-31 (recovery is not an athlete-facing
  // session type; a G+1 Sunday is REST), so the warning was left pointing at a
  // future that is not coming. The hazard is not gone, it was only ever
  // MISNAMED: any cross-day read added to `projectParts` — a week-level rest
  // quota, a fixture-proximity glance at the neighbour, a "second hard day this
  // week" rule — silently makes the menu project a different day from the one
  // every other surface projects, with no error and no diff to notice.
  //
  // A comment asserting a property is not evidence of the property (this
  // branch's own method finding). So the property is asserted here, over the
  // real generated horizon, exactly as the shortcut takes it: same shape, same
  // capabilities, same parts, byte-for-byte.
  world();
  for (const week of WEEKS) {
    const days = projected(week);
    const whole = projectParts({ week: days, weekStart: week });
    for (const [index, day] of days.entries()) {
      const alone = projectParts({ week: [day], weekStart: day.date }).days[0];
      assert(JSON.stringify(alone) === JSON.stringify(whole.days[index]),
        `${day.date}: projecting this day ALONE differs from projecting the week and `
        + `picking it out.\n        alone ${JSON.stringify(alone)}\n        in-week `
        + `${JSON.stringify(whole.days[index])}\n      `
        + '`planChangeProducer.projectedDay` takes the single-day shortcut on every '
        + 'menu listing, so a cross-day read in `projectParts` makes the MENU project '
        + 'a different day from every other surface. Either the read moves out of '
        + '`projectParts`, or `projectedDay` stops taking the shortcut.');
    }
  }
});

run('a recovery SESSION is capable of everything a strength session is (ruling 3)', () => {
  // RESTATED IN TASK 4, AND STRENGTHENED — read the reason before changing it back.
  //
  // This cell used to compare every `kind === 'recovery'` part in the real week
  // against the first strength part. In this world EVERY recovery part is a
  // `recovery_addon` (probed: 4 add-ons, 0 standalone recovery components), so it
  // was stating ruling 3 about a POSITION the ruling is not about, and it would
  // have passed just as happily if `partCapabilities` had returned all-false for
  // both. Ruling 3 says a recovery DAY is a day type like any other; `position,
  // never kind` is the same sentence from the other side.
  //
  // So the comparison is now made where the ruling lives — two standalone
  // sessions in the same position, one recovery and one strength — and it asserts
  // the capabilities are not only equal but FULL. The add-on's own rule (it rides
  // with the day, so it is not independently editable) is the cell below, and the
  // two together say what one vague cell used to imply.
  const day = (date: string, workout: unknown): ResolvedDay => ({
    date, source: 'plan', workout,
  } as unknown as ResolvedDay);
  const week = [
    day('2026-07-13', {
      id: 'recovery-session', name: 'Recovery Session', workoutType: 'Recovery',
      sessionTier: 'recovery', exercises: [], durationMinutes: 30,
    }),
    day('2026-07-14', {
      id: 'strength-session', name: 'Upper Push', workoutType: 'Strength',
      sessionTier: 'core', durationMinutes: 60,
      exercises: [{ id: 'r1', name: 'Bench Press', sets: 3, reps: 5 }],
    }),
  ];
  const parts = projectParts({ week, weekStart: '2026-07-13' }).days.flatMap((d) => d.parts);
  const recovery = parts.filter((p) => p.kind === 'recovery');
  const strength = parts.filter((p) => p.kind === 'strength');
  assert(recovery.length > 0 && strength.length > 0,
    `nothing to compare — recovery ${recovery.length}, strength ${strength.length}. `
    + 'A vacuous ruling-3 cell is worse than none.');
  const FULL = JSON.stringify({
    canSwap: true, canMove: true, canRemove: true, canEditRows: true,
  });
  for (const part of recovery) {
    assert(JSON.stringify(part.capabilities) === JSON.stringify(strength[0].capabilities),
      `a recovery session is offered ${JSON.stringify(part.capabilities)} while a `
      + `strength session gets ${JSON.stringify(strength[0].capabilities)}. Recovery is `
      + 'a day type like any other.');
    assert(JSON.stringify(part.capabilities) === FULL,
      `a standalone session is offered ${JSON.stringify(part.capabilities)} — equal to `
      + 'strength, but both are locked down. Equality alone is satisfiable by '
      + 'refusing everything.');
  }
});

run('an add-on rides with the day — position, never kind', () => {
  // THE OTHER HALF OF RULING 3, and the reason the walker's
  // `projection_offers_a_move_off_an_anchored_day` red could be paid honestly.
  //
  // `recoveryAddons` is a top-level workout field, so it produces no visible
  // section: no bin scope names it, no move scope addresses it, and
  // `materializeAcceptedVisibleSections`'s signed `keepRecoveryAddons` finding
  // says the half of a split day that LEAVES never takes it. A part no door can
  // act on must not be projected as one the athlete may act on — that mismatch is
  // what made a team night carrying an add-on read as movable.
  //
  // This is NOT a recovery exception: the cell above proves a standalone recovery
  // session is fully capable. It is the position that answers.
  world();
  const days = projected(WEEK).concat(projected('2026-08-03'));
  const parts = projectParts({ week: days, weekStart: WEEK }).days.flatMap((d) => d.parts);
  const addons = parts.filter((part) => part.id.endsWith(':recovery_addon'));
  assert(addons.length > 0,
    'no recovery add-on in his week — this cell has nothing to say and would pass '
    + 'vacuously');
  for (const addon of addons) {
    assert(!addon.capabilities.canMove && !addon.capabilities.canRemove &&
      !addon.capabilities.canSwap && !addon.capabilities.canEditRows,
      `${addon.id} is offered ${JSON.stringify(addon.capabilities)} — but no door in `
      + 'the app can move, remove or swap a recovery add-on on its own.');
    assert(addon.kind === 'recovery' && addon.countsTowardLoad === false,
      `${addon.id} stopped being a recovery part — the position rule must not `
      + 'change what the part IS');
  }
});

run('a fixture owns its whole day', () => {
  // The two game-day walker reds, as a stated law. `dayKind` said "game" while
  // `COMPONENT_TO_PART` mapped the fixture's `session` component to `strength`, so
  // the projection offered a move and a removal on a day the athlete cannot touch
  // — one derivation disagreeing with itself.
  world();
  const days = projected('2026-07-27');
  const game = projectParts({ week: days, weekStart: '2026-07-27' })
    .days.find((d) => d.kind === 'game');
  assert(game, 'no game day in the week his fixture is in — nothing to assert');
  assert(game.parts.length > 0,
    `${game.date} projects no parts at all, so "nothing on it is editable" is `
    + 'trivially true and this cell proves nothing');
  assert(!game.capabilities.canAdd && !game.capabilities.canMoveWholeDay &&
    !game.capabilities.canRemoveWholeDay,
    `${game.date} is a fixture and the projection offers `
    + `${JSON.stringify(game.capabilities)}`);
  for (const part of game.parts) {
    assert(!part.capabilities.canMove && !part.capabilities.canRemove &&
      !part.capabilities.canSwap && !part.capabilities.canEditRows,
      `${part.id} on a fixture is offered ${JSON.stringify(part.capabilities)}`);
  }
});

run('recovery counts toward nothing (ruling 3)', () => {
  assert(PART_COUNTS_TOWARD_LOAD.recovery === false,
    'recovery counts toward the load ledger');
  for (const kind of ['strength', 'conditioning', 'power', 'speed'] as const) {
    assert(PART_COUNTS_TOWARD_LOAD[kind] === true,
      `${kind} stopped counting — the ruling was about recovery only`);
  }
  world();
  const parts = projectParts({ week: projected(WEEK), weekStart: WEEK })
    .days.flatMap((d) => d.parts);
  for (const part of parts.filter((p) => p.kind === 'recovery')) {
    assert(part.countsTowardLoad === false,
      `a projected recovery part claims to count toward load`);
  }
});

run('rest is a kind, not an absence of parts', () => {
  world();
  quiet(() => useCalendarStore.getState().setRestDay('2026-07-30'));
  const days = projected(WEEK);
  const mine = projectParts({ week: days, weekStart: WEEK });
  const rest = mine.days.find((d) => d.date === '2026-07-30');
  assert(rest, 'the rest day vanished from the projection');
  assert(rest.kind === 'rest',
    `a day the athlete marked as rest projects as "${rest.kind}". Rest is complete `
    + 'rest and is its own kind — never "a day whose workout is null", which is the '
    + 'conflation that let a deletion door write a schedule fact.');
  const emptyTraining = mine.days.find((d) => d.kind === 'training' && d.parts.length === 0);
  if (emptyTraining) {
    assert(emptyTraining.kind !== 'rest',
      'an empty training day is being reported as rest');
  }
});

/**
 * A PRACTICE MATCH IS A FIXTURE WITH ITS OWN WORD — Sam, 2026-07-31.
 *
 * Ruling: a practice/trial fixture day reads "Practice Match", not "Game Day". It
 * is a LABEL ruling and this cell is written to fail if it ever becomes more than
 * one: the practice-match day and the competitive fixture beside it are projected
 * from IDENTICAL input but for the `workoutType`, and everything except the
 * headline is asserted equal between them — kind, owner, part kinds, and every
 * capability at day and part level. A future change that lets the label leak into
 * the week's SHAPE (a fixture that stops locking, a part that becomes editable)
 * reds here rather than reaching a phone.
 *
 * IT IS ASSERTED THROUGH THE SHARED HELPERS, NOT THE RAW FIELD, because the field
 * is not what the athlete reads. All three render sites go through two functions:
 * the week card (`HomeScreenV2.cardLeadHeadline`) and the away-day picker (the
 * same call, on the row it draws per date) read `visibleDayLeadHeadline`, and the
 * day-detail title reads `projectDayDetail(...).headline`, which is the same
 * function again. Asserting both is asserting all three.
 *
 * Built from an explicit `ResolvedDay` rather than seeded state, on purpose:
 * `project()` is a pure function of resolved days (L14), and `'Practice Match'` is
 * not a member of the `WorkoutType` union — it arrives on hand-built and legacy
 * workouts, which is exactly the shape `dayIsFixture` compares as a string. This
 * is the same fixture shape `planChangeProducerTests` has used for a practice-match
 * day since Task 4, not a new invention. See `dayIsPracticeMatch`'s header for the
 * honest reachability statement (the generator's own anchor still resolves through
 * `createGameStub`, i.e. `workoutType: 'Game'`).
 */
run('a practice match reads its own word, and changes nothing else', () => {
  const fixtureDay = (workoutType: string): ResolvedDay => ({
    date: '2026-08-08',
    dayOfWeek: 6,
    short: 'SAT',
    isToday: false,
    workout: {
      id: `fixture-${workoutType}`,
      microcycleId: 'calendar',
      dayOfWeek: 6,
      name: 'Game Day',
      description: 'Match day',
      durationMinutes: 120,
      intensity: 'High',
      workoutType,
      sessionTier: 'core',
      exercises: [],
      createdAt: '',
      updatedAt: '',
    } as unknown as ResolvedDay['workout'],
    source: 'game',
    indicator: 'game',
  });

  const projectOne = (workoutType: string) => project({
    week: [fixtureDay(workoutType)],
    weekStart: '2026-08-08',
  }).days[0];

  const game = projectOne('Game');
  const practice = projectOne('Practice Match');

  // NON-VACUITY FIRST. If the competitive fixture stopped reading "Game Day" the
  // comparison below would pass while proving nothing about the new word.
  assert(String(game.headline) === 'Game Day',
    `a competitive fixture reads "${game.headline}" — the ruling was about practice `
    + 'matches only, and the default must be untouched');

  assert(String(practice.headline) === 'Practice Match',
    `a practice-match fixture reads "${practice.headline}". Sam ruled 2026-07-31 that `
    + 'a practice/trial fixture day reads "Practice Match", not "Game Day".');

  // THE CARD AND THE AWAY PICKER (`visibleDayLeadHeadline`) AND THE DETAIL TITLE
  // (`projectDayDetail`) — the same word through the two shared helpers.
  assert(String(visibleDayLeadHeadline(practice)) === 'Practice Match',
    `the card/away-picker headline for a practice match is "${visibleDayLeadHeadline(practice)}" — `
    + 'a fixture leads with its day headline, so this must be the ruled word');
  assert(String(projectDayDetail(practice)?.headline) === 'Practice Match',
    `the day-detail title for a practice match is "${projectDayDetail(practice)?.headline}"`);

  // AND NOTHING ELSE MOVED. Label only.
  assert(practice.kind === 'game' && practice.kind === game.kind,
    `a practice match projects kind "${practice.kind}" — the ruling varies the WORD, `
    + 'never the kind; `dayIsFixture` and every capability it drives must be blind to it');
  assert(practice.owner === game.owner,
    `owner drifted: ${practice.owner} vs ${game.owner}`);
  assert(JSON.stringify(practice.capabilities) === JSON.stringify(game.capabilities),
    `day capabilities differ between a practice match and a game:\n        `
    + `${JSON.stringify(practice.capabilities)}\n        ${JSON.stringify(game.capabilities)}`);
  assert(practice.parts.length === game.parts.length && practice.parts.length > 0,
    `part counts differ (${practice.parts.length} vs ${game.parts.length}), or a fixture `
    + 'projects no parts at all and the capability comparison below is vacuous');
  practice.parts.forEach((part, index) => {
    const twin = game.parts[index];
    assert(part.kind === twin.kind,
      `part ${index} kind drifted: ${part.kind} vs ${twin.kind}`);
    assert(JSON.stringify(part.capabilities) === JSON.stringify(twin.capabilities),
      `part ${index} capabilities drifted between a practice match and a game`);
  });
});

run('an unregistered id still throws — the sheet is the only source', () => {
  // TASK 2: `project()` now has a full registered vocabulary, so it no longer
  // throws for real weeks (see the cell above). What must still throw is the
  // constructor itself, for an id nobody registered — `signedCopy()` has no
  // fallback, on purpose (`signedCopy.ts`'s header). A deliberately bogus id
  // proves the guarantee without depending on which ids happen to be gaps
  // today.
  let threw: unknown = null;
  try { signedCopy('projection_ownership_tests.deliberately_bogus_id'); }
  catch (error) { threw = error; }
  assert(threw instanceof UnsignedCopyError,
    'signedCopy() produced text for an id nobody registered. The words must come '
    + 'from docs/COPY_SHEET_RULINGS_2026-07-30.md (via the registered sheet) or '
    + 'not exist.');
});

/**
 * THE NAME CHANNEL IS CLOSED TO THE ATHLETE SURFACES — Task 11, source contract.
 *
 * `resolveSessionDisplayName` still reads `focus` and `name`, and it still has to:
 * its output IS `workout.name`, which the frozen coach router/executor
 * string-match and regex, and the whole-bible differential (30,937 distinct
 * inputs) showed two of its rules and all three of its early domain-label guards
 * are LIVE producers of those keys. Deleting them would be a silent
 * coach-pipeline behaviour change, which LR-6 forbids. What this unit CAN
 * guarantee — and what these cells hold — is that no athlete surface can reach
 * them.
 *
 * The guarantee is an OMISSION, which is the fragile kind: `partHeadline`
 * deliberately does not pass `focus`/`name`, so the surviving rules cannot fire
 * through the projection. An omission is undone by one autocompleted property.
 * These cells make undoing it fail the build instead.
 *
 * WHY SOURCE-CONTRACT DEPTH RATHER THAN BEHAVIOURAL. A behavioural cell can only
 * prove the rules did not fire on the days it reached; cell 5 of
 * `surfaceAgreementTests` (L-P2) is exactly that and runs over the whole visible
 * horizon. What it cannot prove is that the CHANNEL is absent, because a
 * pass-through that returns an already-signed word is invisible to it. Both
 * depths, for the two halves of the claim.
 */
run('the projection cannot reach the name channel (source contract)', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const src = (rel: string): string =>
    fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

  const projection = src('rules/projectVisibleWeek.ts');

  /**
   * THE ARGUMENT BLOCK, BRACE-MATCHED — not regex-matched.
   *
   * The first version of this cell read the block with
   * `/resolveSessionDisplayName\(\{([\s\S]*?)\}\)/`, and the lazy quantifier
   * stopped at the FIRST `})` inside the arguments — which is the one closing
   * `exercises: rows.map((row) => ({ name: row.name }))`. Everything after that
   * line was outside the guard, so a `focus:` PREPENDED to the object was caught
   * and a `focus:` APPENDED to it was not. Appending is what an autocomplete
   * does, and the docblock above names autocomplete as the threat, so the cell
   * was blind to exactly the mutation it was written for. Found in review, not
   * by the cell.
   *
   * Balanced-brace scan instead: from the `{` after the call's `(`, count depth
   * until it returns to zero. Every call site is read, not just the first, so a
   * second naming call added below cannot slip in unguarded.
   */
  const argumentBlocks = (source: string, fn: string): string[] => {
    const blocks: string[] = [];
    const opener = new RegExp(`\\b${fn}\\s*\\(\\s*\\{`, 'g');
    let hit: RegExpExecArray | null;
    while ((hit = opener.exec(source)) !== null) {
      let depth = 1;
      let index = hit.index + hit[0].length;
      while (index < source.length && depth > 0) {
        const char = source[index];
        if (char === '{') depth += 1;
        else if (char === '}') depth -= 1;
        index += 1;
      }
      assert(depth === 0,
        `unbalanced braces reading ${fn}'s argument block — the contract cannot `
        + 'read the call it guards, which is a failure, not a pass');
      blocks.push(source.slice(hit.index + hit[0].length, index - 1));
    }
    return blocks;
  };

  const blocks = argumentBlocks(projection, 'resolveSessionDisplayName');
  assert(blocks.length > 0,
    'projectVisibleWeek.ts no longer calls resolveSessionDisplayName — '
    + 'if the strength headline moved to a different naming owner this cell must '
    + 'follow it, not be deleted');

  // TOP-LEVEL KEYS ONLY. A flat regex over the argument block finds the `name:`
  // inside `exercises: rows.map((row) => ({ name: row.name }))` and reports the
  // channel as open while it is shut — a cell that cries wolf gets loosened, and
  // a loosened cell is how the channel actually reopens.
  //
  // `depth` is clamped at zero. The block handed in is already balanced, but a
  // scanner that lets depth go NEGATIVE on a stray closer silently treats the
  // rest of the object as nested and stops reporting keys — the same
  // fail-open shape as the regex above, one level down.
  const topLevelKeys = (block: string): string[] => {
    const keys: string[] = [];
    let depth = 0;
    let token = '';
    for (const char of block) {
      if (char === '{' || char === '[' || char === '(') { depth += 1; token = ''; continue; }
      if (char === '}' || char === ']' || char === ')') {
        depth = Math.max(0, depth - 1); token = ''; continue;
      }
      if (depth > 0) continue;
      if (char === ',') { token = ''; continue; }
      if (char === ':') { keys.push(token.trim()); token = ''; continue; }
      token += char;
    }
    return keys;
  };
  const keys = blocks.flatMap(topLevelKeys);
  assert(!keys.includes('focus'),
    'the projection now passes `focus` to resolveSessionDisplayName. That reopens '
    + 'the legacy focus-inference rule on the athlete\'s own week — the rule whose '
    + 'measured output includes raw planner text. Derive the headline from typed '
    + 'intent and rows, or register the word.');
  assert(!keys.includes('name'),
    'the projection now passes `name` to resolveSessionDisplayName, reopening the '
    + 'name pass-through on the athlete\'s own week.');
  // NON-VACUITY. If the extractor ever returns nothing, both assertions above
  // pass for free and the contract has quietly stopped existing.
  assert(keys.includes('strengthIntent'),
    'the argument extractor found no `strengthIntent` key, so it is not reading '
    + 'the call — both channel assertions above are passing vacuously');

  // AND THE PARSER IS GONE, everywhere, not just here. `splitSessionName` turned a
  // composed name back into structure; `visibleProjection.ts`'s header calls its
  // existence the proof that names were a data channel between layers. A
  // reintroduction anywhere is the channel reopening.
  const roots = ['rules', 'screens', 'utils', 'components', 'hooks', 'data'];
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    const full = path.join(__dirname, '..', dir);
    if (!fs.existsSync(full)) return;
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(rel); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const text = src(rel);
      // Comments explaining the deletion are the point of the deletion, not a
      // reintroduction. Only real code counts.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (/\bsplitSessionName\b/.test(code)) offenders.push(rel);
    }
  };
  for (const root of roots) walk(root);
  assert(offenders.length === 0,
    `splitSessionName is back in ${offenders.join(', ')}. A name is not evidence `
    + 'about content: ask the projection for `parts`, or name a component from its '
    + 'own typed intent and rows (`strengthComponentDisplayName`).');
});

console.log(`\nProjection ownership totals: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
