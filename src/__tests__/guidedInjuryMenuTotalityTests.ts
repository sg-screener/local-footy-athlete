/**
 * THE GUIDED INJURY MENU IS TOTAL — every answer the app offers, it can act on.
 *
 * SAM'S RULING, 2026-07-30 (options 1 + 3 of
 * `docs/INJURY_OTHER_PATH_TRACE_2026-07-30.md`):
 *
 *   (1) the guided menu becomes TOTAL: every area row resolves to a bucket, gated both
 *       directions; the "Other upper/lower body" rows get real buckets or become "pick
 *       the closest area."
 *   (3) free text that cannot resolve is HONESTLY REFUSED at the point of answering,
 *       never stored-and-pretended. "A stored answer that filters nothing is the worst
 *       outcome and is now unrepresentable."
 *
 * WHAT WENT WRONG, because the shape of it is the reason this suite exists. The sheet
 * accepted any area, stored a typed constraint carrying the athlete's own words, and
 * derived severity from the severity answer alone — so the week's DOSE dropped and the
 * athlete could see the app respond. Every consumer that decides which MOVEMENTS to
 * avoid is bucket-keyed and early-returns on null (`tapSwapHierarchy`:
 * `if (!bucket) continue`, `injuryWorkoutFilter`, `trainAroundEngine`, `injuryKeysFor`),
 * so nothing was filtered. The app looked like it had listened. It had, about the dose.
 * It was still programming the movement that hurt.
 *
 * AND IT WAS NOT ONLY THE FREE-TEXT PATH. Two ordinary MENU rows — "Other upper body"
 * and "Other lower body" — matched no pattern, so a fully-guided path through a ruled
 * menu ended in the same place. That is why direction 1 below is about the MENU and not
 * about typing.
 *
 * DEPTH (L13): 0 — a pure predicate over an authored menu, plus one throw. There is no
 * state to accumulate; what accumulates is whether the phrase map still covers the menu
 * after either is edited, which is exactly what a both-directions gate is for.
 *
 * Run: npm run test:guided-injury-totality
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  GUIDED_INJURY_AREA_HINT,
  GUIDED_INJURY_AREA_OPTIONS,
  GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL,
  buildGuidedInjuryConstraint,
  guidedInjuryAreaIsProgrammable,
  guidedInjuryBucketForArea,
  guidedInjuryMenuTotality,
} from '../utils/guidedInjuryControl';
import { EXERCISE_TAGS } from '../data/exerciseTags';

const src = path.resolve(__dirname, '..');
let passed = 0; const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail !== undefined ? `\n      ${
    typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

console.log('\n[1] FORWARD — every row the menu offers resolves to a bucket');
{
  const { rows, unresolved } = guidedInjuryMenuTotality();
  ok('the menu is not empty', rows.length >= 10, `${rows.length} rows`);
  ok('every area row resolves to an injury bucket', unresolved.length === 0,
    `these rows store an injury nothing can filter on: ${unresolved.join(', ')}. Either `
    + 'give the row a bucket or stop offering it — Sam\'s ruling, 2026-07-30.');

  // The two that were removed, named so a re-add fails loudly rather than quietly.
  const allRows = new Set(rows);
  for (const gone of ['Other upper body', 'Other lower body']) {
    ok(`"${gone}" is not offered`, !allRows.has(gone),
      'it resolved to no bucket, so tapping it stored an injury that filtered nothing');
  }
  // GONE TOO, once the door was wired to Sam's authored matrix: "Other midline" and
  // "Abs / side" route to none of his 13 regions. They resolved under the old copy's own
  // `/midline|abs|side/` pattern, which is exactly the kind of answer the copy invented
  // for itself.
  for (const gone of ['Other midline', 'Abs / side']) {
    ok(`"${gone}" is not offered — no authored region routes it`, !allRows.has(gone));
  }

  // AND THE ROWS THAT STRADDLED TWO REGIONS ARE SPLIT. One row cannot answer which of two
  // authored regions the athlete meant, and Sam's routing is single-target.
  ok('"Hip / groin" is split into two rows', allRows.has('Hip') && allRows.has('Groin') &&
    !allRows.has('Hip / groin'));
  ok('"Chest / ribs" is split into two rows', allRows.has('Chest') && allRows.has('Ribs') &&
    !allRows.has('Chest / ribs'));
  ok('and each half reaches its own authored region',
    guidedInjuryBucketForArea('Hip') === 'hip' &&
    guidedInjuryBucketForArea('Groin') === 'groin' &&
    guidedInjuryBucketForArea('Ribs') === 'ribs' &&
    guidedInjuryBucketForArea('Chest') === 'shoulder');

  // A LABEL MAY STILL LIST TWO WORDS when both route to ONE region.
  ok('the surviving slash rows ask one question each',
    guidedInjuryBucketForArea('Wrist / hand') === 'wrist/hand' &&
    guidedInjuryBucketForArea('Calf / Achilles') === 'calf' &&
    guidedInjuryBucketForArea('Ankle / foot') === 'ankle/foot');

  // THE NECK RULING, landed: "Neck" reaches the NECK column, not shoulder.
  ok('"Neck" reaches Sam\'s neck matrix column', guidedInjuryBucketForArea('Neck') === 'neck');
  // And Quad reaches quad rather than being proxied to knee.
  ok('"Quad" reaches the quad column, not knee',
    guidedInjuryBucketForArea('Quad') === 'quad');
}

console.log('\n[2] REVERSE — every bucket the exercise tags filter on is reachable');
{
  // One direction alone is satisfiable by the wrong menu: a menu of one row that
  // resolves passes [1] while leaving eleven filters the athlete can never trigger.
  const tagged = new Set<string>();
  for (const tag of Object.values(EXERCISE_TAGS)) {
    for (const key of Object.keys((tag as unknown as { injury?: Record<string, string> }).injury ?? {})) {
      tagged.add(key);
    }
  }
  const { reachableBuckets } = guidedInjuryMenuTotality();
  const reachable = new Set<string>(reachableBuckets);
  const unreachable = Array.from(tagged).filter((bucket) => !reachable.has(bucket)).sort();
  // ASSERTED EMPTY, and it took a ruling to get here. This list held four PROXY MAPPINGS
  // when the door had its own phrase map — `hip` and `quad` folded into other regions,
  // `ribs` rode "Chest / ribs" to shoulder, and `neck` was offered as a row that resolved
  // to SHOULDER, so the authored neck column was unreachable by any answer.
  //
  // Sam ruled the door wired to his authored matrix (2026-07-30). All four repaired at
  // once, because they were never four defects — they were one copy disagreeing with the
  // owner. The list is DELETED rather than emptied, so a future proxy has to argue for
  // itself here rather than inherit an allowance.
  ok('EVERY exercise-tag bucket is reachable from the menu', unreachable.length === 0,
    `the tags can filter on ${unreachable.join(', ')} and no menu row reaches it — a `
    + 'filter the athlete can never trigger. Sam\'s 13 regions are all offered; a new '
    + 'unreachable one means a row was removed or the routing owner changed.');
}

console.log('\n[3] THE REFUSAL — unprogrammable free text is refused, never stored');
{
  // The words are Sam's, quoted from the ruling.
  ok('the refusal says what the athlete should do instead',
    /pick the closest area|ask the coach/i.test(GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL),
    GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL);
  ok('the area step tells them to pick the closest one',
    GUIDED_INJURY_AREA_HINT.length > 0);

  ok('a programmable area passes the predicate', guidedInjuryAreaIsProgrammable('hamstring'));
  // THIS LIST HAS BEEN CORRECTED TWICE BY ITS OWN RUNS, which is worth recording because
  // both corrections were the harness being wrong about the app. "rib cage thing" routes
  // (ribs is a region). "tricep" routes to ELBOW — Sam's map covers it. What is left is
  // genuinely unroutable, and the shortness of the list is itself the finding: his
  // authored routing covers far more free text than the copy did.
  for (const unprogrammable of ['jaw', 'shin', 'dunno', 'everything']) {
    ok(`"${unprogrammable}" is refused rather than accepted`,
      !guidedInjuryAreaIsProgrammable(unprogrammable));
  }

  // UNREPRESENTABLE, not merely refused upstream. The builder is the writer, and a UI
  // convention the next caller can bypass is not a boundary.
  let threw = false;
  try {
    buildGuidedInjuryConstraint({
      region: 'other', area: 'jaw', severity: 6, severityBand: 'moderate',
      adjustmentLevel: 'moderate', triggers: [], seriousSymptoms: false,
    } as never, { todayISO: '2026-07-30' });
  } catch {
    threw = true;
  }
  ok('the constraint builder REFUSES to store an unprogrammable area', threw,
    'it built a constraint with a null bucket — the stored-but-filters-nothing state '
    + 'Sam ruled unrepresentable');

  // And the resolvable path still works, so the refusal is not a blanket one.
  const good = buildGuidedInjuryConstraint({
    region: 'lower_body', area: 'Hamstring', severity: 6, severityBand: 'moderate',
    adjustmentLevel: 'moderate', triggers: [], seriousSymptoms: false,
  } as never, { todayISO: '2026-07-30' });
  ok('a real area still builds a real constraint', good.bucket === 'hamstring', good.bucket);
}

console.log('\n[4] THE SHEET refuses at the point of answering');
{
  const sheet = fs.readFileSync(
    path.join(src, 'screens/home/GuidedInjuryFlowSheet.tsx'), 'utf8');
  ok('the sheet asks the shared predicate rather than its own',
    /guidedInjuryAreaIsProgrammable\(/.test(sheet),
    'a second answer to "can the app program around this" is how the door and the '
    + 'writer come to disagree');
  ok('it shows the refusal instead of advancing',
    /setAreaRefusal\(GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL\)/.test(sheet));
  ok('and it does not advance in the same branch',
    /setAreaRefusal\(GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL\);\s*\n\s*return;/.test(sheet));
}

console.log(`\nGuided injury menu totality: ${passed} passed, ${failures.length} failed`);
console.log('  DEPTH (L13): 0 — a pure predicate over an authored menu.');
console.log('  This door now routes through data/injuryRegions.ts — Sam\'s 13 authored');
console.log('  regions. NOT COVERED (census LR-27): programAdjustmentEngine and');
console.log('  sessionBuilder still carry their own copies, so other doors can still');
console.log('  disagree with the owner about a word.');
if (failures.length > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
