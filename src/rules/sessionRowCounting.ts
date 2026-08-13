/**
 * The ONE role-filtered choke point.
 *
 * Sam's ruling (2026-07-27): "fence semantics at one role-filtered choke point
 * serving taxonomy and the exercise budget (one cap, every training age; power
 * rows never count against it)".
 *
 * ## Why one place rather than a guard per probe
 *
 * Power's counting fence — not a hard exposure, not main strength, no
 * conditioning credit, not a finisher — used to be enforced BY ABSENCE: power
 * lived in `workout.powerBlock`, so nothing that iterated `workout.exercises`
 * could count it, and the block's `counting` object merely documented a
 * guarantee the data shape already made. Power is a row now, so that guarantee
 * is gone and this module is what replaced it.
 *
 * The obvious repair is a guard at each counter. This repo bans that pattern for
 * good reason: `sessionTaxonomy` has FOUR probes over the row list today, and a
 * fifth added next month would silently miss its guard. So the probes stop
 * reading `workout.exercises` and read this instead. The fence gains a POSITIVE
 * definition for the first time — before: "power is not in the list"; after:
 * "power's role does not participate in counting" — a fact the code states
 * rather than one the data shape implies.
 *
 * ## The Explosive Push-up trap
 *
 * This is not theoretical. Of the seven power-pool entries, `Explosive Push-up`
 * matches `MAIN_LIFT_EXERCISE_RX` (via `push[-\s]?ups?`) and is a
 * `horizontal_press` exposure. As a row it would hand `hasMainLiftExercises`
 * main-lift proof, turning an accessory-named session into `upper_strength` and
 * flowing into `mainStrengthExposures`, the 4-session cap and hard-day grading —
 * directly contradicting `mainStrength: false`. Six of seven entries are
 * harmless; that asymmetry is why it would pass most tests and most device
 * passes.
 *
 * Hence the ordering rule this module exists to enforce: FILTER BY ROLE BEFORE
 * ANY NAME PROBE RUNS. A name probe over an unfiltered list is the bug.
 *
 * ## Why exemption rather than inclusion
 *
 * The predicate removes rows; it never adds them. A row with no authored role
 * has not been declared exempt, so it counts — which is exactly what happened
 * before roles existed. That makes this module incapable of moving a count by
 * omission, which is what let Stage 2 prove byte-equivalence rather than assert
 * it, and what keeps un-migrated legacy rows counting exactly as they always
 * did.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import type { SessionRole } from '../utils/sessionRoles';
import type { Section18RowRole } from './weeklyExposureContractV2';

/**
 * Roles whose rows take no part in counting — not in the taxonomy's
 * classification, and not against the per-session exercise cap.
 *
 * ONE entry today. It is a set rather than a comparison because
 * `conditioningBlock` and `speedBlock` have the same shape problem power did
 * (see the reassessment's scope boundary), and when they become rows they join
 * this set rather than growing a second mechanism beside it.
 *
 * Adding a role here is a counting change and must come with a golden diff.
 */
export const ROLES_EXEMPT_FROM_COUNTING: ReadonlySet<SessionRole> = new Set<SessionRole>([
  'power',
  // THE THIRD CASE OF THE SHAPE THIS SET WAS BUILT FOR, and the note above
  // predicted it: a component that is not strength work, riding the same row
  // list, counted against the strength budget by accident of storage.
  //
  // Sam, 2026-08-13: *"team training should be looked at more like conditioning
  // - it's not part of the strength exercises - it's its own component of the
  // day"*. A team-training row is the CLUB's session; counting it against the
  // per-session exercise cap makes a four-row gym night read as three lifts.
  //
  // ADDED BY ROLE, NOT BY NAME, because this module's own header forbids the
  // alternative: "FILTER BY ROLE BEFORE ANY NAME PROBE RUNS. A name probe over
  // an unfiltered list is the bug." `isTeamTrainingItem` stays what it is — the
  // display split and the read-ingress lift for rows authored before the role.
  'team_training',
  // THE FOURTH CASE, and it was caught by checking a claim rather than by a red.
  // The pairing producer stamped its mobility rows `prehab` and a comment claimed
  // that kept them out of the count. IT DID NOT — `prehab` is not in this set, so
  // every paired mobility row would have counted against the per-session exercise
  // budget, directly against Sam's rule 5: *"counts toward nothing"*.
  'mobility',
  // THE FIFTH CASE, AND SAM NAMED IT HIMSELF AFTER THE APP SHIPPED IT WRONG.
  //
  // 2026-08-13: *"yes it should be its own thing and not count as a strength
  // exercise - thats stupid"*.
  //
  // THIS IS THE ROLE THE TEAM-TRAINING EXEMPTION USED AS ITS OWN REFERENCE.
  // Read the `team_training` note above: his argument for exempting the club's
  // session was *"looked at more like conditioning - it's not part of the
  // strength exercises"*. The exemption was applied to the ANALOGY and not to
  // the thing it was compared to, so a combined day's conditioning block went on
  // counting as a gym exercise for another day.
  //
  // MEASURED BEFORE AND AFTER: 8 of 100 gym sessions carried SEVEN counted rows
  // against his cap of six, and every one of the eight was a `Mixed` day whose
  // seventh row was the conditioning block.
  'conditioning',
]);

/** Whether one row takes part in counting. Authored role only — never a name. */
export function participatesInCounting(row: Pick<WorkoutExercise, 'role'>): boolean {
  return !row.role || !ROLES_EXEMPT_FROM_COUNTING.has(row.role);
}

/**
 * The rows any counter may look at.
 *
 * Every taxonomy probe and the per-session exercise budget read this instead of
 * `workout.exercises`. Accepts a partial workout because the taxonomy classifies
 * loosely-typed hydrated content.
 */
export function countingRows(
  workout: Partial<Workout> | null | undefined,
): readonly WorkoutExercise[] {
  return (workout?.exercises ?? []).filter(participatesInCounting);
}

/**
 * THE ROLE CROSSWALK — the single bridge between the app's two row-role
 * vocabularies.
 *
 * `SessionRole` (six) is what a row IS, authored on the row and read for
 * ordering and counting. `Section18RowRole` (seven) is the same fact in Section
 * 18's spelling, stamped as row evidence for the weekly evaluator. They map 1:1
 * with one documented exception, and having two spellings of one fact is a
 * second representation — queued for collapse as its own unit (Sam, 2026-07-28).
 *
 * Until that lands, this is the ONE place the two are related, and
 * `sessionRowCountingTests` fails if either vocabulary grows a member this map
 * does not cover. That is the point: the collapse unit will be deleting around
 * these two, and silent drift while that happens is exactly how a fence goes
 * missing.
 *
 * `legacy_unknown` is the exception and is deliberately absent: it is an INGRESS
 * SENTINEL for hydrated rows whose evidence predates the classifier, not a kind
 * of work an author can choose. Nothing may map onto it.
 */
export const SESSION_ROLE_TO_SECTION18_ROW_ROLE:
  Readonly<Partial<Record<SessionRole, Section18RowRole>>> = {
  power: 'power',
  main_lift: 'main_strength',
  accessory: 'strength_accessory',
  midline: 'trunk_support',
  prehab: 'recovery_support',
  conditioning: 'conditioning',
};

/** Section 18 row roles with no authored `SessionRole` partner, and why. */
export const SECTION18_ROW_ROLES_WITHOUT_SESSION_ROLE: readonly Section18RowRole[] = [
  'legacy_unknown',
];

/**
 * `SessionRole`s with NO Section 18 row spelling, and why — the other direction
 * of the same declared exception, added 2026-08-13 with `team_training`.
 *
 * THE MAP WENT FROM TOTAL TO PARTIAL AND THAT IS THE POINT, not a loosening.
 * The compiler demanded an entry the moment the role existed, which is exactly
 * the question worth being asked; the honest answer is that there is no §18
 * spelling for it, so declaring one would be inventing accounting.
 *
 * A TEAM NIGHT IS ALREADY COUNTED, AT THE SESSION LEVEL. `sessionTaxonomy`
 * credits it as running, sprint/COD and conditioning exposure under Section
 * 17.E. Mapping the ROW onto `conditioning` as well would credit the same
 * training twice — once as the day's identity and once as row evidence — which
 * is the double-count this crosswalk exists to make visible rather than cause.
 *
 * Sam's own words place it outside the strength accounting entirely
 * (2026-08-13): *"it's not part of the strength exercises - it's its own
 * component of the day"*. Not counted is what "its own component" means here.
 */
export const SESSION_ROLES_WITHOUT_SECTION18_ROW_ROLE: readonly SessionRole[] = [
  'team_training',
  // Same reason: rule 5 says paired mobility counts toward nothing, so giving it
  // a §18 row spelling would be inventing the credit the rule denies.
  'mobility',
];

/**
 * Position among the session's COUNTED work.
 *
 * `generatedWorkoutRowClassification` reads position as one signal of main-lift
 * identity ("the first row or two of a strength session is the main lift").
 * Power is pre-lift and leads the list, so a naive array index renumbers every
 * lift behind it: the session's second main lift slid from index 1 to index 2,
 * lost its main-lift claim, and the canonicaliser then RESTORED the "missing"
 * pattern as a fresh Back Squat row. Found by the differential harness on two
 * in-season days, in a delta that had nothing to do with power's own counts.
 *
 * So the index a classifier sees is the position among rows that count, which
 * power does not. Exempt rows get a sentinel far outside every positional
 * window rather than a real index — they are not in the ordering at all, and a
 * `-1` would silently satisfy an `index <= 1` test.
 *
 * This is a NARROW repair of the perturbation power introduced. It leaves the
 * deeper problem standing and visible: position feeding identity at all is the
 * pattern Sam's readiness law names as wrong ("dose/intensity/position must
 * never feed identity"). Retiring that clause would reclassify rows that are
 * main lifts ONLY by position and move counts across the app, so it belongs to
 * its own unit with its own before/after — not to this one.
 */
export const NON_COUNTING_ROW_INDEX = 99;

export function countingIndices(rows: readonly WorkoutExercise[]): number[] {
  let counted = 0;
  return rows.map((row) =>
    participatesInCounting(row) ? counted++ : NON_COUNTING_ROW_INDEX);
}

/** Whether a row is power work. The authored role decides — never the name. */
export function isPowerRow(row: Pick<WorkoutExercise, 'role'>): boolean {
  return row.role === 'power';
}

/**
 * The day's power rows, in authored order.
 *
 * The complement of what the counters see. `getSessionComponentRows` uses it to
 * give power its own population, the §18 weekly budget uses it to find and strip
 * candidates, and the session screen uses it to render power as an ordinary row.
 */
export function powerRows(
  workout: Partial<Workout> | null | undefined,
): readonly WorkoutExercise[] {
  return (workout?.exercises ?? []).filter(isPowerRow);
}

/** Whether the day carries power at all — the row-era `!!workout.powerBlock`. */
export function hasPowerRow(workout: Partial<Workout> | null | undefined): boolean {
  return (workout?.exercises ?? []).some(isPowerRow);
}

/**
 * RULING 4a (Sam, 2026-08-06): does this day's power count against the WEEKLY
 * PRIMER BUDGET?
 *
 * It does, everywhere but one place. The G-2 quality-lower session's jumps are
 * named by the Bible prescription itself — "2x3 box squats to high box + 2x3
 * vertical jumps" — and that prescription is game-aware BY DEFINITION: it exists
 * precisely because the day is two out from a fixture. Budgeting it against the
 * weekly selector allowance meant a week already carrying two team trainings and
 * a game derived a budget of 0 and stripped the authored half of a session the
 * same Bible line had just licensed.
 *
 * THE EXEMPTION IS SCOPED TO THAT SESSION AND NOTHING ELSE. The budget governs
 * every other day unchanged.
 *
 * ONE PREDICATE, TWO READERS, deliberately. `section18SafetyFinaliser` uses it to
 * decide what may be stripped, and `section18EffectiveWeekEvaluator` uses it to
 * decide what is COUNTED. An exemption known to only one of them is the exact
 * asymmetry the finaliser's own header calls the whole defect: content derived to
 * match its budget cannot be allowed to contradict it. If this predicate ever
 * grows a second copy, that is the bug.
 *
 * BIBLE_ANCHOR: lower_strength_g3
 */
export function budgetedPowerSession(
  workout: Partial<Workout> | null | undefined,
): boolean {
  if (!hasPowerRow(workout)) return false;
  return workout?.strengthVariant !== 'quality_low_volume';
}

/**
 * Remove power from a day — the row-era replacement for `powerBlock: undefined`.
 *
 * Nine sites used to delete the field. A field delete is invisible to every
 * owner: nothing canonicalises after it, nothing records that content left, and
 * the workout's name and type can end up describing work that is no longer
 * there. Row removal is an ordinary content mutation, so it goes back through
 * `finaliseWorkoutAfterMutation` at the call sites that own week content — which
 * is what Sam meant by stripping "through the transaction owner".
 *
 * This helper does the removal only. It deliberately does NOT canonicalise:
 * callers differ in the context they can supply (a §18 pass has the contract, a
 * safety pass has the phase clock), and inventing a context here is exactly the
 * defaulting the subphase fix removed.
 *
 * `familiesToRemove` scopes the removal to an injured region; omit it to remove
 * all power.
 */
export function withoutPowerRows(
  workout: Workout,
  familiesToRemove?: readonly string[],
): Workout {
  const rows = workout.exercises ?? [];
  const survivors = rows.filter((row) =>
    !isPowerRow(row) ||
    (familiesToRemove !== undefined && !familiesToRemove.includes(row.power?.family ?? '')));
  return survivors.length === rows.length ? workout : { ...workout, exercises: survivors };
}

/**
 * Rows that count against the per-session exercise cap.
 *
 * Section 11 (Sam, 2026-07-27): "There is now ONE per-session exercise cap for
 * every training age… power rows never count against that cap at any training
 * age, consistent with power's exclusion from every other count."
 *
 * ⚠ IT WAS "deliberately the SAME predicate as the taxonomy's". **R-088 SPLIT
 * THEM, 2026-08-13, and this export existed for exactly that day** — its old
 * note said it was separate "only so the cap's eventual enforcement site reads
 * as what it is", and the two fences are now genuinely different questions.
 *
 * **THE CAP COUNTS STRENGTH ROWS ONLY.** Sam: *"the mobility pairings dont count
 * at all towards the cap… there should be a mobility warm up and prehab stuff
 * then there should be 2-3 non competing pairings of strength with mobility in
 * the session… the mobility portion does not count"*. **A session with 7
 * strength rows and 3 paired mobility picks is AT the cap, not over it — a
 * counter reading session rows would read 10 and be wrong.**
 *
 * `mobility` was already exempt from counting (the R-015 pairing's own rule 5,
 * *"counts toward nothing"*). **`prehab` was NOT**, and Bible `:229`'s flow is
 * named by this ruling, so the cap's fence adds it. **The taxonomy's fence is
 * left exactly as it was** — §18 counting is a different question and moving it
 * here would be the counting change `ROLES_EXEMPT_FROM_COUNTING` demands a
 * golden diff for.
 *
 * **AND THE CAP BINDS THE APP, NOT THE ATHLETE:** *"7 is the max the app should
 * set and a user should be able to add as many of their own things on top of it
 * as they choose"*. **A cap that refuses an athlete's own added exercise is a
 * defect, not enforcement.** Nothing refuses anything today; whoever builds the
 * enforcement owes that exemption in the same commit.
 *
 * NOTE: nothing enforces a cap today. `trainingAgePolicy`'s
 * `maxExercisesPerStrengthSession` flows into `AIConstraints.maxExercisesPerSession`
 * and is read by no prompt builder, validator or trim. When Sam designs the
 * per-session controls (execution-order step 5), the cap is enforced by counting
 * THIS, and no new limit is invented on the way — §11 abolished the
 * beginner-only cap precisely to stop that.
 */
export const ROLES_EXEMPT_FROM_THE_CAP: ReadonlySet<SessionRole> =
  new Set<SessionRole>([...ROLES_EXEMPT_FROM_COUNTING, 'prehab']);

export function exerciseBudgetRows(
  workout: Partial<Workout> | null | undefined,
): readonly WorkoutExercise[] {
  return (workout?.exercises ?? []).filter(
    (row) => !row.role || !ROLES_EXEMPT_FROM_THE_CAP.has(row.role),
  );
}

/**
 * THE SESSION-SIZE FLOOR — and it is UNAUTHORED. Sam has never ruled a number.
 *
 * ## Why it moved here
 *
 * It was `MIN_SESSION_SIZE` inside `exerciseScorer`, module-private, next to
 * nothing. Session size then had TWO representations in two files: a ceiling
 * (`trainingAgePolicy.maxExercisesPerStrengthSession`, authored — Bible §11's
 * "ONE exercise cap for every training age") and this floor, invented, where
 * only one module could see it. This module is the choke point for what a
 * session's rows ARE, so how many of them there must be belongs beside it.
 *
 * Moving it changed no behaviour: the value is the same 4 it has always been,
 * and `exerciseScorer` is its only reader. What changed is that the floor is
 * now visible next to the fence it answers to, and labelled as unauthored so
 * nobody reads it as law.
 *
 * ## What it is NOT
 *
 * It is not a validator and it is not enforced. Nothing trims a session that
 * exceeds the ceiling and nothing pads one that falls under this floor; the
 * scorer merely tops up its own selection toward it. A predicate that judged
 * whole sessions would have no production reader today, and this repo bans
 * building one before its reader exists.
 *
 * ## The measurement that decides what happens next (2026-08-13)
 *
 * Over 120 generated sessions from the local deterministic path — three season
 * phases x four experience levels — counted rows ran min 2, max 6:
 *
 *   Strength        n=32   5 to 6      never under the floor
 *   Mixed           n=56   4 to 6      never under the floor
 *   Team Training   n=32   2 to 4      26 sessions under it
 *
 * ZERO sessions exceeded the authored ceiling of 6. Every session below the
 * floor was a TEAM-TRAINING night.
 *
 * ## AND THE 26 ARE A DEFECT — SAM RULED IT 2026-08-13 (seat item 21)
 *
 * This comment used to justify those 26 by calling a team night "a day the
 * athlete is already at the club". **That was FALSE, it was mine, and Sam
 * struck it:** *"just because the strength is on the same day doesn't mean they
 * are doing it at the club, they might do it in the morning or on the drive to
 * footy"*. A session sharing a DATE with team training says nothing about where
 * or when it is done. **Do not reason from same-day to same-place again.**
 *
 * His rule is simpler than the question I asked: *"just keep sessions for gym
 * the same before footy training"*. **There is no team-night size case and no
 * exception to this floor in either direction** — so 26 of 32 team nights under
 * four exercises is a defect, not a correct smallness.
 *
 * THE FIX IS GENERATION-SIDE AND IS NOT DONE HERE (stand-down D). Size comes
 * from the template at `sessionBuilder.ts:718`, not from a team-night branch,
 * and the open question item 21 names first is whether these counted rows
 * include the "Team Training" row itself — if they do, a "4-exercise" team night
 * is really a 3-exercise lift and the defect is a different one.
 *
 * `MIN EXERCISES PER SESSION` is still NOT emitted to the AI prompt: this floor
 * remains unauthored as a NUMBER. Sam ruled that gym sessions are the same size
 * everywhere, not that the size is 4.
 */
export const SESSION_SIZE_FLOOR = 4;
