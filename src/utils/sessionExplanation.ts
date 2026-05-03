/**
 * Session Explanation — v3
 *
 * Pure functions. No AI. No side effects.
 * Reads ResolvedDay fields + game proximity to produce a short,
 * session-specific coaching explanation.
 *
 * v3 extends the engine with full conditioning/sprint coverage so
 * those days no longer fall back to generic "Scheduled session" copy.
 */

import type { ResolvedDay } from './sessionResolver';
import type { SeasonPhase } from '../types/domain';

// ─── Legacy Type (consumed by SessionStateBadge — unused but exported for compat) ───

export type SessionStateLabel = 'Building' | 'Steady' | 'Holding' | 'Backing off' | 'Easing in' | 'Pushing hard' | null;

// ─── Types ───

export type SessionIntent =
  | 'programmed'
  | 'game'
  | 'game_adjusted'
  | 'conditioning'
  | 'recovery'
  | 'rest';

export interface SessionExplanation {
  headline: string;
  body: string;
}

/**
 * Context used to gate game-related language.
 *
 * Game phrasing ("before the weekend", "game prep", "game readiness") must
 * only appear when the athlete actually has a game this week AND we're in
 * (or close to) the season. Off-season athletes shouldn't see game framing
 * even if the calendar contains a stray future game date.
 */
export interface SessionContext {
  /** Days until the next scheduled game (negative = past, null = none upcoming). */
  daysToGame: number | null;
  /** True when at least one game falls within the current ±7 day window. */
  hasGameThisWeek?: boolean;
  /** Athlete's current season phase from onboarding. */
  seasonPhase?: SeasonPhase;
}

// ─── Workout Name Parsing ───

type BodyFocus = 'lower' | 'upper' | 'full';
type MovementFocus = 'squat' | 'hinge' | 'push' | 'pull' | 'pump' | 'power' | null;

interface SessionProfile {
  bodyFocus: BodyFocus | null;
  movementFocus: MovementFocus;
  isPower: boolean;
  isPump: boolean;
}

function parseWorkoutName(name: string): SessionProfile {
  const n = name.toLowerCase();
  let bodyFocus: BodyFocus | null = null;
  if (n.includes('lower')) bodyFocus = 'lower';
  else if (n.includes('upper')) bodyFocus = 'upper';
  else if (n.includes('full')) bodyFocus = 'full';

  let movementFocus: MovementFocus = null;
  if (n.includes('squat')) movementFocus = 'squat';
  else if (n.includes('hinge') || n.includes('deadlift')) movementFocus = 'hinge';
  else if (n.includes('push') || n.includes('press')) movementFocus = 'push';
  else if (n.includes('pull') || n.includes('row')) movementFocus = 'pull';
  else if (n.includes('pump') || n.includes('arm') || n.includes('gunshow')) movementFocus = 'pump';
  else if (n.includes('power') || n.includes('explosive')) movementFocus = 'power';

  return {
    bodyFocus,
    movementFocus,
    isPower: n.includes('power') || n.includes('explosive') || n.includes('contrast'),
    isPump: n.includes('pump') || n.includes('arm') || n.includes('gunshow'),
  };
}

// ─── Conditioning Taxonomy ───

export type ConditioningKind =
  | 'free_sprint'        // Free Sprint Session — athlete-led speed exposure
  | 'quality_sprint'     // Quality Sprints, Flying Sprints, Hill Sprints
  | 'max_velocity'       // MAS Training, MAS 15:15 Blocks
  | 'repeat_sprint'      // Sprint Intervals, 200m/400m Repeat Runs
  | 'accel_accumulation' // Max Effort Sprint Accumulation
  | 'high_intensity'     // Tabata, Inverse Tabata, Hard Row/Ski/Bike Intervals, 4x4 VO2
  | 'metcon'             // MetCon, Flog Friday
  | 'fartlek'            // Footy Fartlek
  | 'tempo'              // Tempo Run, Long Nasal Run, Tempo-Run
  | 'long_aerobic'       // Long Run, 6x1km, 1km Repeats
  | 'aerobic_base'       // generic aerobic
  | 'flush'              // Flush Run, Easy Bike/Row/Ski/Swim, Light Circuits
  | null;

/**
 * Classify a conditioning session by name or workoutType.
 * Returns null if the session isn't recognisably a conditioning type.
 */
function classifyConditioning(name: string, workoutType?: string): ConditioningKind {
  const n = (name || '').toLowerCase();
  const wt = (workoutType || '').toLowerCase();

  // Free sprint (athlete-led)
  if (n.includes('free sprint')) return 'free_sprint';

  // Quality / flying / hill sprints — high-quality speed
  if (n.includes('flying sprint')) return 'quality_sprint';
  if (n.includes('hill sprint') || wt === 'hill-sprints') return 'quality_sprint';
  if (n.includes('quality sprint') || wt === 'quality-sprints') return 'quality_sprint';

  // Max velocity / MAS-based speed reserve
  if (n.includes('mas ') || n.includes('mas-') || n.startsWith('mas') || wt === 'mas-training') {
    return 'max_velocity';
  }

  // Repeat sprint capacity
  if (n.includes('sprint interval') || wt === 'sprint-intervals') return 'repeat_sprint';
  if (n.includes('repeat run') || n.includes('200m') || n.includes('400m')) return 'repeat_sprint';

  // Accel accumulation (low impact on bike)
  if (n.includes('max effort sprint accumulation') || n.includes('accel')) return 'accel_accumulation';

  // High-intensity intervals (non-sprint, mostly off-feet)
  if (n.includes('tabata') || n.includes('4x4 vo2')) return 'high_intensity';
  if (n.includes('hard row') || n.includes('hard ski') || n.includes('hard assault') || n.includes('hard bike')) {
    return 'high_intensity';
  }

  // MetCon / Flog Friday — mixed conditioning
  if (n.includes('metcon') || wt === 'metcon') return 'metcon';
  if (n.includes('flog friday') || wt === 'flog-friday') return 'metcon';

  // Fartlek — varied pace running
  if (n.includes('fartlek')) return 'fartlek';

  // Tempo
  if (n.includes('tempo') || n.includes('nasal run') || wt === 'tempo-run') return 'tempo';

  // Long aerobic
  if (n.includes('long run') || wt === 'long-run') return 'long_aerobic';
  if (n.includes('6x1km') || n.includes('1km repeat') || wt === '6x1km') return 'long_aerobic';

  // Flush / easy — recovery-flavoured conditioning
  if (n.includes('flush') || n.startsWith('easy ') || n.includes('light circuit') || wt === 'flush-out') {
    return 'flush';
  }

  // Generic row/ski/bike intervals (no "hard" prefix) — aerobic
  if (
    (n.includes('row interval') || n.includes('ski interval') || n.includes('bike interval') || n.includes('assault bike')) &&
    !n.includes('hard')
  ) {
    return 'aerobic_base';
  }

  // Unknown conditioning session
  return null;
}

// ─── Placement Context ───

type Placement = 'early_week' | 'mid_week' | 'late_week' | 'weekend';

function getPlacement(dayOfWeek: number): Placement {
  // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  if (dayOfWeek === 1 || dayOfWeek === 2) return 'early_week';
  if (dayOfWeek === 3 || dayOfWeek === 4) return 'mid_week';
  if (dayOfWeek === 5) return 'late_week';
  return 'weekend'; // Sat/Sun
}

// ─── Programmed (Strength) Session Body Generation ───

function buildProgrammedBody(
  profile: SessionProfile,
  placement: Placement,
  intensity: string | undefined,
  hasCombinedConditioning: boolean | undefined,
  conditioningFlavour: string | undefined,
  daysToGame: number | null,
  hasGameContext: boolean,
): string {
  const parts: string[] = [];

  if (profile.isPump) {
    parts.push('Low-fatigue accessory work to drive blood flow and build joint resilience without taxing your recovery.');
  } else if (profile.isPower) {
    parts.push(buildPowerSentence(profile));
  } else if (profile.bodyFocus === 'lower' && profile.movementFocus === 'squat') {
    parts.push(buildLowerSquatSentence(placement, intensity, hasGameContext));
  } else if (profile.bodyFocus === 'lower' && profile.movementFocus === 'hinge') {
    parts.push(buildLowerHingeSentence(placement, intensity, hasGameContext));
  } else if (profile.bodyFocus === 'lower') {
    parts.push(buildLowerGenericSentence(placement, intensity));
  } else if (profile.bodyFocus === 'upper' && profile.movementFocus === 'push') {
    parts.push(buildUpperPushSentence(placement, daysToGame));
  } else if (profile.bodyFocus === 'upper' && profile.movementFocus === 'pull') {
    parts.push(buildUpperPullSentence(placement));
  } else if (profile.bodyFocus === 'upper') {
    parts.push(buildUpperGenericSentence(placement, daysToGame));
  } else if (profile.bodyFocus === 'full') {
    parts.push(buildFullBodySentence(placement, intensity));
  } else {
    parts.push(buildFallbackSentence(placement, intensity, hasGameContext));
  }

  if (hasCombinedConditioning && conditioningFlavour) {
    parts.push(buildConditioningFlavourNote(conditioningFlavour));
  }

  return parts.join(' ');
}

// ── Strength sentence builders ──

function buildPowerSentence(profile: SessionProfile): string {
  if (profile.bodyFocus === 'lower') {
    return 'Power and paired strength + explosive work to convert lower-body strength into speed. Perform the explosive move immediately after the heavy lift.';
  }
  if (profile.bodyFocus === 'upper') {
    return 'Upper-body power focus to build rate of force development without accumulating unnecessary volume.';
  }
  return 'Power-focused session to develop speed and explosiveness from the strength you\u2019ve already built.';
}

function buildLowerSquatSentence(
  placement: Placement,
  intensity: string | undefined,
  hasGameContext: boolean,
): string {
  if (intensity === 'High' || intensity === 'Maximal') {
    if (placement === 'early_week') {
      return hasGameContext
        ? 'Heavy squat session early in the week while you\u2019re fresh, with enough runway to recover before the weekend.'
        : 'Heavy squat session early in the week while you\u2019re fresh, with enough runway to recover later in the week.';
    }
    return 'Heavy squat day to push lower-body strength. Loads are set to challenge you without burying your legs for the week.';
  }
  if (placement === 'early_week') {
    return 'Squat-dominant session placed early to load your legs when freshness is highest.';
  }
  return 'Squat-focused lower session to build strength through the quads and trunk under controlled intensity.';
}

function buildLowerHingeSentence(
  placement: Placement,
  intensity: string | undefined,
  hasGameContext: boolean,
): string {
  if (intensity === 'High' || intensity === 'Maximal') {
    return hasGameContext
      ? 'Hip-hinge focus to build posterior chain strength. Heavy pulls are placed here so fatigue doesn\u2019t carry into game prep.'
      : 'Hip-hinge focus to build posterior chain strength. Heavy pulls are placed here so fatigue doesn\u2019t carry into the higher-fatigue sessions later in the week.';
  }
  if (placement === 'mid_week') {
    return 'Hinge-dominant session mid-week to load the posterior chain while balancing weekly fatigue.';
  }
  return 'Hip-hinge lower session targeting the glutes, hamstrings, and back to support running power and resilience.';
}

function buildLowerGenericSentence(placement: Placement, intensity: string | undefined): string {
  if (placement === 'early_week') {
    return 'Lower-body session early in the week to load your legs when freshness and recovery capacity are highest.';
  }
  if (intensity === 'Light' || intensity === 'Moderate') {
    return 'Moderate lower-body session to maintain strength stimulus without adding excessive fatigue this deep in the week.';
  }
  return 'Lower-body strength work to develop the foundation for on-field power and durability.';
}

function buildUpperPushSentence(placement: Placement, daysToGame: number | null): string {
  if (daysToGame !== null && daysToGame <= 3) {
    return 'Upper push focus to drive pressing strength without adding lower-body fatigue before the weekend.';
  }
  if (placement === 'mid_week') {
    return 'Pressing-focused upper session mid-week to build horizontal and vertical push strength while your legs recover.';
  }
  return 'Upper push session to develop pressing strength and shoulder stability without loading the lower body.';
}

function buildUpperPullSentence(placement: Placement): string {
  if (placement === 'mid_week' || placement === 'late_week') {
    return 'Pull-focused upper session to balance pressing volume and build back strength that protects the shoulders long-term.';
  }
  return 'Upper pull session targeting the back and posterior shoulder to support posture, tackle strength, and shoulder health.';
}

function buildUpperGenericSentence(placement: Placement, daysToGame: number | null): string {
  if (daysToGame !== null && daysToGame <= 3) {
    return 'Upper-body session to keep the training stimulus going without taxing your legs before the game.';
  }
  if (placement === 'early_week') {
    return 'Full upper session early in the week to push pressing and pulling volume when energy is highest.';
  }
  return 'Upper-body strength work to build the push, pull, and carry capacity that transfers to the field.';
}

function buildFullBodySentence(placement: Placement, intensity: string | undefined): string {
  if (intensity === 'Light' || intensity === 'Moderate') {
    return 'Full-body session at controlled intensity to touch every movement pattern without creating excessive soreness.';
  }
  if (placement === 'early_week') {
    return 'Full-body strength session early in the week to hit all major patterns while recovery capacity is high.';
  }
  return 'Full-body session balancing upper and lower work to maintain broad strength across the week.';
}

function buildFallbackSentence(
  placement: Placement,
  intensity: string | undefined,
  hasGameContext: boolean,
): string {
  if (intensity === 'High' || intensity === 'Maximal') {
    if (placement === 'early_week') {
      return hasGameContext
        ? 'High-intent session placed early in the week so you can push hard and still recover before the game.'
        : 'High-intent session placed early in the week so you can push hard and still have fresh days to recover.';
    }
    return 'Strength session with meaningful load. Execute with intent and log how it feels.';
  }
  if (placement === 'late_week') {
    return hasGameContext
      ? 'Late-week session with managed intensity to maintain the training stimulus without compromising game readiness.'
      : 'Late-week session with managed intensity to maintain the training stimulus while keeping fatigue manageable across the week.';
  }
  return 'Programmed session set for where you are in the block. Execute the prescribed loads with intent.';
}

function buildConditioningFlavourNote(flavour: string): string {
  switch (flavour) {
    case 'aerobic':
      return 'Aerobic finisher included to build your base without spiking fatigue.';
    case 'tempo':
      return 'Tempo conditioning tagged on to develop sustained work capacity at threshold.';
    case 'high-intensity':
      return 'High-intensity finisher to sharpen repeat-effort ability in a controlled setting.';
    default:
      return '';
  }
}

// ─── Conditioning Session Body Generation ───

function buildConditioningBody(
  kind: ConditioningKind,
  placement: Placement,
  daysToGame: number | null,
  isOptional: boolean,
): string {
  // Game-proximity aware openings get priority for sprint-style work
  const gameNear = daysToGame !== null && daysToGame <= 3;

  switch (kind) {
    case 'free_sprint':
      if (isOptional) {
        return 'Optional sprint exposure to touch speed and mechanics \u2014 only run it if you\u2019re moving well and not carrying fatigue.';
      }
      if (gameNear) {
        return 'Short, high-quality sprint exposure placed here to prime the nervous system without dragging fatigue toward game day. Shut it down if speed drops.';
      }
      if (placement === 'mid_week') {
        return 'Free sprint work mid-week to expose you to true top-end speed while recovery capacity is still high. Keep volume low and quality high.';
      }
      return 'Athlete-led sprint exposure to build top-end speed. Stop when speed drops \u2014 this is a quality session, not a volume one.';

    case 'quality_sprint':
      if (gameNear) {
        return 'Quality sprint work to sharpen speed without excessive volume before the game. Full rest between reps and stop when mechanics break down.';
      }
      return 'High-quality sprint exposure to develop maximum velocity and neuromuscular output. Full recoveries between reps \u2014 the point is speed, not conditioning.';

    case 'max_velocity':
      // MAS-fallback copy lives on the actual session description (sessionBuilder),
      // not here — most athletes read the session, not the "Why this session" panel.
      if (placement === 'mid_week') {
        return 'Max velocity intervals placed mid-week to build speed reserve while your legs are still fresh enough to hit the paces.';
      }
      return 'Max velocity work to expand your speed reserve so game pace feels easier. Hit the prescribed paces or the stimulus is lost.';

    case 'repeat_sprint':
      if (gameNear) {
        return 'Repeat-sprint work tuned to keep you game-ready. Hold the prescribed paces and respect the rests \u2014 the quality matters more than the total work.';
      }
      return 'Repeat-sprint intervals to build the ability to reproduce high efforts under fatigue \u2014 the exact quality footy demands late in games.';

    case 'accel_accumulation':
      return 'Low-impact acceleration accumulation on the bike to touch peak output without the tissue cost of field sprints. Keep efforts all-out and rests honest.';

    case 'high_intensity':
      if (placement === 'late_week' || gameNear) {
        return 'Short, sharp intervals with full rest to keep conditioning sharp without the tissue cost of running. Don\u2019t let the efforts become just hard \u2014 they need to be top-end.';
      }
      return 'High-intensity intervals to build repeat-effort capacity in a controlled, low-impact format. Go hard on the work, actually recover on the rest.';

    case 'metcon':
      if (placement === 'late_week') {
        return 'Mixed-modality conditioning to finish the week \u2014 push hard, but don\u2019t let fatigue from this leak into game prep.';
      }
      return 'Mixed conditioning to stress aerobic and anaerobic systems together. Hold intent across the whole piece, not just the opening rounds.';

    case 'fartlek':
      return 'Varied-pace running to build aerobic capacity with some bite. Mix the efforts honestly \u2014 the easy sections recover you, the hard sections develop you.';

    case 'tempo':
      if (gameNear) {
        return 'Tempo running to accumulate repeat-effort volume while keeping intensity below true sprint demand. Good for keeping the engine turning over before the weekend.';
      }
      return 'Tempo running to build sustained work capacity at threshold. Hold the pace, don\u2019t drift into either easy or all-out.';

    case 'long_aerobic':
      return 'Longer aerobic piece to build the base your game conditioning sits on top of. Pace control matters more than feeling destroyed at the end.';

    case 'aerobic_base':
      return 'Aerobic base work to build your engine without spiking fatigue. Conversational effort \u2014 if you\u2019re gasping, back it off.';

    case 'flush':
      if (daysToGame !== null && daysToGame === -1) {
        return 'Post-game flush to promote blood flow and help you bounce back. Keep it very easy \u2014 the point is recovery, not a second workout.';
      }
      return 'Aerobic flush placed here to build low-fatigue conditioning and support recovery, not to create a second hard session.';

    default:
      // Unknown conditioning session — still give something better than generic
      if (gameNear) {
        return 'Conditioning session with intensity managed for game proximity. Execute the prescribed work cleanly and shut it down if quality drops.';
      }
      return 'Conditioning session placed here to build a specific quality \u2014 hold the prescribed intent rather than turning it into something harder.';
  }
}

// ─── Intent Derivation ───

export function deriveIntent(source: ResolvedDay['source']): SessionIntent {
  switch (source) {
    case 'template':
    case 'manual':
      return 'programmed';
    case 'game':
      return 'game';
    case 'gameProximity':
      return 'game_adjusted';
    case 'conditioning':
      return 'conditioning';
    case 'recovery':
      return 'recovery';
    case 'rest':
    case 'none':
      return 'rest';
    default:
      return 'rest';
  }
}

/** Decide whether a "programmed" session is actually a conditioning session. */
function isProgrammedConditioning(
  workoutType: string | undefined,
  name: string | undefined,
): boolean {
  if (!workoutType && !name) return false;
  const t = (workoutType || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (t === 'strength') return false;
  if (
    t === 'conditioning' ||
    t === 'sprint-intervals' ||
    t === 'hill-sprints' ||
    t === 'quality-sprints' ||
    t === 'mas-training' ||
    t === 'tempo-run' ||
    t === 'long-run' ||
    t === 'metcon' ||
    t === 'flog-friday' ||
    t === '6x1km' ||
    t === 'flush-out' ||
    t === 'nordic-4x4'
  ) {
    return true;
  }
  return classifyConditioning(name || '', workoutType) !== null;
}

// ─── Headline Generation ───

function buildConditioningHeadline(kind: ConditioningKind): string {
  switch (kind) {
    case 'free_sprint':
    case 'quality_sprint':
      return 'Sprint quality';
    case 'max_velocity':
      return 'Speed exposure';
    case 'repeat_sprint':
      return 'Repeat-sprint capacity';
    case 'accel_accumulation':
      return 'Low-impact speed';
    case 'high_intensity':
      return 'High-intensity intervals';
    case 'metcon':
      return 'Mixed conditioning';
    case 'fartlek':
      return 'Varied-pace running';
    case 'tempo':
      return 'Tempo conditioning';
    case 'long_aerobic':
      return 'Aerobic base';
    case 'aerobic_base':
      return 'Aerobic base';
    case 'flush':
      return 'Low-fatigue conditioning';
    default:
      return 'Conditioning focus';
  }
}

function buildHeadline(
  intent: SessionIntent,
  profile: SessionProfile,
  conditioningKind: ConditioningKind,
  isProgConditioning: boolean,
): string {
  if (intent === 'game') return 'Game day';
  if (intent === 'game_adjusted') return 'Adjusted for game week';
  if (intent === 'conditioning') return buildConditioningHeadline(conditioningKind);
  if (intent === 'recovery') return 'Active recovery';
  if (intent === 'rest') return 'Rest day';

  // Programmed — could be strength OR conditioning stored as a template
  if (isProgConditioning) {
    return buildConditioningHeadline(conditioningKind);
  }

  if (profile.isPump) return 'Low-fatigue session';
  if (profile.isPower) return 'Power development';
  if (profile.bodyFocus === 'lower' && profile.movementFocus === 'squat') return 'Squat strength';
  if (profile.bodyFocus === 'lower' && profile.movementFocus === 'hinge') return 'Hinge strength';
  if (profile.bodyFocus === 'lower') return 'Lower-body strength';
  if (profile.bodyFocus === 'upper' && profile.movementFocus === 'push') return 'Pressing strength';
  if (profile.bodyFocus === 'upper' && profile.movementFocus === 'pull') return 'Pulling strength';
  if (profile.bodyFocus === 'upper') return 'Upper-body strength';
  if (profile.bodyFocus === 'full') return 'Full-body strength';
  return 'Scheduled session';
}

// ─── Non-Programmed Intents ───

function buildGameBody(daysToGame: number | null): string {
  if (daysToGame === 1) {
    return 'Game tomorrow. Nothing today should add fatigue \u2014 stay sharp, keep it light, and get out.';
  }
  if (daysToGame === 2) {
    return 'Game in two days. Load is managed to keep you fresh. Don\u2019t chase numbers \u2014 move well and save it for the contest.';
  }
  return 'Your game this week shifted the plan. Intensity is pulled back so you\u2019re ready when it counts.';
}

// ─── Public API ───

/**
 * Generate the "Why this session" explanation for a resolved day.
 *
 * Pure function. No side effects, no external state, no AI calls.
 *
 * Accepts either a raw `daysToGame` number (legacy callers) or a full
 * `SessionContext` (preferred). When a SessionContext is supplied with
 * `hasGameThisWeek === false` or `seasonPhase === 'Off-season'`, all
 * game-related framing is suppressed — the "effective" daysToGame becomes
 * null and `hasGameContext` flags off, so off-season athletes never see
 * "before the weekend" / "before the game" / "game readiness" copy.
 *
 * @param day - The resolved day from the scheduling pipeline.
 * @param ctxOrDaysToGame - SessionContext object, or a raw daysToGame number.
 */
export function explainSession(
  day: ResolvedDay,
  ctxOrDaysToGame: number | null | SessionContext,
): SessionExplanation {
  // Normalise to SessionContext
  const ctx: SessionContext =
    typeof ctxOrDaysToGame === 'object' && ctxOrDaysToGame !== null
      ? ctxOrDaysToGame
      : { daysToGame: ctxOrDaysToGame as number | null };

  // Off-season OR explicit no-game-this-week → strip all game framing.
  // Note: hasGameThisWeek defaults to "true" when undefined (legacy callers
  // that only know about daysToGame still get the prior behaviour).
  const noGameContext =
    ctx.seasonPhase === 'Off-season' || ctx.hasGameThisWeek === false;
  const effectiveDaysToGame = noGameContext ? null : ctx.daysToGame;
  const hasGameContext = !noGameContext;

  const intent = deriveIntent(day.source);
  const workout = day.workout;
  const profile = parseWorkoutName(workout?.name ?? '');
  const placement = getPlacement(day.dayOfWeek);
  const isOptional = workout?.sessionTier === 'optional';

  // Classify conditioning kind from name/type whenever a workout exists
  const conditioningKind = workout
    ? classifyConditioning(workout.name ?? '', workout.workoutType)
    : null;

  // A programmed session may actually be a conditioning template — route appropriately
  const isProgConditioning =
    intent === 'programmed' &&
    workout != null &&
    isProgrammedConditioning(workout.workoutType, workout.name);

  const headline = buildHeadline(intent, profile, conditioningKind, isProgConditioning);

  let body: string;

  if (intent === 'game') {
    body = 'The week\u2019s work is done. Warm up properly, back yourself, and compete.';
  } else if (intent === 'game_adjusted') {
    body = buildGameBody(effectiveDaysToGame);
  } else if (intent === 'rest') {
    body = 'Eat well, sleep well, stay off your feet. The work you did this week only counts if you recover from it.';
  } else if (intent === 'recovery') {
    body = buildConditioningBody('flush', placement, effectiveDaysToGame, isOptional);
  } else if (intent === 'conditioning' || isProgConditioning) {
    body = buildConditioningBody(conditioningKind, placement, effectiveDaysToGame, isOptional);
  } else if (intent === 'programmed' && workout) {
    body = buildProgrammedBody(
      profile,
      placement,
      workout.intensity,
      workout.hasCombinedConditioning,
      workout.conditioningFlavour,
      effectiveDaysToGame,
      hasGameContext,
    );
  } else {
    body = 'Programmed session set for where you are in the block. Execute the prescribed work with intent.';
  }

  // ── Context suffixes ──
  const suffixes: string[] = [];

  // Game proximity warning for non-game/non-adjusted sessions
  // (skip for conditioning — the conditioning body already incorporates game context)
  // Uses effectiveDaysToGame so off-season suppresses the warning entirely.
  if (
    intent !== 'game' &&
    intent !== 'game_adjusted' &&
    intent !== 'conditioning' &&
    !isProgConditioning
  ) {
    if (effectiveDaysToGame === 1) {
      suffixes.push('Game tomorrow \u2014 everything today should leave you feeling better, not more tired.');
    } else if (effectiveDaysToGame === 2) {
      suffixes.push('Game in two days. Intensity is managed accordingly.');
    }
  }

  // Optional tier messaging (but skip for free_sprint — already worked into the body)
  if (isOptional && conditioningKind !== 'free_sprint') {
    suffixes.push('This session is optional \u2014 skip it if you\u2019re carrying fatigue.');
  }

  if (suffixes.length > 0) {
    body = body + ' ' + suffixes.join(' ');
  }

  return { headline, body };
}
