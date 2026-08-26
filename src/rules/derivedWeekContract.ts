/**
 * THE DERIVED WEEK CONTRACT — leg (iii) of the V3 conformance unit
 * (`docs/THREE_LEG_CONFORMANCE_RULING_2026-08-06.md`), landed under the
 * four-leg convergence ruling (`docs/FOUR_LEG_CONVERGENCE_RULING_2026-08-07.md`).
 *
 * THE CONVERGENCE RULE, applied: fixture and athlete-removal state is derived
 * at read around the accepted compiler-authored family identity. A fact family
 * that has moved into the compiler is consumed from that accepted declaration;
 * it is not re-authored here to make stale output look correct.
 *
 * `deriveWeekContract` is the ONE owner of that question, and it is installed
 * at exactly the three contract-SELECTION lines the app has: the accepted
 * reader (`acceptedEffectiveWeek`), the deriver's own tier-4 host
 * (`sessionResolver`), and the publisher (`fixtureMinimalReplan`). Three
 * readers of one owner, never three answers.
 */
import type { OnboardingData, UserRemovalConstraint, Workout } from '../types/domain';
import type { CalendarDayType } from '../store/calendarStore';
import {
  buildSection18WeeklyExposureContractV2,
  type Section18AnchorState,
  type Section18AuthorisedReduction,
  type Section18WeekMode,
  type WeeklyExposureContractV2,
} from './weeklyExposureContractV2';
import { targetWeekFixtures } from './fixtureConditionedAvailability';
import { awaySpansFromFacts, dateIsInsideAwaySpan } from './awaySpans';
import { ownSeasonPhaseForGeneration } from './seasonPhaseOwner';
import { applyAthleteRemovalTypedReduction } from './userRemovalConstraints';
import type { TemporarySourceFact } from './temporarySourceFact';

/* LEG (v)'s WRITER-HALF SCAFFOLD IS DEMOLISHED, UN-LANDED (R-229 S5,
 * 2026-08-26). Its premise — retire the stored declaration's write — belonged
 * to a world where the declaration was one durable input. Boot regenerates
 * the program wholesale under live facts (quiescentBoot), so the declaration
 * is re-authored every boot regardless, and every judge now derives on read
 * (S4c installs). Landing the flag would only have blinded the cannot-derive
 * fallback. The read half stays landed and unflagged. */

/**
 * DIAGNOSTIC ONLY, and named so it cannot be mistaken for product state.
 *
 * Tier 4's output is never stored — that is the whole ruling — so the contract
 * the visible week actually answers to exists only inside the derivation. The
 * lawfulness proof has to measure THAT contract; rebuilding one beside it
 * measures a contract no surface uses, which is
 * `gate-passing-on-coordinates-it-never-builds` with extra steps.
 *
 * Written by the deriver, read only by `derivedWeekLawfulnessProof`. Nothing in
 * the product reads it, and it is cleared on every derivation so a stale entry
 * can never be mistaken for a fresh one.
 */
export const lastTierFourDerivation: {
  weekStart: string | null;
  contract: WeeklyExposureContractV2 | null;
  status: string | null;
  repairs: string[];
  blockingViolations: string[];
} = { weekStart: null, contract: null, status: null, repairs: [], blockingViolations: [] };

/* ────────────────────────────────────────────────────────────────────────────
 * LEG (iii) — the week's contract DERIVED from current fixture facts
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * THE TRIPS LIVE OVER THIS WEEK — SEAT_INBOX item 30, Sam 2026-08-13.
 *
 * MOVED TO `rules/awaySpans.ts` ON 2026-08-13 (item 61, sighting 3, seat
 * `vocab`). It stood here as a local reader of `factKind`/`effectiveFrom`/
 * `effectiveUntil` while generation kept its OWN reader of
 * `type`/`startDate`/`expiresAt` over an `any[]` — one trip, two word-lists,
 * sharing not one field name. **Both halves now call one owner**, and a
 * round-trip cell pins them to each other through the real projection.
 */
function fixtureIdentityForWeek(args: {
  profile: OnboardingData;
  weekStart: string;
  markedDays?: Readonly<Record<string, CalendarDayType>>;
  storedMode: Section18WeekMode;
  temporarySourceFacts?: readonly TemporarySourceFact[];
}): { anchorState: Section18AnchorState; fixtureDays: number[]; mode: Section18WeekMode } {
  const ownedPhase = ownSeasonPhaseForGeneration(args.profile);
  const allFixtures = targetWeekFixtures({
    profile: args.profile,
    weekStart: args.weekStart,
    markedDays: args.markedDays,
    ownedPhase,
  });
  // ── A GAME HE IS AWAY FOR DOES NOT ANCHOR HIS WEEK ──
  //
  // **Sam, 2026-08-13:** *"If you're away, you're not playing, so a taper and a
  // recovery day would be training for a match you're not at … the game on the
  // 15th should be removed or at least blanked out, but the next saturday the
  // 22nd game is still alive"*, and the shape he named for the trip itself:
  // *"almost look like a bye week build or an off season block"*.
  //
  // ONE FILTER GIVES ALL OF THAT, because this is the seam where a week decides
  // what it IS. Drop the fixtures inside the trip and the week falls through to
  // the no-fixture branch below — `anchorState: 'bye'`, mode
  // `in_season_bye_build`, which is the bye-week build in his own words. A
  // fixture OUTSIDE the span is untouched, so the Saturday after he lands still
  // anchors and still tapers back across the days he is travelling: *"there
  // training on wednesday thursday friday the following week needs to not kill
  // them for that return"*.
  //
  // IT FILTERS THE READ, NOT THE STORE. His calendar mark is his record and is
  // not edited here.
  const awaySpans = awaySpansFromFacts(args.temporarySourceFacts);
  const fixtures = awaySpans.length === 0
    ? allFixtures
    : allFixtures.filter((candidate) => !dateIsInsideAwaySpan(candidate.date, awaySpans));
  // The accepted declaration is compiler output. Illness used to be re-read
  // below to repair this mode at view time, which could make a stale compiler
  // answer look correct. Fact transactions now recompile on create/clear, so
  // this derivation consumes the accepted family instead of authoring another.
  const storedFamilyMode: Section18WeekMode = args.storedMode;
  const fixture = fixtures[0] ?? null;
  if (!fixture) {
    // No fixture: an in-season week becomes a bye, a pre-season week keeps its
    // phase mode. The stored mode's own phase family decides which.
    const inSeason = storedFamilyMode.startsWith('in_season') ||
      storedFamilyMode === 'practice_match_week';
    const mode: Section18WeekMode = storedFamilyMode === 'in_season_game_week' ||
      storedFamilyMode === 'practice_match_week'
      ? 'in_season_bye_build'
      : storedFamilyMode;
    // A pre-season week with no fixture has anchor state `none`, not `bye`:
    // `bye` is an IN-SEASON fact (the round exists and this team is not in it).
    return { anchorState: inSeason ? 'bye' : 'none', fixtureDays: [], mode };
  }
  // EVERY FIXTURE, NOT `fixtures[0]`. `targetWeekFixtures` already returns the
  // whole week's list sorted by date; this line used to keep the first and drop
  // the rest, so a split round (a Wednesday game AND the usual Saturday) reached
  // the contract as a one-game week. The dropped fixture got no anchor, and
  // therefore no G-1/G-2 protection, no credit and no place in the week's
  // identity. `HOW_TO_BUILD_THIS_APP` §5.4 named this line as THE waist.
  //
  // The KIND still comes from the first fixture: a practice-match week is a
  // mode, and a week mixing a practice match with a game has no declared mode
  // to be. Sam's call if it ever becomes reachable; today the kind is uniform
  // because `canonicalFixtureKind` derives it from the owned phase.
  const fixtureDays = fixtures.map((entry) =>
    new Date(`${entry.date}T12:00:00`).getDay());
  if (fixture.kind === 'practice_match') {
    return { anchorState: 'practice_match', fixtureDays, mode: 'practice_match_week' };
  }
  const mode: Section18WeekMode = storedFamilyMode.startsWith('in_season')
    ? 'in_season_game_week'
    : storedFamilyMode;
  return { anchorState: 'game', fixtureDays, mode };
}

/**
 * THE WEEK'S IDENTITY, DERIVED FROM EVERY FACT THAT OWNS A PIECE OF IT.
 *
 * The fixtures own anchor state and fixture day around the compiler-authored
 * family mode. Illness is already part of that accepted declaration; re-reading
 * its raw facts here would make this function a second identity writer.
 */
function weekIdentityForWeek(args: {
  profile: OnboardingData;
  weekStart: string;
  markedDays?: Readonly<Record<string, CalendarDayType>>;
  storedMode: Section18WeekMode;
  temporarySourceFacts?: readonly TemporarySourceFact[];
}): { anchorState: Section18AnchorState; fixtureDays: number[]; mode: Section18WeekMode } {
  return fixtureIdentityForWeek(args);
}

/**
 * THE REMOVAL LEDGER, APPLIED TO A DERIVED CONTRACT.
 *
 * `applyAthleteRemovalTypedReduction` is the app's ONE owner of what a
 * removal does to a contract; this reads it rather than restating it. What
 * changes under the pattern-identity ruling is only WHERE the reduction comes
 * from: the persisted constraint (a decision) instead of the stored contract's
 * record of one (an output). A constraint whose reduction is already present
 * is skipped, so applying twice is identity.
 */
function withRemovalLedger(
  contract: WeeklyExposureContractV2,
  args: {
    weekStart: string;
    userRemovalConstraints?: readonly UserRemovalConstraint[];
    workouts?: readonly Workout[];
  },
): WeeklyExposureContractV2 {
  const weekStart = args.weekStart.slice(0, 10);
  const weekEnd = (() => {
    const date = new Date(`${weekStart}T12:00:00`);
    date.setDate(date.getDate() + 6);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  })();
  const speaking = (args.userRemovalConstraints ?? []).filter((constraint) =>
    constraint.status === 'active' &&
    constraint.targetDate >= weekStart && constraint.targetDate <= weekEnd);
  if (speaking.length === 0 || !args.workouts) return contract;
  let result = contract;
  for (const constraint of speaking) {
    const alreadyTyped = (result.authorisedReductions ?? []).some((reduction) =>
      reduction.deletionIdentity === constraint.id);
    if (alreadyTyped) continue;
    result = applyAthleteRemovalTypedReduction({
      contract: result,
      workouts: args.workouts,
      weekStart,
      constraint,
    });
  }
  return result;
}

/**
 * The covering week's stored contract is the IDENTITY OWNER; the fixture facts
 * decide mode, anchor state and fixture day. Everything else is recovered from
 * the contract itself. Returns the stored object when the facts already agree,
 * so an unchanged world is byte-identical.
 */
export function deriveWeekContract(args: {
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
  markedDays?: Readonly<Record<string, CalendarDayType>>;
  /**
   * THE ATHLETE'S REMOVAL LEDGER — the persisted DECISION, not the stored
   * contract's copy of its arithmetic. Under the pattern-identity ruling the
   * stored contract retires as an input, so a removal's typed reduction has to
   * come from the decision that authorised it or it is lost entirely.
   */
  userRemovalConstraints?: readonly UserRemovalConstraint[];
  /** The composed week the reduction is measured against. */
  workouts?: readonly Workout[];
  /**
   * THE ATHLETE'S SOURCE FACTS — leg (v)'s read side (see
   * `weekIdentityForWeek`). Absent means a caller with no facts to offer, which
   * is a world with no illness, not a world whose illness is unknown.
   */
  temporarySourceFacts?: readonly TemporarySourceFact[];
}): WeeklyExposureContractV2 {
  // No profile, no facts to derive FROM — the stored identity stands.
  if (!args.profile) return args.contract;
  const stored = args.contract;
  const derived = weekIdentityForWeek({
    profile: args.profile,
    weekStart: args.weekStart.slice(0, 10),
    markedDays: args.markedDays,
    storedMode: stored.identity.mode,
    temporarySourceFacts: args.temporarySourceFacts,
  });
  const storedFixture = stored.anchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  // THE WHOLE SET, SORTED — a week that gained or lost its SECOND fixture is a
  // week whose identity moved, and comparing one day could not see that.
  const sameDays = (left: readonly number[], right: readonly number[]): boolean =>
    left.length === right.length
    && [...left].sort().every((day, index) => day === [...right].sort()[index]);
  const storedFixtureDays = stored.anchors
    .filter((anchor) => anchor.kind === 'game' || anchor.kind === 'practice_match')
    .map((anchor) => anchor.dayOfWeek);
  if (
    derived.mode === stored.identity.mode &&
    derived.anchorState === stored.identity.anchorState &&
    sameDays(derived.fixtureDays, storedFixtureDays)
  ) {
    return withRemovalLedger(stored, args);
  }

  const optionalSelection = stored.mainStrength.exposure.plannerSelectionKind === 'optional';
  const teamTrainingDays = stored.anchors
    .filter((anchor) => anchor.kind === 'team_training')
    .map((anchor) => anchor.dayOfWeek);
  const teamParticipation: Record<number, typeof stored.anchors[number]['participation']> = {};
  for (const anchor of stored.anchors) {
    if (anchor.kind === 'team_training') teamParticipation[anchor.dayOfWeek] = anchor.participation;
  }
  // PRICING DEFECT 3, found and fixed on the scaffold: `declaredSubphase`
  // is part of the SAME fixture-authored identity as `mode`. Deriving one and
  // carrying the other stale makes the contract disagree with itself, and the
  // evaluator rightly raises `phase_subphase_policy_mismatch` on every derived
  // week whose facts moved. The declaration follows the builder's own expected
  // subphase.
  const buildWith = (declaredSubphase: typeof stored.identity.declaredSubphase) =>
    buildSection18WeeklyExposureContractV2({
    seasonPhase: stored.identity.seasonPhase,
    declaredSubphase,
    mode: derived.mode,
    blockNumber: stored.identity.blockNumber,
    weekInBlock: stored.identity.weekInBlock,
    globalWeek: stored.identity.globalWeek,
    phaseWeek: stored.identity.phaseWeek,
    phaseEntryWeekStartISO: stored.identity.phaseEntryWeekStartISO,
    phaseClockSelectedPhase: stored.identity.phaseClockSelectedPhase,
    phaseWeekProvenance: stored.identity.phaseWeekProvenance,
    weekKind: stored.identity.weekKind,
    anchorState: derived.anchorState,
    teamTrainingDays,
    fixtureDays: derived.fixtureDays,
    // PRICING DEFECT 1, found and fixed on the scaffold: participation and the production claim
    // are FACTS ABOUT THE ANCHOR and travel. Rebuilding them from a boolean
    // resurrects claims the safety finaliser already demoted.
    fixtureParticipation: storedFixture?.participation,
    teamParticipation,
    participationProvenance: stored.anchors[0]?.participationProvenance,
    capacity: stored.safety.reasons.includes('low_readiness') ? 'low' : 'medium',
    cookedReadiness: stored.safety.strengthIntensityCeiling === 'Moderate' &&
      stored.identity.mode !== 'in_season_bye_recovery',
    // The builder folds the week's SELECTION KIND into where each count lands,
    // so recovery has to undo the same fold: on an optional week the core
    // selections are zeroed and the real numbers live in the optional fields.
    plannerSelected: optionalSelection
      ? {
        mainStrength: stored.mainStrength.optionalMainStrengthSelected,
        coreConditioning: stored.conditioning.optionalFlush.plannerSelectedCount,
        optionalRecoveryAerobic: stored.conditioning.optionalRecoveryAerobic.plannerSelectedCount,
        sprintHighSpeed: stored.sprintHighSpeed.exposure.plannerSelectedTarget,
        powerPrimers: stored.power.plannerSelectedWeeklyBudget,
      }
      : {
        mainStrength: stored.mainStrength.exposure.plannerSelectedTarget,
        optionalMainStrength: stored.mainStrength.optionalMainStrengthSelected,
        coreConditioning: stored.conditioning.core.plannerSelectedTarget,
        optionalFlush: stored.conditioning.optionalFlush.plannerSelectedCount,
        optionalRecoveryAerobic: stored.conditioning.optionalRecoveryAerobic.plannerSelectedCount,
        sprintHighSpeed: stored.sprintHighSpeed.exposure.plannerSelectedTarget,
        powerPrimers: stored.power.plannerSelectedWeeklyBudget,
      },
    prohibitedPatterns: stored.strengthPatterns.prohibitedPatterns,
    prohibitedPatternProvenance: stored.strengthPatterns.prohibitedPatternProvenance,
    intentionalImbalanceReason: stored.strengthPatterns.intentionalImbalanceReason,
    reductions: [...(stored.authorisedReductions ?? [])],
    prohibitedSprintHighSpeed: stored.safety.prohibitedSprintHighSpeed,
    prohibitedPower: stored.safety.prohibitedPower,
    prohibitedPowerFamilies: stored.safety.prohibitedPowerFamilies,
    affectedSafetyDomains: stored.safety.affectedDomains,
    trainingPaused: stored.safety.trainingPaused,
    equipment: stored.equipment,
    source: stored.source,
  });
  // PRICING DEFECT 3, CORRECTED. The first cut carried the STORED contract's
  // `expectedSubphase` into the derived one — but the expectation is a
  // function of the DERIVED anchor state (a pre-season week with a practice
  // match expects `practice_match_week`), so carrying the stored answer made
  // the derived contract disagree with itself and every derived week red on
  // `phase_subphase_policy_mismatch`. Two passes: build once to learn the
  // derived expectation, then declare it. The builder owns the rule; this only
  // asks it.
  const rebuilt = buildWith(buildWith(stored.identity.declaredSubphase)
    .identity.expectedSubphase ?? stored.identity.declaredSubphase);
  // PRICING DEFECT 1, the other half. `anchorsFor` builds all three production
  // claims from ONE boolean and the safety finaliser then DEMOTES the ones
  // participation cannot justify. Rebuilding from that boolean resurrects
  // settled claims and the finaliser THROWS on `unjustified_anchor_credit`.
  // Only the anchor SET is derived; the claims are facts and travel.
  rebuilt.anchors = rebuilt.anchors.map((anchor) => {
    const priorAnchor = stored.anchors.find((candidate) =>
      candidate.kind === anchor.kind && candidate.dayOfWeek === anchor.dayOfWeek);
    return priorAnchor
      ? {
        ...anchor,
        participation: priorAnchor.participation,
        participationProvenance: priorAnchor.participationProvenance,
        currentProductionClaim: { ...priorAnchor.currentProductionClaim },
      }
      : anchor;
  });
  return withRemovalLedger(rebuilt, args);
}


/**
 * THE WEEK'S IDENTITY, EXPOSED FOR ONE SUITE — SEAT_INBOX item 30.
 *
 * `test:away-flow` walks Sam's worked example (leave Thu 13 Aug, home Fri 21st)
 * against this seam directly, because the property he ruled is about what a week
 * IS — bye or game — and that is decided here, not in a rendered card.
 */
export const weekIdentityForWeekForTest = weekIdentityForWeek;
