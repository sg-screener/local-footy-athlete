/**
 * ONE OWNER OF "A REBUILD IS HAPPENING" — the ownership boundary, not the pixel.
 *
 * A rebuild is ONE event in the athlete's world: `runRebuild` rebuilds their one
 * program. Before this gate, the day screen owned the telling of it in its own
 * `useState`s, so the moment a second surface showed the same notice there were
 * TWO writers of one fact — and the first disagreement is "the coach screen says
 * it finished while the day screen is still spinning".
 *
 * WHAT THIS GATE ASSERTS
 *   [1] The owner behaves: begin/end/error/clear do what the day screen used to
 *       do inline, INCLUDING the rule that clearing an error restores canRetry.
 *   [2] Two independent readers see ONE truth — the property per-screen state
 *       cannot have, asserted by reading the store twice around one write.
 *   [3] The day screen no longer holds rebuild state of its own, and no longer
 *       runs the ticker. Both are the "it was a MOVE" half.
 *   [4] The day screen's RENDERING did not change — the same field names reach
 *       the same components. Without this, [3] would pass on a deletion.
 *   [5] The store stays node-callable: no `react-native` import in the store
 *       layer, which is what keeps [1] and [2] behavioural rather than regex.
 *
 * WHAT IT DELIBERATELY DOES NOT ASSERT
 *   That the coach status screen mounts the notice. It does not yet — that is
 *   the next step, and a gate claiming it today would be prose. When it lands,
 *   the tape that matters is a rebuild started from the coach page showing on
 *   BOTH surfaces and landing on the SAME decision the day screen writes.
 *
 * Run: npm run test:rebuild-notice-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import { stripComments } from './support/sourceText';
import {
  useRebuildNoticeStore,
  beginRebuildNotice,
  endRebuildNotice,
  advanceRebuildMessage,
  setRebuildNoticeError,
  clearRebuildNoticeError,
  resetRebuildNotice,
} from '../store/rebuildNoticeStore';
import { REBUILD_MESSAGES } from '../screens/home/homeScreenConstants';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const read = (relative: string): string =>
  stripComments(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));

const raw = (relative: string): string =>
  fs.readFileSync(path.join(repoRoot, relative), 'utf8');

console.log('\n[1] The owner behaves — begin, end, error, clear');
{
  resetRebuildNotice();
  ok('idle to start', useRebuildNoticeStore.getState().isRebuilding === false);

  // A failed attempt that forbade retry, left over from last time.
  setRebuildNoticeError('Could not reach the coach.', false);
  ok('an error is held as user-facing copy',
    useRebuildNoticeStore.getState().error === 'Could not reach the coach.');
  ok('canRetry=false is held', useRebuildNoticeStore.getState().errorCanRetry === false);

  // THE RULE THAT MATTERS: a stale canRetry=false must not survive into the
  // next attempt and suppress the retry button. It was a comment on the day
  // screen's clearRebuildError; it is now the owner's, and asserted.
  clearRebuildNoticeError();
  ok('clearing the error restores canRetry to true',
    useRebuildNoticeStore.getState().errorCanRetry === true);
  ok('clearing the error clears the copy',
    useRebuildNoticeStore.getState().error === null);

  // Begin must also clear a previous attempt's error — the day screen used to
  // call clearRebuildError() as its own fourth preamble line.
  setRebuildNoticeError('Old failure.', false);
  advanceRebuildMessage();
  beginRebuildNotice();
  const begun = useRebuildNoticeStore.getState();
  ok('begin marks a rebuild running', begun.isRebuilding === true);
  ok('begin resets to the first message', begun.msgIdx === 0);
  ok('begin clears the previous attempt error', begun.error === null);
  ok('begin restores canRetry', begun.errorCanRetry === true);

  endRebuildNotice();
  ok('end stops the rebuild', useRebuildNoticeStore.getState().isRebuilding === false);
}

console.log('\n[2] Two readers, one truth');
{
  resetRebuildNotice();
  // Two independent reads, as two mounted screens would do. Per-screen state
  // cannot pass this: each screen would hold its own false.
  const readerA = () => useRebuildNoticeStore.getState().isRebuilding;
  const readerB = () => useRebuildNoticeStore.getState().isRebuilding;
  beginRebuildNotice();
  ok('a rebuild started anywhere is visible to reader A', readerA() === true);
  ok('the SAME rebuild is visible to reader B', readerB() === true);
  ok('and the two readers agree', readerA() === readerB());

  setRebuildNoticeError('It failed.', true);
  ok('the failure copy is one value, not per-screen',
    useRebuildNoticeStore.getState().error === 'It failed.');
  endRebuildNotice();
  ok('ending it is visible to both', readerA() === false && readerB() === false);
}

console.log('\n[3] The message index wraps, and only the owner writes it');
{
  resetRebuildNotice();
  ok('the message list is non-empty', REBUILD_MESSAGES.length > 0);
  for (let i = 0; i < REBUILD_MESSAGES.length; i += 1) advanceRebuildMessage();
  ok('advancing a full lap returns to the first message',
    useRebuildNoticeStore.getState().msgIdx === 0);
  advanceRebuildMessage();
  ok('and the next advance moves on',
    useRebuildNoticeStore.getState().msgIdx === 1 % REBUILD_MESSAGES.length);
  resetRebuildNotice();
}

console.log('\n[4] The day screen no longer owns any of it');
{
  const hook = read('src/screens/home/useHomeScreen.ts');
  ok('no local isRebuilding state', !/useState[^\n]*\n?[^\n]*setIsRebuilding/.test(hook)
    && !/setIsRebuilding\(/.test(hook));
  ok('no local rebuild error state', !/setRebuildError\(/.test(hook)
    && !/setRebuildErrorCanRetry\(/.test(hook));
  ok('no local message index state', !/setRebuildMsgIdx\(/.test(hook));
  ok('no local Animated fade for the notice',
    !/rebuildMsgOpacity\s*=\s*useRef/.test(hook));
  // The ticker is the one that had to move: two mounted readers running two
  // intervals would rotate the messages at double speed.
  ok('the rotation interval is gone from the day screen',
    !/REBUILD_MSG_INTERVAL_MS/.test(hook));

  ok('the day screen reads the shared notice', /useRebuildNotice\(\)/.test(hook));
  // RE-AIMED 2026-08-12 (SEAT_INBOX item 8). The notice's WRITES moved out of
  // the day screen into `hooks/useProgramRebuild`, because Coach / My Status can
  // now cause a rebuild and a second writer would be a second opinion about
  // whether one is running. This section's claim — *the day screen no longer
  // owns any of it* — got STRONGER, not weaker: it now writes none of it either.
  const rebuildOwner = read('src/hooks/useProgramRebuild.ts');
  ok('the rebuild owner writes through the notice s acts',
    /beginRebuildNotice\(\)/.test(rebuildOwner) && /endRebuildNotice\(\)/.test(rebuildOwner)
    && /setRebuildNoticeError\(/.test(rebuildOwner));
  ok('and the day screen writes NONE of them itself',
    !/beginRebuildNotice\(\)/.test(hook) && !/endRebuildNotice\(\)/.test(hook));
}

console.log('\n[5] The rendering did NOT change — this was a move, not a rewrite');
{
  const hook = read('src/screens/home/useHomeScreen.ts');
  // The counterweight to [4]: without these, deleting the notice outright
  // would pass every assertion above.
  //
  // SCOPED TO THE RETURN OBJECT, AND THAT IS THE WHOLE POINT. The first cut of
  // this cell searched the WHOLE FILE for `\n    <field>,` — which the hook's
  // own `const { ... } = useRebuildNotice()` destructure matches at the same
  // indent. Every field "passed" while the return was missing it; dropping
  // `rebuildMsgOpacity` from the return was the one mutation of seven this
  // suite let through. A bind can be green and empty: assert the thing the
  // screen actually reads, not any line that spells the name.
  const returnBlock = hook.slice(hook.lastIndexOf('\n  return {'));
  ok('the return block was located', returnBlock.length > 0 && returnBlock.length < hook.length);
  for (const field of ['isRebuilding', 'rebuildError', 'rebuildErrorCanRetry',
    'rebuildMsgIdx', 'rebuildMsgOpacity']) {
    ok(`the hook still RETURNS ${field} to the screen`,
      new RegExp(`\\n\\s{4}${field},`).test(returnBlock));
  }
  const v2 = read('src/screens/home/HomeScreenV2.tsx');
  ok('the progress sheet is still mounted on the day screen', /<RebuildSheet/.test(v2));

  // Every begin is paired with an end, or a rebuild would spin forever.
  // COUNTED IN THE OWNER, where the acts now live. Counting them in a file that
  // has none would read `0 === 0` and pass — the vacuous shape this suite's own
  // comment above is about.
  const rebuildOwnerSource = read('src/hooks/useProgramRebuild.ts');
  const begins = (rebuildOwnerSource.match(/beginRebuildNotice\(\)/g) || []).length;
  const ends = (rebuildOwnerSource.match(/endRebuildNotice\(\)/g) || []).length;
  ok(`every begin has an end (begins=${begins} ends=${ends})`,
    begins > 0 && begins === ends);
}

console.log('\n[6] The store layer stays node-callable');
{
  // This is why [1]-[3] are real calls and not regexes. An Animated.Value
  // cannot be constructed in this harness, so a store importing react-native
  // would be the only store its own suite could not exercise. The fade and the
  // ticker live in hooks/useRebuildNotice.ts for exactly that reason.
  const store = raw('src/store/rebuildNoticeStore.ts');
  ok('the store does not import react-native',
    !/from ['"]react-native['"]/.test(stripComments(store)));

  const hookFile = stripComments(raw('src/hooks/useRebuildNotice.ts'));
  ok('the fade is a module singleton, not per-mount',
    /^export const rebuildMsgOpacity = new Animated\.Value\(/m.test(hookFile));
  ok('the ticker subscribes once at module scope, not in an effect',
    /useRebuildNoticeStore\.subscribe\(/.test(hookFile)
    && !/useEffect/.test(hookFile));
  ok('the reader hands out no setters',
    !/setState/.test(hookFile));
}

const total = passed + failures.length;
console.log(`\nRebuild notice ownership: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
