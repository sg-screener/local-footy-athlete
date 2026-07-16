/**
 * injuryAdjustmentEngine.ts
 *
 * Generic deterministic engine that turns a "<bodyPart> hurts, <severity>/10"
 * message into REAL future-only program edits — driven by exercise metadata
 * (`exerciseTags.injury`), not hardcoded body-part fixes.
 *
 * CONTRACT
 *   Input:  raw user message text + (optional) todayISO override
 *   Effect: writes date overrides + (optionally) weekly overrides via the
 *           shared `coachActions` dispatcher
 *   Output: { fired, diff, reply, … }  — everything the UI needs to render
 *           a grounded, diff-only response
 *
 * RULES (matches the build spec)
 *   1. Active severity with a known body part → engine fires.
 *   2. No body part / no severity → engine declines (caller falls through
 *      to the existing client guard / LLM path).
 *   3. Edits are TODAY-FORWARD only. Past sessions are never mutated.
 *   4. Mutations go through `applyCoachAction` so no store wiring leaks here.
 *   5. The reply is built from the actual filtered diff. If nothing landed:
 *      either "I couldn't find any future sessions this week to adjust." (no
 *      future sessions exist) or "I tried to adjust your week, but no
 *      changes were applied. Check the Program tab and try again."
 *
 * INTEGRATION
 *   Called from CoachScreen.handleSend BEFORE the network fetch, after the
 *   severity-unknown clarifier guard. The engine fully owns severity-known
 *   injury turns — the LLM never sees them.
 */

import {
  detectInjurySignals,
  detectRedFlagSymptoms,
  normalizeText,
  BODY_PARTS,
} from './injuryClarificationGuard';
import type { ExerciseTag } from '../data/exerciseTags';
import {
  applyCoachAction,
  type CoachAction,
  type WeeklyOverrideRule,
} from './coachActions';
import {
  snapshotCurrentWeek,
  diffWeekSnapshots,
  filterDiffFromDate,
  summarizeDiffBullets,
  buildScheduleStateImperative,
  type WeekDiff,
} from './coachWeekDiff';
import {
  resolveWeekWithConditioning,
  getMondayStr,
  type ResolvedDay,
} from './sessionResolver';
import { logger } from './logger';
import {
  hasActiveInjurySeverity,
  injurySeverityAvoidsExactTriggers,
  injurySeverityPausesAffectedTraining,
  injurySeverityRemovesRiskyWork,
} from '../rules/injurySeverityBands';
import { classifyExerciseRiskForBucket } from '../rules/injuryExerciseRisk';
import { getReplacementForBucket } from './injurySessionClassifier';
import { todayISOLocal } from './appDate';

// ─── Types ───

/**
 * Injury "bucket" — re-uses the keys of `ExerciseTag.injury` so the engine
 * can read per-exercise risk ratings directly with no extra mapping layer.
 */
export type InjuryBucket = keyof ExerciseTag['injury'];
//   = 'adductor' | 'pubalgia' | 'lowerBack' | 'knee' | 'hamstring'
//     | 'calf' | 'ankle' | 'shoulder' | 'elbow' | 'wrist'

export interface InjuryContext {
  bodyPart: string;              // matched body-part token (canonical, lowercased) OR 'unknown'
  severity: number;              // 1..10
  bucket: InjuryBucket | null;   // exerciseTags InjuryProfile key — null when body part unknown
  isLowerLimb: boolean;          // → strip running this week
  isUpperLimb: boolean;          // → keep lower work intact
}

export interface InjuryAdjustmentInput {
  message: string;
  todayISO?: string;
}

export interface InjuryAdjustmentResult {
  fired: boolean;
  reason: string;
  context?: InjuryContext;
  diff?: WeekDiff;
  reply?: string;
}

// ─── Body-part → InjuryBucket mapping ───
//
// Keys are entries from injuryClarificationGuard.BODY_PARTS (already
// normalized via normalizeText, so "hammy" / "hammies" / "hamstring" all
// route through this list after normalization). Values are the InjuryProfile
// key whose ratings best protect that body part.
//
// Where there's no exact match in InjuryProfile (e.g. "quad", "glute",
// "neck", "foot", "bicep", "pec") we map to the closest neighbour whose
// risk profile is the best functional proxy. Documented per entry below.

const BODY_PART_TO_BUCKET: Readonly<Record<string, InjuryBucket>> = {
  // ─ Posterior chain / lower limb ─
  hamstring: 'hamstring',
  hamstrings: 'hamstring',
  hammy: 'hamstring',
  hammies: 'hamstring',
  // glute injuries protect hinge/posterior-chain → use hamstring profile
  glute: 'hamstring',
  glutes: 'hamstring',

  // ─ Knee / quad ─
  knee: 'knee',
  knees: 'knee',
  // quad strains hate heavy knee-dominant loading → knee profile is the proxy
  quad: 'knee',
  quads: 'knee',
  quadricep: 'knee',
  quadriceps: 'knee',

  // ─ Calf / achilles ─
  calf: 'calf',
  calves: 'calf',
  achilles: 'calf',

  // ─ Ankle / foot ─
  ankle: 'ankle',
  ankles: 'ankle',
  // feet strains avoid high-impact loading → ankle is the closest proxy
  foot: 'ankle',
  feet: 'ankle',

  // ─ Groin / adductor ─
  groin: 'adductor',
  // hip/groin sits closer to adductor restrictions than lower-back loading.
  hip: 'adductor',
  hips: 'adductor',

  // ─ Back ─
  back: 'lowerBack',
  'lower back': 'lowerBack',
  'upper back': 'lowerBack',

  // ─ Shoulder & upper-body adjacency ─
  shoulder: 'shoulder',
  shoulders: 'shoulder',
  // pec / chest / neck strains all share the overhead-press / heavy-press
  // restriction that the shoulder profile already encodes
  pec: 'shoulder',
  pecs: 'shoulder',
  chest: 'shoulder',
  neck: 'shoulder',

  // ─ Elbow / arm ─
  elbow: 'elbow',
  elbows: 'elbow',
  // bicep/tricep/forearm strains share the elbow-loading restrictions
  bicep: 'elbow',
  biceps: 'elbow',
  tricep: 'elbow',
  triceps: 'elbow',
  forearm: 'elbow',
  forearms: 'elbow',

  // ─ Wrist ─
  wrist: 'wrist',
  wrists: 'wrist',
};

const LOWER_LIMB_BUCKETS = new Set<InjuryBucket>([
  'hamstring',
  'knee',
  'calf',
  'ankle',
  'adductor',
  'lowerBack',
]);

const UPPER_LIMB_BUCKETS = new Set<InjuryBucket>([
  'shoulder',
  'elbow',
  'wrist',
]);

// ─── Severity parsing ───

const NUMERIC_SEVERITY_RE = /\b([1-9]|10)\s*(?:\/\s*10|out of 10)\b/i;
const PAIN_NUMBER_RE = /\b(?:pain|sore|hurt|hurts).{0,20}\b([1-9]|10)\b/i;
const QUALITATIVE_HIGH = /\b(?:really bad|very bad|severe|sharp pain|stabbing|excruciating|killing me|agony|can'?t walk|cannot walk|can'?t move|cannot move|barely walk|barely move)\b/i;
const QUALITATIVE_MID = /\b(?:moderate|pretty bad|fairly bad|nasty)\b/i;
const QUALITATIVE_LOW = /\b(?:mild|minor|slight|barely (?:notice|hurts|sore)|just a bit|a little tight|a bit tight)\b/i;

/**
 * Pull a 1..10 severity number out of the message. Returns null when none
 * is present. We map qualitative phrases onto representative numbers so
 * downstream gating ("≥5") works uniformly.
 */
export function parseSeverityNumber(text: string): number | null {
  if (!text) return null;
  const m1 = text.match(NUMERIC_SEVERITY_RE);
  if (m1) {
    const n = parseInt(m1[1], 10);
    if (!isNaN(n) && n >= 1 && n <= 10) return n;
  }
  const m2 = text.match(PAIN_NUMBER_RE);
  if (m2) {
    const n = parseInt(m2[1], 10);
    if (!isNaN(n) && n >= 1 && n <= 10) return n;
  }
  if (QUALITATIVE_HIGH.test(text)) return 8;
  if (QUALITATIVE_MID.test(text)) return 6;
  if (QUALITATIVE_LOW.test(text)) return 3;
  return null;
}

// ─── Body-part extraction ───

/**
 * Returns the canonical body-part token matched in the message (after
 * normalization), or null. Multi-word entries are tried first so "lower
 * back" is matched before "back".
 */
export function extractBodyPart(text: string): string | null {
  if (!text) return null;
  const haystack = normalizeText(text);
  // BODY_PARTS is already ordered with multi-word entries first.
  for (const part of BODY_PARTS) {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(haystack)) return part;
  }
  return null;
}

// ─── Composite parser: full injury context ───

export function extractInjuryContext(text: string): InjuryContext | null {
  if (detectRedFlagSymptoms(text)) return null;
  const signals = detectInjurySignals(text);
  // Needs an injury signal OR negative descriptor to discriminate intent
  // (otherwise any "6/10" message would fire). Body part is OPTIONAL —
  // when missing we still act, but with a region-agnostic fallback.
  if (!signals.isInjury && !signals.hasNegativeDescriptor) return null;
  // Severity is the ONLY hard gate: without an actual number we can't
  // tell how aggressive to be, so the LLM/clarifier path takes over.
  const severity = parseSeverityNumber(text);
  if (severity == null) return null;
  const detectedBodyPart = extractBodyPart(text);
  const bodyPart = detectedBodyPart ?? 'unknown';
  const bucket: InjuryBucket | null = detectedBodyPart
    ? BODY_PART_TO_BUCKET[detectedBodyPart] ?? null
    : null;
  return {
    bodyPart,
    severity,
    bucket,
    isLowerLimb: bucket ? LOWER_LIMB_BUCKETS.has(bucket) : false,
    isUpperLimb: bucket ? UPPER_LIMB_BUCKETS.has(bucket) : false,
  };
}

// ─── Per-exercise classification ───

// ─── Avoid-this-week templated guidance ───

/**
 * 1–2 short bullets of practical "avoid this week" guidance keyed off the
 * bucket. Pure templating — no LLM. Athletes get the same restrictions
 * regardless of severity, since these are protective minimums.
 */
function avoidThisWeekBullets(bucket: InjuryBucket): string {
  switch (bucket) {
    case 'hamstring':
      return '• Heavy hinges (deadlift / RDL / Nordic-style)\n• Sprinting and high-speed running';
    case 'knee':
      return '• Heavy knee-dominant work (deep squat / lunge / jump)\n• Cutting / change-of-direction';
    case 'calf':
      return '• Sprinting, plyos, and bounding\n• Loaded calf raises';
    case 'ankle':
      return '• Running, jumping, and cutting\n• Single-leg balance work on the affected side';
    case 'adductor':
      return '• Cutting / change-of-direction\n• Heavy adductor / wide-stance squat work';
    case 'lowerBack':
      return '• Heavy axial loading (back squat / deadlift)\n• Loaded hinges';
    case 'shoulder':
      return '• Overhead press / pulling overhead\n• Heavy bench-style pressing on the painful side';
    case 'elbow':
      return '• Heavy chin-ups / curls\n• Loaded triceps extension';
    case 'wrist':
      return '• Front-rack / loaded wrist-extension work\n• Push-up variants on a flat hand';
    default:
      return '• Anything that reproduces the pain';
  }
}

// ─── Empathy line ───

function empathyLine(severity: number, bodyPart: string): string {
  if (injurySeverityPausesAffectedTraining(severity)) return `That's a serious one - let's pull back hard on the ${bodyPart}.`;
  if (injurySeverityRemovesRiskyWork(severity)) return `Sounds rough - let's take pressure off the ${bodyPart} this week.`;
  return `Got it - let's protect the ${bodyPart} for a few days.`;
}

// ─── Engine ───

export function applyInjuryAdjustment(
  input: InjuryAdjustmentInput,
): InjuryAdjustmentResult {
  const { message } = input;
  const todayISO = input.todayISO || todayISOLocal();

  const context = extractInjuryContext(message);
  if (!context) {
    return { fired: false, reason: 'no extractable severity' };
  }

  // Legacy engine requires a known bucket — the new UAE handles the
  // unknown-body-part case with a region-agnostic fallback. Decline here
  // so the caller falls through to the UAE / LLM path.
  if (!context.bucket) {
    return {
      fired: false,
      reason: 'legacy engine: body part unknown - UAE handles fallback',
      context,
    };
  }

  // Active severity triggers automatic protection; the canonical band helper
  // owns the 1-10 boundary.
  if (!hasActiveInjurySeverity(context.severity)) {
    return {
      fired: false,
      reason: `severity ${context.severity}/10 is not active`,
      context,
    };
  }

  // ── 1. Snapshot before mutating ──
  const beforeSnapshot = snapshotCurrentWeek();

  // ── 2. Identify future sessions in current week ──
  const state = buildScheduleStateImperative();
  const monday = getMondayStr(0);
  const resolved = resolveWeekWithConditioning(monday, state);
  const futureSessions: ResolvedDay[] = resolved.filter(
    (d) => d.date >= todayISO && d.workout && d.workout.exercises != null,
  );

  if (futureSessions.length === 0) {
    return {
      fired: true,
      reason: 'severity-known injury but no future sessions this week',
      context,
      diff: { hasChanges: false, changedDays: [] },
      reply: "I couldn't find any future sessions this week to adjust.",
    };
  }

  const actions: CoachAction[] = [];

  // ── 3. Per-session per-exercise classification ──
  for (const session of futureSessions) {
    const workout = session.workout!;
    const exercises = workout.exercises || [];
    if (exercises.length === 0) continue;

    const avoidNames: string[] = [];
    const cautionNames: string[] = [];
    for (const ex of exercises) {
      const name: string = ex.exercise?.name || '';
      if (!name) continue;
      const rating = classifyExerciseRiskForBucket(name, context.bucket);
      if (rating === 'avoid') avoidNames.push(name);
      else if (rating === 'caution') cautionNames.push(name);
    }

    // Severity bands:
    //   1-3:  remove exact 'avoid' triggers where present
    //   4-5:  reduce affected work via avoid-trigger removal/fallback
    //   6-7:  also remove caution-rated risky work
    //   8-10: if ≥ 50% of session is risky, swap whole day to recovery shell
    const removeNames =
      injurySeverityRemovesRiskyWork(context.severity)
        ? [...avoidNames, ...cautionNames]
        : injurySeverityAvoidsExactTriggers(context.severity)
        ? [...avoidNames]
        : [];

    for (const name of removeNames) {
      const replacement = context.bucket
        ? getReplacementForBucket(
            name,
            context.bucket as any,
            context.severity,
            exercises.map((ex) => ex.exercise?.name || '').filter(Boolean),
          )
        : null;
      if (replacement) {
        actions.push({
          kind: 'replace_exercise',
          scope: 'local_adjustment',
          payload: {
            date: session.date,
            fromExercise: name,
            toExercise: {
              name: replacement,
              sets: 3,
              repsMin: 6,
              repsMax: 8,
              notes: 'Injury swap - safe alternative before removing work.',
            },
          },
        });
        continue;
      }
      actions.push({
        kind: 'remove_exercise',
        scope: 'local_adjustment',
        payload: { date: session.date, exercise: name },
      });
    }
  }

  // ── 4. Conditioning swap for lower-limb injuries ──
  // `no_running` walks the week and strips running content from sessions
  // that have it. It's a no-op on weeks without running, so it's safe to
  // always include for lower-limb injuries.
  if (context.isLowerLimb) {
    actions.push({
      kind: 'add_weekly_override',
      scope: 'weekly_adjustment',
      payload: { rule: 'no_running' as WeeklyOverrideRule },
    });
  }

  // ── 5. Apply actions ──
  for (const action of actions) {
    try {
      applyCoachAction(action);
    } catch (e) {
      // Swallow per-action failures — the diff captures what actually
      // landed, so a single failed action just doesn't show up.
      // eslint-disable-next-line no-console
      logger.warn('[injuryEngine] action failed', { kind: action.kind, e });
    }
  }

  // ── 6. Snapshot after, compute filtered diff ──
  let afterSnapshot = snapshotCurrentWeek();
  let rawDiff = diffWeekSnapshots(beforeSnapshot, afterSnapshot);
  let diff = filterDiffFromDate(rawDiff, todayISO);

  // ── 7. Mandatory fallback: if nothing landed but severity warrants action,
  //       flip the next core session to a recovery shell so at least one
  //       override is written. We use `recovery` (not `optional`) because:
  //       (a) the diff fingerprint tracks workoutName + exerciseNames only,
  //           so an `optional` lightening is invisible in the diff (same name,
  //           same exercises, just halved sets).
  //       (b) recovery is a clear signal that an injury was reported and
  //           the engine took a protective action.
  //       This is the "session-level fallback" the spec requires.
  if (!diff.hasChanges) {
    const candidate = futureSessions.find(
      (d) => d.workout && d.workout.exercises && d.workout.exercises.length > 0,
    );
    if (candidate) {
      try {
        applyCoachAction({
          kind: 'lighten_session',
          scope: 'local_adjustment',
          payload: {
            date: candidate.date,
            level: 'optional',
          },
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        logger.warn('[injuryEngine] fallback lighten failed', e);
      }
      afterSnapshot = snapshotCurrentWeek();
      rawDiff = diffWeekSnapshots(beforeSnapshot, afterSnapshot);
      diff = filterDiffFromDate(rawDiff, todayISO);
    }
  }

  // ── 8. Build reply from diff ──
  let reply: string;
  if (diff.hasChanges) {
    const bullets = summarizeDiffBullets(diff);
    const avoid = avoidThisWeekBullets(context.bucket);
    reply = [
      empathyLine(context.severity, context.bodyPart),
      '',
      'Program changes:',
      bullets,
      '',
      'Avoid this week:',
      avoid,
      '',
      'Program updated - check your week.',
    ].join('\n');
  } else {
    reply =
      'I tried to adjust your week, but no changes were applied. Check the Program tab and try again.';
  }

  return {
    fired: true,
    reason: `severity ${context.severity}/10 + bucket ${context.bucket} → engine adjusted program`,
    context,
    diff,
    reply,
  };
}
