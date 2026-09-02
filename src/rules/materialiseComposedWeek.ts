/**
 * THE HANDOVER — `ComposedWeek` in, domain `Workout` rows out. Pure.
 *
 * **THIS IS THE BOUNDARY THE PREVIOUS THREE SESSIONS DID NOT BUILD.** Until now
 * the composer's week was flattened into `CoachGeneratedWorkoutInput` and handed
 * to `buildWorkoutsFromCoach` — the legacy builder — which re-dosed every row,
 * rewrote identities and dropped some of them entirely. **No composer-authored
 * row passes through that builder any more.**
 *
 * **IT REINTERPRETS NOTHING.** Identity, order, role, pattern, dose category,
 * sets, reps and load arrive already decided (`composeWeek` + `composedDose`)
 * and are copied. The only things minted here are ids and timestamps, which are
 * not composition.
 */
import { buildPowerRow, findOrCreateExercise } from '../data/defaultProgram';
import { deloadPowerDose } from './deloadWeekRules';
import {
  applyStrengthDeloadToExercises,
  type DeloadWeekPolicy,
} from './deloadWeekRules';
import type { ComposedDay, ComposedGap, ComposedWeek } from './composeWeek';
import type { Workout, WorkoutExercise } from '../types/domain';
import { isoDateForWeekday } from '../utils/appDate';
import { createAutomaticWeeklyExerciseSelector } from './automaticWeeklyExerciseSelection';
import {
  reductionReasonsFromComposer,
  withUsefulStrengthSessionContract,
} from './minimumUsefulStrengthSession';

/** The specialist's decision for one day, plus what the row builder needs. */
export interface ComposedPowerPlacement {
  readonly automaticWeeklyExerciseSelector?: import('./automaticWeeklyExerciseSelection').AutomaticWeeklyExerciseSelector;
  /**
   * THE WEEK'S POWER ALLOWANCE, HONOURED BY NOT PLACING MORE THAN IT.
   *
   * The old trimmer enforced this by REMOVING rows after the fact, and its
   * first live act was to destroy an authored strength day. A limit obeyed at
   * placement needs no strip at all.
   */
  readonly allowance?: number;
  readonly primerByDay: Readonly<Record<number, import('./powerPrimerPolicy').PowerPrimerSpec | null>>;
  readonly phase?: import('../types/domain').SeasonPhase;
  readonly experienceLevel?: string;
  readonly availableEquipment?: readonly string[];
  readonly availableEquipmentByDay?: Readonly<Record<number, readonly string[]>>;
  readonly blockId?: string;
  readonly blockStartISO?: string;
  readonly selectionHistory?: readonly import('./powerExercisePool').BlockPowerSelection[];
  readonly selectionsOut?: import('./powerExercisePool').BlockPowerSelection[];
  readonly selectionTracesOut?: import('./programmingSelectionTrace').AutomaticProgrammingSelectionTrace[];
  readonly injuries?: readonly string[];
  readonly daysToGameByDay?: Readonly<Record<number, number | null>>;
}

export interface MaterialisationContext {
  readonly microcycleId: string;
  /**
   * THE POWER PRIMER THE SPECIALIST ALREADY CHOSE, PLACED AT LAST.
   *
   * ⚠ **MEASURED 2026-08-19: no generated athlete had ever received a single
   * power row.** The specialist works — traced on a real in-season world it
   * chose a lower primer for Monday, an upper primer for Tuesday, and on the
   * G-2 Thursday an UPPER primer described "G-2 tiny neural prime", refusing
   * lower exactly as Sam's rule requires. `scheduleToCoachingPlan` carried all
   * three onto the plan. Then nothing placed them: the only row builder lived
   * in the adapter, and the adapter authors no strength on composer-owned days.
   * The decision was made correctly and thrown away.
   *
   * Power is part of an authorised STRENGTH session, so it is placed here, on
   * the composer's own day, from the specialist's typed result. This module
   * chooses no exercise, no dose and no day — it consumes what was decided.
   */
  readonly power?: ComposedPowerPlacement;
  /** Plan tiers/names arrive on the composed day; nothing is renamed here. */
  readonly weekStartISO: string;
  /**
   * THE GOVERNED DOSE INSTRUCTION FOR THIS DAY — deload, readiness or illness.
   *
   * **This exists because the resolved policy reached only the retained
   * adapter.** `buildWorkoutsFromCoach` applied `applyStrengthDeloadToExercises`
   * to the rows it built; composer rows never enter that builder, so a composed
   * week was the ONLY week in the app whose strength ignored an active deload,
   * an illness reduction or a readiness window. An athlete told the app they
   * were ill and their lifts did not move.
   *
   * **IT IS A FUNCTION OF THE DAY, NOT THE WEEK — R-035.** A readiness
   * declaration governs its dated window; a Thursday declaration must not
   * retro-deload Monday. The caller resolves that with the existing owner's own
   * predicate and hands the answer down; nothing here re-derives a window.
   *
   * Null for a day the instruction does not govern. Absent for an ordinary week,
   * which is why an ordinary week is byte-identical.
   */
  readonly deloadPolicyForDay?: (dayOfWeek: number) => DeloadWeekPolicy | null;
}

/** The composer's own provenance, carried onto every row it authored. */
export const COMPOSER_ROW_PROVENANCE = 'composer_declaration' as const;

function materialiseRow(
  row: ComposedDay['rows'][number],
  workoutId: string,
  index: number,
  stamp: string,
): WorkoutExercise {
  const exercise = findOrCreateExercise(row.identity);
  return {
    id: `we-${workoutId}-${index}`,
    workoutId,
    exerciseId: exercise.id,
    exerciseOrder: index + 1,
    prescribedSets: row.sets,
    prescribedRepsMin: row.repsMin,
    prescribedRepsMax: row.repsMax,
    prescribedWeightKg: row.load,
    restSeconds: row.restSeconds ?? 0,
    notes: row.notes,
    // Slice 5 (Sam, 2026-08-23): an isometric's authored UNIT reaches the
    // stored row — without this, `2 × 20-30 seconds` rendered as `2 × 15`
    // reps on every surface, which is the defect he reported.
    ...(row.prescriptionType ? { prescriptionType: row.prescriptionType } : {}),
    ...(row.perSide ? { perSide: true } : {}),
    exercise: { ...exercise, createdAt: stamp, updatedAt: stamp },
    // THE COMPOSER'S SUBSTITUTION RECORD, CARRIED. It has existed on
    // `ComposedRow` since 2026-08-17 and died here — the screen could see that
    // an unfamiliar lift was on the day and had no way to say WHY.
    ...(row.substitutedFor
      ? {
          substitutedFrom: {
            baseExerciseName: row.substitutedFor.baseIdentity,
            cause: row.substitutedFor.cause,
          },
        }
      : {}),
    createdAt: stamp,
    updatedAt: stamp,
    // The composer DECIDES the role (R-092); §18 reads this rather than
    // re-inferring it from the exercise name.
    section18Evidence: {
      protocolVersion: 1,
      role: row.role,
      strengthPattern: row.mainStrengthPattern,
      mainStrengthPattern: row.role === 'main_strength' ? row.mainStrengthPattern : null,
      // ⚠ **THE SLOT IS WHAT MAKES A SET COUNTABLE, AND IT WAS BEING DROPPED.**
      //
      // Sam, 2026-08-16: Wednesday is *12* main/secondary sets, not 14 — *"Ab
      // Wheel is outside that ceiling"*; Friday is *10*, not 12 — *"Band
      // Pull-Apart is accessory work outside that count"*.
      //
      // Every non-main row arrived as a bare `strength_accessory`, so nothing
      // downstream could tell a secondary COMPOUND that occupies a movement slot
      // (Bulgarian Split Squats, Lat Pulldown) from core or band isolation that
      // occupies none (Ab Wheel, Band Pull-Apart). **Counting them alike inflated
      // every session's set total against the WC-030 ceiling.** The composer knew
      // the slot all along; it simply never travelled.
      slot: row.slot ?? null,
      provenance: COMPOSER_ROW_PROVENANCE,
    },
    ...(row.qualityLimit ? { notes: 'Stop when speed or technique drops.' } : {}),
  } as unknown as WorkoutExercise;
}

/**
 * ⚠ THE TYPED GAP CARRIER, AND IT HAS ONE OWNER.
 *
 * `composedGaps` sits on the WORKOUT because a gap names a DAY — *"no vertical
 * pull on Tuesday, you'd need a pull-up bar"*. Putting the same fact on the
 * microcycle and the program as well would be three representations of one
 * decision, which is what `NORTH_STAR.md` presumes wrong; the day is the
 * smallest shape that can carry it truthfully.
 *
 * **MEASURED BEFORE THIS EXISTED: 176 typed gaps across 86 worlds were composed
 * and NONE survived materialisation**, because `CoachGeneratedWorkoutInput` had
 * no field to put them in and the adapter simply dropped them.
 */
function gapsForDay(week: ComposedWeek, dayOfWeek: number): readonly ComposedGap[] {
  return week.gaps.filter((gap) => gap.dayOfWeek === dayOfWeek);
}

export function materialiseComposedWeek(
  week: ComposedWeek,
  context: MaterialisationContext,
): Workout[] {
  /* The allowance is spent in weekday order — deterministic, and the same order
   * the athlete's week runs in. Absent allowance means "no limit stated", which
   * only happens for callers that pass no power at all. */
  const allowance = context.power?.allowance;
  let primersPlaced = 0;
  const powerSeats = new Map<string, number>();
  const automaticWeeklyExerciseSelector = context.power
    ? context.power.automaticWeeklyExerciseSelector
      ?? createAutomaticWeeklyExerciseSelector(
        week.days.flatMap((day) => day.rows.map((row) => row.identity)),
      )
    : undefined;
  return week.days.map((day) => {
    const workoutId = `w-composed-${context.microcycleId}-${day.dayOfWeek}`;
    const gaps = gapsForDay(week, day.dayOfWeek);
    const stamp = `${isoDateForWeekday(context.weekStartISO, day.dayOfWeek)}T12:00:00.000Z`;
    const composedRows = day.rows.map((row, index) => materialiseRow(row, workoutId, index, stamp));
    // ── THE GOVERNED DOSE, APPLIED ONCE, BY THE EXISTING OWNER ──────────────
    //
    // **`applyStrengthDeloadToExercises` is the app's ONE deload arithmetic and
    // it is called here rather than reimplemented inside the composer.** The
    // mission forbids a second deload table, and re-deriving "half the sets,
    // keep 2-3 accessories or half whichever is less, hold the weight unless
    // the athlete is beat up" in a second place is exactly that table.
    //
    // ONCE: composer rows never enter `buildWorkoutsFromCoach`, so this is the
    // only place the law reaches them. The adapter's own rows are deloaded on
    // its side, as they always were.
    //
    // A day the instruction does not govern gets `null` and is untouched —
    // which is what keeps an ordinary week byte-identical.
    const policy = context.deloadPolicyForDay?.(day.dayOfWeek) ?? null;
    const strengthRows = policy
      ? applyStrengthDeloadToExercises(composedRows, policy)
      : composedRows;
    /* ── THE PRIMER, PRE-LIFT, ON THE DAY THE SCHEDULER AUTHORISED ──────────
     * `exerciseOrder: 0` is the builder's own; the composed rows start at 1, so
     * the primer sorts ahead of the main lifts where a primer belongs.
     *
     * The DELOAD DOSE is the existing owner's (`deloadPowerDose`), for the same
     * reason the strength deload above is: power SURVIVES a deload — Sam,
     * 2026-07-27, "keep a small sharp dose ... a deload is not a reason to lose
     * sharpness" — the numbers shrink and the movement does not change. */
    /* ⚠ **ONLY ON A DAY THAT ACTUALLY CARRIES STRENGTH** (Sam: "It may only
     * appear on a scheduler-authorised strength day"). Placing it on a day the
     * composer authored no lifts for made the session read as power rather than
     * main strength, and a 4-day PRE-SEASON BODYWEIGHT week lost an exposure and
     * was refused — `main_strength_planner_selected_target expected 3, actual 2`,
     * measured on four worlds before this line existed. Power is part of a
     * strength session; a day with no strength is not one. */
    const withinAllowance = allowance === undefined || primersPlaced < allowance;
    const primer = strengthRows.length > 0 && withinAllowance
      ? context.power?.primerByDay?.[day.dayOfWeek] ?? null
      : null;
    let powerRow: WorkoutExercise | null = null;
    if (primer) {
      const dosed = policy
        ? (() => {
          const shrunk = deloadPowerDose({
            sets: primer.sets, repsMin: primer.repsMin, repsMax: primer.repsMax,
          });
          return shrunk ? { ...primer, ...shrunk } : null;
        })()
        : primer;
      if (dosed) {
        const powerSeat = powerSeats.get(dosed.family) ?? 0;
        powerSeats.set(dosed.family, powerSeat + 1);
        const built = buildPowerRow(dosed, workoutId, {
          phase: context.power?.phase,
          experienceLevel: context.power?.experienceLevel as never,
          availableEquipment: (context.power?.availableEquipmentByDay?.[day.dayOfWeek]
            ?? context.power?.availableEquipment ?? []) as never,
          blockId: context.power?.blockId,
          blockStartISO: context.power?.blockStartISO,
          seatIndex: powerSeat,
          selectionHistory: [
            ...(context.power?.selectionHistory ?? []),
            ...(context.power?.selectionsOut ?? []),
          ],
          selectionTracesOut: context.power?.selectionTracesOut,
          automaticWeeklyExerciseSelector,
          traceContext: {
            dateISO: isoDateForWeekday(context.weekStartISO, day.dayOfWeek),
            weekStartISO: context.weekStartISO,
            dayOfWeek: day.dayOfWeek,
            experience: context.power?.experienceLevel ?? null,
            injuries: context.power?.injuries ?? [],
            daysToGame: context.power?.daysToGameByDay?.[day.dayOfWeek] ?? null,
          },
        });
        if (built) {
          /* ── HISTORICAL ROOT-CAUSE RECEIPT: ONE EXERCISE, ONCE ─────────────
         *
         * ⚠ **THE PRIMER YIELDS TO THE LIFT. IT NEVER APPEARS BESIDE ITS OWN
         * TWIN.** Measured 2026-08-19 across the 180-world corpus: making the
         * specialist's power budget reach the composer delivered **32 sessions
         * that prescribed one exercise twice** — `Explosive Push-up 2x3` as
         * Power and the same movement `3x7` as Strength, on the same day. An
         * athlete reading that cannot tell whether they are meant to do it once
         * or twice, and no amount of role typing makes two identical rows read
         * as one intention.
         *
         * **EVERY ONE OF THE 32 WAS A ZERO-EQUIPMENT WORLD, AND THAT IS THE
         * WHOLE MECHANISM.** `Explosive Push-up` is the ONLY `upper` entry in
         * `POWER_EXERCISE_POOL`, and in a Bodyweight-Only world it is also a
         * legal main/accessory push, so the two pools have exactly one member
         * in common and both reach for it. Full Gym and Dumbbells worlds
         * produced zero collisions.
         *
         * **SO POWER IS THE ONE THAT GIVES WAY, AND IT MAY GIVE WAY TO
         * NOTHING.** Power is the fence-exempt extra — not a hard exposure, not
         * main strength, no conditioning credit — so dropping it costs the week
         * no exposure it is owed. The strength row is the session's actual
         * work and cannot be dropped. There is no third option: with one upper
         * entry in the pool there is no alternative movement to swap to, and
         * inventing one here would be a second power pool.
         *
         * The athlete still does the movement explosively — it is simply
         * prescribed once, as their lift, instead of twice under two names.
         *
         * The former local same-session check is now removed. The shared
         * canonical weekly selector owns both this case and cross-session
         * repeats, and leaves power empty when no unused legal candidate exists. */
          // The canonical weekly selector already rejected any identity on this
          // day or elsewhere in the week. Power has no private deduplicator.
          powerRow = built;
          if (powerRow && context.power?.blockStartISO && context.power.selectionsOut) {
            if (!context.power.selectionsOut.some((row) => row.blockStartISO === context.power?.blockStartISO
              && row.family === dosed.family && row.seatIndex === powerSeat)) {
              context.power.selectionsOut.push({
                blockStartISO: context.power.blockStartISO,
                family: dosed.family,
                seatIndex: powerSeat,
                exerciseName: built.exercise?.name ?? '',
              });
            }
          }
        }
      }
    }
    if (powerRow) primersPlaced += 1;
    const exercises = powerRow ? [powerRow, ...strengthRows] : strengthRows;
    const workout = {
      id: workoutId,
      microcycleId: context.microcycleId,
      dayOfWeek: day.dayOfWeek,
      name: day.name,
      description: '',
      // A deloaded day is not a High-intensity day. The intensity ceiling is
      // the policy's, not the composer's optimism.
      intensity: policy ? 'Moderate' : 'High',
      workoutType: day.workoutType,
      sessionTier: day.sessionTier,
      planEntryId: day.planEntryId,
      /**
       * ⚠ **R-225 — THE PLAN THE DAY WAS COMPOSED FROM, ONTO THE WORKOUT.**
       *
       * Without it every composer-owned day reached the athlete as "Strength":
       * `assembleAuthoredWeek` makes this workout the merge BASE, so the
       * adapter's copy of the intent never lands on a day the composer owns,
       * and `resolveSessionDisplayName` had nothing typed to read. Measured
       * across three season phases: 16 of 42 sessions unnamed for this reason.
       *
       * Carried, never recomputed — the same correction `kind` received in this
       * file after it was computed and thrown away.
       */
      strengthIntent: day.strengthIntent,
      // ── THE COMPOSER'S DECLARED SHAPE, CARRIED (2026-08-14) ────────────────
      //
      // **IT WAS COMPUTED AND THROWN AWAY, AND EVERY READER GUESSED IT BACK OUT
      // OF PROSE.** `ComposedDay.kind` is the composer's own answer to "which of
      // Sam's ladders does this day owe", decided from the plan's TYPED intent —
      // and it stopped here. Downstream, `slotDayKindFor(workout.name)` re-derived
      // it from the planner's session title, which for the full-body shape cannot
      // be right in principle: Sam's A and B are DIFFERENT ladders and every
      // naming owner in this app calls them the same thing.
      //
      // Measured cost of the guess, 180-world sweep: 24 composed full-body days
      // judged against a lower-or-upper ladder, all 24 scored deficient with
      // nothing missing from them, and R-089's week-level pair counter blind to a
      // hinge sitting on the day in front of it — 6 worlds reported as
      // squat-without-hinge whose weeks are `sq1/hi1`.
      //
      // **THIS IS A DECISION, NOT A DERIVATION** — `NORTH_STAR.md`'s test for
      // whether state may be stored. The composer DECIDED full body where the
      // planner had said upper-only (Sam overruled the planner for this athlete),
      // so the shape is an input to every later judgement and cannot be recovered
      // from the week's content. Exactly the precedent `section18Evidence.role`
      // set: *"the composer DECIDES the role (R-092); §18 reads this rather than
      // re-inferring it from the exercise name."*
      //
      // WRITER: here, and nowhere else. READER: `ladderCoverageWideCensus` and
      // `composedDayShapeIsDeclared` in `composerSeveranceTests`. Both landed in
      // the same commit as this line — a field with no reader is the `canOverride`
      // shape and this repo has paid for it once already.
      composedDayShape: day.kind,
      // ── AND THE DAY'S OWN LADDER, FOR R-087's COVERAGE DAY (2026-08-14) ─────
      //
      // The SHAPE alone stopped being enough the moment a full-body day's slots
      // became *"whatever the week has not covered yet"*. `full_body_coverage` has
      // no row in `SLOTS_FOR_KIND` that states this day's seven — the table holds
      // the whole ten-slot weekly set it draws FROM — so a judge with only the kind
      // would score the day against all ten and invent three misses.
      //
      // It is the DECLARED set, before the kit dropped anything, and deliberately
      // not `requiredSlots` (the filled set), which a judge could only ever find
      // complete.
      //
      // WRITER: here. READER: `ladderCoverageWideCensus`, and the `[shape]` block
      // in `composerSeveranceTests`. Same commit, as the law requires.
      composedDeclaredSlots: day.declaredSlots,
      durationMinutes: 0,
      exercises,
      ...(gaps.length > 0 ? { composedGaps: gaps } : {}),
    } as unknown as Workout;
    return withUsefulStrengthSessionContract(workout, reductionReasonsFromComposer({
      deloadDoor: policy?.door ?? null,
      gaps,
    }));
  });
}
