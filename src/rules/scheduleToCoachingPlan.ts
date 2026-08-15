/**
 * THE CONNECTOR — scheduler-authored schedule + specialist content → the existing
 * canonical `CoachingPlan` shape. Pure.
 *
 * **IT DECIDES NOTHING.** Sam's instruction: *"The connector decides nothing. It
 * may only translate fields and combine provenance."* Every value below is either
 * copied from the schedule, copied from a materialised session, or produced by an
 * authority that already exists (`calculateCapacity`, `buildWeeklyExposureContract`,
 * `schedulerExposureContract`). **There is no policy in this file** — if a number
 * appears here that is not a translation, it is a defect.
 *
 * ## WHY IT RETURNS `CoachingPlan` AND NOT SOMETHING NICER
 *
 * `CoachingPlan` is read by the adapter, the §18 gateway, the store and the coach.
 * **Those are consumers of the SHAPE.** Replacing the shape would be a repo-wide
 * change for no gain; replacing its PRODUCER is the whole point. So the shape is
 * preserved exactly and `buildCoachingPlan` stops being the thing that fills it.
 *
 * ## `deterministicCoachNoteEffects` IS PROVENANCE, NOT A POLICY OWNER
 *
 * Sam, 2026-08-15: *"provenance—not another policy owner. Build it as an
 * append-only record of scheduler and specialist decisions. It must never affect
 * scheduling or content selection."*
 *
 * So the seeds are APPENDED here, after both the scheduler and the specialists
 * have finished, and **nothing in this file reads them back**. They are written
 * once and never consulted — which is what makes them incapable of influencing
 * anything.
 */
import { buildWeeklyExposureContract } from './weeklyExposureContractBuilders';
import { schedulerExposureContract } from './schedulerExposureContract';
import { section18ModeAndSubphase } from './section18WeekIdentity';
import { GLOBAL_RULES, PURPOSE_IS_LOWER, type SessionPurpose } from './weeklyProgrammingContract';
import type { MaterialisedSession } from './materialiseAuthoredSessions';
import type { WeeklySchedule } from './weeklyScheduler';
import type { CapacityBand, DeterministicCoachNoteEffectSeed } from '../types/domain';
import type {
  AIConstraints, AuthoredDayIdentity, CoachingInputs, CoachingPlan, SessionAllocation,
} from '../utils/coachingEngine';
import type { Section18ContractV2Input } from './weeklyExposureContractV2';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday'];

/** The composer's archetype word for a scheduler purpose. Translation only. */
const ARCHETYPE_FOR_PURPOSE: Readonly<Record<SessionPurpose, string>> = {
  full_body: 'full_body', lower: 'lower', lower_squat: 'lower', lower_hinge: 'lower',
  upper: 'upper', upper_push: 'upper', upper_pull: 'upper',
};

const MAIN_PATTERNS: Readonly<Record<SessionPurpose, string[]>> = {
  full_body: ['squat', 'hinge', 'push', 'pull'],
  lower: ['squat', 'hinge'], lower_squat: ['squat'], lower_hinge: ['hinge'],
  upper: ['push', 'pull'], upper_push: ['push'], upper_pull: ['pull'],
};

/** The adapter's flavour word, read off the template's own category. */
function flavourFor(category: string | null): 'aerobic' | 'tempo' | 'high-intensity' | undefined {
  if (category === null) return undefined;
  if (category === 'aerobic_base' || category === 'recovery_flush') return 'aerobic';
  if (category === 'tempo') return 'tempo';
  return 'high-intensity';
}

export interface ConnectorInput {
  readonly schedule: WeeklySchedule;
  readonly materialised: readonly MaterialisedSession[];
  readonly coachingInputs: CoachingInputs;
  readonly capacity: CapacityBand;
  readonly capacityFactors: readonly string[];
  readonly offseasonSubphase: CoachingPlan['offseasonSubphase'];
  readonly preseasonSubphase: CoachingPlan['preseasonSubphase'];
  /** Everything §18 needs that is not a scheduling decision. */
  readonly section18Identity: Omit<Section18ContractV2Input,
    'plannerSelected' | 'teamTrainingDays' | 'fixtureDays' | 'capacity'
    | 'mode' | 'declaredSubphase' | 'anchorState'>;
  readonly clubNights: readonly number[];
  readonly gameDays: readonly number[];
  readonly v1Input: Parameters<typeof buildWeeklyExposureContract>[0];
}

export function scheduleToCoachingPlan(input: ConnectorInput): CoachingPlan {
  const { schedule, materialised, coachingInputs, capacity } = input;
  const { demand } = schedule;

  // ── V1 CONTRACT — the existing separate authority, called directly ────────
  const legacy = buildWeeklyExposureContract(input.v1Input);
  const identity = section18ModeAndSubphase(coachingInputs, legacy);

  // ── V2 CONTRACT — derived from the COMPLETED schedule ────────────────────
  const contractV2 = schedulerExposureContract({
    schedule,
    identity: {
      ...input.section18Identity,
      mode: identity.mode,
      declaredSubphase: identity.declaredSubphase,
      anchorState: identity.anchorState,
      capacity,
    } as Section18ContractV2Input,
    clubNights: input.clubNights,
    gameDays: input.gameDays,
  });

  // ── THE WEEK, TRANSLATED DAY BY DAY ──────────────────────────────────────
  //
  // One allocation per materialised session, in order. The connector cannot
  // change the count: `map`, like the boundary above it.
  const weeklyPlan: SessionAllocation[] = materialised.map((session, index) => {
    const intention = schedule.days[index];
    const purpose = session.purpose;
    const template = session.conditioningTemplate;
    const isStrength = session.owner === 'strength' && purpose !== null;

    // ── PROVENANCE, APPENDED AND NEVER READ ────────────────────────────────
    const effects: DeterministicCoachNoteEffectSeed[] = [];
    if (session.unmaterialised) {
      effects.push({
        kind: 'conditioning_substituted' as never,
        reason: session.unmaterialised as never,
        ownerKey: `specialist:${session.dayOfWeek}`,
      });
    }

    // ── THE TYPED DAY IDENTITY, CARRIED WHOLE ──────────────────────────────
    //
    // Copied off the scheduler's own day. **The connector decides nothing here
    // either** — `anchor` is its `game`/`clubTraining` flags and `components` is
    // what it authorised the day to hold. This is the field that stops the
    // reader downstream from rebuilding the day out of hints.
    const components: AuthoredDayIdentity['components'] = [
      ...(isStrength ? ['strength' as const] : []),
      ...(template ? ['conditioning' as const] : []),
      ...(session.owner === 'rest_or_recovery' ? ['recovery' as const] : []),
    ];
    const authoredDay: AuthoredDayIdentity = {
      anchor: session.game ? 'game' : session.clubTraining ? 'club_training' : null,
      components,
    };

    const allocation: SessionAllocation = {
      tier: (session.optional ? 'optional' : 'core') as SessionAllocation['tier'],
      focus: intention?.purpose ?? session.owner,
      dayOfWeek: DAY_NAMES[session.dayOfWeek],
      authoredDay,
      // Hard/rest classification is the SCHEDULER's (Sam's boundary), read off
      // the day it authored rather than recomputed here.
      isHardExposure: session.owner === 'strength' || session.game
        || session.clubTraining,
      planEntryId: `sched:${schedule.weekStartISO}:${session.dayOfWeek}:${purpose ?? session.owner}`,
      isTeamDay: session.clubTraining,
      ...(effects.length > 0 ? { deterministicCoachNoteEffects: effects } : {}),
    } as SessionAllocation;

    if (isStrength && purpose) {
      Object.assign(allocation, {
        strengthPattern: ARCHETYPE_FOR_PURPOSE[purpose],
        strengthIntent: {
          archetype: ARCHETYPE_FOR_PURPOSE[purpose],
          primaryPattern: MAIN_PATTERNS[purpose][0],
          plannedPatterns: MAIN_PATTERNS[purpose],
          effectivePatterns: MAIN_PATTERNS[purpose],
        },
        ...(session.powerPrimer ? { powerPrimer: session.powerPrimer } : {}),
      });
    }

    if (template && intention?.conditioningCategory) {
      Object.assign(allocation, {
        conditioningCategory: intention.conditioningCategory,
        conditioningFlavour: flavourFor(intention.conditioningCategory),
        conditioningOffFeet: intention.conditioning === 'off_leg',
        hasCombinedConditioning: intention.conditioningRole === 'component',
        attachedConditioningKind: intention.conditioningRole === 'component'
          ? 'component' : undefined,
        section18ConditioningRole: intention.conditioningRole === 'component'
          ? 'core' : 'core',
        conditioningVariant: template.name,
      });
    }
    return allocation;
  });

  const coreSessions = weeklyPlan.filter((entry) => entry.tier === 'core').length;
  const optionalSessions = weeklyPlan.filter((entry) => entry.tier === 'optional').length;

  const constraints: AIConstraints = {
    phase: coachingInputs.seasonPhase,
    capacity,
    hardExposureCap: GLOBAL_RULES.hardDays.permittedMaximum,
    existingHardExposures: demand.hardDays,
    coreSessionsToProgram: demand.mainStrength,
    optionalSessionsAllowed: optionalSessions,
    recoverySessionsAllowed: demand.fullRestDays,
    // Safety loadings are the SAFETY owner's, carried through from the V1
    // contract rather than re-decided here.
    lowerBodyLoading: 'normal',
    sprintLoading: demand.sprintHighSpeed > 0 ? 'allowed' : 'do-not-add',
    // ── TWO READINESS DOSE EDGES, RESTORED ─────────────────────────────────
    //
    // These were hardcoded `'full'` and `false` when I wrote this connector, and
    // that quietly deleted two behaviours that lived in `buildAIConstraints`: a
    // low-capacity athlete's conditioning is MODERATED, and their week asks for
    // a RAMP-UP. Both went out with the legacy planner and neither was noticed,
    // because the suite that owns them died at import on the deleted symbol.
    //
    // Found by re-pointing `test:readiness-dose-sweep` at the live producer —
    // the same two edges the readiness census had to be reclassified for. They
    // are DOSE, never structure: the week's shape does not change with capacity.
    conditioningLoading: capacity === 'low' ? 'moderate' : 'full',
    injuryRestrictions: [],
    priorities: [],
    rampUp: capacity === 'low',
    maxExercisesPerSession: GLOBAL_RULES.dailyMovementCeiling,
    notes: [],
    weeklyExposureContract: legacy,
  };

  return {
    capacity,
    capacityFactors: [...input.capacityFactors],
    hardExposureCap: GLOBAL_RULES.hardDays.permittedMaximum,
    existingHardExposures: demand.hardDays,
    remainingHardBudget: Math.max(0,
      GLOBAL_RULES.hardDays.permittedMaximum - demand.hardDays),
    coreSessions,
    optionalSessions,
    recoverySessions: demand.fullRestDays,
    weeklyPlan,
    offseasonSubphase: input.offseasonSubphase,
    preseasonSubphase: input.preseasonSubphase,
    weeklyExposureContract: legacy,
    weeklyExposureContractV2: contractV2,
    constraints,
  };
}

/** Every purpose that loads the legs. Re-exported so callers do not re-derive it. */
export { PURPOSE_IS_LOWER };
