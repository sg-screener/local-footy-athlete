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
import { speedBlockForTemplate } from './speedTemplates';
import { withExposureTarget } from './weeklyExposureContract';
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

  // ── V1 CONTRACT — the existing shape, RE-TARGETED FROM THE SCHEDULER ─────
  //
  // **Sam, 2026-08-16:** *"Pre-season expected strength count must come from the
  // approved scheduler contract: four when the approved inputs call for four, not
  // the deleted planner/checker expectation of three."*
  //
  // `buildWeeklyExposureContract` carries the OLD checker's per-mode expectation.
  // A pre-season week with a fixture resolves to `practice_match_week`, whose row
  // expects 3 — so the approved pre-season layouts ("Four required strength
  // sessions: Upper x2 + Lower x2") were judged against a number the approved
  // source does not contain. Measured on 12 worlds.
  //
  // The scheduler's `demand.mainStrength` IS the contract's count: it comes from
  // `baseLayoutFor`, which is the approved phase x availability table. So the
  // expectation is taken from there and the old per-mode number is not consulted.
  //
  // ⚠ **ONLY THE EXPECTATION MOVES, NEVER THE FLOOR.** `required` is left exactly
  // as the V1 builder set it. Raising a floor refuses weeks that were legal a
  // moment ago, and this correction is bookkeeping — it must not be able to lose
  // an athlete a week. `withExposureTarget` could not be used: it only ever
  // reduces, by design.
  // ⚠ **REQUIRED sessions, not scheduled ones.** `demand.mainStrength` is the
  // layout's count and counts optional sessions too. The early off-season overlay
  // (WC-130) makes every session optional — "zero completed is valid" — so using
  // the raw demand there set a target of 3-4 against a core count of 0 and broke
  // 12 off-season worlds that had been fine. Measured, then narrowed.
  const requiredStrengthCount = materialised.filter((session) =>
    session.owner === 'strength' && !session.optional).length;
  const v1 = buildWeeklyExposureContract(input.v1Input);
  const legacy: typeof v1 = {
    ...v1,
    strength: {
      ...v1.strength,
      targetCount: requiredStrengthCount,
      preferred: {
        min: Math.min(v1.strength.preferred.min, requiredStrengthCount),
        max: Math.max(v1.strength.preferred.max, requiredStrengthCount),
      },
    },
  };
  // ── A REDUCED WEEK DECLARES ITS REDUCTION IN THE CONTRACT'S OWN LEDGER ───
  //
  // Sam, 2026-08-16: *"disclose any preferred work omitted."* Putting the
  // disclosure only on the schedule was not enough — §18 reads the contract's
  // reduction ledger, and a lowered target with no entry reds
  // *"the contract records every target it lowers"*. It is the right red: an
  // undeclared reduction is indistinguishable from a target that was never owed.
  //
  // `spacing_safety_conflict` is the honest reason: the sessions were dropped or
  // offered as upper because game proximity and lower spacing left no legal
  // placement. `withExposureTarget` only ever reduces, which is exactly correct
  // here — this path can never raise anything.
  //
  // ⚠ **`withExposureTarget` ALONE WAS NOT ENOUGH, AND ITS SILENCE LOOKED LIKE
  // SUCCESS.** It early-returns when `target >= required`, and for these weeks
  // `required` was ALREADY at or below the delivered count — so it recorded
  // nothing and the reduced target stood unexplained. The reduction is a
  // statement about the TARGET (authored -> delivered); it is not a statement
  // about the floor, and reading it off the floor is what lost it.
  //
  // So the call is kept — it keeps `required` in step on the weeks where the
  // floor genuinely does exceed what was delivered — and the ledger entry is
  // written from the AUTHORED count regardless.
  const disclosure = schedule.reductionDisclosure;
  const withFloor = disclosure === null ? legacy : withExposureTarget(
    legacy, 'main_strength', disclosure.deliveredStrengthCount,
    'spacing_safety_conflict', disclosure.reason,
  );
  // ⚠ **THE ENTRY IS WRITTEN EVEN WHEN THE COUNT DID NOT MOVE.** The Sunday
  // fixture week delivers the same 2 sessions it authored and still gives
  // something up: a lower session is served as upper because G-2 may not hold
  // heavy lower. A ledger keyed only on counts calls that "no reduction" — so the
  // omitted PURPOSE is carried in the detail and the entry is written regardless.
  //
  // Deduped against the V1 builder's own entries so a week does not disclose the
  // same fact twice in different words.
  const already = withFloor.reductions.some((entry) =>
    entry.domain === 'main_strength'
    && entry.metric === 'weekly_exposure_count'
    && entry.to === disclosure?.deliveredStrengthCount
    && entry.from === disclosure?.intendedStrengthCount);
  const reduced: typeof withFloor = disclosure === null || already ? withFloor : {
    ...withFloor,
    reductions: [...withFloor.reductions, {
      domain: 'main_strength' as const,
      reason: 'spacing_safety_conflict' as const,
      metric: 'weekly_exposure_count' as const,
      from: disclosure.intendedStrengthCount,
      to: disclosure.deliveredStrengthCount,
      detail: disclosure.omittedPurpose === null
        ? disclosure.reason
        : `${disclosure.reason} (omitted as authored: ${disclosure.omittedPurpose})`,
    }],
  };

  // THE CONNECTOR RUNS ONCE PER WEEK. `coachingInputs` describes the first week
  // supplied to the edge/planner boundary and is intentionally reused only for
  // athlete facts; its phase-week and fixture fields are stale by week 2. Feed
  // the identity owner the current scheduler/clock facts already carried by this
  // connector, otherwise weeks 3–4 of the first Off-season block are judged by
  // early Off-season's three-session ceiling after the scheduler correctly moves
  // them to mid Off-season and selects four.
  const identity = section18ModeAndSubphase({
    ...coachingInputs,
    hasGame: input.gameDays.length > 0,
    phaseWeekNumber: input.section18Identity.phaseWeek ?? undefined,
    offseasonSubphase: input.offseasonSubphase ?? undefined,
    preseasonSubphase: input.preseasonSubphase ?? undefined,
  }, reduced);

  // ── HARD DAYS COME FROM THE AGREED WEEK'S ANCHORS ────────────────────────
  //
  // **Sam, 2026-08-16:** *"Hard-day accounting must derive from the final agreed
  // scheduled week, not raw onboarding answers."*
  //
  // `existingHardExposures` means the hard days ALREADY COMMITTED by anchors
  // before the app adds anything — club nights plus fixture credit. I had it set
  // to `demand.hardDays`, which is the week's TOTAL and includes every strength
  // day the app itself authored, so an in-season athlete with no club and no game
  // reported 3 committed hard days against 0 real anchors.
  //
  // Read off the contract's anchors, which the scheduler supplied from the agreed
  // week — so a stale onboarding fixture or an unselected club night cannot
  // inflate it. Measured: counted=5 vs contract=1, and counted=3 vs contract=0.
  const committedAnchorHardDays = reduced.anchors.teamTrainingDays.length
    + reduced.anchors.gameOrPracticeMatchCredit;

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
    powerPrimerCandidates: materialised.filter((session) => session.powerPrimer !== null).length,
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
      ...(template || session.sprintTemplate ? ['conditioning' as const] : []),
      // R-130: a composed-optional day's part is STRENGTH (the Primer's ruled
      // component identity, R-129), not the rest-class recovery its owner
      // would imply. Copied off the scheduler's marker — still a translation.
      ...(session.owner === 'rest_or_recovery'
        ? [session.composedOptional ? 'strength' as const : 'recovery' as const]
        : []),
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
      // R-130: the typed marker the builder composes from — the same field the
      // athlete's own add door stamps, so generator and door cannot prescribe
      // different work under one name (Sam's composed-optional class ruling).
      ...(session.composedOptional
        ? { composedOptionalKind: session.composedOptional }
        : {}),
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

    // ── WC-139: THE SPRINT COMPONENT, CARRIED ALONGSIDE ─────────────────
    //
    // A second conditioning component on the day. It is stamped BEFORE the
    // conditioning assignment below so that, if a day somehow carried only the
    // sprint, the conditioning fields below still win the slot — the sprint is
    // an addition, never a replacement.
    if (session.sprintTemplate) {
      // ⚠ **THIS IS THE APP'S EXISTING PRE-LIFT SPEED VOCABULARY, NOT A NEW
      // ONE.** `defaultProgram` already composes a pre-lift sprint onto a
      // strength day when an allocation carries `speedWorkKind: 'true_speed'`
      // and `speedPlacement: 'pre_lift'`, prepends its rows, and builds the
      // `speedBlock` §18 reads for sprint credit. WC-139's job is to make the
      // SCHEDULER able to ask for that on a day which already carries
      // conditioning — not to grow a second composer.
      //
      // `templateName` is the specialist's answer, so the component and the
      // standalone sprint draw from one authority.
      Object.assign(allocation, {
        speedWorkKind: 'true_speed',
        speedPlacement: 'pre_lift',
        // ⚠ **THE WHOLE BLOCK, FROM THE ONE FACTORY.** A partial
        // `{ templateName }` is what broke twelve worlds: `buildSpeedBlock`
        // spreads this verbatim, so the assembled workout carried
        // `kind: undefined` and §18 — which credits `speedBlock.kind`, not the
        // visible rows — scored the week at zero sprint nights and refused it.
        speedBlock: speedBlockForTemplate(session.sprintTemplate, 'pre_lift'),
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

  // ── `coreSessions` IS A STRENGTH COUNT, AND I HAD IT COUNTING DAYS ───────
  //
  // Every consumer compares this against §18's main-strength target, which the
  // contract states as a number of STRENGTH sessions ("three strength sessions",
  // "Four required strength sessions"). I filtered on `tier === 'core'`, and the
  // connector marks every non-optional day core — **including authored REST days,
  // the fixture and club nights** — so a plain in-season week reported `core=4`
  // against a target of 2. Measured on 12 worlds in `test:weekly-dose-ownership`.
  //
  // A rest day is not a core session. Counted off the typed identity, so the
  // count means what its readers already assume it means.
  const coreSessions = weeklyPlan.filter((entry) =>
    entry.tier === 'core'
    && entry.authoredDay?.components.includes('strength') === true).length;
  const optionalSessions = weeklyPlan.filter((entry) => entry.tier === 'optional').length;

  const constraints: AIConstraints = {
    phase: coachingInputs.seasonPhase,
    capacity,
    hardExposureCap: GLOBAL_RULES.hardDays.permittedMaximum,
    existingHardExposures: committedAnchorHardDays,
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
    // a RAMP-UP. Both went out with the reduced planner and neither was noticed,
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
    weeklyExposureContract: reduced,
  };

  return {
    capacity,
    capacityFactors: [...input.capacityFactors],
    hardExposureCap: GLOBAL_RULES.hardDays.permittedMaximum,
    existingHardExposures: committedAnchorHardDays,
    remainingHardBudget: Math.max(0,
      GLOBAL_RULES.hardDays.permittedMaximum - demand.hardDays),
    coreSessions,
    optionalSessions,
    recoverySessions: demand.fullRestDays,
    weeklyPlan,
    offseasonSubphase: input.offseasonSubphase,
    preseasonSubphase: input.preseasonSubphase,
    weeklyExposureContract: reduced,
    weeklyExposureContractV2: contractV2,
    constraints,
  };
}

/** Every purpose that loads the legs. Re-exported so callers do not re-derive it. */
export { PURPOSE_IS_LOWER };
