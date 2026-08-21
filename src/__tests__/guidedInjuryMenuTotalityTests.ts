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

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  GUIDED_INJURY_AREA_HINT,
  GUIDED_INJURY_AREA_OPTIONS,
  GUIDED_INJURY_REGION_OPTIONS,
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
  ok('"Neck" is offered once, under Back / midline only',
    !GUIDED_INJURY_AREA_OPTIONS.upper_body.includes('Neck')
    && GUIDED_INJURY_AREA_OPTIONS.back_midline.filter((area) => area === 'Neck').length === 1);
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

console.log('\n[3] THE WRITER STILL REFUSES — an unprogrammable area cannot be stored');
{
  /* THE REFUSAL COPY IS GONE, AND THAT IS THE POINT (Sam, 2026-08-21). Its cell
     used to read `GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL`, shown when free text
     resolved to nothing. There is no free text at this door now, so the constant
     went and the hint below is the ONLY thing standing between an athlete whose
     exact area is unlisted and a wrong answer. Section [4] holds the absence. */
  ok('the area step tells them to pick the closest one',
    GUIDED_INJURY_AREA_HINT.length > 0);

  ok('a programmable area passes the predicate', guidedInjuryAreaIsProgrammable('hamstring'));
  // THIS LIST HAS BEEN CORRECTED THREE TIMES BY ITS OWN RUNS, which is worth recording
  // because every correction was the harness being wrong about the app. "rib cage thing"
  // routes (ribs is a region). "tricep" routes to ELBOW — Sam's map covers it. And "shin"
  // left the list on 2026-08-03: Sam's LR-27 ruling (2026-08-02, parked §5) ADDED
  // shin -> calf to the ruling sheet, so it routes now. What is left is genuinely
  // unroutable, and the shortness of the list is itself the finding: his authored
  // routing covers far more free text than the copy did.
  for (const unprogrammable of ['jaw', 'dunno', 'everything']) {
    ok(`"${unprogrammable}" is refused rather than accepted`,
      !guidedInjuryAreaIsProgrammable(unprogrammable));
  }
  // The ruled addition, pinned from the accepting side: shin means calf at this door.
  ok('"shin" is accepted since Sam ruled it to calf (2026-08-02)',
    guidedInjuryAreaIsProgrammable('shin'));

  // UNREPRESENTABLE, not merely refused upstream. The builder is the writer, and a UI
  // convention the next caller can bypass is not a boundary.
  let threw = false;
  try {
    buildGuidedInjuryConstraint({
      region: 'lower_body', area: 'jaw', severity: 6, severityBand: 'moderate',
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

console.log('\n[4] THE SHEET HAS NO TYPED-AREA DOOR AT ALL');
{
  const sheet = fs.readFileSync(
    path.join(src, 'screens/home/GuidedInjuryFlowSheet.tsx'), 'utf8');
  const onboarding = fs.readFileSync(
    path.join(src, 'screens/onboarding/InjuriesScreen.tsx'), 'utf8');
  /**
   * ⚠ **THIS SECTION USED TO HOLD THE REFUSAL. IT NOW HOLDS THE ABSENCE, WHICH
   * IS THE STRONGER PROPERTY** (Sam, 2026-08-21: *"i reckon we just remove the
   * option for other - they're prompted to select the closest match anyway"*).
   *
   * A refusal has to be RE-ASSERTED for every path that reaches the field. An
   * absent field has no paths. So the cells below assert what is NOT there —
   * no `Other` row, no typed-area step, no text input — and section [2]'s
   * reverse direction is what makes that safe to do: all thirteen buckets stay
   * reachable from the rows that remain, so nothing became unreportable.
   */
  ok('the region menu offers exactly Upper body, Lower body and Back / midline',
    GUIDED_INJURY_REGION_OPTIONS.map((option) => option.id).join(',')
      === 'upper_body,lower_body,back_midline',
    GUIDED_INJURY_REGION_OPTIONS.map((option) => option.label));
  ok('no region row is an "Other"',
    !GUIDED_INJURY_REGION_OPTIONS.some((option) => /other/i.test(option.label)
      || /other/i.test(option.id)));
  /* The STEP, not the word: the sheet still names `custom_area` in the comment
     recording that it was removed, and a cell that reds on its own tombstone
     teaches the next reader to delete the history. */
  ok('the sheet has no typed-area step left',
    !/step === 'custom_area'/.test(sheet) && !/setStep\('custom_area'\)/.test(sheet),
    'the step the Other row led to');
  ok('the sheet renders no text input of any kind',
    !/<AppTextInput/.test(sheet) && !/<TextInput/.test(sheet),
    'a free-text area is the one answer this door cannot program around');
  ok('and it carries no refusal copy, because there is nothing left to refuse',
    !/areaRefusal|UNRESOLVABLE_AREA_REFUSAL/.test(sheet));
  ok('the in-app flow applies a non-paused severity immediately without a trigger step',
    sheet.includes('submit(false, option);')
    && !sheet.includes("setStep('triggers')")
    && !sheet.includes('GUIDED_INJURY_TRIGGER_OPTIONS')
    && !sheet.includes('injury-trigger-'));
  ok('updating in-app preserves trigger context originally saved elsewhere',
    sheet.includes('setPreservedTriggers(initial?.triggers ?? [])')
    && sheet.includes('triggers: trainingPaused ? [] : preservedTriggers'));
  ok('onboarding stops after the shared severity scale, then asks whether to repeat',
    onboarding.includes("type InternalStep = 'question' | 'region' | 'area' | 'severity' | 'more'")
    && !onboarding.includes("setStep('triggers')")
    && !onboarding.includes("setStep('notes')")
    && !onboarding.includes('movementTriggers'));
}

console.log('\n[5] SETUP ASKS FROM THE SAME LIST — the second door is closed too');
{
  /**
   * SAM, 2026-08-21: *"do the set up one"* — the first-time setup questions had
   * the SAME `Other area` free-text answer, and worse.
   *
   * **MEASURED BEFORE THE CHANGE.** Setup offered seven rows (Groin, Hamstring,
   * Knee, Ankle, Hip, Lower back, Shoulder) plus `Other area`. The seven all
   * routed. `Other area` routed to NOTHING — the stored-but-filters-nothing
   * state — and six body parts the app can fully program around (quad, calf,
   * neck, elbow, wrist/hand, ribs) **could not be reported at setup at all**,
   * which is what made the text box necessary in the first place.
   *
   * ⚠ **THE FIX IS ONE LIST, NOT TWO LISTS THAT AGREE.** A second copy that
   * happens to match today is the divergence this door has already paid for
   * once (LR-27, five copies of the body-part map). So the cell asserts the
   * screen READS the owner — a copied-and-pasted array would pass a
   * set-equality check and fail this one.
   */
  const setup = fs.readFileSync(
    path.join(src, 'screens/onboarding/InjuriesScreen.tsx'), 'utf8');

  ok('setup renders its top-level regions FROM the injury flow\'s menu',
    setup.includes('GUIDED_INJURY_REGION_OPTIONS.map((option) =>'));
  ok('setup drills into the selected region through the shared area menu',
    setup.includes('GUIDED_INJURY_AREA_OPTIONS[region].map((option) =>'));
  ok('setup renders the same four-band severity scale as the in-app flow',
    setup.includes('GUIDED_INJURY_SEVERITY_OPTIONS.map((option) =>')
    && setup.includes('severityScore: option.severity'));
  ok('setup offers no "Other area" row', !/'Other area'/.test(setup));
  ok('setup has no typed-area step',
    !/step === 'customArea'/.test(setup) && !/setStep\('customArea'\)/.test(setup));
  ok('setup renders no text inputs, trigger step or notes step',
    !/<AppTextInput/.test(setup)
    && !/movementTriggers|WHAT BRINGS IT ON|ANYTHING ELSE/.test(setup));
  ok('setup offers No issues after all initially and No more injuries when repeating',
    setup.includes("injuries.length > 0 ? 'No more injuries' : 'No issues after all'"));
  ok('setup asks whether there are more injuries after each severity answer',
    setup.includes('title="ANY MORE INJURIES?"')
    && setup.includes('setStep(\'more\')'));
  ok('Yes repeats the region and area process; No saves every collected injury',
    setup.includes('const addAnotherInjury = () =>')
    && setup.includes("setStep('region')")
    && setup.includes('const finishInjuries = () =>')
    && setup.includes('commitAndAdvance({ injuries }'));
  ok('back from the repeat question edits rather than duplicates the last injury',
    setup.includes('const editLastInjury = () =>')
    && setup.includes('current.slice(0, -1)')
    && setup.includes("setStep('severity')"));

  // The property that actually matters to the athlete, asked of the list the
  // screen now uses: nothing offerable is unprogrammable.
  const offered = Array.from(new Set(Object.values(GUIDED_INJURY_AREA_OPTIONS).flat()));
  const dead = offered.filter((row) => !guidedInjuryAreaIsProgrammable(row));
  ok('every area setup offers resolves to a bucket', dead.length === 0, dead);
  // And the six that used to be unreportable now are — named, because the
  // shortness of the old list is the finding, not a detail.
  for (const area of ['Quad', 'Calf / Achilles', 'Neck', 'Elbow', 'Wrist / hand', 'Ribs']) {
    ok(`"${area}" can now be reported at setup`, offered.includes(area));
  }
}

console.log(`\nGuided injury menu totality: ${passed} passed, ${failures.length} failed`);
totalsPrinted(failures.length);
console.log('  DEPTH (L13): 0 — a pure predicate over an authored menu.');
console.log('  This door routes through data/injuryRegions.ts — Sam\'s 13 authored');
console.log('  regions. Since the LR-27 convergence (2026-08-03) EVERY door does: the');
console.log('  last copies retired and test:injury-routing-divergence pins each door');
console.log('  equal to the owner at zero divergence.');
if (failures.length > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
