/**
 * THE CLEAN-RESET DOOR — the guard for the law it implements.
 *
 * **The law (`LAW-unreadable-world-resets-clean`), Sam 2026-08-10:** a stored
 * world the current code cannot read is **RESET CLEAN and the athlete is told
 * once** — never migrated, never silently served by an older set of rules.
 *
 * This suite exists because of what it replaces. `legacyPowerBlockMigration`
 * held the opposite answer in six THROW sites, and the throws were the loud,
 * careful, wrong exit: a stored world the code could not map took the app down
 * at boot rather than letting the athlete in. Its own suite proved the migration
 * worked. **Nothing proved the RULE**, which is why the rule could be reversed
 * by a ruling and no cell noticed.
 *
 * ## What each section holds, and what would break it
 *
 *   [1] READABLE PASSES THROUGH — an ordinary world is not reset. Mutation: make
 *       the classifier stricter and this reds first, before any athlete does.
 *   [2] UNREADABLE RESETS — the four shapes that used to reach a throw.
 *   [3] ABSENT IS NOT A RESET — the first-run trap. An empty device must not be
 *       told its training was destroyed, and this is the cell that says so.
 *   [4] THE TELLING IS OWED, ONCE — derived from the fact, never counted.
 *   [5] NOTHING SALVAGES — the ruling's negative half, which is the half a
 *       later pass would quietly reintroduce ("just try the old reader first").
 *   [6] THE MIGRATION IS GONE — a structural cell over the repo, because a
 *       deletion that gets re-added by a merge is a deletion that did not
 *       happen. `LAW-claim-needs-a-cell`.
 *
 * Run: npm run test:unreadable-world-reset
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import fs from 'node:fs';
import path from 'node:path';

import {
  athleteIsOwedTheResetTelling,
  decideUnreadableWorldReset,
  markResetTelling,
  parseWorldResetFact,
  readStoredWorld,
  WORLD_RESET_NOTICE_DISMISS_ID,
  WORLD_RESET_NOTICE_ID,
  type WorldResetFact,
} from '../rules/unreadableWorldReset';
import { signedCopy, signedCopyEntry } from '../rules/signedCopy';

const repoRoot = path.resolve(__dirname, '../..');
const NOW = '2026-08-10T09:00:00.000Z';

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

/* ── [1] A READABLE WORLD IS NOT TOUCHED ──────────────────────────── */

{
  const envelope = JSON.stringify({
    state: { inputs: { generationAnchorISO: '2026-08-03', sessionFeedback: {} } },
    version: 7,
  });
  const verdict = readStoredWorld(envelope);
  ok('[1] a current-shape envelope reads as readable', verdict.kind === 'readable');
  ok(
    '[1] and it decides NO reset',
    decideUnreadableWorldReset(verdict, NOW).clear === false,
  );

  // A world with no `version` — written before the store was versioned. Readable:
  // the reset door is for worlds we cannot READ, not worlds we dislike.
  const unversioned = readStoredWorld(JSON.stringify({ state: { inputs: {} } }));
  ok('[1] an unversioned envelope is still readable', unversioned.kind === 'readable');

  // An empty `state` is a legitimate world (a fresh install that has persisted
  // once). This cell is the one that catches over-strictness: it is the shape a
  // future "stricter" classifier would wrongly reset.
  const emptyState = readStoredWorld(JSON.stringify({ state: {}, version: 7 }));
  ok('[1] an empty but well-formed state is readable, not reset', emptyState.kind === 'readable');
}

/* ── [2] AN UNREADABLE WORLD RESETS ───────────────────────────────── */

{
  const cases: readonly { readonly label: string; readonly raw: string; readonly reason: string }[] = [
    { label: 'truncated JSON', raw: '{"state":{"inputs":', reason: 'not_json' },
    { label: 'not JSON at all', raw: 'undefined', reason: 'not_json' },
    { label: 'a bare array', raw: '[1,2,3]', reason: 'not_an_object' },
    { label: 'a bare number', raw: '42', reason: 'not_an_object' },
    { label: 'an object with no state', raw: '{"version":7}', reason: 'unrecognised_envelope' },
    { label: 'a state that is not an object', raw: '{"state":"gone"}', reason: 'unrecognised_envelope' },
    { label: 'a state that is an array', raw: '{"state":[]}', reason: 'unrecognised_envelope' },
  ];

  for (const testCase of cases) {
    const verdict = readStoredWorld(testCase.raw);
    ok(`[2] ${testCase.label} reads as unreadable`, verdict.kind === 'unreadable', verdict.kind);
    ok(
      `[2] ${testCase.label} carries its reason`,
      verdict.kind === 'unreadable' && verdict.reason === testCase.reason,
    );
    const decision = decideUnreadableWorldReset(verdict, NOW);
    ok(`[2] ${testCase.label} decides a RESET`, decision.clear === true);
    ok(
      `[2] ${testCase.label} writes a fact with a telling still owed`,
      decision.fact !== null && decision.fact.toldAtISO === null
        && decision.fact.resetAtISO === NOW,
    );
  }

  ok('[2] the sweep covered every unreadable shape it lists', cases.length === 7);
}

/* ── [3] ABSENT IS A FIRST RUN, NOT A RESET ───────────────────────── */

{
  for (const raw of [null, undefined, '', '   ']) {
    const verdict = readStoredWorld(raw);
    ok(
      `[3] ${JSON.stringify(raw)} reads as ABSENT, not unreadable`,
      verdict.kind === 'absent',
      verdict.kind,
    );
    const decision = decideUnreadableWorldReset(verdict, NOW);
    ok(`[3] ${JSON.stringify(raw)} resets nothing`, decision.clear === false);
    ok(
      `[3] ${JSON.stringify(raw)} tells nobody — a first run is not a loss`,
      decision.fact === null,
    );
  }
}

/* ── [4] THE TELLING IS OWED EXACTLY ONCE ─────────────────────────── */

{
  const fresh: WorldResetFact = { resetAtISO: NOW, reason: 'not_json', toldAtISO: null };
  ok('[4] a fresh reset owes the athlete a telling', athleteIsOwedTheResetTelling(fresh));

  const told = markResetTelling(fresh, '2026-08-10T09:05:00.000Z');
  ok('[4] dismissing stamps the decision', told.toldAtISO === '2026-08-10T09:05:00.000Z');
  ok('[4] and the telling is no longer owed', !athleteIsOwedTheResetTelling(told));

  const again = markResetTelling(told, '2026-08-11T09:00:00.000Z');
  ok('[4] a second dismissal does not move the first', again.toldAtISO === told.toldAtISO);

  ok('[4] no fact means nothing owed', !athleteIsOwedTheResetTelling(null));

  // The record is stored, so it can be corrupt. A corrupt record must read as
  // "no reset happened" — if it read as a reset, an unreadable byte would arm a
  // notice forever; if it THREW, the door meant to survive a broken world would
  // become a new way to die.
  for (const bad of ['{', 'null', '[]', '{"resetAtISO":5}', '{"resetAtISO":"x","reason":"nope"}']) {
    ok(`[4] a corrupt reset record (${bad}) reads as null`, parseWorldResetFact(bad) === null);
  }
  const roundTripped = parseWorldResetFact(JSON.stringify(told));
  ok(
    '[4] a good record round-trips',
    roundTripped !== null && roundTripped.toldAtISO === told.toldAtISO
      && roundTripped.reason === 'not_json',
  );
}

/* ── [5] NOTHING SALVAGES, AND THE SENTENCE IS IN THE SHEET ───────── */

{
  const door = read('src/store/unreadableWorldResetDoor.ts');
  const rules = read('src/rules/unreadableWorldReset.ts');

  // The ruling's negative half. A later pass "helping" by reading the old shape
  // first is exactly what Sam forbade, and it would arrive looking like care.
  const salvageWords = /\bmigrate|\bfallback|\bsalvage|\brecover\w*\(/i;
  ok(
    '[5] the door contains no migration/fallback/salvage path',
    !salvageWords.test(door.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
  );

  // The decisions are pure: a rules module that reaches storage is a rules
  // module that cannot be tested without one, and the split is the design.
  ok(
    '[5] the decision module performs no I/O',
    !/asyncStorage|AsyncStorage|localStorage/.test(rules),
  );

  // THE TELLING EXISTS AND IS SIGNED. `signedCopy` throws on an unregistered id,
  // so calling it IS the assertion.
  const notice = signedCopy(WORLD_RESET_NOTICE_ID);
  ok('[5] the athlete-facing sentence is in the signed sheet', notice.length > 0);
  ok('[5] and so is its dismissal', signedCopy(WORLD_RESET_NOTICE_DISMISS_ID).length > 0);

  // Plain coach English: no file names, no error codes, no jargon in the words
  // the athlete reads. `LAW-plain-coach-english`, on the surface that IS in the repo.
  ok(
    '[5] the sentence carries no jargon, code or file name',
    !/\b(powerBlock|envelope|JSON|migration|hydrat\w*|null|undefined|_)\b/i.test(notice),
    notice,
  );

  // The provenance says UNSIGNED, because Sam has not signed these words. A row
  // claiming a signature he never gave is worse than an honest gap.
  const entry = signedCopyEntry(WORLD_RESET_NOTICE_ID);
  ok(
    '[5] the entry says plainly that Sam has not signed the words',
    entry !== null && /UNSIGNED/.test(entry.provenance),
  );

  // The door is mounted where the athlete can reach it in EITHER tree. A built
  // surface nobody renders is the dead-affordance shape (L5), inverted.
  const root = read('src/navigation/RootNavigator.tsx');
  ok('[5] the notice is mounted at the root', /<WorldResetNotice\s*\/>/.test(root));
}

/* ── [6] THE MIGRATION IS GONE, AND STAYS GONE ────────────────────── */

{
  ok(
    '[6] rules/legacyPowerBlockMigration.ts no longer exists',
    !fs.existsSync(path.join(repoRoot, 'src/rules/legacyPowerBlockMigration.ts')),
  );
  ok(
    '[6] its suite no longer exists',
    !fs.existsSync(path.join(repoRoot, 'src/__tests__/legacyPowerBlockMigrationTests.ts')),
  );

  const store = read('src/store/programStore.ts');
  for (const symbol of [
    'migrateStoredPowerBlock',
    'migrateHydratedStatePowerBlocks',
    'assertNoUnmigratedPowerBlock',
  ]) {
    ok(
      `[6] programStore no longer calls ${symbol}`,
      !new RegExp(`${symbol}\\s*\\(`).test(store.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
    );
  }

  // TWO CELLS STOOD HERE AND ARE DELETED (2026-08-14).
  //
  //   [6] the generator-recovery lift survived the deletion
  //   [6] and it still runs above the ingress branch
  //
  // They were written in 2026-08-10 as a censused risk: the power migration
  // being deleted also CARRIED `liftGeneratorRecoveryToRest`, and a commit that
  // read as "remove the power migration" would have taken a second, unrelated
  // ruling with it in silence. They did their job — they made that deletion say
  // out loud what it was taking.
  //
  // THE LIFT IS NOW DELETED ON PURPOSE, WITH ITS OWN REASONING, so these two
  // have flipped from a guard into a blocker: they assert the CONTINUED
  // PRESENCE of source that has been deliberately removed. It is removed because
  // it could not run — `programStore.partialize` persists INPUTS only, so no
  // launch reads a stored program back and there was never a stored recovery
  // session to lift — and because the generator no longer places recovery at
  // all, so there was nothing to lift even in principle.
  //
  // THE RULING ITSELF DID NOT GO WITH THE CODE. "The generator never places
  // recovery uninvited" is now asserted where it can actually be observed — by
  // RUNNING the generator — in `section18RecoveryNeutralityTests`, cell "THE
  // UPSTREAM HALF — no optional work is placed authorless", which carries the
  // predicate inline.

  // The read door is wired. A door nobody calls is the thing the previous stop
  // report caught the hook doing: an exit described and never cut.
  ok(
    '[6] the program store reads through the clean-reset door',
    /readStoredWorldOrResetClean\s*\(/.test(store),
  );

  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  ok('[6] test:power-migration is out of the chain', !('test:power-migration' in pkg.scripts));
  ok(
    '[6] and this suite is IN it — a check outside the chain is a check nobody runs',
    pkg.scripts['test:bible'].includes('test:unreadable-world-reset'),
  );
}

/* ── Result ───────────────────────────────────────────────────────── */

console.log(
  `\nUnreadable-world clean reset: passed=${passed}/${passed + failures.length} failures=${failures.length}`,
);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
