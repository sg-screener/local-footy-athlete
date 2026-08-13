/**
 * A FATIGUE STREAK IS NOT A DETRAINED BASELINE — the last laundering sites.
 *
 * SAM'S ORDER, 2026-08-13: *"'Readiness' means two unrelated things in this app
 * — the athlete's own declaration, and a capacity score from onboarding — and
 * ten call sites read the wrong one. Give them separate names and fix the call
 * sites."* The names landed first (`CapacityBand` / `capacity`, R-041 + R-064).
 * **This is the fix to the call sites.**
 *
 * ## THE SHAPE, AND WHY SAM HAD ALREADY KILLED IT ONCE
 *
 * `calculateCapacity` carries his deletion in a comment — THE LAUNDERING SITE:
 *   *"This used to step the CAPACITY score down on `deloaded`. That converted
 *   the law's boolean straight back into a magnitude, and every
 *   `readiness === 'low'` branch in this engine then read it — so one
 *   declaration of 'wrecked' quietly reclassified the athlete as permanently
 *   detrained and rebuilt their week as recovery work."*
 *
 * **Three writers survived that sweep**, doing the identical thing from session
 * FEEDBACK rather than from a declaration:
 *   - `feedbackPatterns.applyPatternBiases`  — FATIGUE_STREAK, MIXED_SIGNALS
 *   - `feedbackAdapter.applyReadinessBias`   — the adaptation's `readinessBias`
 *   - `feedbackPatterns.biasConditioningReadiness` — the conditioning arm
 *
 * ## WHAT THE MEASUREMENT SHOWED, AND WHY THE FIX IS A NEW FIELD
 *
 * `progressionRules`'s soft-deload counter reads:
 *
 *     if (input.capacity === 'low') softCount++;
 *     if (rpe >= 8) softCount++;
 *     if (input.missedSessionsThisWeek >= 1) softCount++;
 *     if (input.sessionFeeling === 'Cooked') softCount++;
 *
 * **`capacity` sat in that list as a PEER of three genuine fatigue signals.**
 * So the writers were lowering the band to buy one fatigue vote — and paying
 * for it everywhere else `capacity` is read: the phase build/hold branches, the
 * two high-capacity gates, and the athlete-visible note string
 * *"Pre-season, low capacity - build"* for a man whose onboarding said he trains
 * consistently.
 *
 * `feedbackPatterns`' own comment already knew they were one axis —
 * *"This prevents double-stacking: readiness down + feeling up would be two
 * steps."* **So the vote gets its own name.** `recentFatiguePattern` is written
 * by the same two places, read by the same counter, weighted the same, and
 * cannot be mistaken for a statement about the athlete's baseline.
 *
 * ## ⚠ WHAT `test:qa` PROVED, AND WHAT IT DID NOT
 *
 * The 17-scenario corpus is **BYTE-IDENTICAL** either side of this change —
 * 1393 lines, zero diff, 168/10 both ways. **That is inertness, not safety.**
 * Those scenarios generate from profiles with no session-feedback history, so
 * FATIGUE_STREAK, MIXED_SIGNALS and the adaptation never fire in them: the
 * corpus is BLIND to this path, and a zero diff there would look exactly the
 * same if the change were wrong. **This suite is the evidence the corpus cannot
 * give**, which is why the field's own law requires it.
 *
 * Run: npm run test:progression-capacity-laundering
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import {
  applyPatternBiases,
  conditioningReportsRecentFatigue,
  type FeedbackPatternSummary,
  type PatternFlag,
} from '../utils/feedbackPatterns';
import { adaptationReportsFatigue, type AdaptationResult } from '../utils/feedbackAdapter';
import {
  DEFAULT_PROGRESSION_CONTEXT,
  type StrengthProgressionContext,
} from '../utils/strengthProgressionIntegration';
import { resolveProgression, type ProgressionInput } from '../utils/progressionRules';
import {
  resolveConditioningProgression,
  type ConditioningProgressionInput,
} from '../utils/conditioningProgressionRules';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function summary(flags: PatternFlag[]): FeedbackPatternSummary {
  return {
    sampleSize: 4,
    fatigueTrend: 'rising',
    completionTrend: 'declining',
    progressionConfidence: 'over_reached',
    activeFlags: flags,
  };
}

function ctx(over: Partial<StrengthProgressionContext> = {}): StrengthProgressionContext {
  return { ...DEFAULT_PROGRESSION_CONTEXT, capacity: 'high', ...over };
}

/** One fatigue signal short of a soft deload, so the vote under test decides. */
function input(over: Partial<ProgressionInput> = {}): ProgressionInput {
  return {
    exerciseRole: 'primary_strength',
    seasonPhase: 'Off-season',
    capacity: 'high',
    recentFatiguePattern: false,
    completionQuality: 'full',
    weeksSinceDeload: 1,
    consecutiveBuildWeeks: 1,
    recentRPE: 8,            // exactly ONE fatigue signal
    daysToGame: null,
    daysSinceGame: null,
    doubleGameWeek: false,
    weeksOffTraining: 0,
    injuryAvoidFlag: false,
    recentDeloadTrigger: null,
    missedSessionsThisWeek: 0,
    sessionFeeling: 'Good',
    trend: 'flat',
    isLowerBody: false,
    consecutiveFullCompletions: 1,
    ...over,
  } as ProgressionInput;
}

console.log('\n[1] THE WRITERS — feedback no longer touches the capacity band');
{
  const fit = ctx({ capacity: 'high' });

  const streak = applyPatternBiases(fit, summary(['FATIGUE_STREAK']));
  ok('[R-041] a FATIGUE_STREAK leaves the capacity band alone',
    streak.capacity === 'high',
    `capacity became ${streak.capacity} — a bad fortnight is not a detrained baseline`);
  ok('a FATIGUE_STREAK casts the fatigue vote instead',
    streak.recentFatiguePattern === true);

  const mixed = applyPatternBiases(fit, summary(['MIXED_SIGNALS']));
  ok('[R-041] MIXED_SIGNALS leaves the capacity band alone',
    mixed.capacity === 'high', `capacity became ${mixed.capacity}`);
  ok('MIXED_SIGNALS casts the fatigue vote instead',
    mixed.recentFatiguePattern === true);

  // The medium band was the one that used to fall to 'low' and trip every
  // `capacity === 'low'` branch downstream. It is the interesting case.
  const middling = applyPatternBiases(ctx({ capacity: 'medium' }), summary(['FATIGUE_STREAK']));
  ok('[the old defect, exactly] a MEDIUM athlete is not pushed to low',
    middling.capacity === 'medium',
    `capacity became ${middling.capacity} — this is the step that used to trip the `
    + 'soft-deload counter, the phase branches and the "low capacity" note at once');

  // No summary at all must change nothing, or every athlete without feedback
  // history carries a free vote.
  const none = applyPatternBiases(fit, null);
  ok('[control] no pattern summary changes nothing',
    none.capacity === 'high' && none.recentFatiguePattern === false);
}

console.log('\n[2] ONE VOTE, NOT TWO — the double-stacking guard still holds');
{
  const both = applyPatternBiases(
    ctx({ capacity: 'high' }), summary(['FATIGUE_STREAK', 'MIXED_SIGNALS']),
  );
  // The field is a boolean, so two flags cannot buy two votes. The original code
  // needed an explicit `!flags.includes('FATIGUE_STREAK')` guard to get this;
  // the shape now enforces it, and the guard is kept as documentation.
  ok('two fatigue flags still cast exactly one vote',
    both.recentFatiguePattern === true && both.capacity === 'high');
}

console.log('\n[3] THE READER — the vote still buys a soft deload, at the same weight');
{
  // One other signal (rpe 8) plus the pattern = 2 = soft deload. This is the
  // behaviour the laundering used to produce, now produced honestly.
  const withPattern = resolveProgression(input({ recentFatiguePattern: true }));
  ok('[the vote counts] one fatigue signal + a recent pattern = soft deload',
    /Soft deload/i.test(withPattern.note ?? ''),
    `note: ${withPattern.note}`);
  ok('and the deload names the pattern in its own words',
    /recent fatigue pattern/i.test(withPattern.note ?? ''),
    `note: ${withPattern.note} — the signal list must say which signals fired`);

  // NON-VACUITY. Without this cell the one above could pass because everything
  // deloads. Same input, vote withdrawn, no deload.
  const without = resolveProgression(input({ recentFatiguePattern: false }));
  ok('[non-vacuity] the SAME input without the pattern does NOT soft deload',
    !/Soft deload/i.test(without.note ?? ''),
    `note: ${without.note} — if this deloads too, the cell above proves nothing`);

  // AND THE VOTE IS WORTH EXACTLY ONE. A lone pattern with no other signal must
  // not deload on its own, or the swap silently doubled its weight.
  const alone = resolveProgression(input({ recentRPE: 6, recentFatiguePattern: true }));
  ok('[weight] the pattern ALONE is one signal and does not reach the threshold',
    !/Soft deload/i.test(alone.note ?? ''),
    `note: ${alone.note} — the counter needs 2+, so one vote must not be enough`);
}

console.log('\n[4] THE ADAPTATION ARM — same cut, different writer');
{
  const down: AdaptationResult = {
    feelingOverride: null, readinessBias: 'down', volumeAdjustment: 0,
  } as AdaptationResult;
  const flat: AdaptationResult = {
    feelingOverride: null, readinessBias: null, volumeAdjustment: 0,
  } as AdaptationResult;

  ok('a "down" adaptation reports fatigue', adaptationReportsFatigue(down) === true);
  ok('[control] a neutral adaptation does not', adaptationReportsFatigue(flat) === false);
  // The old export took a CapacityBand and returned a lowered one. Its
  // replacement cannot: it returns a boolean and has no band to give back.
  ok('[structural] the replacement cannot return a capacity band at all',
    typeof adaptationReportsFatigue(down) === 'boolean');
}

console.log('\n[5] THE DEFAULT IS THE ABSENCE OF THE SIGNAL');
{
  // "No history" must never mean "assume fatigued", or every new athlete starts
  // with a free soft-deload vote and progresses more slowly than the law says.
  ok('an athlete with no history carries no fatigue vote',
    DEFAULT_PROGRESSION_CONTEXT.recentFatiguePattern === false);
  ok('and no history does not move the capacity band either',
    DEFAULT_PROGRESSION_CONTEXT.capacity === 'medium');
}

console.log('\n[6] THE CONDITIONING ARM — the same cut, the third writer');
{
  // `biasConditioningReadiness` was the last of the three. It stepped the band
  // down and handed the result to `buildWeekLog`, so the corrupted value became
  // `WeekLog.capacity` and reached every reader beyond it.
  ok('[R-041] a fatigue streak reports fatigue without touching a band',
    conditioningReportsRecentFatigue(summary(['FATIGUE_STREAK'])) === true);
  ok('COOKED_REPEAT reports it too', conditioningReportsRecentFatigue(summary(['COOKED_REPEAT'])) === true);
  ok('MIXED_SIGNALS reports it too', conditioningReportsRecentFatigue(summary(['MIXED_SIGNALS'])) === true);
  ok('[control] a clean week reports no fatigue',
    conditioningReportsRecentFatigue(summary(['EASE_STREAK'])) === false);
  ok('[control] no summary reports no fatigue',
    conditioningReportsRecentFatigue(null) === false);
  // STRUCTURAL: the replacement has no band to give back, so the old shape
  // cannot be restored without changing the signature.
  ok('[structural] it cannot return a capacity band at all',
    typeof conditioningReportsRecentFatigue(summary(['FATIGUE_STREAK'])) === 'boolean');

  // THE READER. Without this the conditioning field would have a writer and a
  // test and no proof anything consumes it — the `canOverride` shape, written
  // nine times and read zero.
  const condInput = (over: Partial<ConditioningProgressionInput> = {}) => ({
    tier: 'B-high', capacity: 'high', recentFatiguePattern: false,
    recentRPE: 8,                       // exactly ONE other fatigue signal
    completionQuality: 'full', hasAvoidInjury: false, hasModifyInjury: false,
    seasonPhase: 'Off-season', weeklyConditioningCount: 2, daysToGame: null,
    doubleGameWeek: false, highFatigueStrengthThisWeek: false,
    lastSessionProgressed: false, weeklyLoad: 100, previousWeekLoad: 100,
    currentReps: 6, currentIntervals: 6, currentDuration: 20, currentRest: 60,
    ...over,
  } as ConditioningProgressionInput);

  const condWith = resolveConditioningProgression(condInput({ recentFatiguePattern: true }));
  ok('[the vote counts] conditioning: one signal + a recent pattern = soft deload',
    /Soft deload/i.test(condWith.note ?? ''), `note: ${condWith.note}`);
  ok('and it names the pattern in the signal list',
    /recent fatigue pattern/i.test(condWith.note ?? ''), `note: ${condWith.note}`);

  const condWithout = resolveConditioningProgression(condInput({ recentFatiguePattern: false }));
  ok('[non-vacuity] conditioning: the SAME input without the pattern does NOT deload',
    !/Soft deload/i.test(condWithout.note ?? ''),
    `note: ${condWithout.note} — if this deloads too, the cell above proves nothing`);
}

// ── NOT COVERED — A SURVIVING MUTANT, NAMED WITH ITS RECEIPT ───────────────
//
// **THIS SUITE HOLDS THE WRITERS AND THE READERS. IT DOES NOT HOLD THE WIRE
// BETWEEN THEM, AND THAT IS MEASURED, NOT SUSPECTED.**
//
// Mutant M5: in `sessionResolver`, replace
//     const conditioningRecentFatigue = conditioningReportsRecentFatigue(...)
// with `= false`. The vote is then computed correctly, read correctly, and
// never travels. **`test:conditioning-dose` stayed 12/0 and this suite stayed
// green.** Four other mutants in this family were killed; that one survives.
//
// It survives for the same reason `test:qa` is byte-identical across this whole
// change: **no suite in the chain generates a week from an athlete with real
// session-feedback history**, so the flags never fire in any generated world.
//
// **AND THE CHEAP WAY OUT WAS TRIED AND MEASURED, NOT ASSUMED.** Driving
// `resolveWeekWithConditioning(monday, state)` directly with a hand-built
// `ScheduleState` does NOT work:
//   - the feedback set is right — `analyzeFeedbackPatterns` on four `very_hard`
//     sessions returns `FATIGUE_STREAK, COOKED_REPEAT, FULL_COMPLETION_RUN,
//     MIXED_SIGNALS`, so the writer would fire;
//   - but with `currentProgram: null` the resolver returns **seven empty days**,
//     identical with and without the feedback. **There is nothing for the
//     conditioning pass to place, so the wire is never exercised.**
// A test built on that state would have been GREEN, PROVED NOTHING, and looked
// exactly like a passing wire test — the precise failure this suite's header
// warns about one paragraph up.
//
// **So killing M5 needs a SEEDED world (accepted program + profile), which is
// the walker's territory (L13) and a unit of its own.** That is now a
// measurement, not a guess.
//
// **Recorded here rather than in a status file because a surviving mutant that
// only the author knows about is the same as no mutation testing at all.**
console.log('\n  NOT COVERED: the resolver -> input WIRE (mutant M5 survives) '
  + '— needs a walker world with feedback history; see docs/STATUS_READINESS.md');

const total = passed + failures.length;
console.log(`\nProgression capacity laundering: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
