/**
 * weekStructureValidator.ts — Programming Bible weekly-structure validator.
 *
 * Phase 2 rules kernel. PURE: it never mutates a week and never writes.
 *
 * IT IS NO LONGER ADVISORY, and the header said otherwise for long enough to
 * become the answer to "why is the programming shit". It read "FINDINGS ONLY …
 * enforcement is a later phase behind its own approved plan", and the later
 * phase never came: three callers, all of them loggers, while the gate that
 * actually blocked asked only whether the week CONFORMED. **A rule that ships
 * wired to `log` is not shipped.**
 *
 * From 2026-08-12 `rules/section18CraftTier` runs `validateProgramWeek` inside
 * the §18 accepted-week gateway, where every path that can change what the
 * athlete sees already converges, and treats `strong` findings that name a
 * still-changeable day as BLOCKING. Read that module before changing a severity
 * here: `strong` now decides whether a week can be published.
 *
 * The `log*` helpers below stay for the three advisory callers (coach risk
 * assessment, revision override writer, coaching engine) — a second opinion is
 * still useful where it is not the decision.
 *
 * Rule sources: Bible Section 2 (weekly structure), Section 3 (hard
 * exposures), Section 17.B (caps), 17.C (game proximity), 17.D (double
 * days), 17.E (team training), 17.F (warning levels), 17.J (minimum
 * effective program).
 *
 * Severity policy (approved 2026-07-08):
 *   info      — observability / gentle nags (never punitive)
 *   soft      — advisory; athlete can override freely
 *   strong    — risky; athlete can override where safe, with a real warning
 *   hard_stop — RESERVED for true safety/injury situations (8-10 injury,
 *               can't move normally, red-flag symptoms, bedridden). This
 *               validator does not emit hard_stop for programming-risk
 *               pairings — those are strong.
 */

import type { Workout, SeasonPhase, DayOfWeek } from '../types/domain';
import { logger } from '../utils/logger';
import { classifyExerciseExposures, type Exposure } from '../utils/exposureEngine';
import { isTeamTrainingSession } from '../utils/teamTraining';
import type { SessionUnit } from './sessionTaxonomy';
import type { StressContext } from './stressClassification';
import {
  classifyVisibleSession,
  type ClassifiedVisibleSessionUnit,
} from './sessionClassificationAdapter';
import {
  countWeeklyExposures,
  auditWeekAgainstCaps,
  type WeekDayInput,
  type WeeklyExposureCounts,
  type RunningFloorExemption,
  type SprintFloorExemption,
} from './weeklyExposureCounts';
import type { Section18Subphase } from './weeklyExposureContractV2';
import { resolveWeekContext } from './weekContext';

// ─── Types ───────────────────────────────────────────────────────────

export type FindingSeverity = 'info' | 'soft' | 'strong' | 'hard_stop';

export interface WeekFinding {
  /** Stable machine id, e.g. 'g2_hard_lower', 'cap_running_over'. */
  ruleId: string;
  severity: FindingSeverity;
  /** Athlete-readable message. */
  message: string;
  /** Affected ISO date(s). */
  dates: string[];
  /** Affected workout/session names. */
  sessions: string[];
  /** hard_stop = false; everything else = true (override where safe). */
  canOverride: boolean;
  /** Bible provenance, e.g. 'Section 17.C G-2'. */
  bibleRef: string;
  data?: Record<string, unknown>;
}

export interface ValidatorDayInput {
  /** ISO date YYYY-MM-DD. */
  date: string;
  /** All visible workouts for the date (null entries ignored). */
  workouts: Array<Workout | null>;
}

export interface ValidateProgramWeekInput {
  days: ValidatorDayInput[];
  anchors?: {
    /** Game dates in/around this week. Merged with games observed in the week. */
    gameDates?: string[];
    /** Last week's game date — lets G+1 protection cover Monday. */
    previousGameDate?: string;
    /** Next week's game date — lets G-1/G-2 protection cover Sat/Sun. */
    nextGameDate?: string;
    teamTrainingDates?: string[];
  };
  profile?: StressContext & { seasonPhase?: SeasonPhase };
  weekFlags?: {
    /** Busy / sick / injured / away / deload modifier active — suppress under-training nags. */
    reducedLoadActive?: boolean;
    /** Bye week — suppress under-training nags, soften small overshoots. */
    byeWeek?: boolean;
  };
  /**
   * THE WEEK'S §18 SUBPHASE, AND IT EXISTS TO CLAIM A RUNNING-FLOOR EXEMPTION.
   *
   * Sam's floor sentence names its own two escapes — the shipped detail string
   * says *"lifted in early off-season weeks 1-2 and bye recovery"*
   * (`weeklyExposureCounts.ts:330`). `auditWeekAgainstCaps` has taken a TYPED
   * `runningFloorExemption` for exactly those two cases since it was written,
   * and `rulesKernelTests` proves both suppress the finding.
   *
   * **BOTH PRODUCTION CALLERS PASSED NOTHING.** So the app told the athlete
   * about a lift it had no way to apply, and an early-off-season week was nagged
   * for a floor Sam had already lifted. Census C4, measured 2026-08-13.
   *
   * Optional because one caller (`programEditRiskAssessment`) does not hold a
   * contract; absent means the floor is enforced, which is the safe direction.
   */
  subphase?: Section18Subphase | null;
}

export interface WeekValidationReport {
  findings: WeekFinding[];
  counts: WeeklyExposureCounts;
  anchorsUsed: {
    gameDates: string[];
    teamTrainingDates: string[];
    /** True when anchors were (partly) derived from the week itself. */
    derived: boolean;
  };
}

// ─── Internals ───────────────────────────────────────────────────────

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  info: 0, soft: 1, strong: 2, hard_stop: 3,
};

interface ClassifiedWorkout {
  date: string;
  workout: Workout;
  units: ClassifiedVisibleSessionUnit[];
  exposures: Set<Exposure>;
}

function addDaysISO(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayName(dateISO: string): DayOfWeek {
  const names: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[new Date(`${dateISO}T12:00:00Z`).getUTCDay()];
}

function isGameWorkout(w: Workout | null | undefined): boolean {
  if (!w) return false;
  return String(w.workoutType ?? '') === 'Game' || /^game\b/i.test(w.name ?? '');
}

export function deriveWeekValidationFlags(input: Pick<ValidateProgramWeekInput, 'days' | 'anchors' | 'profile' | 'weekFlags'>): NonNullable<ValidateProgramWeekInput['weekFlags']> {
  const explicit = input.weekFlags ?? {};
  const weekDates = new Set(input.days.map((d) => d.date));
  const hasFixtureThisWeek =
    input.days.some((d) => d.workouts.some(isGameWorkout)) ||
    (input.anchors?.gameDates ?? []).some((d) => weekDates.has(d));
  const context = resolveWeekContext({
    seasonPhase: input.profile?.seasonPhase,
    hasFixture: hasFixtureThisWeek,
  });

  return {
    ...explicit,
    byeWeek: explicit.byeWeek ?? context.isByeWeek,
  };
}

function workoutExposureSet(w: Workout): Set<Exposure> {
  const out = new Set<Exposure>();
  for (const ex of w.exercises ?? []) {
    const name = (ex as { exercise?: { name?: string } }).exercise?.name ?? '';
    if (!name) continue;
    for (const e of classifyExerciseExposures(name)) out.add(e);
  }
  return out;
}

const LOWER_POWER_EXPOSURES: ReadonlySet<Exposure> = new Set([
  'squat', 'hinge', 'lunge', 'knee_dominant', 'hip_dominant',
  'plyometric', 'explosive_lower', 'heavy_lower_strength', 'heavy_squat', 'heavy_hinge',
]);

const HEAVY_LOWER_EXPOSURES: ReadonlySet<Exposure> = new Set([
  'heavy_lower_strength', 'heavy_squat', 'heavy_hinge',
]);

const NEURAL_PRIMER_BANNED_NAME_RX = /deadlift|\brdl\b|romanian|nordic/i;

/**
 * Narrow G-2 neural-primer exception (approved 2026-07-08):
 * ≤2 lower/power exercises, ≤3 sets, ≤3 reps, no hard hinge, no
 * deadlift/RDL/Nordic, not a full lower session. Anything unverifiable
 * (no exercises) is NOT a primer — unsure means strong warning.
 *
 * THIS IS THE AUTHORED DEFINITION OF THE ANCHOR'S SECOND STATE, and until
 * 2026-08-06 it was a validator with nothing to validate: no placer in the app
 * ever produced the shape it licenses. The producer is the G-2 quality-lower
 * last resort in `coachingEngine.buildWeeklyPlan`, and the injury-authority
 * suite asserts the session that placer ships still satisfies THIS function —
 * so the licence and the thing licensed cannot drift apart.
 *
 * BIBLE_ANCHOR: lower_strength_g3
 */
export function looksLikeNeuralPrimer(w: Workout): boolean {
  const exs = w.exercises ?? [];
  if (exs.length === 0 || exs.length > 4) return false;

  const lowerExercises: Array<{ sets: number; repsMax: number }> = [];
  for (const ex of exs) {
    const name = (ex as { exercise?: { name?: string } }).exercise?.name ?? '';
    if (!name) continue;
    if (NEURAL_PRIMER_BANNED_NAME_RX.test(name)) return false;
    const exp = classifyExerciseExposures(name);
    if (exp.includes('heavy_hinge') || exp.includes('hamstring_dominant')) return false;
    if (exp.includes('sprint') || exp.includes('change_of_direction')) return false;
    if (exp.some((e) => LOWER_POWER_EXPOSURES.has(e))) {
      lowerExercises.push({
        sets: (ex as { prescribedSets?: number }).prescribedSets ?? 99,
        repsMax: (ex as { prescribedRepsMax?: number }).prescribedRepsMax ?? 99,
      });
    }
  }
  if (lowerExercises.length === 0 || lowerExercises.length > 2) return false;
  return lowerExercises.every((e) => e.sets <= 3 && e.repsMax <= 3);
}

// ─── Validator ───────────────────────────────────────────────────────

export function validateProgramWeek(input: ValidateProgramWeekInput): WeekValidationReport {
  const profile = input.profile ?? {};
  const flags = deriveWeekValidationFlags(input);

  // Classify every workout once.
  const classified: ClassifiedWorkout[] = [];
  for (const day of input.days) {
    for (const w of day.workouts) {
      if (!w) continue;
      classified.push({
        date: day.date,
        workout: w,
        units: classifyVisibleSession(w, profile).units,
        exposures: workoutExposureSet(w),
      });
    }
  }
  const byDate = new Map<string, ClassifiedWorkout[]>();
  for (const cw of classified) {
    const list = byDate.get(cw.date) ?? [];
    list.push(cw);
    byDate.set(cw.date, list);
  }
  const weekDates = new Set(input.days.map((d) => d.date));

  // Anchors: observed week wins; explicit anchors merge in.
  const observedGames = classified
    .filter((cw) => cw.units.some((u) => u.category === 'game'))
    .map((cw) => cw.date);
  const observedTT = classified
    .filter((cw) => cw.units.some((u) => u.category === 'team_training'))
    .map((cw) => cw.date);
  const gameDates = Array.from(new Set([
    ...(input.anchors?.gameDates ?? []),
    ...(input.anchors?.nextGameDate ? [input.anchors.nextGameDate] : []),
    ...observedGames,
  ])).sort();
  const teamTrainingDates = Array.from(new Set([...(input.anchors?.teamTrainingDates ?? []), ...observedTT])).sort();

  // Counts + caps via the Phase 1 counters.
  const countInput: WeekDayInput[] = input.days.map((d) => ({ date: d.date, workouts: d.workouts }));
  const counts = countWeeklyExposures(countInput, profile);

  const findings: WeekFinding[] = [];
  const push = (f: WeekFinding) => findings.push(f);

  // ── A. Game proximity (Section 17.C) ──────────────────────────────
  // Checked around EVERY game date (multiple games / moved games:
  // stricter protection wins via dedupe below).
  const gPlusOneSources = [...gameDates];
  if (input.anchors?.previousGameDate) gPlusOneSources.push(input.anchors.previousGameDate);

  const proximityExempt = (u: SessionUnit): boolean =>
    u.category === 'game' || u.category === 'team_training';

  for (const g of gameDates) {
    const g1 = addDaysISO(g, -1);
    const g2 = addDaysISO(g, -2);

    // G-1: rest / recovery / gunshow / very easy only.
    if (weekDates.has(g1)) {
      for (const cw of byDate.get(g1) ?? []) {
        for (const u of cw.units) {
          if (proximityExempt(u) || u.stress === 'low') continue;
          push({
            ruleId: 'g1_not_light',
            severity: u.stress === 'high' ? 'strong' : 'soft',
            message: `${u.category.replace(/_/g, ' ')} on ${dayName(g1)} is the day before the ${dayName(g)} game — G-1 should be rest, recovery, gunshow or very easy work.`,
            dates: [g1], sessions: [cw.workout.name], canOverride: true,
            bibleRef: 'Section 17.C G-1',
            data: { gameDate: g, category: u.category, stress: u.stress },
          });
        }
      }
    }

    // G-2: no full hard lower (narrow neural-primer exception), no extra
    // hard conditioning / sprint (normal team training excepted).
    if (weekDates.has(g2)) {
      for (const cw of byDate.get(g2) ?? []) {
        for (const u of cw.units) {
          if (proximityExempt(u)) continue;
          const isHardLower =
            u.category === 'lower_strength' ||
            (u.category === 'full_body_strength' && u.stress === 'high');
          if (isHardLower) {
            const primer = looksLikeNeuralPrimer(cw.workout);
            push({
              ruleId: 'g2_hard_lower',
              severity: primer ? 'info' : 'strong',
              message: primer
                ? `Low-volume lower/power primer on ${dayName(g2)} (G-2) — allowed as a tiny familiar neural exposure.`
                : `Lower-body strength on ${dayName(g2)} is 2 days before the ${dayName(g)} game — no full hard lower session on G-2.`,
              dates: [g2], sessions: [cw.workout.name], canOverride: true,
              bibleRef: 'Section 17.C G-2',
              data: { gameDate: g, neuralPrimer: primer },
            });
          }
          if (u.category === 'hard_conditioning') {
            push({
              ruleId: 'g2_hard_conditioning',
              severity: 'strong',
              message: `Hard conditioning on ${dayName(g2)} is within 48h of the ${dayName(g)} game — team training is the only accepted hard load here.`,
              dates: [g2], sessions: [cw.workout.name], canOverride: true,
              bibleRef: 'Section 17.C G-2 / Section 6 (48h rule)',
              data: { gameDate: g },
            });
          }
          if (u.category === 'sprint') {
            push({
              ruleId: 'g2_sprint_cod',
              severity: 'strong',
              message: `Sprint/COD work on ${dayName(g2)} is too close to the ${dayName(g)} game.`,
              dates: [g2], sessions: [cw.workout.name], canOverride: true,
              bibleRef: 'Section 7 / Section 17.C G-2',
              data: { gameDate: g },
            });
          }
        }
      }
    }
  }

  // G+1: rest/recovery/easy only. medium → soft, high → strong.
  for (const g of gPlusOneSources) {
    const gPlus1 = addDaysISO(g, 1);
    if (!weekDates.has(gPlus1)) continue;
    for (const cw of byDate.get(gPlus1) ?? []) {
      for (const u of cw.units) {
        if (proximityExempt(u) || u.stress === 'low') continue;
        push({
          ruleId: 'g_plus1_hard_work',
          severity: u.stress === 'high' ? 'strong' : 'soft',
          message: `${u.category.replace(/_/g, ' ')} on ${dayName(gPlus1)} is the day after a game — G+1 should be rest or recovery.`,
          dates: [gPlus1], sessions: [cw.workout.name], canOverride: true,
          bibleRef: 'Section 17.C G+1',
          data: { gameDate: g, category: u.category, stress: u.stress },
        });
      }
    }
  }

  // ── C. Team training is never recovery (Section 17.E) ─────────────
  for (const cw of classified) {
    const isTT = isTeamTrainingSession(cw.workout as never);
    if (!isTT) continue;
    const markedRecovery =
      cw.workout.sessionTier === 'recovery' || String(cw.workout.workoutType) === 'Recovery';
    if (markedRecovery) {
      push({
        ruleId: 'tt_marked_recovery',
        severity: 'strong',
        message: `Team training on ${dayName(cw.date)} is marked as recovery — team training is a real session and must count as running, sprint/COD and conditioning load.`,
        dates: [cw.date], sessions: [cw.workout.name], canOverride: true,
        bibleRef: 'Section 17.E',
      });
    }
  }

  // ── D. Double-day pairings (Section 17.D) ─────────────────────────
  for (const [date, cws] of byDate) {
    const allUnits = cws.flatMap((cw) => cw.units.map((u) => ({ ...u, workout: cw.workout })));
    const hasOnFeetSprint = allUnits.some(
      (u) => u.category === 'sprint' && (u.modality === 'running' || u.modality === 'mixed'),
    );
    const heavyHingeSessions = cws.filter((cw) => cw.exposures.has('heavy_hinge'));
    const heavyLowerSessions = cws.filter(
      (cw) =>
        Array.from(cw.exposures).some((e) => HEAVY_LOWER_EXPOSURES.has(e)) ||
        cw.units.some((u) => u.category === 'lower_strength' && u.stress === 'high'),
    );
    // Hard COD from a programmed (non-team) session only — team training's
    // own COD content is normal club load.
    const codSessions = cws.filter(
      (cw) => cw.exposures.has('change_of_direction') && !isTeamTrainingSession(cw.workout as never),
    );

    if (hasOnFeetSprint && heavyHingeSessions.length > 0) {
      push({
        ruleId: 'double_hinge_plus_sprint',
        severity: 'strong',
        message: `Heavy hinge work and sprinting are stacked on ${dayName(date)} — this pairing has very competing demands (hamstring overload risk).`,
        dates: [date],
        sessions: Array.from(new Set([...heavyHingeSessions.map((c) => c.workout.name),
          ...allUnits.filter((u) => u.category === 'sprint').map((u) => u.workout.name)])),
        canOverride: true,
        bibleRef: 'Section 2 / Section 17.D',
      });
    }
    if (codSessions.length > 0 && heavyLowerSessions.length > 0) {
      push({
        ruleId: 'double_cod_plus_heavy_lower',
        severity: 'strong',
        message: `Hard change-of-direction work and heavy lower-body strength are stacked on ${dayName(date)} — risky pairing.`,
        dates: [date],
        sessions: Array.from(new Set([...codSessions.map((c) => c.workout.name), ...heavyLowerSessions.map((c) => c.workout.name)])),
        canOverride: true,
        bibleRef: 'Section 17.D',
      });
    }
    // Lower + upper as two separate full gym sessions → prefer full body.
    const lowerWorkouts = new Set(
      allUnits.filter((u) => u.category === 'lower_strength').map((u) => u.workout.id),
    );
    const upperWorkouts = new Set(
      allUnits.filter((u) => u.category === 'upper_strength').map((u) => u.workout.id),
    );
    const separate = lowerWorkouts.size > 0 && upperWorkouts.size > 0 &&
      Array.from(lowerWorkouts).some((id) => !upperWorkouts.has(id));
    if (separate) {
      push({
        ruleId: 'double_lower_plus_upper_full',
        severity: 'soft',
        message: `${dayName(date)} stacks a lower session and an upper session as two full workouts — a single full-body session is the better shape for this day.`,
        dates: [date],
        sessions: cws.map((c) => c.workout.name),
        canOverride: true,
        bibleRef: 'Section 17.D',
      });
    }
  }

  // ── B. Weekly caps (Section 17.B) ──────────────────────────────────
  // Evaluated AFTER the double-day checks so hard-day grading can see
  // whether the week also contains bad pairings.
  const hasDoublePairing = findings.some((f) => f.ruleId.startsWith('double_'));
  const capSeverity: Record<string, FindingSeverity> = {
    maxMainStrengthSessions: 'strong',
    maxRunningExposures: 'strong',
    conditioningExposures: 'soft',
    sprintCodExposures: 'soft',
  };
  // THE EXEMPTION IS CLAIMED BY NAME, NEVER BY A BOOLEAN — that is why
  // `RunningFloorExemption` is a typed pair and not a flag. A week says WHICH of
  // Sam's two authored cases it is standing on, and the build can check the
  // reason still holds.
  const runningFloorExemption: RunningFloorExemption | null =
    input.subphase === 'early_offseason' ? 'early_off_season_weeks_1_2'
    : input.subphase === 'bye_recovery' ? 'bye_recovery'
    : flags.byeWeek ? 'bye_recovery'
    : null;
  // The first four Off-season weeks (early + transition subphases) deliberately
  // carry no Speed. This is the canonical floor rule, not a generated-row patch.
  const sprintFloorExemption: SprintFloorExemption | null =
    input.subphase === 'early_offseason' || input.subphase === 'mid_offseason'
      ? 'off_season_weeks_1_4'
      : null;
  for (const cf of auditWeekAgainstCaps(counts, {
    runningFloorExemption,
    sprintFloorExemption,
  })) {
    if (cf.kind === 'under') {
      if (flags.reducedLoadActive || flags.byeWeek) continue; // never punish light weeks
      push({
        ruleId: `cap_${cf.cap}_under`,
        // STEP 3 OF CENSUS C4 — A FLOOR CARRIES ITS CEILING'S WEIGHT.
        //
        // This was hardcoded `'info'`, which is the whole of C4: `grep` for a
        // repair consumer of the three `_under` ids returned ZERO while the
        // `_over` twins had EIGHT. Sam's ceilings refused; his floors did
        // nothing. Same map as the ceilings, so neither can drift from the
        // other.
        //
        // SAFE ONLY BECAUSE STEPS 1-2 LANDED FIRST. `maxRunningExposures` is
        // `'strong'`, and `section18CraftTier.ts` BLOCKS on `strong` — so doing
        // this before the exemptions reached the validator would have made S5
        // and S6 unbuildable. Measured, backed out, and re-ordered (87299547).
        severity: capSeverity[cf.cap] ?? 'info',
        message: cf.detail,
        dates: [], sessions: [], canOverride: true,
        bibleRef: 'Section 17.B / 17.J',
        data: { observed: cf.observed, limit: cf.limit },
      });
      continue;
    }

    // Hard days are GRADED, not binary (Sam's clarified intent, 2026-07-08):
    //   0-4 = clean target, no finding
    //   5   = absolute max / upper edge:
    //           in-season → soft (game + team training already load the week)
    //           off/pre-season & bye → info, escalated to soft when the week
    //           also contains bad double-day pairings
    //   6+  = strong (week too spread out or too loaded)
    // Note: 5 being "allowed" does not make it the aim — the app should
    // still prefer stacking compatible work so athletes get true rest days.
    if (cf.cap === 'maxHardDays') {
      const hd = cf.observed;
      let severity: FindingSeverity;
      let message: string;
      if (hd >= 6) {
        severity = 'strong';
        message = `${hd} hard days — 6+ means the week is too spread out or too loaded (clean target 4, absolute max 5). Stack compatible sessions to create true rest days.`;
      } else if (flags.byeWeek) {
        // Bye week: no game to protect — usually fine, unless the week
        // also contains bad pairings.
        severity = hasDoublePairing ? 'soft' : 'info';
        message = `5 hard days on a bye week — acceptable as a mini pre-season, but prefer stacking compatible work onto fewer days.`;
      } else {
        severity = profile.seasonPhase === 'In-season'
          ? 'soft'
          : hasDoublePairing ? 'soft' : 'info';
        message = `5 hard days — above the clean 4-day target, at the absolute max. Prefer stacking compatible work (lower + easy off-feet, upper + conditioning, full body + easy aerobic) onto fewer days.`;
      }
      push({
        ruleId: 'cap_maxHardDays_over',
        severity,
        message,
        dates: [], sessions: [], canOverride: true,
        bibleRef: 'Section 2 / Section 17.B (graded per 2026-07-08 clarification)',
        data: {
          observed: hd, target: 4, absoluteMax: 5,
          seasonPhase: profile.seasonPhase ?? null,
          byeWeek: !!flags.byeWeek,
          hasDoublePairing,
        },
      });
      continue;
    }

    // Bye weeks: a small overshoot (+1) is a mini-pre-season, not a problem.
    let severity = capSeverity[cf.cap] ?? 'soft';
    if (flags.byeWeek && cf.observed - cf.limit <= 1) severity = 'info';
    push({
      ruleId: `cap_${cf.cap}_over`,
      severity,
      message: cf.detail,
      dates: [], sessions: [], canOverride: true,
      bibleRef: 'Section 17.B',
      data: { observed: cf.observed, limit: cf.limit, byeWeek: !!flags.byeWeek },
    });
  }

  // ── E. Minimum effective week (Section 17.J) ──────────────────────
  // Never fires on reduced-load / bye weeks — do not punish.
  if (!flags.reducedLoadActive && !flags.byeWeek) {
    if (counts.mainStrengthExposures < 2) {
      push({
        ruleId: 'min_strength_under',
        severity: 'info',
        message: `${counts.mainStrengthExposures} main strength session(s) this week — the Bible's minimum effective target is 2.`,
        dates: [], sessions: [], canOverride: true,
        bibleRef: 'Section 17.J',
        data: { observed: counts.mainStrengthExposures, target: 2 },
      });
    }
  }

  // ── Dedupe: same rule/date/session keeps the strictest severity ────
  const deduped = new Map<string, WeekFinding>();
  for (const f of findings) {
    const key = `${f.ruleId}|${f.dates.join(',')}|${f.sessions.join(',')}`;
    const existing = deduped.get(key);
    if (!existing || SEVERITY_RANK[f.severity] > SEVERITY_RANK[existing.severity]) {
      deduped.set(key, f);
    }
  }
  const finalFindings = Array.from(deduped.values()).sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );

  return {
    findings: finalFindings,
    counts,
    anchorsUsed: {
      gameDates,
      teamTrainingDates,
      derived: observedGames.length > 0 || observedTT.length > 0,
    },
  };
}

// ─── Log-only helpers for call sites ─────────────────────────────────

/**
 * Validate + log. THROW-PROOF and side-effect-free: a validator bug can
 * never break a caller. Returns null on internal error.
 */
export function logWeekValidation(
  input: ValidateProgramWeekInput,
  label: string,
): WeekValidationReport | null {
  try {
    const report = validateProgramWeek(input);
    logger.debug('[rules] week_validation', {
      label,
      findingCount: report.findings.length,
      findings: report.findings.map((f) => `${f.severity}:${f.ruleId}@${f.dates.join(',') || 'week'}`),
      hardDays: report.counts.hardDays,
      mainStrength: report.counts.mainStrengthExposures,
      running: report.counts.runningExposures,
      sprintCod: report.counts.sprintCodExposures,
      conditioning: report.counts.conditioningExposures,
      anchors: report.anchorsUsed,
    });
    return report;
  } catch (e) {
    logger.debug('[rules] week_validation_error', { label, error: String(e) });
    return null;
  }
}

/**
 * Convenience adapter for resolved weeks (ResolvedDay-shaped inputs).
 * Structural typing keeps this module free of a sessionResolver import.
 */
export function validatorDaysFromResolvedWeek(
  resolved: Array<{ date: string; workout: Workout | null }>,
): ValidatorDayInput[] {
  return resolved.map((d) => ({ date: d.date, workouts: [d.workout] }));
}

// ─── Allocation-week adapter (generation-time, log-only) ─────────────

/**
 * Structural view of coachingEngine's SessionAllocation — kept structural
 * so this module never imports coachingEngine (no cycle).
 */
export interface AllocationLike {
  dayOfWeek?: string;
  focus: string;
  tier: string;
  isTeamDay?: boolean;
  isHardExposure?: boolean;
  hasCombinedConditioning?: boolean;
  conditioningFlavour?: 'aerobic' | 'tempo' | 'high-intensity';
  conditioningCategory?: 'aerobic_base' | 'tempo' | 'sprint' | 'vo2' | 'glycolytic' | 'cod_decel';
}

/** Reference Monday for synthetic allocation-week dates (2026-01-05 = Mon). */
const REF_MONDAY = '2026-01-05';
const REF_DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Validate a generation-time weekly plan (allocations, pre-resolver) and
 * log findings. LOG-ONLY and throw-proof — generation behaviour is never
 * affected. Allocations lack exercises, so exercise-level checks (neural
 * primer, hinge/COD exposures) conservatively rely on names.
 */
export function logAllocationWeekValidation(
  weeklyPlan: AllocationLike[],
  opts: {
    gameDay?: string;
    seasonPhase?: SeasonPhase | null;
    profile?: StressContext;
    label?: string;
  } = {},
): WeekValidationReport | null {
  try {
    const now = new Date().toISOString();
    const dayMap = new Map<string, Array<Workout | null>>();
    for (const dn of REF_DAY_ORDER) dayMap.set(dn, []);

    for (const s of weeklyPlan) {
      if (!s.dayOfWeek || !dayMap.has(s.dayOfWeek)) continue;
      const w = {
        id: `alloc-${s.dayOfWeek}-${dayMap.get(s.dayOfWeek)!.length}`,
        microcycleId: 'alloc', dayOfWeek: 0,
        name: s.focus.slice(0, 80), description: s.focus,
        durationMinutes: 45,
        intensity: s.isHardExposure ? 'High' : s.tier === 'optional' ? 'Light' : 'Moderate',
        workoutType: s.tier === 'recovery' ? 'Recovery' : 'Strength',
        sessionTier: s.tier,
        hasCombinedConditioning: s.hasCombinedConditioning,
        conditioningFlavour: s.conditioningFlavour,
        conditioningCategory: s.conditioningCategory,
        exercises: [], createdAt: now, updatedAt: now,
      } as unknown as Workout;
      if (s.isTeamDay) (w as unknown as { isTeamDay: boolean }).isTeamDay = true;
      dayMap.get(s.dayOfWeek)!.push(w);
    }

    // Synthetic game stub on the profile game day (in-season generation
    // plans don't carry the game as an allocation).
    const gameDayName = opts.gameDay && REF_DAY_ORDER.includes(opts.gameDay) ? opts.gameDay : null;
    if (gameDayName && opts.seasonPhase === 'In-season') {
      dayMap.get(gameDayName)!.push({
        id: 'alloc-game', microcycleId: 'alloc', dayOfWeek: 0,
        name: 'Game Day', description: '', durationMinutes: 0,
        intensity: 'Maximal', workoutType: 'Game',
        exercises: [], createdAt: now, updatedAt: now,
      } as unknown as Workout);
    }

    const days: ValidatorDayInput[] = REF_DAY_ORDER.map((dn, i) => ({
      date: addDaysISO(REF_MONDAY, i),
      workouts: dayMap.get(dn)!,
    }));

    const profile = { ...(opts.profile ?? {}), seasonPhase: opts.seasonPhase ?? undefined };
    const anchors: ValidateProgramWeekInput['anchors'] = {};
    if (gameDayName === 'Sunday') {
      anchors.previousGameDate = addDaysISO(REF_MONDAY, -1);
    }
    if (gameDayName === 'Monday') {
      anchors.nextGameDate = addDaysISO(REF_MONDAY, 7);
    } else if (gameDayName === 'Tuesday') {
      anchors.nextGameDate = addDaysISO(REF_MONDAY, 8);
    }
    return logWeekValidation(
      {
        days,
        anchors: Object.keys(anchors).length > 0 ? anchors : undefined,
        profile,
        weekFlags: deriveWeekValidationFlags({ days, profile }),
      },
      opts.label ?? 'generation_weekly_plan',
    );
  } catch (e) {
    logger.debug('[rules] allocation_week_validation_error', { error: String(e) });
    return null;
  }
}
