/**
 * A DIAGNOSTIC LABEL MUST NAME THE THING A DIAGNOSIS NEEDS TO TELL APART.
 *
 * **Sam, 2026-08-10:** *"well shouldn't it be labelled differently to prevent
 * this issue from happening again? so we can diagnose whether the issue happened
 * via tap or coach?"*
 *
 * ## The founding case, and it cost a pass
 *
 * `source: "tap"` was emitted by BOTH the Program tab's own sheet and the
 * coach's change card, because it was derived from `initiatedBy` — a field that
 * answers *"was a human involved?"*, not *"which door?"*. The seat read
 * `lastTransaction: "tap:move_session:..."` in Sam's export and told him the
 * move had come through the Program tab. It had not; `route` said
 * `coach_tab:coach_change_card`. **A whole pass of his investigation went the
 * wrong way on a field that could not answer the question being asked of it.**
 *
 * `LAW-count-names-instrument`, widened by Sam's question from NUMBERS to
 * LABELS: a value names the axis its own field measures, not the thing the
 * reader wanted to know.
 *
 * ## What this suite holds
 *
 *   [1] THE LABEL NAMES THE DOOR — derived from the screen, one owner.
 *   [2] ONE OPINION PER ACTION — `lastTransaction`'s prefix is minted from the
 *       SAME value the event log carries, so the summary and the log cannot
 *       disagree about one action.
 *   [3] NO SECOND OPINION IN THE SOURCE — nothing may re-derive the label from
 *       `initiatedBy` again. This is the cell that stops the regression.
 *   [4] THE REPAIR SAYS WHICH REPAIR — the other half of Sam's export, where
 *       "measure it, do not assume it" ran out of road because the log recorded
 *       that a repair had been selected and never what it was.
 *
 * Run: npm run test:diagnostic-label-names-the-door
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import fs from 'node:fs';
import path from 'node:path';

import {
  athleteActionSourceForDoor,
  planChangeSourceForDoor,
} from '../rules/athleteActionSourceLabel';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(detail ? `${name} — ${detail}` : name);
}

function read(file: string): string {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/* ── [1] THE LABEL NAMES THE DOOR ─────────────────────────────────── */

{
  // SAM'S EXACT CASE. `initiatedBy: 'tap'` is correct and stays — he DID tap
  // Confirm. What changed is that the label no longer reads that axis.
  const coachCard = {
    screen: 'coach_tab' as const,
    surface: 'coach_change_card',
    initiatedBy: 'tap' as const,
  };
  ok(
    '[1] the coach change card is labelled `coach`, not `tap`',
    athleteActionSourceForDoor(coachCard) === 'coach',
    athleteActionSourceForDoor(coachCard),
  );

  // THE CONTROL, IN THE SAME RUN. Without it, a deriver that returned 'coach'
  // for everything would pass the cell above.
  const programTab = {
    screen: 'program_tab' as const,
    surface: 'plan_change_sheet',
    initiatedBy: 'tap' as const,
  };
  ok(
    '[1] the athlete\'s own sheet is still `tap`',
    athleteActionSourceForDoor(programTab) === 'tap',
    athleteActionSourceForDoor(programTab),
  );

  // AND THE TWO DIFFER. The whole point, asserted as a difference rather than
  // as two independent values — that is what Sam asked for.
  ok(
    '[1] and the two doors do NOT share a label',
    athleteActionSourceForDoor(coachCard) !== athleteActionSourceForDoor(programTab),
  );

  ok(
    '[1] `system` outranks the door',
    athleteActionSourceForDoor({ screen: 'coach_tab', initiatedBy: 'system' }) === 'system',
  );
  ok(
    '[1] the system screen is system',
    athleteActionSourceForDoor({ screen: 'system' }) === 'system',
  );
  ok('[1] a missing source is `tap`, not a throw', athleteActionSourceForDoor(null) === 'tap');

  // LR-6: `coach_notes` is the FROZEN beta surface. It must NOT be counted as
  // the rebuild's coach, or a census of coach-authored decisions counts the old
  // pipeline's writes as the new one's.
  ok(
    '[1] the frozen `coach_notes` surface is not the rebuilt coach',
    athleteActionSourceForDoor({ screen: 'coach_notes' as never }) !== 'coach',
  );
}

/* ── [2] ONE OPINION PER ACTION ───────────────────────────────────── */

{
  const coachCard = { screen: 'coach_tab' as const, initiatedBy: 'tap' as const };
  const programTab = { screen: 'program_tab' as const, initiatedBy: 'tap' as const };

  ok(
    '[2] the producer label agrees with the event label for the coach',
    planChangeSourceForDoor(coachCard) === 'coach'
      && athleteActionSourceForDoor(coachCard) === 'coach',
  );
  ok(
    '[2] and for the athlete\'s own door',
    planChangeSourceForDoor(programTab) === 'tap'
      && athleteActionSourceForDoor(programTab) === 'tap',
  );
  // `system` narrows to `tap` at the producer, and that narrowing is DECLARED
  // rather than happening at a call site.
  ok(
    '[2] `system` narrows to `tap` at the producer, on purpose',
    planChangeSourceForDoor({ screen: 'system' }) === 'tap',
  );

  const producer = read('src/utils/planChangeProducer.ts');
  // `lastTransaction`'s prefix IS the producer's `source`. This pins the shape,
  // because a prefix minted from a literal again is the exact regression.
  ok(
    '[2] lastTransaction\'s prefix is minted from the producer source',
    /reason: `\$\{args\.source\}:move_session:/.test(producer),
  );
  ok(
    '[2] and the door\'s value reaches it',
    /source: args\.doorSource \?\? 'tap'/.test(producer),
  );

  const door = read('src/utils/programControlActions.ts');
  ok(
    '[2] the door hands its derived label to the producer',
    /doorSource: planChangeSourceForDoor\(action\.source\)/.test(door),
  );
}

/* ── [3] NO SECOND OPINION — THE REGRESSION CELL ──────────────────── */

{
  const door = stripComments(read('src/utils/programControlActions.ts'));
  // THE EXACT EXPRESSION THAT CAUSED IT. Not a general ban on reading
  // `initiatedBy` — that field has legitimate readers (`sourceActor`, which is
  // a different axis and correctly ignores the door).
  ok(
    '[3] nothing re-derives the diagnostic label from initiatedBy',
    !/source(: AthleteActionSource)?:?\s*=?\s*action\.source\.initiatedBy === 'system' \? 'system' : 'tap'/
      .test(door),
  );
  ok(
    '[3] the door derives through the one owner instead',
    (door.match(/athleteActionSourceForDoor\(action\.source\)/g) ?? []).length >= 2,
  );

  const owner = read('src/rules/athleteActionSourceLabel.ts');
  ok(
    '[3] the one owner reads the SCREEN, which is what `route` is built from',
    /source\.screen === 'coach_tab'/.test(owner),
  );
}

/* ── [4] THE REPAIR SAYS WHICH REPAIR ─────────────────────────────── */

{
  const gateway = read('src/rules/section18AcceptedWeekGateway.ts');
  ok(
    '[4] the gateway result event names the repair kinds',
    /repairKinds: result\.repairs\.map\(\(repair\) => repair\.kind\)/.test(gateway),
  );

  const replan = read('src/utils/fixtureMinimalReplan.ts');
  ok(
    '[4] the selected repair candidate names them too',
    /repairKinds: winner\.gateway\.repairs\.map\(\(repair\) => repair\.kind\)/.test(replan),
  );

  // AND THE READING THAT MISLED, PINNED SO IT CANNOT BE RE-READ THE OLD WAY.
  // `rejectionCodes` is built from the SELECTED candidate's evaluation, so it
  // is the state AFTER repair. An empty list means "nothing is still wrong",
  // never "nothing was wrong" — which is how four repairs read as a clean run.
  ok(
    '[4] rejectionCodes are the SELECTED candidate\'s, i.e. post-repair',
    /rejectionCodes: result\.evaluation\.blockingViolations/.test(gateway),
  );
  ok(
    '[4] and the field carries the count that makes the pair readable',
    /repairCount: result\.repairs\.length/.test(gateway),
  );
}

/* ── Result ───────────────────────────────────────────────────────── */

console.log(
  `\nDiagnostic label names the door: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
