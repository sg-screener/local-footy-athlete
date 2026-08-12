/**
 * WHERE THE ATHLETE ACTUALLY TAPPED — the provenance cell for the coach-note
 * writers, written BEFORE the writers moved.
 *
 * ## Why this cell exists
 *
 * SEAT_INBOX item 8 lifts the modifier controls onto Coach / My Status. The two
 * writers behind them (`handleClearCoachNote`, `handleUpdateCoachNoteStatus`)
 * lived in `useHomeScreen` with **nine hard-coded `screen: 'program_tab'`
 * sites**. Lifting that code unchanged would record every decision the athlete
 * makes on My Status as having happened on the Program tab — and **nothing in
 * the repo would go red**, because no cell reads the recorded screen at all.
 *
 * So the source is a PARAMETER, and this file is the thing that fails when it
 * stops being one.
 *
 * ## THREE PREMISES OF THE ORDER WERE CHECKED, AND TWO WERE FALSE
 *
 * `a-ruling-premise-is-a-claim-too`. The order said the source *"goes into the
 * action tape and the decision ledger"*. Measured 2026-08-12:
 *
 * 1. **THE LEDGER DOES NOT RECORD THESE ACTIONS AT ALL.**
 *    `rules/programControlDecisions.ts` records exactly three action types
 *    (`swap_exercise`, `add_exercise`, `remove_exercise`). Not one coach-note
 *    action is among them. **The tape is the ONLY record**, which is why every
 *    assertion below reads the tape and none reads the ledger.
 *
 * 2. **THE DURABLE DOOR WAS DROPPING THE SCREEN.** `executeProgramControlAction`
 *    builds `route: program_control:<screen>:<surface>`; its durable twin built
 *    `program_control_durable:<surface ?? screen>` — and since every coach-note
 *    action sets a surface, **the screen never reached the tape**. The lift
 *    would not have FORGED the provenance, it would have LOST it, silently,
 *    which is the same defect wearing quieter clothes. One line, fixed in the
 *    same commit as this cell, because a cell asserting an unobservable is prose.
 *
 * 3. **`coach_tab` WOULD HAVE BEEN THE WRONG ANSWER.**
 *    `rules/athleteActionSourceLabel.ts` maps `screen: 'coach_tab'` to the
 *    diagnostic label `'coach'` — that mapping IS the fix Sam asked for on
 *    2026-08-10 (*"shouldn't it be labelled differently … so we can diagnose
 *    whether the issue happened via tap or coach?"*). My Status is an ATHLETE
 *    surface that happens to live on the Coach tab. Stamping it `coach_tab`
 *    would tell a future investigation that the coach resolved the athlete's
 *    injury. So the screen is `'my_status'`, whose label stays `'tap'` — and the
 *    cell below asserts BOTH halves, because getting one right and the other
 *    wrong is the whole failure mode.
 *
 * Run: npm run test:coach-note-action-source
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — provenance is a local question');
};

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { createCoachNoteActions } from '../screens/coach/useCoachNoteActions';
import { athleteActionSourceForDoor } from '../rules/athleteActionSourceLabel';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import type { ActiveFatigueConstraint } from '../store/coachUpdatesStore';
import { selectActiveCoachNotes } from '../utils/activeCoachNotes';
import type { ActiveCoachNote } from '../utils/activeCoachNotes';
import {
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionDiagnosticEvents,
} from '../utils/athleteActionDiagnostics';
import type { ProgramControlScreen } from '../types/programControlAction';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const pendingAsync: Promise<void>[] = [];
function run(name: string, body: () => void | Promise<void>): void {
  const settle = (error?: unknown) => {
    if (error) {
      failed += 1;
      failures.push(`${name}: ${(error as Error)?.message ?? String(error)}`);
    } else {
      passed += 1;
    }
  };
  try {
    const result = body();
    if (result instanceof Promise) {
      pendingAsync.push(result.then(() => settle(), settle));
    } else {
      settle();
    }
  } catch (error) {
    settle(error);
  }
}

const TODAY = '2026-08-12';

/**
 * ONE REAL MODIFIER, THROUGH THE REAL SELECTOR.
 *
 * The note is not hand-built: a constraint goes into the store the athlete's
 * own readiness door writes to, and `selectActiveCoachNotes` — the same
 * derivation both screens read — produces the note. A hand-built note would let
 * the clear path take a branch the athlete's world can never reach.
 */
function seedOneClearableNote(): ActiveCoachNote {
  const constraint: ActiveFatigueConstraint = {
    id: 'tap-load-reduction-provenance',
    type: 'fatigue',
    severity: 5,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: `${TODAY}T08:00:00.000Z`,
    source: 'tap',
    reasonLabel: 'Heavy week',
    // WITHOUT THIS THE MODIFIER IS NOT A NOTE AT ALL. `shouldCreateCoachNote`
    // drops any modifier that changes nothing the athlete can see, so a
    // constraint with no declared reach never reaches a screen — and a seed
    // that omitted it would hand this cell an empty list.
    modifierAffects: ['current_week'],
    rules: [],
    safeFocus: [],
    advice: [],
  };
  useCoachUpdatesStore.setState({
    activeConstraints: [constraint],
    activeInjury: null,
    dismissedCoachNoteIds: [],
  } as never);
  // NO `visibleWeekDays`, DELIBERATELY. The readiness proof gate drops a
  // fatigue note whose reduction it cannot SEE in the week it was handed, and
  // an empty week shows nothing — so passing `[]` would silently produce zero
  // notes and this cell would be measuring an empty list. Omitting it is the
  // documented back-compatible snapshot (`buildActiveCoachNotes`), and this
  // cell's subject is the recorded screen, not the proof gate.
  const notes = selectActiveCoachNotes({
    activeConstraints: [constraint],
    activeInjury: null,
    dismissedCoachNoteIds: [],
  } as never);
  const note = notes.find((candidate) => candidate.constraintId === constraint.id);
  assert(note,
    'the seed produced no coach note — this cell would then assert over an empty '
    + 'tape and pass while measuring nothing (a-bind-can-be-green-and-empty)');
  return note;
}

/** Every screen this run's tape saw, from the door's own route field. */
function screensOnTape(): string[] {
  const screens: string[] = [];
  for (const event of getAthleteActionDiagnosticEvents()) {
    const route = (event as { route?: unknown }).route;
    if (typeof route !== 'string') continue;
    // `program_control:<screen>:<surface>` and its durable twin.
    const parts = route.split(':');
    if (parts[0] !== 'program_control' && parts[0] !== 'program_control_durable') continue;
    if (parts[1]) screens.push(parts[1]);
  }
  return screens;
}

/**
 * THE TAPE HAS TO BE RUNNING OR THIS FILE MEASURES NOTHING.
 *
 * `production: false` is not decoration: the harness sets `__DEV__ = false`,
 * which `productionBuild()` reads as a production build and which switches the
 * diagnostics OFF before `enabled` is even consulted. Without both flags every
 * assertion below would be reading an empty tape.
 */
configureAthleteActionDiagnosticsForTests({ enabled: true, production: false });

async function clearOneNoteFrom(screen: ProgramControlScreen): Promise<string[]> {
  clearAthleteActionDiagnosticEvents();
  const note = seedOneClearableNote();
  const actions = createCoachNoteActions({
    screen,
    notes: [note],
    onResult: async () => {},
  });
  await actions.clearCoachNote(note.id);
  return screensOnTape();
}

/**
 * BOTH RUNS, IN ORDER, ONCE — and the ordering is not tidiness.
 *
 * The tape is a MODULE-LEVEL ring. `run()` starts every async body
 * synchronously, so two cells each clearing the tape and then awaiting a door
 * interleave, and each reads the other's events. The first draft of this file
 * did exactly that and reported the My Status run as `program_tab` six times —
 * a perfect description of a defect that was not there. One sequential
 * measurement, two assertions over its results.
 */
const measured = (async () => ({
  myStatus: await clearOneNoteFrom('my_status'),
  programTab: await clearOneNoteFrom('program_tab'),
}))();

// ── [1] THE LIFT CANNOT MISREPORT WHERE THE ATHLETE ACTED ──────────────────

run('a note cleared from My Status records My Status, not the program tab', async () => {
  const screens = (await measured).myStatus;
  assert(screens.length > 0,
    'the clear recorded NOTHING on the tape — with no record at all there is '
    + 'nothing to be right or wrong about, and this cell would pass on an inert '
    + 'writer forever');
  assert(screens.every((screen) => screen === 'my_status'),
    `a note cleared on My Status was recorded as ${screens.join(',')} — the only `
    + 'record of this decision would say the athlete acted on a screen they '
    + 'never opened');
});

// ── [2] NON-VACUITY: THE SAME DOOR, THE OTHER SOURCE ───────────────────────
//
// Cell [1] alone is satisfied by a writer that hard-codes `my_status`, which is
// the original defect pointing the other way. This is the arm that makes the
// pair a claim about the PARAMETER rather than about either value.

run('the program tab still records the program tab', async () => {
  const screens = (await measured).programTab;
  assert(screens.length > 0, 'the program-tab clear recorded nothing at all');
  assert(screens.every((screen) => screen === 'program_tab'),
    `the program tab's own clear was recorded as ${screens.join(',')} — the lift `
    + 'changed the meaning of the screen that was already there');
});

// ── [3] THE SCREEN REACHES THE TAPE THROUGH THE DURABLE DOOR TOO ───────────
//
// The durable door built its route as `<surface ?? screen>`, and every
// coach-note action sets a surface — so the screen was unobservable on exactly
// the door the injury and readiness writers use. A cell that only measured the
// synchronous door would have been green through the whole defect.

run('the durable door carries the screen, not only the surface', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const file = path.join(__dirname, '..', 'utils', 'programControlActions.ts');
  const source = fs.readFileSync(file, 'utf8');
  const durableRoute = source.match(/program_control_durable:\$\{[^}]*\}/);
  assert(durableRoute,
    'the durable route template is gone from programControlActions.ts — this '
    + 'cell is anchored on a string that no longer exists and is measuring '
    + 'nothing (anchoring law: prove the anchor was FOUND)');
  assert(/screen/.test(durableRoute[0]),
    `the durable door's route is \`${durableRoute[0]}\` — it does not mention the `
    + 'screen, so every durable action with a surface set records where the '
    + 'athlete acted as nothing at all');
});

// ── [4] MY STATUS IS THE ATHLETE'S SURFACE, NOT THE COACH'S VOICE ──────────
//
// The half that is easiest to get wrong while looking right. `coach_tab` was
// the order's suggested value; it maps to the diagnostic label `'coach'`, which
// is the field Sam asked for so an investigation can tell his own tap from a
// coach-authored change. My Status is his tap.

run('a My Status tap is labelled the athlete, never the coach', () => {
  assert(athleteActionSourceForDoor({ screen: 'my_status', initiatedBy: 'tap' }) === 'tap',
    `a My Status tap is labelled `
    + `'${athleteActionSourceForDoor({ screen: 'my_status', initiatedBy: 'tap' })}' — `
    + 'the next investigation would read it as the coach having resolved the '
    + "athlete's own modifier");
  assert(athleteActionSourceForDoor({ screen: 'coach_tab', initiatedBy: 'tap' }) === 'coach',
    'the coach tab stopped being labelled the coach — My Status was given its '
    + 'own screen precisely so this distinction survived, and it has not');
});

void Promise.all(pendingAsync).then(() => {
  configureAthleteActionDiagnosticsForTests(null);
  console.log(`\ncoach-note action source: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFAILURES:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  totalsPrinted(failed);
  process.exit(failed === 0 ? 0 : 1);
});
