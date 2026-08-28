import { buildScheduleStateImperative } from '../../utils/coachWeekDiff';
import { getEffectiveGameDates } from '../../utils/sessionResolver';
import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polygon } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { RowIcon, SESSION_SECTION_ICON_KIND } from '../../components/icons/SectionIcon';
import { SessionStopwatchControl } from '../../components/SessionStopwatchControl';
import { Text } from '../../components/common/Text';
import { LfaWordmark } from '../../components/branding/LfaWordmark';
import { Card, Button, IconButton, Sheet, SheetHeader } from '../../components/ui';
import {
  SessionActionSheet,
  useSessionActionStep,
} from '../../components/SessionActionSheet';
import { LfaIcon } from '../../components/icons/LfaIcon';
import { ACTION_TINT, glyph as sessionChangeGlyph } from '../../components/SessionChangeHub';
import { UndoToast } from '../../components/UndoToast';
import { useNavigation } from '@react-navigation/native';
import { signedCopy } from '../../rules/signedCopy';
import { SECTION_LABELS } from '../../utils/sessionExecutionChecklist';
import { GuidedInjuryFlowSheet } from './GuidedInjuryFlowSheet';
import { SessionEquipmentSheet } from './SessionEquipmentSheet';
import ExerciseVideoModal from '../../components/ExerciseVideoModal';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import { KeyboardSafeArea } from '../../components/keyboard/KeyboardSafeArea';
import { getCoachNoteDisplay } from '../../utils/coachNoteSummary';
import { SessionFeedbackPanel } from '../../components/SessionFeedbackPanel';
import { SessionCompleteMoment } from '../../components/SessionCompleteMoment';
import { getSmokeRuntimeSignal } from '../../utils/smokeBootstrap';
import { todayISOLocal } from '../../utils/appDate';
import type { ComposedGap } from '../../rules/composeWeek';
import {
  EXERCISE_EXCLUSION_QUESTION,
  EXERCISE_EXCLUSION_SCOPES,
  EXERCISE_EXCLUSION_SCOPE_DETAIL,
  EXERCISE_EXCLUSION_SCOPE_LABEL,
  excludedExerciseNamesOn,
  exclusionExpiryLabel,
  type ExerciseExclusionScope,
} from '../../rules/exerciseExclusions';
import { applyExerciseExclusionDecision } from '../../utils/exerciseExclusionOwner';
import {
  ADD_GROUPS,
  ADD_LEAF_LABELS,
  legalAddCandidates,
  legalAddFamilies,
  type AddFamilyId,
  type AddGroupId,
  type AddLeafId,
} from '../../utils/addExerciseCandidates';
import {
  executeProgramControlAction,
  executeProgramControlActionDurably,
} from '../../utils/programControlActions';
import {
  observeRenderedAthleteActionOutcome,
  registerAthleteActionUIOutcome,
} from '../../dev/e2e/athleteActionUIObservation';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';
import { classifyBibleInjurySeverity } from '../../rules/injurySeverityBands';
import {
  buildGuidedInjuryConstraint,
  type GuidedInjuryFlowResult,
} from '../../utils/guidedInjuryControl';
import {
  buildSessionInjuryReview,
  type SessionInjuryReview,
} from '../../utils/sessionInjuryReview';
import type { ActiveInjuryConstraint } from '../../store/coachUpdatesStore';
import {
  injurySubstitutionBadge,
  type InjurySubstitutionSourceRef,
} from '../../rules/injurySubstitutionSource';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useProfileStore } from '../../store/profileStore';
import { useReadinessStore } from '../../store/readinessStore';
import { useDecisionLedgerStore } from '../../store/decisionLedgerStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import {
  getTapSwapChoices,
  groupTapSwapChoices,
  resolveTapSwapEnvironment,
  type TapSwapChoice,
  type TapSwapHierarchyTier,
  type TapSwapPrimaryInjury,
  type TapSwapReason,
} from '../../utils/tapSwapHierarchy';
import { resolveEquipmentCapabilities } from '../../utils/equipmentAvailability';
import {
  resolveSelectedImplement,
  selectedImplementLabel,
  type SelectedImplement,
} from '../../rules/selectedImplement';
import type { EquipmentTag } from '../../data/exercisePools';
import type { LoadControlMode } from '../../utils/loadEstimation';
import type { DerivedExerciseSource } from '../../types/programControlAction';
import {
  nextQuickSwapChoice,
  rankedQuickSwapChoices,
} from '../../utils/quickExerciseActions';
import {
  applyMobilityFlowExerciseDecisions,
  applyRecoveryAddonExerciseDecisions,
} from '../../utils/derivedExerciseDecisions';

/**
 * The typed implement for a row PLUS whether today's kit changed it. Sam's UI
 * correction: the implement is always typed, and only ever SHOWN when it is
 * today's answer rather than the athlete's usual one.
 */
type SelectedImplementToday = SelectedImplement & {
  changedToday: boolean;
  normalImplement: EquipmentTag | null;
};
import { canonicalExerciseName } from '../../utils/exerciseCanonicalisation';
import {
  deriveSessionEquipmentRequirements,
  missingSessionEquipmentValues,
  type SessionEquipmentRequirementKey,
} from '../../utils/sessionEquipment';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import {
  sessionExecutionCheckbox,
  sessionExecutionCheckboxChecked,
  sessionExecutionCheckmark,
} from '../../theme/sessionExecutionCheckbox';
import { useDayWorkout } from './useDayWorkout';
import {
  mobilityFlowMovementDose,
  selectMobilityPrehabFlow,
  type MobilityPrehabFlow,
} from '../../utils/mobilityPrehabFlow';
import { useAthleteContext, useResolvedWeekForDate } from '../../hooks/useSchedule';
import {
  buildDayWorkoutSmokeContractErrorResult,
  deriveDayWorkoutSmokeContract,
  type DayWorkoutSmokeContractResult,
} from './dayWorkoutSmokeContract';
import {
  buildCueText,
  cueForImplement,
  cleanNotes,
  formatRest,
  formatLowLoadSetsReps,
  formatStrengthSetsReps,
  formatConditioningRowPrescription,
} from './dayWorkoutHelpers';
import { isTeamTrainingItem } from '../../utils/teamTraining';
import { personalPaceLine } from '../../rules/masPace';
import {
  buildSessionTemplate,
  sessionListLabels,
  type SessionTemplateItem,
} from '../../utils/sessionTemplate';
import { stableTestIdToken } from '../../utils/stableTestId';
import { explorerTestId } from '../../utils/stableTestId';
import { ExplorerRenderWitness } from '../../components/ExplorerRenderWitness';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import {
  buildSessionExecutionPlan,
  buildSessionExecutionSummary,
  performedMobilityMovementIds,
  recordedCompletedSessionExecutionItemIds,
  type SessionExecutionPlan,
  type SessionExecutionSection as SessionExecutionSectionModel,
  type SessionExecutionSectionId,
} from '../../utils/sessionExecutionChecklist';
import {
  buildSwapSuggestionPayload,
  type SwapSuggestionPayload,
} from '../../utils/swapSuggestionPayload';

type EditableExercise = {
  key: string;
  name: string;
  targetId?: string;
  raw?: any;
  derivedSource?: DerivedExerciseSource;
};

// THE SWAP PAYLOAD'S SHAPE AND ITS RULE BOTH LIVE IN `utils/swapSuggestionPayload`
// — a rule about which LOAD an athlete sees cannot be asserted by anything that
// has to mount React Native first. See that file's header for the defect.
type SuggestedExercise = SwapSuggestionPayload;

type SuggestedSwap =
  | {
      kind: 'exercise';
      suggestion: SuggestedExercise;
      hierarchyTier: TapSwapHierarchyTier;
      reason: string;
    }
  | {
      kind: 'rest';
      hierarchyTier: 'rest';
      reason: string;
    };

/**
 * TASK 8: the two-step "which exercise, then what" menu died with ruling 12
 * — swap and remove are now single-tap row buttons that already know their
 * exercise, so `pick_exercise` only exists for the injury entry that starts
 * from the TOP of the page with no row context yet. Equipment now has a
 * whole-session checklist instead of choosing one exercise. `'swap' | 'remove'`
 * are gone rather than kept as dead
 * union members nothing sets. RETIREMENT PASS: `concern_reason`,
 * `injury_area` and `injury_severity` — the steps `'concern'`/an earlier
 * design would have routed through — are deleted outright rather than kept
 * as dead-but-present.
 */
/**
 * WHICH EXERCISE, AND FOR WHAT.
 *
 * Sam, 2026-08-19: the hub is *"Equipment · Injury · Add · Remove · Swap"*, and
 * three of those five need a row before they can act. They all ask the same
 * question, so they all use the same step rather than three pickers that could
 * drift apart.
 */
/**
 * ⚠ **`'injury'` LEFT THIS UNION ON 2026-08-20, AND THAT IS THE WHOLE POINT.**
 *
 * Sam: *"Ask for the injured body area or movement ONCE. Find EVERY affected
 * exercise in the session."* An injury is a fact about the ATHLETE, not about
 * one row — asking "which exercise?" first made the athlete do the app's job of
 * finding the affected work, and then only ever fixed the one row they happened
 * to name. Injury now opens the guided flow straight from the hub and reviews
 * the whole session. Swap and Remove still need a row, because they genuinely
 * are about one.
 */
type ExercisePickAction = 'swap' | 'remove';
/**
 * ⚠ **FOUR OF THESE SIX WERE DELETED WITH THE REASON SCREEN (2026-08-19).**
 *
 * Sam: *"Delete the entire 'Why do you want to swap it?' step. Swap means only:
 * I want a different exercise. … Equipment and Injury already have separate
 * actions, so do not ask about either inside Swap. Too hard/easy also does not
 * belong here."*
 *
 * `'Preference'` is what every athlete-initiated swap now is. `'Injury / pain'`
 * survives because the INJURY action still routes through the same suggestion
 * owner and needs the injury ladder — it is set by that flow, never chosen.
 */
type SwapReason = 'Preference' | 'Injury / pain';
type AddExerciseKind =
  | 'Upper body'
  | 'Lower body'
  | 'Midline'
  | 'Prehab'
  | 'Mobility'
  | 'Conditioning finisher'
  | 'Other';
type InjuryArea =
  | 'Shoulder'
  | 'Elbow'
  | 'Wrist'
  | 'Lower back'
  | 'Hip'
  | 'Groin'
  | 'Knee'
  | 'Hamstring'
  | 'Ankle'
  | 'Other';
type InjurySeverity = 'Mild' | 'Moderate' | 'Severe';

/**
 * REMOVAL LEFT `future_scope` ON 2026-08-16 — SAM'S APPROVED BLOCK TWO CONTRACT.
 *
 * The removal arm used to land here and ask *"Apply this change to future
 * weeks?"* with two answers, "Today only" and "Future weeks too". The contract
 * asks a different question with three answers — *"How long should we leave this
 * exercise out?"* / Today only / This block / Until I change it — so removal now
 * lands on `exclusion_scope` below and this union covers swap and add alone.
 *
 * The two-answer question could not express "this block" at all, and its
 * "Future weeks too" answer wrote a preference constraint that GENERATION NEVER
 * READ (`composeWeek` is fed from `prefs.excluded`, and that branch wrote to
 * `coachUpdatesStore` instead) — so an athlete who chose it saw the exercise
 * come straight back the following week.
 */
type FutureScopeStep =
  | {
      kind: 'future_scope';
      action: 'swap';
      exercise: EditableExercise;
      suggestion: SuggestedExercise;
      reason: SwapReason | 'Injury / pain';
      injuryArea?: InjuryArea;
      injurySeverity?: InjurySeverity;
    }
  | {
      kind: 'future_scope';
      action: 'add';
      addKind: AddExerciseKind;
      suggestion: SuggestedExercise;
    };

type ExerciseEditStep =
  | { kind: 'closed' }
  | { kind: 'pick_exercise'; action: ExercisePickAction }
  /**
   * ONE REVIEW OF EVERY CHANGE THE INJURY PROPOSES, BEFORE ANY OF THEM LAND.
   *
   * Sam, 2026-08-20: *"Show one review of all proposed changes. Apply the
   * approved changes together."*
   *
   * ⚠ **THE `constraint` IS CARRIED, NOT REBUILT.** The review was computed from
   * this exact constraint; approving hands the SAME object to
   * `set_injury_modifier`, which rebuilds the plan from the same owner
   * (`resolveInjuryRecompositionInputs`). Rebuilding the constraint at approve
   * time would re-stamp `lastUpdatedAt` and re-ask the world, which is how a
   * preview stops matching what it previewed.
   */
  | {
      kind: 'injury_review';
      review: SessionInjuryReview;
      constraint: ActiveInjuryConstraint;
    }
  | { kind: 'confirm_remove'; exercise: EditableExercise }
  | { kind: 'decide_removal'; exercise: EditableExercise }
  | {
      kind: 'choose_removal_replacement';
      exercise: EditableExercise;
      groups: readonly {
        id: string;
        label: string;
        options: readonly { name: string; suggestion: SuggestedSwap }[];
      }[];
    }
  /**
   * SAM'S SCOPE QUESTION, ASKED AFTER THE EXERCISE IS ALREADY OUT OF TODAY.
   *
   * The order matters and it is the order the contract implies: the athlete
   * tapped Remove, so it comes out of today's session first, and only then are
   * they asked how long to leave it out. Asking first would leave a live
   * question standing between them and a session they have already decided
   * about.
   */
  | { kind: 'exclusion_scope'; exercise: EditableExercise }
  /**
   * SAM'S SWAP MENU — up to six legal options in three labelled groups.
   *
   * Sam, 2026-08-19: *"Up to six legal choices: two Closest matches; two
   * Similar options; two Other useful options. Label the groups. Show fewer
   * when good legal options do not exist."*
   *
   * It sits BEFORE `confirm_swap` and does not replace it: the athlete picks
   * from the menu and still sees what they are about to get, with its own
   * prescription, before anything is written. The screen used to take
   * `getTapSwapChoices(...)[0]` and show that one option as a fait accompli.
   */
  | {
      kind: 'choose_swap';
      exercise: EditableExercise;
      reason: SwapReason;
      groups: readonly {
        id: string;
        label: string;
        options: readonly { name: string; suggestion: SuggestedSwap }[];
      }[];
    }
  | {
      kind: 'confirm_swap';
      exercise: EditableExercise;
      suggestion: SuggestedSwap;
      reason: SwapReason | 'Injury / pain';
      injuryArea?: InjuryArea;
      injurySeverity?: InjurySeverity;
      /**
       * THE MENU THIS CHOICE CAME FROM, so Back returns to it rather than
       * closing the sheet. Absent when the swap was reached from the injury
       * flow, which has its own shallower step and no menu of its own.
       */
      fromMenu?: Extract<ExerciseEditStep, { kind: 'choose_swap' }>;
    }
  /**
   * **THE ADD MENU — SAM'S THREE LEVELS, 2026-08-20.**
   *
   * *"1. Strength / Conditioning / Mobility-Warm-up. 2. A relevant subcategory,
   * such as upper/lower/movement pattern. 3. Legal final exercise choices.
   * Never show athletes a mixed internal list containing options like
   * 'Breathing reset'."*
   *
   * ⚠ **`add_group` — ONE FLAT LEVEL — IS DELETED.** It opened on every group
   * the VOCABULARY has, which is the generation prompt's own filing: 23 buttons
   * on a full-kit athlete, reading `Upper push horizontal`, `Groin / adductors`,
   * `Tissue quality`, `Breathing reset`, in a sheet that does not scroll. The
   * names behind it were already legal and already the athlete's; it was the
   * MENU that was internal.
   *
   * `add_family` -> `add_group` -> (`add_leaf`) -> `add_pick` replace it.
   * Every level except the exercises comes from `legalAddFamilies` and the
   * exercises from `legalAddCandidates`, both reading one legality pass so a
   * count can never disagree with the list behind it. A family, group or leaf
   * with nothing legal left is ABSENT, so the hierarchy can never dead-end on
   * an empty screen.
   */
  | {
      kind: 'add_family';
      families: readonly { id: AddFamilyId; label: string; count: number }[];
    }
  | {
      kind: 'add_group';
      family: AddFamilyId;
      familyLabel: string;
      groups: readonly { id: AddGroupId; label: string; count: number }[];
      /** The family list this came from, so Back climbs rather than closing. */
      fromFamily?: Extract<ExerciseEditStep, { kind: 'add_family' }>;
    }
  /**
   * ⚠ **SAM'S EXTRA STEP, AND IT EXISTS ONLY WHERE HE ASKED FOR IT.**
   *
   * *"This adds one extra step only where needed."* Lower body and Upper body
   * reach this; Power & Jumps, Midline & Carries and every Conditioning and
   * Mobility heading go straight to their exercises. The screen does not decide
   * that — `ADD_GROUPS[group].leaves` does, and a group whose legal leaves
   * collapse to one for THIS athlete today loses the step with them.
   */
  | {
      kind: 'add_leaf';
      family: AddFamilyId;
      group: AddGroupId;
      groupLabel: string;
      leaves: readonly { id: AddLeafId; label: string; count: number }[];
      /** The group list this came from, so Back climbs one level. */
      fromGroup?: Extract<ExerciseEditStep, { kind: 'add_group' }>;
    }
  | {
      kind: 'add_pick';
      family: AddFamilyId;
      leaf: AddLeafId;
      label: string;
      options: readonly { name: string; suggestion: SuggestedExercise }[];
      /**
       * THE LIST THIS CAME FROM — a leaf step under Lower/Upper body, or the
       * GROUP step directly when that group asked no extra question. Back has
       * to climb to whichever it actually was, or it would skip a level on one
       * branch and invent one on the other.
       */
      fromList?: Extract<ExerciseEditStep, { kind: 'add_leaf' } | { kind: 'add_group' }>;
    }
  | {
      kind: 'confirm_add';
      addKind: AddExerciseKind;
      suggestion: SuggestedExercise;
      /** The list this came from, so Back returns to it. */
      fromPick?: Extract<ExerciseEditStep, { kind: 'add_pick' }>;
    }
  | FutureScopeStep
  | { kind: 'coach_fallback'; title: string; message: string; prefill: string }
  | { kind: 'result'; ok: boolean; title: string; message: string };

/**
 * SAM'S THREE ANSWERS → THE EXPLORER'S THREE SCOPE IDS.
 *
 * A `Record` over the closed scope union, so a fourth scope cannot be added
 * without deciding what the accessibility walk should call it. `'today'` and
 * `'future'` keep the spellings the walk already knows.
 */
const EXCLUSION_SCOPE_TEST_ID: Record<ExerciseExclusionScope, 'today' | 'block' | 'future'> = {
  today_only: 'today',
  this_block: 'block',
  until_changed: 'future',
};

/* `SWAP_REASONS` DELETED with the `swap_reason` step it fed (2026-08-19). */

/* `ADD_EXERCISE_KINDS` DELETED with the `add_kind` step it fed (2026-08-19).
 * `AddExerciseKind` itself survives: `confirm_add` still carries one, and the
 * future-scope step reads it. */

function getExerciseName(exercise: any, fallback = 'Exercise'): string {
  return String(exercise?.exercise?.name || exercise?.name || fallback).trim();
}

function displayExerciseName(name: string | null | undefined, fallback = 'Exercise'): string {
  return formatExerciseDisplayName(name) || fallback;
}

function editableExerciseForRow(
  row: any,
  derivedSource?: DerivedExerciseSource,
): EditableExercise | null {
  const targetId = String(
    derivedSource?.id ?? row?.id ?? row?.exerciseId ?? row?.exercise?.id ?? '',
  ).trim();
  const name = getExerciseName(row);
  if (!targetId || !name) return null;
  return { key: targetId, name, targetId, raw: row, derivedSource };
}

function buildEditableExercises(workout: any, isTeamOnly: boolean): EditableExercise[] {
  if (!workout || isTeamOnly) return [];
  const stored = (workout.exercises ?? [])
    .filter((exercise: any) => !isTeamTrainingItem(exercise))
    .map((exercise: any) => {
      const targetId = exercise.id || exercise.exerciseId || exercise.exercise?.id;
      if (!targetId) return null;
      return editableExerciseForRow(exercise);
    })
    .filter((exercise: EditableExercise | null): exercise is EditableExercise =>
      exercise !== null && !!exercise.name);
  const addons = (workout.recoveryAddons ?? []).flatMap((addon: any) =>
    (addon?.exercises ?? []).map((exercise: any) => {
      const targetId = String(exercise?.id ?? '').trim();
      if (!targetId) return null;
      return editableExerciseForRow(exercise, {
        kind: 'recovery_addon' as const,
        id: targetId,
      });
    })).filter((exercise: EditableExercise | null): exercise is EditableExercise => !!exercise);
  return [...stored, ...addons];
}

function buildMobilityEditableExercises(flow: MobilityPrehabFlow | null): EditableExercise[] {
  return (flow?.movements ?? []).map(({ exercise }) => {
    const targetId = `mobility:${exercise.id}`;
    return {
      key: targetId,
      name: exercise.name,
      targetId,
      raw: {
        id: targetId,
        exerciseId: targetId,
        prescribedSets: exercise.sets,
        prescribedRepsMin: exercise.repsMin,
        prescribedRepsMax: exercise.repsMax,
        prescriptionType: exercise.prescriptionType,
        perSide: exercise.perSide,
        restSeconds: exercise.restSeconds,
        exercise: { id: exercise.id, name: exercise.name },
      },
      derivedSource: { kind: 'mobility_flow' as const, id: targetId },
    };
  });
}

function tapSwapReason(reason: SwapReason): TapSwapReason {
  return reason === 'Injury / pain' ? 'injury_or_pain' : 'preference';
}

function suggestedSwapFromChoice(
  exercise: EditableExercise,
  choice: TapSwapChoice,
): SuggestedSwap {
  if (choice.kind === 'rest' || !choice.name) {
    return {
      kind: 'rest',
      hierarchyTier: 'rest',
      reason: choice.reason,
    };
  }
  return {
    kind: 'exercise',
    suggestion: buildSwapSuggestionPayload(
      choice.name,
      exercise.raw,
      choice.prescription ?? {},
    ),
    hierarchyTier: choice.hierarchyTier,
    reason: choice.reason,
  };
}

function guidedAreaToExerciseArea(area: string): InjuryArea {
  const key = area.toLowerCase();
  if (/shoulder|chest|ribs|neck|upper body/.test(key)) return 'Shoulder';
  if (/elbow/.test(key)) return 'Elbow';
  if (/wrist|hand/.test(key)) return 'Wrist';
  if (/lower back|upper back|back|abs|side|midline/.test(key)) return 'Lower back';
  if (/hip/.test(key)) return 'Hip';
  if (/groin|adductor/.test(key)) return 'Groin';
  if (/knee|quad/.test(key)) return 'Knee';
  if (/hamstring|hammy/.test(key)) return 'Hamstring';
  if (/ankle|foot|calf|achilles/.test(key)) return 'Ankle';
  return 'Other';
}

/**
 * Map the Bible's four severity bands onto the app's three-value
 * `InjurySeverity`. The MAPPING is local — the app has always had three names
 * for four bands — but the BAND EDGES are not: they belong to
 * `rules/injurySeverityBands.ts`, whose header says consumers "should not own
 * their own numeric thresholds". This site used to restate them as 8 and 4.
 */
function guidedSeverityToExerciseSeverity(result: GuidedInjuryFlowResult): InjurySeverity {
  if (result.seriousSymptoms) return 'Severe';
  switch (classifyBibleInjurySeverity(result.severity).band) {
    case 'pause_affected_8_10': return 'Severe';
    case 'restrict_and_refer_6_7':
    case 'reduce_affected_4_5': return 'Moderate';
    default: return 'Mild';
  }
}

/**
 * ⚠ **`suggestAddExercise` IS DELETED — 2026-08-19.**
 *
 * A hand-written table of TWELVE names, two per 'kind', offering whichever
 * one the session did not already contain. It asked nothing about the
 * athlete's equipment and nothing about their injuries, so a shoulder-injured
 * athlete with no barbell was offered the same two upper-body options as
 * everyone else, and every band in it was typed by hand.
 *
 * Sam, 2026-08-19: *"Add any legal exercise, mobility or conditioning
 * component. Respect equipment, injury and genuine session limits. Own load
 * authority."* The owners are `utils/addExerciseCandidates.legalAddFamilies`
 * and `legalAddCandidates`, over the app's own `selectableVocabularyGroups()`,
 * filtered by the SAME safety function the swap ladder uses, with the load from
 * `startingWeightForAthlete`.
 */

function suggestionPrescription(suggestion: SuggestedExercise): string {
  const reps =
    suggestion.repsMin === suggestion.repsMax
      ? `${suggestion.repsMin}`
      : `${suggestion.repsMin}-${suggestion.repsMax}`;
  if (suggestion.prescriptionType === 'duration') {
    return `${suggestion.sets} x ${reps}s${suggestion.perSide ? ' / side' : ''}`;
  }
  if (suggestion.prescriptionType === 'duration_minutes') {
    return `${suggestion.sets} x ${reps} min${suggestion.perSide ? ' / side' : ''}`;
  }
  if (suggestion.prescriptionType === 'distance') {
    return `${suggestion.sets} x ${reps}m${suggestion.perSide ? ' / side' : ''}`;
  }
  return `${suggestion.sets} x ${reps}${suggestion.perSide ? ' / side' : ''}`;
}

/**
 * DayWorkoutScreenV2 — redesigned session screen matching HomeScreenV2.
 *
 * ## Design direction
 * - Bolder header: muted eyebrow ("MONDAY"), big title and session-type subtitle.
 * - Exercise cards: larger readable names, integrated accent play IconButton,
 *   cleaner two-column stats grid (Sets×Reps | Weight), polished segmented
 *   weight control, collapsible coaching cues.
 * - Superset/paired grouping: wrapped in a Card(tone="accent") container with
 *   a subtle lime tint so the pairing reads at a glance.
 * - Conditioning: descriptive phase Cards with lime phase labels.
 * - Recovery: structured prescription lines in accent, integrated play button.
 * - Finish moment: full-width primary Button (size="lg", glow) in its own
 *   elevated section at the bottom of the scroll — the "ship it" cue.
 *
 * ## Logic parity
 * All state lives in `useDayWorkout`; this file is presentation only.
 * Swapping between Classic and V2 produces identical session data, only the
 * rendering differs.
 */
export default function DayWorkoutScreenV2() {
  const {
    date,
    routeWorkoutId,
    workout,
    staleWarning,
    selectedExercise,
    setSelectedExercise,
    expandedCues,
    toggleCue,
    isFinished,
    justSaved,
    savedFeedbackReceipt,
    persistedFeedback,
    persistedReceipt,
    isAlreadyComplete,
    editingWeightId,
    editingWeightText,
    setEditingWeightText,
    formatWeight,
    getLoadControlMode,
    incrementWeight,
    decrementWeight,
    incrementBandResistance,
    decrementBandResistance,
    startEditingWeight,
    commitWeightEdit,
    handleBack,
    handleFinishWorkout,
    handleCancelFeedback,
    handleFeedbackSaved,
    handleScrollBeginDrag,
    detail,
    isTeamOnly,
  } = useDayWorkout();

  const navigation = useNavigation();

  const smokeCoachBikeFlow =
    __DEV__ && getSmokeRuntimeSignal().flow === 'coach-bike-flow';
  const [exerciseEditStep, setExerciseEditStep] =
    React.useState<ExerciseEditStep>({ kind: 'closed' });
  /* THE INJURY FLOW IS THE SESSION'S, NOT A ROW'S — it used to hold the
   * `EditableExercise` the athlete had been made to pick first. */
  const [injuryFlowOpen, setInjuryFlowOpen] = React.useState(false);
  const [sessionEquipmentVisible, setSessionEquipmentVisible] =
    React.useState(false);
  const [sessionOptionsVisible, setSessionOptionsVisible] =
    React.useState(false);
  const quickSwapState = React.useRef<Record<string, {
    choices: readonly TapSwapChoice[];
    attemptedNames: readonly string[];
  }>>({});
  const ledgerEntries = useDecisionLedgerStore((state) => state.entries);
  const storedAthletePrefs = useAthletePreferencesStore((state) => state.prefs);
  const excludedExerciseNames = React.useMemo(
    () => excludedExerciseNamesOn(storedAthletePrefs.exclusions, date),
    [date, storedAthletePrefs.exclusions],
  );
  const effectiveWorkout = React.useMemo(
    () => workout ? applyRecoveryAddonExerciseDecisions({
      workout,
      date,
      entries: ledgerEntries,
      excludedExerciseNames,
    }) : workout,
    [date, excludedExerciseNames, ledgerEntries, workout],
  );
  const [
    pendingComponentDeletionObservation,
    setPendingComponentDeletionObservation,
  ] = React.useState<{
    traceId: string;
    observationId: string;
    componentId: string;
    targetId?: string;
    exerciseKey: string;
  } | null>(null);

  const storedEditableExercises = React.useMemo(
    () => buildEditableExercises(effectiveWorkout, isTeamOnly),
    [effectiveWorkout, isTeamOnly],
  );

  /**
   * ── THE EFFECTIVE KIT FOR *THIS* DAY, AND THE IMPLEMENT IT SELECTS ────────
   *
   * R-104. `resolveEquipmentCapabilities(profile, constraints, date)` is the one
   * owner — profile, minus any away span, minus the session answer this screen
   * now writes as a dated fact. **Reading `profile.equipmentAnswer` directly here
   * would answer "barbell" on a day the athlete has just unticked the barbell**,
   * which is exactly the private profile read R-102 closed.
   *
   * The store reads are live-at-render on purpose: applying the equipment sheet
   * writes a fact and recomposes, so `workout` changes identity and this
   * recomputes with it.
   */
  const effectiveKitTags = React.useMemo(
    () => (date
      ? resolveEquipmentCapabilities(
          useProfileStore.getState().onboardingData,
          useCoachUpdatesStore.getState().activeConstraints,
          date,
        ).tags
      : []),
    [date, workout],
  );
  /**
   * The PERMANENT kit — the athlete's own gym, with no dated fact subtracted.
   * `resolveEquipmentCapabilities` with no constraints IS the permanent answer
   * (see its docstring); it is resolved separately so the screen can tell "this
   * is what you always use" from "this is what you're using TODAY".
   */
  const permanentKitTags = React.useMemo(
    () => (date
      ? resolveEquipmentCapabilities(useProfileStore.getState().onboardingData, [], date).tags
      : []),
    [date],
  );
  const implementFor = React.useCallback(
    (exerciseName: string, prescribedWeightKg?: number | null) => {
      const canonical = canonicalExerciseName(exerciseName);
      const effective = resolveSelectedImplement({
        exerciseName: canonical, availableTags: effectiveKitTags, prescribedWeightKg,
      });
      const permanent = resolveSelectedImplement({
        exerciseName: canonical, availableTags: permanentKitTags, prescribedWeightKg,
      });
      return {
        ...effective,
        // ── SAM'S UI CORRECTION, 2026-08-18 ────────────────────────────────
        // *"The always-visible implement labels make the session too cluttered
        // … Only show equipment context when it explains a TEMPORARY session
        // change."* So the implement stays typed on every row — legality, load
        // and cues all read it — and the SCREEN only speaks when today differs
        // from the athlete's normal kit. On an ordinary day this is false on
        // every row and the session renders exactly as it did before any of
        // this landed.
        changedToday: !!effective.implement && !!permanent.implement
          && effective.implement !== permanent.implement,
        normalImplement: permanent.implement,
      };
    },
    [effectiveKitTags, permanentKitTags],
  );

  /**
   * The one list. Composed once from the whole workout — see
   * `src/utils/sessionTemplate.ts` for why this is an owner rather than a
   * render helper.
   */
  const sessionTemplate = React.useMemo(
    () => buildSessionTemplate(effectiveWorkout),
    [effectiveWorkout],
  );

  /**
   * The collapsed Mobility & Prehab flow. Game week is read off the resolved
   * week this date belongs to — a real signal the schedule already owns, rather
   * than a flag the flow would otherwise have to guess at (and so never use).
   */
  const seasonPhase = useProfileStore(
    (s: any) => s.onboardingData?.seasonPhase ?? null,
  );
  const resolvedWeek = useResolvedWeekForDate(date);
  const isGameWeek = React.useMemo(
    () => resolvedWeek.some((day) => day.indicator === 'game'),
    [resolvedWeek],
  );
  const flowAthlete = useAthleteContext();
  /* ⚠ **R-213 — A TICKED WARM-UP OUTLIVES THE WORK IT WAS DERIVED FOR.**
   *
   * Sam, 2026-08-25: *"If a warm up is already ticked off then it should stay,
   * but otherwise swapping it for something else is okay if they change a main
   * lift."* The warm-up is derived from the workout, so a main lift change
   * re-derives it — measured 2026-08-25, one swap replaced 2 of 4 movements and
   * the saved ticks went with them. The saved record is an INPUT to the
   * derivation, which is the only place that fact can be honoured for every
   * surface at once. */
  const performedMovementIds = React.useMemo(
    () => performedMobilityMovementIds(persistedFeedback as any),
    [persistedFeedback],
  );
  const baseMobilityFlow = React.useMemo(
    () => selectMobilityPrehabFlow({
      workout: effectiveWorkout,
      seasonPhase,
      isGameWeek,
      athlete: flowAthlete,
      date,
      performedMovementIds,
    }),
    [effectiveWorkout, seasonPhase, isGameWeek, flowAthlete, date, performedMovementIds],
  );
  const mobilityFlow = React.useMemo(
    () => applyMobilityFlowExerciseDecisions({
      flow: baseMobilityFlow,
      date,
      entries: ledgerEntries,
      excludedExerciseNames,
    }),
    [baseMobilityFlow, date, excludedExerciseNames, ledgerEntries],
  );
  const editableExercises = React.useMemo(
    () => [...storedEditableExercises, ...buildMobilityEditableExercises(mobilityFlow)],
    [mobilityFlow, storedEditableExercises],
  );
  const sessionEquipmentRequirements = React.useMemo(
    () => deriveSessionEquipmentRequirements(editableExercises),
    [editableExercises],
  );
  const executionPlan = React.useMemo(
    () => effectiveWorkout ? buildSessionExecutionPlan({
      workout: effectiveWorkout,
      template: sessionTemplate,
      mobilityFlow,
    }) : null,
    [effectiveWorkout, mobilityFlow, sessionTemplate],
  );
  const [completedExerciseIds, setCompletedExerciseIds] = React.useState<ReadonlySet<string>>(
    () => executionPlan
      ? recordedCompletedSessionExecutionItemIds(executionPlan, persistedFeedback)
      : new Set(),
  );
  React.useEffect(() => {
    // The checklist is a local draft until Save. Reopening (or hydration
    // completing after mount) starts that draft from the exact durable item
    // evidence. A same-session weight/edit render must not reset active ticks,
    // so the effect keys on session identity and the saved fact, not the whole
    // derived plan object.
    setCompletedExerciseIds(executionPlan
      ? recordedCompletedSessionExecutionItemIds(executionPlan, persistedFeedback)
      : new Set());
  }, [date, workout?.id, persistedFeedback]);
  const toggleExerciseComplete = React.useCallback((itemId: string) => {
    setCompletedExerciseIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);
  const executionSummary = React.useMemo(
    () => executionPlan
      ? buildSessionExecutionSummary(executionPlan, completedExerciseIds)
      : undefined,
    [completedExerciseIds, executionPlan],
  );

  /**
   * SELECT ALL — Sam, 2026-08-22: *"this would select/unselect all the boxes
   * for people that completed the entire session = in case they don't check
   * them as they are going"*.
   *
   * ⚠ **A WITHHELD ROW IS NEVER SELECTED, AND THAT IS R-115, NOT A DETAIL.**
   * Those rows show `SKIP` instead of a checkbox because the injury owner
   * withheld them — *"the injured date cannot be completed as normal"*. A
   * select-all that ticked them would do by one tap exactly what removing their
   * checkbox exists to prevent.
   *
   * It MIRRORS rather than always-selects: if every selectable row is already
   * ticked the tap clears them, which is the "unselect all" half of the ask and
   * the only behaviour that makes one control honest in both directions.
   */
  const selectableItemIds = React.useMemo(() => {
    const items = sessionTemplate?.items ?? [];
    return (executionPlan?.items ?? [])
      .filter((item) => !withholdingOfTemplateItem(
        item.templateIndex === null ? undefined : items[item.templateIndex],
      ))
      .map((item) => item.id);
  }, [executionPlan, sessionTemplate]);
  const allSelected = selectableItemIds.length > 0
    && selectableItemIds.every((id) => completedExerciseIds.has(id));
  const toggleSelectAll = React.useCallback(() => {
    setCompletedExerciseIds((current) => {
      const everySelected = selectableItemIds.length > 0
        && selectableItemIds.every((id) => current.has(id));
      if (everySelected) {
        const next = new Set(current);
        for (const id of selectableItemIds) next.delete(id);
        return next;
      }
      return new Set([...current, ...selectableItemIds]);
    });
  }, [selectableItemIds]);

  React.useEffect(() => {
    if (!pendingComponentDeletionObservation) return;
    const targetStillRendered = editableExercises.some((exercise) =>
      pendingComponentDeletionObservation.targetId
        ? exercise.targetId === pendingComponentDeletionObservation.targetId
        : exercise.key === pendingComponentDeletionObservation.exerciseKey);
    if (targetStillRendered) return;
    const resultTestID = explorerTestId.componentDeleteResult(
      workout.id,
      pendingComponentDeletionObservation.componentId,
    );
    observeRenderedAthleteActionOutcome({
      traceId: pendingComponentDeletionObservation.traceId,
      observationId: pendingComponentDeletionObservation.observationId,
      renderedText: {
        componentId: pendingComponentDeletionObservation.componentId,
        targetStillRendered,
        visibleComponentIds: editableExercises.map((exercise) =>
          exercise.targetId ?? exercise.key),
      },
      controlId: resultTestID,
      accessibilityNode: {
        resultTestID,
        workoutExerciseRowTestIDs: editableExercises.map((exercise) =>
          `workout-exercise-row-${stableTestIdToken(exercise.targetId ?? exercise.key)}`),
      },
      screenshotReference:
        'screenshots/trace-v2-component-deletion-after-mutation.png',
      hierarchyReference:
        'accessibility-hierarchy/trace-v2-component-deletion-after-mutation.json',
    });
    setPendingComponentDeletionObservation(null);
  }, [editableExercises, pendingComponentDeletionObservation, workout.id]);

  const closeExerciseEditor = React.useCallback(
    () => setExerciseEditStep({ kind: 'closed' }),
    [],
  );

  // TASK 8 (ruling 12): the "Edit exercises" link and its modal MENU are
  // retired. The top-of-page icon row below opens these three doors
  // directly — same gate the link used to apply (`!isTeamOnly &&
  // editableExercises.length > 0`), now guarded at both the render site
  // (hides the row) and here (defensive, matches the retired handler's
  // own belt-and-braces check).

  const openSessionEquipment = React.useCallback(() => {
    if (isTeamOnly || sessionEquipmentRequirements.length === 0) return;
    setSessionEquipmentVisible(true);
  }, [isTeamOnly, sessionEquipmentRequirements.length]);

  /**
   * INJURY, ASKED ONCE, FROM THE TOP OF THE SESSION.
   *
   * No exercise is picked first. The athlete answers where it hurts and how
   * bad; the app finds every affected row itself.
   */
  const openSessionInjuryFlow = React.useCallback(() => {
    if (isTeamOnly || editableExercises.length === 0) return;
    setExerciseEditStep({ kind: 'closed' });
    setInjuryFlowOpen(true);
  }, [editableExercises.length, isTeamOnly]);

  // Per-row swap/remove buttons. Replace `openSpecificExerciseEditor`,
  // which routed every row tap through the now-deleted `exercise_menu`
  // step. The row already tells us which exercise AND which action, so
  // each opener lands straight on the guided step that action starts —
  // no intermediate menu to choose from.

  const workoutLabel = workout?.name ?? 'this session';
  const dateLabel = date ?? 'today';

  const showExerciseEditFallback = React.useCallback(
    (title: string, message: string, prefill: string) => {
      setExerciseEditStep({ kind: 'coach_fallback', title, message, prefill });
    },
    [],
  );

  const suggestTapSwap = React.useCallback(
    (
      exercise: EditableExercise,
      reason: SwapReason,
      primaryInjury: TapSwapPrimaryInjury | null = null,
    ): SuggestedSwap => {
      const dateISO = date ?? todayISOLocal();
      const environment = resolveTapSwapEnvironment({
        scheduleState: buildScheduleStateImperative(),
        date: dateISO,
        gameDates: [...getEffectiveGameDates(buildScheduleStateImperative(), dateISO)],
        profile: useProfileStore.getState().onboardingData,
        activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[dateISO],
        primaryInjury,
      });
      const choice = getTapSwapChoices({
        originalExercise: exercise.name,
        reason: tapSwapReason(reason),
        environment,
        primaryInjury,
        existingExerciseNames: editableExercises.map((item) => item.name),
      })[0];
      return suggestedSwapFromChoice(exercise, choice);
    },
    [date, editableExercises],
  );

  /** One tap advances through one ranked list for the original visible slot. */
  const quickSwapExercise = React.useCallback(async (exercise: EditableExercise) => {
    if (!date) return;
    const slotId = exercise.targetId ?? exercise.key;
    let state = quickSwapState.current[slotId];
    if (!state) {
      const environment = resolveTapSwapEnvironment({
        scheduleState: buildScheduleStateImperative(),
        date,
        gameDates: [...getEffectiveGameDates(buildScheduleStateImperative(), date)],
        profile: useProfileStore.getState().onboardingData,
        activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[date],
      });
      state = {
        choices: rankedQuickSwapChoices({
          originalExercise: exercise.name,
          reason: 'preference',
          environment,
          existingExerciseNames: editableExercises.map((item) => item.name),
          profile: useProfileStore.getState().onboardingData,
          requiredFamily: exercise.derivedSource?.kind === 'mobility_flow'
            ? 'mobility'
            : undefined,
        }),
        attemptedNames: [],
      };
    }
    const next = nextQuickSwapChoice(state.choices, state.attemptedNames);
    if (!next) {
      showExerciseEditFallback(
        'No safe swap for this one',
        `There is no safe replacement for ${displayExerciseName(exercise.name)} with today’s kit and how you are pulling up. You can remove it instead.`,
        `Find a safe replacement for ${displayExerciseName(exercise.name)} on ${date}.`,
      );
      return;
    }
    const suggestion = suggestedSwapFromChoice(exercise, next.choice);
    if (suggestion.kind !== 'exercise') return;
    const result = await executeProgramControlActionDurably({
      type: 'swap_exercise',
      source: { screen: 'session_detail', surface: 'quick_exercise_action', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: {
        date,
        fromExercise: exercise.name,
        fromExerciseId: exercise.targetId,
        toExercise: suggestion.suggestion,
        derivedSource: exercise.derivedSource,
      },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: true,
    }, { todayISO: date });
    if (result.ok) {
      quickSwapState.current[slotId] = {
        choices: state.choices,
        attemptedNames: next.attemptedNames,
      };
      return;
    }
    setExerciseEditStep({
      kind: 'result',
      ok: false,
      title: 'Could not swap exercise',
      message: result.message ?? 'Nothing changed.',
    });
  }, [date, editableExercises, showExerciseEditFallback]);

  const swapGroupsFor = React.useCallback((exercise: EditableExercise) => {
      const reason: SwapReason = 'Preference';
      const dateISO = date ?? todayISOLocal();
      const environment = resolveTapSwapEnvironment({
        scheduleState: buildScheduleStateImperative(),
        date: dateISO,
        gameDates: [...getEffectiveGameDates(buildScheduleStateImperative(), dateISO)],
        profile: useProfileStore.getState().onboardingData,
        activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[dateISO],
      });
      // THE SAME LADDER, ASKED FOR ITS WHOLE ANSWER. `groupTapSwapChoices` caps
      // each group at two and OMITS a group with no legal member — Sam's *"show
      // fewer when good legal options do not exist"* honoured by omission
      // rather than by padding the list with something illegal.
      return groupTapSwapChoices(rankedQuickSwapChoices({
        originalExercise: exercise.name,
        reason: tapSwapReason(reason),
        environment,
        existingExerciseNames: editableExercises.map((item) => item.name),
        profile: useProfileStore.getState().onboardingData,
        requiredFamily: exercise.derivedSource?.kind === 'mobility_flow'
          ? 'mobility'
          : undefined,
      })).map((group) => ({
        id: group.id,
        label: group.label,
        options: group.choices.map((choice) => {
          const suggestion = suggestedSwapFromChoice(exercise, choice);
          return {
            name: displayExerciseName(choice.name ?? ''),
            suggestion,
          };
        }),
      })).filter((group) => group.options.length > 0);
    }, [date, editableExercises]);

  const prepareSwap = React.useCallback(
    (exercise: EditableExercise) => {
      const reason: SwapReason = 'Preference';
      const groups = swapGroupsFor(exercise);
      if (groups.length === 0) {
        // HONEST, NOT AN EMPTY SHEET. A row with no legal substitute says so in
        // the athlete's words; it does not open a chooser with nothing in it.
        showExerciseEditFallback(
          'No safe swap for this one',
          `There is no safe replacement for ${displayExerciseName(exercise.name)} with today’s kit and how you are pulling up. You can remove it instead.`,
          `Find a safe replacement for ${displayExerciseName(exercise.name)} on ${dateLabel}.`,
        );
        return;
      }
      setExerciseEditStep({ kind: 'choose_swap', exercise, reason, groups });
    },
    [dateLabel, showExerciseEditFallback, swapGroupsFor],
  );


  /**
   * THE LEGAL ADD MENU FOR THIS ATHLETE, ON THIS DAY.
   *
   * Derived at open time and never stored: kit, injuries and what is already on
   * the session all move, and a cached menu would offer a movement the athlete
   * can no longer do.
   */
  /**
   * THE ATHLETE, THEIR KIT AND THEIR INJURIES — ASSEMBLED ONCE, READ BY ALL
   * THREE LEVELS.
   *
   * Derived at every open and never stored: kit, injuries and what is already
   * on the session all move, and a cached menu would offer a movement the
   * athlete can no longer do.
   */
  const addCandidateArgs = React.useCallback(() => {
    const dateISO = date ?? todayISOLocal();
    return {
      environment: resolveTapSwapEnvironment({
        scheduleState: buildScheduleStateImperative(),
        date: dateISO,
        gameDates: [...getEffectiveGameDates(buildScheduleStateImperative(), dateISO)],
        profile: useProfileStore.getState().onboardingData,
        activeConstraints: useCoachUpdatesStore.getState().activeConstraints,
        readinessSignal: useReadinessStore.getState().signalsByDate[dateISO],
      }),
      existingExerciseNames: editableExercises.map((item) => item.name),
      profile: useProfileStore.getState().onboardingData,
    };
  }, [date, editableExercises]);

  /* ⚠ **LEVEL 1 IS DELETED, AND THAT IS THE POINT OF R-217.**
   *
   * `openExerciseAdd` opened *"Strength / Conditioning / Mobility / Warm-up"* —
   * R-120's first rung — and the retired menu row was its only caller. The
   * section plus answers that question by WHERE it is tapped, so the rung has
   * nothing left to ask and `openAddFamily` is now the entry point.
   *
   * ⚠ **ITS "Nothing safe to add today" SENTENCE WENT WITH IT, DELIBERATELY.**
   * That fallback fired when EVERY family was empty. Legality is now read per
   * section before a plus is drawn, so a section with nothing safe shows no
   * control instead of a control that opens on a refusal — the honest answer
   * moved from a sentence to an absence. `showExerciseEditFallback` keeps its
   * other callers.
   */
  /** LEVEL 2 — the headings inside one family. */
  const openAddFamily = React.useCallback((
    family: AddFamilyId,
    fromFamily?: Extract<ExerciseEditStep, { kind: 'add_family' }>,
  ) => {
    const offer = legalAddFamilies(addCandidateArgs()).find((entry) => entry.id === family);
    if (!offer) return;
    setExerciseEditStep({
      kind: 'add_group',
      family: offer.id,
      familyLabel: offer.label,
      groups: offer.groups.map((group) => ({
        id: group.id, label: group.label, count: group.count,
      })),
      ...(fromFamily ? { fromFamily } : {}),
    });
  }, [addCandidateArgs]);

  /**
   * ⚠ **WHICH SECTIONS OFFER A QUICK ADD — R-217.**
   *
   * `AddFamilyId` is an `Extract` of `SessionExecutionSectionId`, so a section
   * and an add family are THE SAME IDENTITY and no translation table is needed
   * (`addExerciseCandidates`: *"the families ARE session sections"*). A section
   * outside those three — Accessories, Recovery, Optional Work — has no family
   * to add into and gets no plus.
   *
   * The legality is the SAME `legalAddFamilies` pass the retired menu row ran,
   * so a family with nothing safe for today's kit and injuries shows no plus at
   * all rather than a control that opens on an empty list.
   */
  const quickAddFamilies = React.useMemo(() => {
    if (isTeamOnly || isFinished || isAlreadyComplete || editableExercises.length === 0) {
      return new Set<AddFamilyId>();
    }
    return new Set(legalAddFamilies(addCandidateArgs()).map((family) => family.id));
  }, [
    addCandidateArgs, editableExercises.length, isAlreadyComplete, isFinished, isTeamOnly,
  ]);

  /** The tap for one section's plus, or `null` when that section has none. */
  const quickAddFor = React.useCallback(
    (sectionId: SessionExecutionSectionId): (() => void) | null => {
      const family = sectionId as AddFamilyId;
      if (!quickAddFamilies.has(family)) return null;
      // ⚠ ENTERS THE EXISTING HIERARCHY ONE LEVEL DOWN — R-120's level 1 IS the
      // three section names, and the plus has already answered that question by
      // WHERE it was tapped. Asking again would be the "path is the context"
      // mistake R-120b names, in reverse.
      return () => openAddFamily(family);
    },
    [openAddFamily, quickAddFamilies],
  );

  /**
   * THE EXERCISE LIST FOR ONE LEAF. Shared by both routes into it, so the two
   * branches cannot drift in what a chosen movement carries.
   */
  const openAddLeafList = React.useCallback((
    family: AddFamilyId,
    leaf: AddLeafId,
    fromList?: Extract<ExerciseEditStep, { kind: 'add_leaf' } | { kind: 'add_group' }>,
  ) => {
    const candidates = legalAddCandidates({ ...addCandidateArgs(), leaf });
    if (candidates.length === 0) return;
    setExerciseEditStep({
      kind: 'add_pick',
      family,
      leaf,
      label: ADD_LEAF_LABELS[leaf],
      options: candidates.map((candidate) => {
        const suggestion: SuggestedExercise = {
          name: candidate.name,
          sets: candidate.sets,
          repsMin: candidate.repsMin,
          repsMax: candidate.repsMax,
          restSeconds: candidate.restSeconds,
          notes: candidate.notes,
          ...(candidate.prescriptionType ? { prescriptionType: candidate.prescriptionType } : {}),
          ...(candidate.perSide ? { perSide: true } : {}),
          ...(candidate.weightKg !== null ? { weight: candidate.weightKg } : {}),
        } as SuggestedExercise;
        return {
          name: displayExerciseName(candidate.name),
          suggestion,
        };
      }),
      ...(fromList ? { fromList } : {}),
    });
  }, [addCandidateArgs]);

  /**
   * A HEADING WAS TAPPED — AND WHETHER THAT ASKS ANOTHER QUESTION IS THE DATA'S
   * ANSWER, NOT THIS FUNCTION'S.
   *
   * Sam: *"this adds one extra step only where needed"*. Lower body and Upper
   * body have four leaves and land on `add_leaf`; Power & Jumps, Midline &
   * Carries and every Conditioning and Mobility heading have one and go
   * straight to the exercises. A group whose other leaves are all unsafe for
   * THIS athlete today also has one, and correctly loses the step too — the
   * athlete is never asked to choose from a list of one.
   */
  const openAddGroup = React.useCallback((
    family: AddFamilyId,
    group: AddGroupId,
    fromGroup?: Extract<ExerciseEditStep, { kind: 'add_group' }>,
  ) => {
    const familyOffer = legalAddFamilies(addCandidateArgs()).find((entry) => entry.id === family);
    const offer = familyOffer?.groups.find((entry) => entry.id === group);
    if (!offer || offer.leaves.length === 0) return;
    if (offer.leaves.length === 1) {
      openAddLeafList(family, offer.leaves[0]!.id, fromGroup);
      return;
    }
    setExerciseEditStep({
      kind: 'add_leaf',
      family,
      group,
      groupLabel: offer.label,
      leaves: offer.leaves.map((leaf) => ({
        id: leaf.id, label: leaf.label, count: leaf.count,
      })),
      ...(fromGroup ? { fromGroup } : {}),
    });
  }, [addCandidateArgs, openAddLeafList]);

  /** THE EXTRA STEP'S ANSWER — Hinge / Squat / Single leg / Accessories. */
  const openAddLeaf = React.useCallback((
    family: AddFamilyId,
    leaf: AddLeafId,
    fromLeaf?: Extract<ExerciseEditStep, { kind: 'add_leaf' }>,
  ) => {
    openAddLeafList(family, leaf, fromLeaf);
  }, [openAddLeafList]);

  /* `prepareAdd` DELETED with `suggestAddExercise` and the `add_kind` step
   * (2026-08-19). `openExerciseAdd` -> `openAddFamily` -> `openAddGroup` ->
   * (`openAddLeaf`) is the whole route now, and its fallback is a real sentence about kit and
   * injuries rather than "I need a bit more detail" for a table that had simply
   * run out of names. */

  const applySessionEquipment = React.useCallback(async (
    missingKeys: ReadonlySet<SessionEquipmentRequirementKey>,
  ) => {
    if (!date) return;
    // ── THE DECISION IS RECORDED BEFORE ANYTHING ACTS ON IT ──────────────────
    //
    // **This handler used to emit a loop of `swap_exercise` actions and nothing
    // else**, holding "I have no barbell today" in the sheet's own `useState`.
    // A decision that exists only as its own consequences cannot be read by the
    // producers that run afterwards, and the post-mutation finaliser proved it:
    // measured through this door, replacing `RDLs` removed the day's hinge, so
    // the finaliser restored one FROM THE ORIGINAL DAY — putting the barbell
    // row straight back on a session the athlete had just said they could not
    // load. It consults no equipment because there was no equipment fact to
    // consult.
    //
    // The fact goes first, so every producer downstream of it — the swap's own
    // finaliser included — is working in a world where the kit is known.
    const factResult = await executeProgramControlActionDurably({
      type: 'set_equipment_modifier',
      source: { screen: 'session_detail', surface: 'session_equipment_sheet', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: {
        date,
        todayISO: date,
        decision: {
          kind: 'missing_for_session',
          tags: missingSessionEquipmentValues(missingKeys).tags,
          conditioningModalities: missingSessionEquipmentValues(missingKeys).modalities,
        },
      },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: true,
    }, { todayISO: date });
    if (!factResult.ok) {
      setSessionEquipmentVisible(false);
      setExerciseEditStep({
        kind: 'result',
        ok: false,
        title: 'Could not change this session’s equipment',
        message: factResult.message ?? 'Nothing changed.',
      });
      return;
    }
    // ── THE FACT IS THE WHOLE ACTION ─────────────────────────────────────
    //
    // ⚠ **A SECOND SELECTION AUTHORITY USED TO LIVE HERE AND IT WAS INERT.**
    // This handler went on to call `buildSessionEquipmentReplacementPlan` and
    // commit a loop of `swap_exercise` actions from its answer — the screen
    // choosing exercises, which is the composer's job. Deleted 2026-08-19 after
    // it was measured across **2,038 real (athlete, session date, implement
    // subset) door walks**: it produced replacements in **0 of them**, because
    // the dated fact above is written FIRST and the composer has already
    // recomposed the day against the reduced kit. Its `"N exercises were
    // replaced"` receipt was unreachable, and the Maestro flow that asserted it
    // had been failing on glass.
    //
    // **THE LIVE SWAP AND REMOVE DOOR IS UNTOUCHED** — `applySwapToday` below
    // still owns `swap_exercise` and `remove_exercise`. Nothing about ordinary
    // swapping or removal changed here; only this dead copy of it went.
    setSessionEquipmentVisible(false);
    setExerciseEditStep({
      kind: 'result',
      ok: true,
      title: 'Session equipment updated',
      message: 'Saved for this session only. Your session was rebuilt using the equipment you have today — your saved gym setup is unchanged.',
    });
  }, [date]);

  /**
   * THE ATHLETE ANSWERED. NOW SHOW THEM EVERYTHING IT WOULD DO — AND WRITE
   * NOTHING YET.
   *
   * Sam, 2026-08-20: *"Show one review of all proposed changes. Apply the
   * approved changes together."*
   *
   * ⚠ **THIS HANDLER USED TO WRITE FIRST AND ASK AFTERWARDS.** It fired
   * `set_injury_modifier` the moment the guided flow closed — which recomposed
   * the whole day — and then offered a `confirm_swap` for the ONE exercise the
   * athlete had been made to pick beforehand. So the session was already
   * changed before any review existed, the review that did exist covered a
   * single row out of however many the injury touched, and the row was often no
   * longer on the session at all (the guard below it existed precisely to catch
   * that). Nothing is written here now.
   *
   * ⚠ **THE REVIEW IS BUILT BY THE WRITE PATH'S OWN OWNER.**
   * `buildSessionInjuryReview` calls `resolveInjuryRecompositionInputs`, which is
   * the identical call `set_injury_modifier` makes when this review is approved.
   * A second builder here would be the "preview disagreed with the delivered
   * program in 40 of 90 prescriptions" shape, measured elsewhere in this repo on
   * the same day this was written.
   */
  const reviewSessionInjury = React.useCallback(
    async (result: GuidedInjuryFlowResult) => {
      if (!date) return;
      setInjuryFlowOpen(false);
      const constraint = buildGuidedInjuryConstraint(result, { todayISO: date });
      const review = buildSessionInjuryReview({ date, constraint });
      setExerciseEditStep({ kind: 'injury_review', review, constraint });
    },
    [date],
  );

  /**
   * APPROVED — APPLY THEM TOGETHER, THROUGH THE ONE DOOR.
   *
   * `set_injury_modifier` records the injury AND recomposes the day in a single
   * durable action, so every change the athlete just approved lands in one pass
   * or none of them does. There is no per-row apply and deliberately no partial
   * state to be left in.
   *
   * ⚠ **THE SENTENCE THEY READ AFTERWARDS IS THE DOOR'S, NOT THE REVIEW'S.** The
   * review said what WOULD happen; `injuryRecompositionMessage` says what DID,
   * derived from the rows before and after. Echoing the review here would be
   * exactly the false claim Sam's *"never claim the session was safely changed
   * if nothing changed"* is about — a promise repeated back as a result.
   */
  const applySessionInjuryReview = React.useCallback(
    async (step: Extract<ExerciseEditStep, { kind: 'injury_review' }>) => {
      if (!date) return;
      const actionResult = await executeProgramControlActionDurably({
        type: 'set_injury_modifier',
        source: { screen: 'session_detail', surface: 'session_injury_review', initiatedBy: 'tap' },
        scope: 'current_and_future',
        payload: { constraint: step.constraint },
        requiresRebuild: false,
        createsActiveModifier: true,
        oneOffOnly: false,
      }, { todayISO: date });
      setExerciseEditStep({
        kind: 'result',
        ok: actionResult.ok,
        title: step.review.trainingPaused
          ? 'Training paused for injury'
          : 'Injury adjustment active',
        message: actionResult.message
          ?? 'Affected work will be avoided. Coach Notes will show this until you clear it.',
      });
    },
    [date],
  );

  /**
   * ⚠ **SWAP AND ADD USED THE SYNCHRONOUS DOOR, AND THEY DID NOT SURVIVE A
   * RESTART.**
   *
   * Measured 2026-08-19 by `npm run test:session-change-sequence`, the first
   * thing in this repo to take four actions and then kill the process: the
   * athlete swapped a lift and added an exercise, relaunched, and both were
   * gone. `dateOverrides` reached disk and came back EMPTY — because
   * `quiescentBoot`'s clean slate deliberately blanks `dateOverrides` and
   * rebuilds the athlete's edits by REPLAYING THE DECISION LEDGER
   * (`migrated_day_placement` / `program_control`).
   *
   * Only `executeProgramControlActionDurably` appends to that ledger. Remove
   * already used it; swap and add did not, so nothing recorded them and the
   * clean slate simply erased them. **The durability was never in the store —
   * it is in the ledger, and these two doors were not writing to it.**
   *
   * (The first cut of this fix added `dateOverrides` to the persisted inputs.
   * It reached disk correctly and changed nothing, because boot blanks it after
   * hydration on purpose — and keeping it would have been a SECOND
   * representation of the athlete's edits racing the ledger's replay. Reverted.)
   */
  const applySwapToday = React.useCallback(
    async (step: Extract<ExerciseEditStep, { kind: 'confirm_swap' }>) => {
      if (!date) return;
      const result = step.suggestion.kind === 'rest'
        ? await executeProgramControlActionDurably({
            type: 'remove_exercise',
            source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
            scope: 'today_only',
            payload: {
              date,
              exercise: step.exercise.name,
              exerciseId: step.exercise.targetId,
            },
            requiresRebuild: false,
            createsActiveModifier: false,
            oneOffOnly: true,
          }, { todayISO: date })
        : await executeProgramControlActionDurably({
            type: 'swap_exercise',
            source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
            scope: 'today_only',
            payload: {
              date,
              fromExercise: step.exercise.name,
              fromExerciseId: step.exercise.targetId,
              toExercise: step.suggestion.suggestion,
            },
            requiresRebuild: false,
            createsActiveModifier: false,
            oneOffOnly: true,
          }, { todayISO: date });
      if (result.ok) {
        if (step.suggestion.kind === 'rest') {
          // A swap with no safe replacement IS a removal — the row came out and
          // nothing went in — so it asks the removal question, not the swap one.
          setExerciseEditStep({ kind: 'exclusion_scope', exercise: step.exercise });
          return;
        }
        setExerciseEditStep({
          kind: 'future_scope',
          action: 'swap',
          exercise: step.exercise,
          suggestion: step.suggestion.suggestion,
          reason: step.reason,
          injuryArea: step.injuryArea,
          injurySeverity: step.injurySeverity,
        });
        return;
      }
      setExerciseEditStep({
        kind: 'result',
        ok: false,
        title: 'Could not swap exercise',
        message: result.message ?? 'Nothing changed.',
      });
    },
    [date],
  );

  /** Durable for the same reason as the swap above — see its note. */
  const applyAddToday = React.useCallback(
    async (step: Extract<ExerciseEditStep, { kind: 'confirm_add' }>) => {
      if (!date) return;
      const result = await executeProgramControlActionDurably({
        type: 'add_exercise',
        source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
        scope: 'today_only',
        payload: {
          date,
          exercise: step.suggestion,
        },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: true,
      }, { todayISO: date });
      if (result.ok) {
        setExerciseEditStep({
          kind: 'future_scope',
          action: 'add',
          addKind: step.addKind,
          suggestion: step.suggestion,
        });
        return;
      }
      setExerciseEditStep({
        kind: 'result',
        ok: false,
        title: 'Could not add exercise',
        message: result.message ?? 'Nothing changed.',
      });
    },
    [date],
  );

  /**
   * THE ATHLETE'S ANSWER TO SAM'S SCOPE QUESTION, THROUGH THE ONE OWNER.
   *
   * `applyExerciseExclusionDecision` is the canonical transaction — the same one
   * My Status's "Change scope" and the coach path use — so an answer given here
   * and an answer given there are the same fact, not two rows that disagree.
   *
   * Today's session is updated only after the athlete has made the removal
   * decision. `removeExerciseToday` commits the day override immediately before
   * this scope question opens. So a `today_only` answer has nothing further to
   * change in the program and simply records why the row is gone, which is what
   * puts it on Status for the day and in history after it.
   */
  const applyExclusionScope = React.useCallback(
    (exercise: EditableExercise, scope: ExerciseExclusionScope) => {
      const result = applyExerciseExclusionDecision({
        exercise: exercise.name,
        scope,
        decidedOnISO: date ?? todayISOLocal(),
      });
      if (!result.ok || !result.exclusion) {
        setExerciseEditStep({
          kind: 'result',
          ok: false,
          title: 'Could not save that',
          message: 'Today’s session is still updated.',
        });
        return;
      }
      setExerciseEditStep({
        kind: 'result',
        ok: true,
        title: 'Saved',
        // `exclusionExpiryLabel` already SAYS the scope for a today_only
        // exclusion ("Today only (date)"), so restating the scope label first
        // printed "— today only. Today only (2026-08-27)." — launch audit
        // 2026-08-25, finding #8. The label leads only when the expiry line
        // does not already carry it.
        message: `${displayExerciseName(exercise.name)} — ${
          scope === 'today_only'
            ? exclusionExpiryLabel(result.exclusion)
            : `${EXERCISE_EXCLUSION_SCOPE_LABEL[scope].toLowerCase()}. ${exclusionExpiryLabel(result.exclusion)}`
        }. You can change or undo this in My Status.`,
      });
    },
    [date],
  );

  const saveFutureExerciseAdjustment = React.useCallback(
    (step: FutureScopeStep) => {
      if (step.action === 'swap') {
        const result = executeProgramControlAction({
          type: 'add_exercise_preference',
          source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
          scope: 'future_weeks',
          payload: {
            exercise: step.exercise.name,
            alternative: step.suggestion.name,
            preferenceKind: 'preferred_alternative',
          },
          requiresRebuild: false,
          createsActiveModifier: true,
          oneOffOnly: false,
        });
        if (!result.ok) {
          setExerciseEditStep({
            kind: 'result',
            ok: false,
            title: 'Could not save future change',
            message: result.message ?? 'Today’s session is still updated.',
          });
          return;
        }
        const label = step.injuryArea
          ? `Replace ${displayExerciseName(step.exercise.name)} with ${displayExerciseName(step.suggestion.name)} when ${step.injuryArea.toLowerCase()} is irritated.`
          : `Replace ${displayExerciseName(step.exercise.name)} with ${displayExerciseName(step.suggestion.name)} where appropriate.`;
        setExerciseEditStep({
          kind: 'result',
          ok: true,
          title: 'Future adjustment saved',
          message: label,
        });
        return;
      }

      const result = executeProgramControlAction({
        type: 'add_exercise_preference',
        source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
        scope: 'future_weeks',
        payload: {
          exercise: step.suggestion.name,
          alternative: step.suggestion.name,
          focus: step.addKind.toLowerCase(),
          preferenceKind: 'add_focus',
        },
        requiresRebuild: false,
        createsActiveModifier: true,
        oneOffOnly: false,
      });
      if (!result.ok) {
        setExerciseEditStep({
          kind: 'result',
          ok: false,
          title: 'Could not save future change',
          message: result.message ?? 'Today’s session is still updated.',
        });
        return;
      }
      const focus = step.addKind.toLowerCase();
      const label = `Add extra ${focus} work in similar sessions.`;
      setExerciseEditStep({
        kind: 'result',
        ok: true,
        title: 'Future adjustment saved',
        message: label,
      });
    },
    [],
  );

  const closeFutureScopeTodayOnly = React.useCallback(() => {
    closeExerciseEditor();
  }, [closeExerciseEditor]);

  /**
   * OPEN THE QUESTION; WRITE NOTHING.
   *
   * Quick Remove used to call the durable removal door directly and only then
   * ask whether the athlete wanted a replacement. That made Close look like an
   * undo even though the row was already gone. The row stays visible until one
   * of the two committing answers below is chosen.
   */
  const requestExerciseRemoval = React.useCallback((exercise: EditableExercise) => {
    setExerciseEditStep({ kind: 'decide_removal', exercise });
  }, []);

  const removeExerciseToday = React.useCallback(
    async (exercise: EditableExercise) => {
      if (!date) return;
      const result = await executeProgramControlActionDurably({
        type: 'remove_exercise',
        source: { screen: 'session_detail', surface: 'exercise_edit_sheet', initiatedBy: 'tap' },
        scope: 'today_only',
        payload: {
          date,
          exercise: exercise.name,
          exerciseId: exercise.targetId,
          derivedSource: exercise.derivedSource,
        },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: true,
      });
      if (result.ok) {
        if (result.traceId) {
          const componentId = exercise.targetId ?? exercise.key;
          const observationId = `day-workout-component-deletion:${result.traceId}`;
          registerAthleteActionUIOutcome({
            traceId: result.traceId,
            observationId,
            domainReturn: {
              ok: result.ok,
              date,
              componentId,
            },
            controlId: explorerTestId.componentDeleteResult(workout.id, componentId),
          });
          setPendingComponentDeletionObservation({
            traceId: result.traceId,
            observationId,
            componentId,
            targetId: exercise.targetId,
            exerciseKey: exercise.key,
          });
        }
        setExerciseEditStep({ kind: 'exclusion_scope', exercise });
        return;
      }
      setExerciseEditStep({
        kind: 'result',
        ok: false,
        title: 'Could not remove exercise',
        message: result.message ?? 'Nothing changed.',
      });
    },
    [date, workout.id],
  );

  const offerRemovedReplacement = React.useCallback((exercise: EditableExercise) => {
    const groups = swapGroupsFor(exercise);
    if (groups.length === 0) {
      setExerciseEditStep({
        kind: 'result',
        ok: false,
        title: 'No safe replacements',
        message: `${displayExerciseName(exercise.name)} is still in your session. Nothing was changed.`,
      });
      return;
    }
    setExerciseEditStep({ kind: 'choose_removal_replacement', exercise, groups });
  }, [swapGroupsFor]);

  const keepRemovedWithoutReplacement = React.useCallback(async (exercise: EditableExercise) => {
    await removeExerciseToday(exercise);
  }, [removeExerciseToday]);

  const addRemovedReplacement = React.useCallback(async (
    exercise: EditableExercise,
    suggestion: SuggestedSwap,
  ) => {
    if (!date || suggestion.kind !== 'exercise') return;
    const action = {
      type: 'swap_exercise' as const,
      source: { screen: 'session_detail' as const, surface: 'quick_remove_replacement', initiatedBy: 'tap' as const },
      scope: 'today_only' as const,
      payload: {
        date,
        fromExercise: exercise.name,
        fromExerciseId: exercise.targetId,
        toExercise: suggestion.suggestion,
        derivedSource: exercise.derivedSource,
      },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: true,
    };
    const result = await executeProgramControlActionDurably(action, { todayISO: date });
    if (result.ok) {
      setExerciseEditStep({
        kind: 'result',
        ok: true,
        title: 'Exercise replaced',
        message: `${displayExerciseName(exercise.name)} was replaced with ${displayExerciseName(suggestion.suggestion.name)} for today’s session.`,
      });
      return;
    }
    setExerciseEditStep({
      kind: 'result',
      ok: false,
      title: 'Could not replace exercise',
      message: result.message ?? 'The original exercise is still in your session.',
    });
  }, [date]);

  // Wrap derivation in try/catch so a thrown contract still produces a
  // failed marker with reason=contract-error instead of leaving the
  // screen silent.
  const smokeContract: DayWorkoutSmokeContractResult = React.useMemo(() => {
    try {
      return deriveDayWorkoutSmokeContract({
        workout,
        date,
        workoutId: routeWorkoutId,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[smoke-dayworkout-contract] derive-error ${(e as Error)?.message ?? String(e)}`,
      );
      return buildDayWorkoutSmokeContractErrorResult({
        error: e,
        date,
        workoutId: routeWorkoutId,
      });
    }
  }, [workout, date, routeWorkoutId]);

  React.useEffect(() => {
    if (!smokeCoachBikeFlow) return;
    // eslint-disable-next-line no-console
    console.warn(
      smokeContract.state === 'ready'
        ? `[smoke-dayworkout-contract] ready ${smokeContract.label}`
        : `[smoke-dayworkout-contract] failed ${smokeContract.label}`,
    );
  }, [smokeCoachBikeFlow, smokeContract.state, smokeContract.label]);

  // ── Missing-day fallback: BOTH resolvers must have a day, or neither speaks ──
  //
  // `workout` comes from `useResolvedDay` (the input state) and `detail` from
  // `useVisibleDay` (the projection). Two resolvers means their disagreement is
  // representable, and the first version of this screen substituted a blank title
  // for it (`detail?.headline ?? ''`) — an untitled session over a full row list,
  // with `accessibilityLabel` reading "Workout: ". That is a silent substitution
  // where the words are missing, which is the one thing this whole migration
  // exists to stop, and everywhere else in it a missing answer is loud. If the
  // projection has no day, the screen says so instead of drawing one.
  if (!workout || !detail) {
    return (
      <SafeAreaView style={styles.container}>
        {smokeCoachBikeFlow
          ? renderDayWorkoutSmokeContractMarkers(smokeContract)
          : null}
        <View style={styles.headerTopRow}>
          <IconButton
            onPress={handleBack}
            accessibilityLabel="Back"
            tone="default"
            icon={<ChevronLeft />}
          />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Workout not found</Text>
          <Text style={styles.emptyBody}>
            Go back and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  // ── Title + metadata: the projection speaks, the screen renders ──
  //
  // TASK 6. All three of these used to be composed here at render:
  // `deriveVisibleWorkoutIdentity(workout).title` re-derived a name from
  // `workout.name`; the subtitle pasted the raw internal `workout.workoutType`
  // onto the glass (and hand-wrote `+ Conditioning`); the count picked one of
  // four branches off `composeDayDetail`'s booleans. Now the title is
  // `SignedCopy` from `projectDayDetail` and the count is read off the list the
  // athlete can actually count.
  //
  // Non-null past the guard above — no fallback, nothing substituted.
  const visibleWorkoutTitle: string = detail.headline;

  //
  // AND THE ATTACHED-PART FRAGMENT IS GONE (2026-08-08, Sam's compound-bucket
  // ruling). It used to join `detail.attached` on a `' + '` literal written
  // right here — a screen choosing athlete-visible punctuation. The title now
  // names every bucket the day holds, so that fragment could only ever repeat
  // one of the words above it; the separator it invented lives in the signed
  // sheet, and the projection does the joining. See `visibleDayDetail.ts`.

  /* ── THE DATE LINE IS GONE, AND START SESSION HAS ITS PLACE ─────────────
   *
   * ⚠ **SAM, 2026-08-25 (R-214): *"can we remove the calendar icon, the Tue 25/8
   * - 8 exercises, then put the start session button in its place?"*** This
   * SUPERSEDES R-116, whose four passes aligned that calendar glyph against that
   * date text, and it moves R-132's stopwatch from the right of the line to the
   * left of it. Both are superseded deliberately: the line's own content is what
   * he removed, not its geometry.
   *
   * ⚠ **AND IT RETIRES THE COUNT RATHER THAN FIXING IT.** The subtitle read
   * `8 exercises` for a session of 8 strength rows and a 4-movement warm-up,
   * because `sessionListLabels` numbers the TEMPLATE and the warm-up is derived
   * beside it — the same "every surface must remember to ask about the warm-up"
   * defect R-213 closes at the flow owner. Sam ruled the warm-up SHOULD count
   * (2026-08-25) and then removed the line that showed the number. A corrected
   * count with no reader would be exactly the dead weight this repo keeps
   * paying for, so the count is deleted with its surface. If a count returns
   * anywhere, it counts the execution plan — the one list that already holds
   * both — and not the template.
   */
  const sessionOptionsAvailable = Boolean(
    date && !isTeamOnly && editableExercises.length > 0
      && !isFinished && !isAlreadyComplete,
  );

  return (
    <SafeAreaView style={styles.container} testID="workout-screen">
      <ExplorerRenderWitness testID={explorerTestId.sessionDetail(workout.id)} />
      {editableExercises.map((exercise) => (
        <ExplorerRenderWitness
          key={`component-identity-${exercise.key}`}
          testID={explorerTestId.componentIdentity(
            workout.id,
            exercise.targetId ?? exercise.key,
          )}
        />
      ))}
      {/*
        Top-of-screen mirror of the contract markers, mounted as a
        sibling of the header. The IDENTICAL markers also render
        beside day-workout-title below so they share that title's
        gate. Either path proves the marker can reach Maestro; if
        BOTH paths fail something is fundamentally wrong with the
        screen render itself (caught upstream by day-workout-title's
        own visibility assertion).
        NOTE: only ONE set of testIDs will be visible at a time —
        React Native's hit-test resolves to whichever is on top in
        the layout. The inline-with-title set is the canonical one;
        this top-level mirror exists purely as a redundancy.
        Actually, the two sets would create duplicate testIDs which
        Maestro treats as "ambiguous match" → fails the assertVisible.
        Drop this top-level mirror; the inline marker is sufficient.
      */}
      {/* ─── Sticky header ─── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <IconButton
            onPress={handleBack}
            accessibilityLabel="Back"
            tone="default"
            icon={<ChevronLeft />}
          />
        </View>
        <View style={styles.headerContent}>
          <LfaWordmark testID="day-workout-title" />
          {/*
            DayWorkout smoke contract markers — mounted in the EXACT
            same render path as day-workout-title (sibling inside the
            same headerContent View) so they share its render gate.
            Maestro asserts:
              assertVisible smoke-dayworkout-contract-mounted
              assertVisible smoke-dayworkout-contract-ready
              assertNotVisible smoke-dayworkout-contract-failed
            If day-workout-title rendered but the markers below didn't,
            the only explanation is a runtime exception between the
            two — which the React error boundary would surface anyway.
            The renderer NEVER returns null and ALWAYS emits the
            mounted marker, so no silent state is possible.
          */}
          {smokeCoachBikeFlow
            ? renderDayWorkoutSmokeContractMarkers(smokeContract)
            : null}
          {/* ⚠ **THE ROW IS GATED ON THE DATE, NOT ON A SUBTITLE (R-214).** It
            * used to be gated on `combinedSubtitle`, so deleting the words
            * would have taken Start session and the options dots with them —
            * the row's REASON to exist is that this is a dated session the
            * athlete can start, which is precisely what `date` says. */}
          {date ? (
            <View style={styles.headerSubtitleRow}>
              {/* R-132 (Sam, 2026-08-23) placed the stopwatch on this line;
                * R-214 moved it to the line's LEFT, into the space the date
                * vacated. State still lives in its own persisted store, so
                * leaving the screen or the app never loses the count. */}
              <SessionStopwatchControl workoutId={workout.id} dateISO={date} />
              <View style={styles.sessionHeaderActions}>
                {sessionOptionsAvailable ? (
                  <Pressable
                    onPress={() => setSessionOptionsVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={signedCopy('plan_change.session_options')}
                    testID="session-options-button"
                    hitSlop={12}
                    style={({ pressed }) => [
                      styles.sessionOptionsButton,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <MaterialCommunityIcons name="dots-horizontal" size={22} color="#B5B5B5" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
          {/* ⚠ **THE THREE UNLABELLED HEADER ICONS STAY DELETED — SAM, 2026-08-19.**
            *
            * The compact dots are ONE labelled Session options doorway, not
            * those three ambiguous direct actions returning to the header.
            *
            * A plus, a dumbbell and a plaster in the sticky header, each opening
            * a different change flow, and nothing on the screen said which was
            * which. The equipment one also came and went with
            * `sessionEquipmentRequirements`, so the row silently changed shape
            * between sessions. R-209 replaces the later card with one labelled
            * menu behind the dots; the three established handlers stay put. */}
        </View>
      </View>

      {/*
        The whole day scroll routes through the shared keyboard owner so the
        inline weight editor's numeric keypad gets the one Done bar and
        scroll-into-view (census finding #9). `dismissOnBackgroundTap` is off —
        the body is a tappable session list, not a form. Device-verify (L10).
      */}
      <KeyboardSafeArea
        style={styles.scroll}
        dismissOnBackgroundTap={false}
        scrollProps={{
          contentContainerStyle: styles.scrollContent,
          showsVerticalScrollIndicator: false,
          onScrollBeginDrag: handleScrollBeginDrag,
        }}
      >
        {/* Stale override warning */}
        {staleWarning ? (
          <View style={styles.banner}>
            <StaleOverrideBanner warning={staleWarning} />
          </View>
        ) : null}

        {/* ── R-124: ONE LINE, NOT FIVE GREYED-OUT CARDS ────────────────────
          *
          * Sam, 2026-08-21: *"The five paused exercises … disappear from the
          * active workout after Apply. Do not show five greyed-out SKIP cards.
          * On the active session, show one concise summary such as: '5
          * lower-body exercises paused for your knee. Today's session has been
          * adjusted to safe upper-body and core work.'"*
          *
          * ⚠ **THE SENTENCE IS DERIVED, NOT WRITTEN HERE.** Every word of it
          * comes from `workout.injuryAdjustment.summary`, which
          * `utils/injurySessionAdjustment` composes from what actually happened
          * to the rows — the count, the half of the body, the athlete's own word
          * for the area, and whether anything was really added. A line written
          * on the glass would be a second, un-derived claim, which is the shape
          * of defect this whole injury unit exists to delete. */}
        {workout.injuryAdjustment ? (
          <View style={styles.injuryAdjustmentNotice} testID="session-injury-adjustment">
            <Text style={styles.injuryAdjustmentText}>
              {workout.injuryAdjustment.summary}
            </Text>
          </View>
        ) : null}

        {/* Coach-authored attribution — ONE concise sentence at most, plus
            an optional "Show changes" disclosure for the audit log. The
            severity-aware tail comes from activeConstraints; the per-
            exercise removed/replaced/focus list is hidden by default. */}
        <CoachNoteBanner
          notes={workout.coachNotes ?? []}
          workoutName={visibleWorkoutTitle}
          workoutType={workout.workoutType}
        />

        {/* ── THE TYPED GAP, ON GLASS ────────────────────────────────────────
            Sam's approved Block Two contract: *"If the exclusion makes the
            pattern impossible, disclose the gap rather than restoring the
            exercise."* `composedGaps` has been carried from the composer to
            the workout, through assembly, and through boot regeneration since
            2026-08-14 — and NOTHING RENDERED IT, so a slot the athlete's own
            exclusion emptied simply came out of the session with no account of
            itself. That is the "carry" half done and the "display" half
            missing. */}
        <ComposedGapNotice gaps={workout.composedGaps ?? []} />

        {/* Session description (rare — usually null) */}
        {workout.description ? (
          <Text
            style={styles.sessionDescription}
            testID="day-workout-description"
          >
            {workout.description}
          </Text>
        ) : null}

        {/*
          ── The session body ──

          D13: the session is ONE list. `buildSessionTemplate` is the single
          composition owner — it reads the whole workout once and emits every
          applicable row in D2 order, each carrying its role badge. The screen
          no longer decides what to mount; it renders what the owner returned.

          This is why team training can no longer go missing on a conditioning
          day (spec §2 item 4c): there is no branch left that could swallow it.

          Standalone Mobility and Recovery rows use this same composition and
          card owner. Their load-neutral classification does not select a
          different visual template.
        */}
        <>
            {executionPlan?.sections.filter((section) =>
              section.id === 'mobility'
              && section.items.every((item) => item.source === 'mobility')).map((section) => (
              <SessionExecutionSection
                key={section.id}
                section={section}
                completedItemIds={completedExerciseIds}
                onQuickAdd={quickAddFor(section.id)}
              >
                <MobilityExerciseList
                  flow={mobilityFlow}
                  completedItemIds={completedExerciseIds}
                  onToggleItem={toggleExerciseComplete}
                  expandedCues={expandedCues}
                  toggleCue={toggleCue}
                  editingWeightId={editingWeightId}
                  editingWeightText={editingWeightText}
                  setEditingWeightText={setEditingWeightText}
                  formatWeight={formatWeight}
                  getLoadControlMode={getLoadControlMode}
                  incrementWeight={incrementWeight}
                  decrementWeight={decrementWeight}
                  incrementBandResistance={incrementBandResistance}
                  decrementBandResistance={decrementBandResistance}
                  startEditingWeight={startEditingWeight}
                  commitWeightEdit={commitWeightEdit}
                  onSelectExercise={setSelectedExercise}
                  onQuickSwap={quickSwapExercise}
                  onQuickRemove={requestExerciseRemoval}
                />
              </SessionExecutionSection>
            ))}
            <SessionList
              items={sessionTemplate.items}
              executionPlan={executionPlan!}
              quickAddFor={quickAddFor}
              completedItemIds={completedExerciseIds}
              onToggleItem={toggleExerciseComplete}
              implementFor={implementFor}
              availableEquipment={effectiveKitTags}
              expandedCues={expandedCues}
              toggleCue={toggleCue}
              editingWeightId={editingWeightId}
              editingWeightText={editingWeightText}
              setEditingWeightText={setEditingWeightText}
              formatWeight={formatWeight}
              getLoadControlMode={getLoadControlMode}
              incrementWeight={incrementWeight}
              decrementWeight={decrementWeight}
              incrementBandResistance={incrementBandResistance}
              decrementBandResistance={decrementBandResistance}
              startEditingWeight={startEditingWeight}
              commitWeightEdit={commitWeightEdit}
              onSelectExercise={setSelectedExercise}
              onQuickSwap={quickSwapExercise}
              onQuickRemove={requestExerciseRemoval}
            />
            {/**
              * SELECT ALL — Sam, 2026-08-22: *"There should be a Select all
              * button on session view - just below the last exercise box for
              * the day ... with the check box in line with the other check
              * boxes of the session but just below them all"*.
              *
              * So it is a ROW, not a button: the same 18x18 box with the same
              * 44x44 target, on the same right-hand line every row's tick sits
              * on, reading the same tick when it is on. A pill or a text link
              * here would be a different control claiming to do the same job.
              */}
            {selectableItemIds.length > 0 ? (
              <Pressable
                onPress={toggleSelectAll}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allSelected }}
                accessibilityLabel={allSelected ? signedCopy('session.clear_all') : signedCopy('session.select_all')}
                testID="session-execution-select-all"
                style={({ pressed }) => [
                  styles.selectAllRow,
                  pressed && { opacity: 0.65 },
                ]}
              >
                <Text style={styles.selectAllLabel}>{signedCopy('session.select_all')}</Text>
                <View
                  style={[
                    styles.executionCheckbox,
                    allSelected && styles.executionCheckboxComplete,
                  ]}
                >
                  {allSelected ? <Text style={styles.executionCheckmark}>✓</Text> : null}
                </View>
              </Pressable>
            ) : null}
        </>

        {/* ── Reopen of a completed session → read-only summary ── */}
        {isAlreadyComplete && date ? (
          <View style={styles.feedbackSection}>
            <SessionCompleteMoment
              date={date}
              receipt={persistedReceipt}
              headline="Session complete"
            />
          </View>
        ) : null}

        {/* ── Finish moment (hidden once the session is complete) ── */}
        {!isFinished && !isAlreadyComplete ? (
          <FinishMoment onPress={handleFinishWorkout} />
        ) : null}
      </KeyboardSafeArea>

      {/* ⚠ **THE CELEBRATION WAS RENDERING BELOW THE FOLD — Sam, 2026-08-27**:
          *"the completion badge thing that pops up can't be seen on screen - it
          pops up hidden for a second or two then snaps back to day view"*.
          It was the LAST CHILD OF THE SESSION LIST, so on any session longer
          than a screen it appeared under everything the athlete was looking at,
          held for 2.5s, and the screen closed. It is an overlay now — the same
          `Sheet` every other moment in this app uses — so it is on top of the
          list, at a fixed place, for the whole beat before the screen closes.
          The reopen-a-completed-session SUMMARY above stays inline: that is a
          record to scroll to, not a moment to catch. */}
      <Sheet
        visible={!!(isFinished && date && justSaved)}
        onClose={() => {}}
        dismissable={false}
        testID="session-complete-moment-sheet"
      >
        {date ? (
          <SessionCompleteMoment date={date} receipt={savedFeedbackReceipt} />
        ) : null}
      </Sheet>

      <Sheet
        visible={sessionOptionsVisible}
        onClose={() => setSessionOptionsVisible(false)}
        testID="session-options-sheet"
      >
        <SheetHeader
          title={signedCopy('plan_change.session_options')}
          subtitle={signedCopy('session.change_card.heading')}
        />
        <View>
          <SessionOptionsRow
            label={signedCopy('session.options.injury.label')}
            sub={signedCopy('session.options.injury.subline')}
            icon={sessionChangeGlyph('injury')}
            iconTint={ACTION_TINT.injury}
            testID="session-options-injury"
            onPress={() => {
              setSessionOptionsVisible(false);
              openSessionInjuryFlow();
            }}
          />
          {sessionEquipmentRequirements.length > 0 ? (
            <SessionOptionsRow
              label={signedCopy('session.options.equipment.label')}
              sub={signedCopy('session.options.equipment.subline')}
              icon={sessionChangeGlyph('equipment')}
              iconTint={ACTION_TINT.equipment}
              testID="session-options-equipment"
              onPress={() => {
                setSessionOptionsVisible(false);
                openSessionEquipment();
              }}
            />
          ) : null}
          {/* ⚠ **THE ADD ROW IS GONE FROM THIS MENU — SAM, 2026-08-25 (R-217):
            * *"it will replace the 'add an exercise' option in the 3 dot menu
            * in the top right corner"*.**
            *
            * It is REPLACED, not duplicated: the section plus knows which
            * section it adds to, and this row could only ever ask that question
            * again as its first step. Two doors to one flow, one of which has
            * to ask something the other already answered, is the shape this
            * screen keeps paying for. `openExerciseAdd` — the level-1 opener
            * this row was the only caller of — went with it. */}
          <Button
            label="Back"
            variant="ghost"
            size="md"
            glow={false}
            onPress={() => setSessionOptionsVisible(false)}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </Sheet>

      {/**
        * THE SESSION FEEDBACK FORM IS A POP-UP — Sam, 2026-08-22: *"instead of
        * opening up like it does currently it should be the same as the log
        * team training pop up"*.
        *
        * It used to expand INLINE, pushing the session list up the scroll, so
        * the athlete answered questions underneath the work they were
        * answering about. Club training's form is a sheet; two feedback forms
        * on the same day opening two different ways is the kind of difference
        * nobody can justify later.
        */}
      <Sheet
        visible={isFinished && !justSaved && !!date}
        onClose={handleCancelFeedback}
        testID="session-feedback-sheet"
        /* Longest of the three forms and the only one that could not scroll:
           a full checklist summary, an effort slider, a duration, a note and a
           Save button. The game form proved this on the simulator — its button
           sat below the fold with no way to reach it. */
        cappedBody
      >
        {/**
          * ⚠ **THE HEADER IS THE SHEET'S — AND THIS IS THE RULING THAT SAID SO,
          * NOT A REVERSAL OF IT.** Sam, 2026-08-22: *"The subtitle under 'log
          * session' in this pop up can be removed as well"*, then *"make sure
          * that the team training feedback, game feedback, and programmed
          * session feedback pop ups are all the same style"*.
          *
          * There were TWO headings, and removing this one left the panel's own
          * — an eyebrow, a title and the same grey sentence, authored as
          * literals in the panel. The panel's is the one that has now gone, so
          * the athlete still sees exactly one heading, and it is the same
          * heading the other two forms wear, from the same signed rows.
          */}
        <SheetHeader
          title={signedCopy('feedback.sheet.label_session')}
          subtitle={signedCopy('feedback.sheet.question')}
        />
        <ScrollView
          style={styles.feedbackSheetBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {date ? (
            <SessionFeedbackPanel
              date={date}
              workout={workout}
              executionSummary={executionSummary}
              onSave={handleFeedbackSaved}
            />
          ) : null}
        </ScrollView>
      </Sheet>

      <ExerciseVideoModal
        visible={!!selectedExercise}
        exerciseName={selectedExercise || ''}
        onClose={() => setSelectedExercise(null)}
      />

      <ExerciseEditSheet
        visible={exerciseEditStep.kind !== 'closed'}
        sessionId={workout.id}
        step={exerciseEditStep}
        editableExercises={editableExercises}
        onClose={closeExerciseEditor}
        onStep={setExerciseEditStep}
        onSwapPick={prepareSwap}
        onApplyInjuryReview={applySessionInjuryReview}
        onApplySwapToday={applySwapToday}
        onApplyAddToday={applyAddToday}
        onRemoveToday={removeExerciseToday}
        onOfferRemovedReplacement={offerRemovedReplacement}
        onKeepRemovedWithoutReplacement={keepRemovedWithoutReplacement}
        onAddRemovedReplacement={addRemovedReplacement}
        onAddFamily={openAddFamily}
        onAddGroup={openAddGroup}
        onAddLeaf={openAddLeaf}
        onFutureScope={saveFutureExerciseAdjustment}
        onTodayOnly={closeFutureScopeTodayOnly}
        onExclusionScope={applyExclusionScope}
      />
      <SessionEquipmentSheet
        visible={sessionEquipmentVisible}
        requirements={sessionEquipmentRequirements}
        onClose={() => setSessionEquipmentVisible(false)}
        onApply={applySessionEquipment}
      />
      <GuidedInjuryFlowSheet
        visible={injuryFlowOpen}
        onClose={() => setInjuryFlowOpen(false)}
        onComplete={reviewSessionInjury}
        titlePrefix="Injury"
      />

      {/* ── UNDO, ON THE SURFACE THE CHANGE WAS MADE ON (R-107) ────────────
        *
        * Sam, 2026-08-20: *"Keep the athlete on the current screen. Undo must
        * appear on whichever screen initiated the change, including inside the
        * active session. Do not send them back to the Day page."*
        *
        * **THE FIVE LABELLED CHANGES LIVE HERE, SO THEIR UNDO DOES TOO.** Until
        * this line, `UndoToast` mounted only on the Program screen, so every
        * Equipment / Injury / Add / Remove / Swap made inside a session raised
        * its toast on the screen BEHIND this one and expired unseen. Six
        * seconds, on a screen the athlete was not looking at.
        *
        * ⚠ **THIS IS NOT A SECOND TOAST.** The component renders nothing unless
        * its own screen is focused and keeps its seen-marker current while it
        * is not, so exactly one is ever visible and one action produces one
        * toast, once. That guard is inside `UndoToast`, not here — see its
        * header for why the rule lives with the component rather than at each
        * call site.
        *
        * It sits OUTSIDE `KeyboardSafeArea`, last, so it draws over the session
        * rather than inside the scrolling content — and absolutely positioned,
        * so it takes part in no layout. */}
      <UndoToast />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/**
 * DayWorkout smoke contract markers — mounted directly in the same
 * render path as testID="day-workout-title" so the markers and the
 * title share the exact same gate. Maestro's order is:
 *   1. assertVisible day-workout-title
 *   2. assertVisible smoke-dayworkout-contract-mounted
 *   3. assertVisible smoke-dayworkout-contract-ready
 *   4. assertNotVisible smoke-dayworkout-contract-failed
 *
 * Renders THREE markers (no silent state allowed):
 *   • smoke-dayworkout-contract-mounted — always renders in smoke
 *     mode, regardless of workout / derivation. Proves the mount
 *     point reached the live UI tree.
 *   • smoke-dayworkout-contract-ready   — only when result.state === 'ready'.
 *   • smoke-dayworkout-contract-failed  — only when result.state === 'failed'.
 *
 * All markers use real native Views with collapsable={false}, real
 * backgroundColor, ≥30×30 px, MAX-INT zIndex/elevation.
 */
function renderDayWorkoutSmokeContractMarkers(
  result: DayWorkoutSmokeContractResult,
) {
  const isReady = result.state === 'ready';
  return (
    <View
      accessible={false}
      collapsable={false}
      pointerEvents="none"
      style={styles.smokeContractMarkerRoot}
      testID="smoke-dayworkout-contract-root"
    >
      {/* Mount probe — proves the render path reached this JSX. */}
      <View
        accessible={true}
        accessibilityLabel={`smoke-dayworkout-contract-mounted ${result.label}`}
        collapsable={false}
        pointerEvents="none"
        style={styles.smokeContractMounted}
        testID="smoke-dayworkout-contract-mounted"
      >
        <Text style={styles.smokeContractMarkerText}>
          {`smoke-dayworkout-contract-mounted ${result.label}`}
        </Text>
      </View>
      {isReady ? (
        <View
          accessible={true}
          accessibilityLabel={result.label}
          collapsable={false}
          pointerEvents="none"
          style={[styles.smokeContractMarker, styles.smokeContractReady]}
          testID="smoke-dayworkout-contract-ready"
        >
          <Text style={styles.smokeContractMarkerText}>{result.label}</Text>
        </View>
      ) : (
        <View
          accessible={true}
          accessibilityLabel={result.label}
          collapsable={false}
          pointerEvents="none"
          style={[styles.smokeContractMarker, styles.smokeContractFailed]}
          testID="smoke-dayworkout-contract-failed"
        >
          <Text style={styles.smokeContractMarkerText}>{result.label}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * CoachNoteBanner — single concise sentence at the top of the screen.
 *
 * Why this exists:
 *   The engine's coachNotes are an audit log: "Removed Back Squat",
 *   "Replaced Deadlift with Goblet Squat", "Focus: Upper body". Pre-MVP
 *   we rendered every line. The result was a wall of bullets the
 *   athlete had to scan before starting the warm-up — exactly the kind
 *   of overwhelm the App Store rejection callout flagged.
 *
 *   Now we collapse N notes into ONE summary line. If the engine
 *   emitted a restriction/rule note, we show that concise note by
 *   default. Generic adjustment flags are intentionally hidden.
 *
 *   Detail lines (the original audit log) sit behind a "Show changes"
 *   toggle for the curious athlete or QA — they're not removed, just
 *   hidden by default.
 */
/**
 * THE TYPED GAP THE ATHLETE ACTUALLY READS.
 *
 * Sam's approved Block Two contract, on an exclusion with no legal replacement:
 * *"If the exclusion makes the pattern impossible, disclose the gap rather than
 * restoring the exercise."* The composer has been producing that disclosure for
 * weeks and it reached the workout, survived assembly and survived boot — and
 * then stopped, because nothing rendered it.
 *
 * ⚠ **IT SPEAKS FOR BOTH CAUSES, AND THAT IS DELIBERATE.** Filtering to
 * `cause === 'exclusion'` would leave a kit-caused hole exactly as silent as
 * this one was, which is the same defect with a different owner. One renderer,
 * one disclosure, and the SENTENCE branches on the cause — because the two have
 * different answers: a kit gap is fixed by equipment, an exclusion gap only by
 * the athlete restoring what they took out.
 *
 * No new colour token and no new font size — it borrows the coach-note banner's
 * own styles, which are already on this screen.
 */
function ComposedGapNotice({ gaps }: { gaps: readonly ComposedGap[] }) {
  if (gaps.length === 0) return null;
  const excluded = gaps.filter((gap) => gap.cause === 'exclusion');
  const kit = gaps.filter((gap) => gap.cause === 'kit');
  const lines: string[] = [];
  for (const gap of gaps.filter((gap) => gap.cause === 'already_on_day')) {
    lines.push(`No extra ${slotWordFor(gap.slot)} today — the available exercises are already in this session.`);
  }
  for (const gap of excluded) {
    // NOT a bare `.map(displayExerciseName)` — `map` passes the INDEX as its
    // second argument and that helper's second parameter is a fallback string.
    const names = (gap.excludedHere ?? []).map((name) => displayExerciseName(name));
    lines.push(names.length > 0
      ? `No ${slotWordFor(gap.slot)} today — you've left ${listWords(names)} out. Restore it in My Status to get this back.`
      : `No ${slotWordFor(gap.slot)} today — everything that trains it is currently left out.`);
  }
  for (const gap of kit) {
    lines.push(gap.wouldNeed
      ? `No ${slotWordFor(gap.slot)} today — that would need ${gap.wouldNeed}.`
      : `No ${slotWordFor(gap.slot)} today — your kit can't train it.`);
  }
  return (
    <View style={styles.coachNotesBanner} testID="composed-gap-notice">
      <Text style={styles.coachNotesEyebrow}>WHAT'S MISSING</Text>
      {lines.map((line) => (
        <Text key={line} style={styles.coachNotesText} testID="composed-gap-line">
          {line}
        </Text>
      ))}
    </View>
  );
}

/** A slot id in the athlete's words. Unknown slots fall back to their own id. */
function slotWordFor(slot: string): string {
  return String(slot).replace(/_/g, ' ');
}

function listWords(values: readonly string[]): string {
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function CoachNoteBanner({
  notes,
  workoutName,
  workoutType,
}: {
  notes: string[];
  workoutName?: string;
  workoutType?: string;
}) {
  const [showDetails, setShowDetails] = React.useState(false);

  const summary = getCoachNoteDisplay(notes, { workoutName, workoutType });
  if (!summary.summaryLine) return null;
  const hasDetails = summary.shouldShowDetails;

  return (
    <View style={styles.coachNotesBanner} testID="coach-note-banner">
      <Text style={styles.coachNotesEyebrow}>COACH UPDATE</Text>
      <Text
        style={styles.coachNotesText}
        numberOfLines={2}
        ellipsizeMode="tail"
        testID="coach-note-banner-line"
      >
        {summary.summaryLine}
      </Text>

      {hasDetails && (
        <Pressable
          onPress={() => setShowDetails((v) => !v)}
          style={styles.coachNotesToggle}
          testID="coach-note-banner-toggle"
          hitSlop={8}
        >
          <Text style={styles.coachNotesToggleText}>
            {showDetails ? 'Hide changes' : 'Show changes'}
          </Text>
        </Pressable>
      )}

      {showDetails && hasDetails && (
        <View style={styles.coachNotesDetails} testID="coach-note-banner-details">
          {summary.detailLines.map((line, i) => (
            <Text
              key={`coach-detail-${i}`}
              style={styles.coachNotesDetailLine}
            >
              • {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * The one list.
 *
 * Every item the composition owner emitted, rendered in the order it emitted
 * them. There are no section headers and no boxes: what separates one row from
 * the next is whitespace, exactly as the flat exercise list already did.
 *
 * The only grouping left is the superset rail — a pairing is a real
 * prescription fact ("do these back to back"), not decoration, so consecutive
 * members of one group are wrapped in the existing lime rail. Every other
 * structural device the screen used to draw was a category header, and
 * categories are now carried by each row's own badge.
 */
interface SessionListProps {
  items: SessionTemplateItem[];
  executionPlan: SessionExecutionPlan;
  completedItemIds: ReadonlySet<string>;
  onToggleItem: (itemId: string) => void;
  /** R-104. Resolved by the screen against the EFFECTIVE kit for this date. */
  implementFor: (exerciseName: string, prescribedWeightKg?: number | null) => SelectedImplementToday;
  /** The same effective dated kit, used only for cue-required apparatus. */
  availableEquipment: readonly EquipmentTag[];
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
  editingWeightId: string | null;
  editingWeightText: string;
  setEditingWeightText: (s: string) => void;
  formatWeight: (ex: any, selectedImplement?: string | null) => string;
  getLoadControlMode: (ex: any, selectedImplement?: string | null) => LoadControlMode;
  incrementWeight: (ex: any, selectedImplement?: string | null) => void;
  decrementWeight: (ex: any, selectedImplement?: string | null) => void;
  incrementBandResistance: (ex: any) => void;
  decrementBandResistance: (ex: any) => void;
  startEditingWeight: (ex: any) => void;
  commitWeightEdit: () => void;
  onSelectExercise: (name: string) => void;
  onQuickSwap: (exercise: EditableExercise) => void;
  onQuickRemove: (exercise: EditableExercise) => void;
  /** R-217 — the section's quick-add tap, or `null` where nothing is legal. */
  quickAddFor: (sectionId: SessionExecutionSectionId) => (() => void) | null;
}

/**
 * Mobility is a derived D17 prescription, but its execution UI is not a second
 * kind of exercise. Adapt each selected pool movement into the row contract
 * that Strength already owns, then use the exact same checklist and exercise
 * card components. This keeps prescription, cues, load entry and video action
 * aligned without pretending derived movements can use the program mutation
 * doors owned by stored workout rows.
 */
function MobilityExerciseList({
  flow,
  completedItemIds,
  onToggleItem,
  expandedCues,
  toggleCue,
  editingWeightId,
  editingWeightText,
  setEditingWeightText,
  formatWeight,
  getLoadControlMode,
  incrementWeight,
  decrementWeight,
  incrementBandResistance,
  decrementBandResistance,
  startEditingWeight,
  commitWeightEdit,
  onSelectExercise,
  onQuickSwap,
  onQuickRemove,
}: {
  flow: MobilityPrehabFlow | null;
  completedItemIds: ReadonlySet<string>;
  onToggleItem: (itemId: string) => void;
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
  editingWeightId: string | null;
  editingWeightText: string;
  setEditingWeightText: (value: string) => void;
  formatWeight: (exercise: any, selectedImplement?: string | null) => string;
  getLoadControlMode: (exercise: any, selectedImplement?: string | null) => LoadControlMode;
  incrementWeight: (exercise: any, selectedImplement?: string | null) => void;
  decrementWeight: (exercise: any, selectedImplement?: string | null) => void;
  incrementBandResistance: (exercise: any) => void;
  decrementBandResistance: (exercise: any) => void;
  startEditingWeight: (exercise: any) => void;
  commitWeightEdit: () => void;
  onSelectExercise: (name: string) => void;
  onQuickSwap: (exercise: EditableExercise) => void;
  onQuickRemove: (exercise: EditableExercise) => void;
}) {
  if (!flow) return null;

  return (
    <View style={styles.exerciseList} testID="mobility-prehab-flow">
      {flow.movements.map(({ exercise }, index) => {
        const itemId = `mobility:${exercise.id}`;
        const row = {
          id: itemId,
          exerciseId: itemId,
          prescribedSets: exercise.sets,
          prescribedRepsMin: exercise.repsMin,
          prescribedRepsMax: exercise.repsMax,
          prescribedWeightKg: null,
          prescriptionType: exercise.prescriptionType,
          perSide: exercise.perSide,
          restSeconds: exercise.restSeconds,
          exercise: {
            id: exercise.id,
            name: exercise.name,
            description: exercise.notes,
            equipmentRequired: exercise.equipment,
          },
        };
        return (
          <ExecutionChecklistItem
            key={itemId}
            itemId={itemId}
            label={exercise.name}
            completed={completedItemIds.has(itemId)}
            onToggle={onToggleItem}
          >
            {(checkbox) => (
            <StrengthExerciseCard
              exercise={row}
              checkbox={checkbox}
              label={`${index + 1}`}
              isGrouped={false}
              prescriptionLabel={mobilityFlowMovementDose(exercise)}
              cueTextOverride={exercise.notes}
              expandedCues={expandedCues}
              toggleCue={toggleCue}
              editingWeightId={editingWeightId}
              editingWeightText={editingWeightText}
              setEditingWeightText={setEditingWeightText}
              formatWeight={formatWeight}
              getLoadControlMode={getLoadControlMode}
              incrementWeight={incrementWeight}
              decrementWeight={decrementWeight}
              incrementBandResistance={incrementBandResistance}
              decrementBandResistance={decrementBandResistance}
              startEditingWeight={startEditingWeight}
              commitWeightEdit={commitWeightEdit}
              onSelectExercise={onSelectExercise}
              quickExercise={editableExerciseForRow(row, {
                kind: 'mobility_flow', id: itemId,
              })!}
              onQuickSwap={onQuickSwap}
              onQuickRemove={onQuickRemove}
            />
            )}
          </ExecutionChecklistItem>
        );
      })}
    </View>
  );
}

function SessionList({
  items,
  executionPlan,
  completedItemIds,
  onToggleItem,
  implementFor,
  availableEquipment,
  expandedCues,
  toggleCue,
  editingWeightId,
  editingWeightText,
  setEditingWeightText,
  formatWeight,
  getLoadControlMode,
  incrementWeight,
  decrementWeight,
  incrementBandResistance,
  decrementBandResistance,
  startEditingWeight,
  commitWeightEdit,
  onSelectExercise,
  onQuickSwap,
  onQuickRemove,
  quickAddFor,
}: SessionListProps) {
  if (items.length === 0) return null;

  // Numbers are a property of the LIST, not of a row — a superset takes one
  // slot however its members are ordered — so they are computed once, up here.
  const labels = sessionListLabels(items);

  const renderItem = (
    item: SessionTemplateItem, key: string, index: number, checkbox?: React.ReactNode,
  ) => {
    if (item.kind === 'team_training') {
      return <TeamTrainingRow key={key} checkbox={checkbox} />;
    }
    /* ⚠ **CONDITIONING TAKES THE CHECKBOX TOO — Sam, 2026-08-27**: *"there's no
       checkbox for the conditioning section like there is for all the exercises
       above it"*. The checklist ALREADY made one for these rows — every
       execution item is wrapped in `ExecutionChecklistItem`, which builds a
       checkbox and hands it to `renderItem` — and these two branches were
       simply dropping the argument on the floor. So the tick was never missing
       from the model, only from the glass: `completedItemIds`, the section's
       `0/1`, Select all and the saved receipt were all already counting a row
       the athlete had no way to tick. */
    if (item.kind === 'conditioning_choice') {
      return (
        <ConditioningChoiceRow
          key={key}
          options={item.options}
          checkbox={checkbox}
          onQuickSwap={onQuickSwap}
          onQuickRemove={onQuickRemove}
        />
      );
    }
    if (item.presentation === 'conditioning_phase') {
      return (
        <ConditioningPhaseRow
          key={key}
          exercise={item.row}
          modalityLabel={item.modalityLabel}
          checkbox={checkbox}
          onQuickSwap={onQuickSwap}
          onQuickRemove={onQuickRemove}
        />
      );
    }
    if (item.presentation === 'addon') {
      return (
        <AddonRow
          key={key}
          exercise={item.row}
          expandedCues={expandedCues}
          toggleCue={toggleCue}
          onQuickSwap={onQuickSwap}
          onQuickRemove={onQuickRemove}
        />
      );
    }
    const isLowLoad = item.presentation === 'mobility' || item.presentation === 'recovery';
    return (
      <StrengthExerciseCard
        key={key}
        exercise={item.row}
        checkbox={checkbox}
        selectedImplement={implementFor(item.row.exercise?.name ?? '', item.row.prescribedWeightKg)}
        availableEquipment={availableEquipment}
        label={labels[index] ?? ''}
        isGrouped={!!item.superset}
        prescriptionLabel={isLowLoad ? formatLowLoadSetsReps(item.row) : undefined}
        cueTextOverride={item.presentation === 'mobility'
          ? cleanNotes(item.row?.notes ?? item.row?.exercise?.description)
          : undefined}
        isLastInGroup={
          !item.superset || item.superset.index === item.superset.size - 1
        }
        expandedCues={expandedCues}
        toggleCue={toggleCue}
        editingWeightId={editingWeightId}
        editingWeightText={editingWeightText}
        setEditingWeightText={setEditingWeightText}
        formatWeight={formatWeight}
        getLoadControlMode={getLoadControlMode}
        incrementWeight={incrementWeight}
        decrementWeight={decrementWeight}
        incrementBandResistance={incrementBandResistance}
        decrementBandResistance={decrementBandResistance}
        startEditingWeight={startEditingWeight}
        commitWeightEdit={commitWeightEdit}
        onSelectExercise={onSelectExercise}
        quickExercise={editableExerciseForRow(item.row)!}
        onQuickSwap={onQuickSwap}
        onQuickRemove={onQuickRemove}
      />
    );
  };

  const sections = executionPlan.sections.filter((section) =>
    !(section.id === 'mobility' && section.items.every((item) => item.source === 'mobility')));
  return (
    <View style={styles.executionSections}>
      {sections.map((section) => (
        <SessionExecutionSection
          key={section.id}
          section={section}
          completedItemIds={completedItemIds}
          onQuickAdd={quickAddFor(section.id)}
        >
          {section.items.map((executionItem) => (
            <ExecutionChecklistItem
              key={executionItem.id}
              itemId={executionItem.id}
              label={executionItem.label}
              completed={completedItemIds.has(executionItem.id)}
              onToggle={onToggleItem}
              /* R-115 — the row's own typed withholding, straight off the
                 projected workout. Nothing is looked up or re-decided here. */
              withheld={withholdingOfTemplateItem(
                executionItem.templateIndex === null
                  ? undefined
                  : items[executionItem.templateIndex])}
            >
              {(checkbox) => (executionItem.templateIndex === null
                ? <Text style={styles.executionFallbackLabel}>{executionItem.label}</Text>
                : renderItem(
                    items[executionItem.templateIndex],
                    `session-item-${executionItem.templateIndex}`,
                    executionItem.templateIndex,
                    checkbox,
                  ))}
            </ExecutionChecklistItem>
          ))}
        </SessionExecutionSection>
      ))}
    </View>
  );
}

/**
 * The typed injury withholding on a template item, or `null`.
 *
 * `SessionTemplateItem` is a union — a team-training banner and a conditioning
 * choice carry no `row` — so the narrowing is done ONCE here rather than at each
 * call site. It reads one field and interprets nothing (R-115).
 */
function withholdingOfTemplateItem(
  item: SessionTemplateItem | undefined,
): { explanation?: string } | null {
  if (!item || item.kind !== 'exercise') return null;
  return (item.row as { unavailableForInjury?: { explanation?: string } } | undefined)
    ?.unavailableForInjury ?? null;
}

function SessionExecutionSection({ section, completedItemIds, onQuickAdd, children }: {
  section: SessionExecutionSectionModel;
  completedItemIds: ReadonlySet<string>;
  /**
   * ⚠ **R-217 (Sam, 2026-08-25): *"add the little plus icon the bottom of the
   * last box in each section ... a 'quick add' feature that allows the athlete
   * to add an exercise to that section"*.**
   *
   * `null` when this section has nothing legal to add — the athlete's kit and
   * injuries decide that, not this component. **It is mounted HERE, in the one
   * section owner both the Mobility route and `SessionList` render through, so
   * a section cannot exist without having been asked the question.** That is
   * the same lesson as R-213: a per-surface plus is a plus one surface forgets.
   */
  onQuickAdd?: (() => void) | null;
  children: React.ReactNode;
}) {
  /**
   * OPEN ON ARRIVAL — Sam, 2026-08-22: *"Opening S&C work = session view opens
   * with the drop downs for the sections of the program already down"*.
   *
   * It opened collapsed, so an athlete walking into the gym had to tap every
   * section before they could read a single prescription. The work is the
   * reason the screen exists; hiding it behind a tap made the default state the
   * least useful one.
   *
   * STILL COLLAPSIBLE, and this is still screen state — closing a section is
   * where the athlete's thumb is, not a decision about their training, so it is
   * never persisted and it resets with the screen.
   */
  const [expanded, setExpanded] = React.useState(true);
  const completedCount = section.items.filter((item) => completedItemIds.has(item.id)).length;
  return (
    <View style={styles.executionSection} testID={`session-execution-section-${section.id}`}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${section.label}, ${completedCount} of ${section.items.length} complete`}
        testID={`session-execution-toggle-${section.id}`}
        style={({ pressed }) => [styles.executionSectionHeader, pressed && { opacity: 0.7 }]}
      >
        {/* ⚠ **ONE ICON PER SECTION HEADING — SAM, 2026-08-20 (R-116).**
          *
          * Keyed on the TYPED section id, never on the label string. The Day
          * card learned that lesson the hard way: `displayLabelIconKind` matches
          * a rendered NAME against a table of equalities, so the moment a title
          * changed the glyph fell through to a grey default. A section that has
          * no icon renders none rather than a placeholder — three are ruled
          * (Mobility, Strength, Conditioning) and inventing a fourth is how a
          * table starts drifting from the ruling. */}
        {/* ⚠ **THE DAY SCREEN'S OWN ICON, NOT A LOOKALIKE — SAM, 2026-08-20.**
          * *"Do not invent new section icons. Reuse the exact established
          * Day-screen icon and colour mapping through one shared owner."* The
          * first cut of R-116 had its own three-name table here and the two
          * surfaces disagreed on glass — Mobility drew a different glyph on each
          * screen and Team Training drew none. `SESSION_SECTION_ICON_KIND` is a
          * TOTAL `Record`, so a new section kind stops the build until somebody
          * gives it an icon; it can never render iconless and silent again. */}
        <View style={styles.executionSectionIcon} testID={`session-execution-icon-${section.id}`}>
          <RowIcon kind={section.iconKind ?? SESSION_SECTION_ICON_KIND[section.id]} size={17} />
        </View>
        <View style={styles.executionSectionHeading}>
          <Text style={styles.executionSectionTitle}>{section.label}</Text>
          <Text style={styles.executionSectionCount}>{completedCount}/{section.items.length}</Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.text.tertiary}
        />
      </Pressable>
      {expanded ? (
        <View
          style={styles.executionSectionBody}
          testID={`session-execution-items-${section.id}`}
        >
          {children}
          {/* THE PLUS SITS UNDER THE LAST CARD, INSIDE THE SECTION IT ADDS TO —
            * which is what makes it unambiguous without a label: a control
            * between two headings would belong to neither. A collapsed section
            * shows none, because a plus with no visible list to join is an
            * instruction to guess. */}
          {onQuickAdd ? (
            <View style={styles.quickAddRow}>
              <View style={styles.quickAddConnector} />
              <Pressable
                onPress={onQuickAdd}
                accessibilityRole="button"
                accessibilityLabel={`${signedCopy('session.quick_add.label')}: ${section.label}`}
                testID={`session-quick-add-${section.id}`}
                hitSlop={4}
                style={({ pressed }) => [styles.quickAddButton, pressed && { opacity: 0.6 }]}
              >
                <MaterialCommunityIcons name="plus" size={14} color={colors.text.secondary} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * ⚠ **THE CHECKBOX LEFT THIS COMPONENT — SAM, 2026-08-20 (R-116).**
 *
 * *"Move the checkbox onto the SAME horizontal control line as the weight
 * stepper, positioned immediately to its right. This supersedes the earlier
 * ruling that placed the checkbox level with the exercise name."*
 *
 * R-111 put the tick on the name line. It is now the last control on the
 * control row, so the athlete's hand finds load and done in one place. The
 * wrapper keeps ownership of the ITEM — its id, its completed state and its
 * dull treatment — and hands the tick down to the card, because only the card
 * knows where its stepper is. `renderCheckbox` is that handover: one function,
 * defined here, so there is still exactly ONE checkbox in the app.
 *
 * ⚠ **AND R-115 RIDES THE SAME HANDOVER.** A row the injury owner has withheld
 * gets a static Skip marker INSTEAD of the tick, built here and handed down the
 * identical way — so the withheld state travels with the control group Sam
 * ruled onto the stepper line, and there is still exactly ONE place in the app
 * that decides what sits at that position.
 */
function ExecutionChecklistItem({ itemId, label, completed, onToggle, withheld, children }: {
  itemId: string;
  label: string;
  completed: boolean;
  onToggle: (itemId: string) => void;
  /**
   * ⚠ **THE TYPED WITHHOLDING, PASSED IN — NEVER DERIVED HERE (R-115).**
   *
   * `WorkoutExercise.unavailableForInjury`, written by
   * `rules/injuryWithheldRows` and carried through the projection untouched.
   * This component does not know what an injury IS: no severity, no band, no
   * body part map. It is handed a decision and renders it.
   */
  withheld?: { explanation?: string } | null;
  children: (checkbox: React.ReactNode) => React.ReactNode;
}) {
  /*
   * ⚠ **THE CHECKBOX OWNS THE RIGHT EDGE — SAM, 2026-08-20 (R-111).**
   *
   * It used to lead the row, vertically centred against the WHOLE card, which
   * on an expanded Strength row put it level with the weight stepper rather
   * than with anything it refers to. It now sits at the far right on the
   * exercise-name line — the place the play button used to hold — so the row
   * reads name → demo → … → done, left to right, and the completion state is
   * where a list keeps its state.
   *
   * **This is a MOVE, not a rebuild.** Same `onToggle(itemId)`, same
   * `accessibilityRole="checkbox"`, same checked state, same spoken label, same
   * `session-execution-check-…` identity — so every flow that ticks a row keeps
   * finding it. `flex-start` + `marginTop` is what puts it on the name line;
   * `styles.executionItem` no longer centres, and the guard that used to
   * REQUIRE centring is inverted in `test:session-execution`, not deleted.
   */
  /* SAME Pressable, same handler, same role, state, label and identity as when
     it sat on the name line — only its PLACE moved. `hitSlop` keeps the tap
     target at the practical minimum now that it sits beside the stepper. */
  /*
   * ⚠ **A WITHHELD ROW HAS NO CHECKBOX AT ALL — SAM, 2026-08-20 (R-115).**
   *
   * *"show them as unavailable/skip"*, and *"the injured date cannot be
   * completed as normal."* A DISABLED checkbox would still be a checkbox: it
   * says "you may tick this later", which is the opposite of what the ruling
   * means. The tick is REPLACED by a static Skip marker, so there is no
   * `onToggle` to reach and no `accessibilityRole="checkbox"` for a screen
   * reader or a flow to find and press. Its own identity is kept so a guard can
   * assert the SWAP happened rather than infer it from an absence.
   *
   * It is built HERE, into the same `checkbox` handover R-116 created, so a
   * withheld row's marker lands exactly where the tick would have — on the
   * control line beside the weight stepper — instead of at a second address.
   */
  const checkbox = withheld ? (
    <View
      style={styles.executionSkipMark}
      accessibilityRole="text"
      accessibilityLabel={`Skip: ${label}`}
      testID={`session-execution-withheld-${stableTestIdToken(itemId)}`}
    >
      <Text style={styles.executionSkipText}>SKIP</Text>
    </View>
  ) : (
    <Pressable
      onPress={() => onToggle(itemId)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={`${completed ? 'Completed' : 'Mark complete'}: ${label}`}
      testID={`session-execution-check-${stableTestIdToken(itemId)}`}
      /* ⚠ **18x18 DRAWN, 44x44 TAPPABLE.** The checkbox now follows the
         smaller weight control while keeping the same accessible target.
         preserve a minimum 44 x 44 accessible tap target using its
         wrapper/hit slop. 18 + 13 + 13 = 44 on BOTH axes, so the box can be
         small without the target being. Symmetric on purpose: an uneven slop
         would move the tappable centre away from the drawn centre, which is the
         same class of defect as the margin that caused the drift. */
      hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
      style={({ pressed }) => [
        styles.executionCheckbox,
        completed && styles.executionCheckboxComplete,
        pressed && { opacity: 0.65 },
      ]}
    >
      {completed ? <Text style={styles.executionCheckmark}>✓</Text> : null}
    </Pressable>
  );
  return (
    <View style={[styles.executionItem, completed && styles.executionItemComplete]}>
      <View style={styles.executionItemContent}>{children(checkbox)}</View>
    </View>
  );
}

/**
 * The one header the optional cluster gets.
 *
 * Sam's run-7 ruling 1. The meaning it carries — this is no-penalty, skip it if
 * it adds fatigue — used to be repeated on every add-on row as an "Optional"
 * eyebrow, and again as a pill on the recovery branch's add-on card. Saying it
 * once above the group says it exactly as well and stops the word competing with
 * the exercise names underneath it.
 *
 * Both branches share this component so the wording cannot drift apart: recovery
 * days keep their own simple template (§6 item 3), but not their own vocabulary
 * for the same idea.
 */
function OptionalWorkHeader() {
  return (
    <Text style={styles.optionalWorkHeader} testID="optional-work-header">
      Optional work
    </Text>
  );
}

/**
 * Power work as the first list row.
 *
 * The old box carried a "POWER / EXPLOSIVE PRIMER" header and a "Before
 * strength" / "Pair with main lift" placement tag. Both are retired: placement
 * is now just list order, and the category is the badge. What survives is the
 * content the athlete acts on — the prescription, the options to choose
 * between, and the coaching notes.
 */

/**
 * An add-on exercise, now an ordinary row inside the optional cluster.
 *
 * The "Optional Recovery Add-on" box is gone and so is the per-row eyebrow that
 * replaced it — the group header above the cluster carries the no-penalty
 * meaning once (Sam, run-7 ruling 1).
 *
 * Its coaching text comes from the curated cue layer via `buildCueText`, exactly
 * like every other row. It used to come from a note string hardcoded in
 * `recoveryAddonBuilder`, which is how "Quiet tempo, no bouncing" reached the
 * athlete without passing through Sam's cues (run-7 ruling 3).
 */
function AddonRow({
  exercise,
  expandedCues,
  toggleCue,
  onQuickSwap,
  onQuickRemove,
}: {
  exercise: any;
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
  onQuickSwap: (exercise: EditableExercise) => void;
  onQuickRemove: (exercise: EditableExercise) => void;
}) {
  const token = stableTestIdToken(exercise?.id);
  const name = exercise?.name;
  return (
    <View style={styles.exerciseCard} testID={`workout-exercise-row-${token}`}>
      <View style={[styles.exerciseHeaderRow, styles.exerciseHeaderWithQuickActions]}>
        <View style={styles.exerciseNameWrap}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {displayExerciseName(name)}
          </Text>
        </View>
      </View>
      <Text
        style={styles.statsPrimary}
        testID={`workout-exercise-prescription-${token}`}
      >
        {exercise?.prescription}
      </Text>
      <CueDisclosure
        exerciseId={String(exercise?.id ?? '')}
        cueText={buildCueText(name)}
        expandedCues={expandedCues}
        toggleCue={toggleCue}
      />
      <QuickExerciseActions
        exercise={editableExerciseForRow(exercise, {
          kind: 'recovery_addon', id: String(exercise.id),
        })!}
        onQuickSwap={onQuickSwap}
        onQuickRemove={onQuickRemove}
      />
    </View>
  );
}

/**
 * The combined-day "choose one of N" picker as a single list row.
 *
 * §6 item 4: no separate box and no carve-out from "one list" — one
 * Conditioning-badged row that expands in place to reveal the choice. When
 * there is only one option there is nothing to choose, so it opens straight
 * away rather than asking for a tap that reveals a single answer.
 */
function ConditioningChoiceRow({
  options,
  checkbox,
  onQuickSwap,
  onQuickRemove,
}: {
  options: Array<{ title: string; description: string; rows: any[]; modalityLabel?: string }>;
  /**
   * The checklist's checkbox for this row. ⚠ **ONE TICK PER EXECUTION ITEM,
   * NOT PER OPTION.** A choice row is "do one of these" — the checklist counts
   * it as a single thing done, so the tick belongs on the card's own header
   * beside the chooser, never inside each option where two ticks would claim
   * the athlete did both.
   */
  checkbox?: React.ReactNode;
  onQuickSwap: (exercise: EditableExercise) => void;
  onQuickRemove: (exercise: EditableExercise) => void;
}) {
  const isChoice = options.length > 1;
  const [expanded, setExpanded] = React.useState(!isChoice);
  const rowCount = options.reduce((sum, option) => sum + option.rows.length, 0);
  if (rowCount === 0) return null;

  return (
    <View style={styles.exerciseCard} testID="conditioning-choice-row">
      <Pressable
        onPress={isChoice ? () => setExpanded((prev) => !prev) : undefined}
        accessibilityRole={isChoice ? 'button' : undefined}
        accessibilityLabel={
          isChoice
            ? `${expanded ? 'Hide' : 'Show'} the ${options.length} conditioning options`
            : undefined
        }
        style={styles.exerciseHeaderRow}
      >
        <View style={styles.exerciseNameWrap}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {isChoice ? `Choose one of ${options.length}` : options[0].title}
          </Text>
        </View>
        {isChoice ? (
          <Text style={styles.disclosureChevron}>{expanded ? '−' : '+'}</Text>
        ) : null}
        {checkbox ? <View style={styles.addonCheckboxSlot}>{checkbox}</View> : null}
      </Pressable>
      {expanded
        ? options.map((option, optionIndex) => (
            <View key={`cond-opt-${optionIndex}`} style={styles.conditioningOption}>
              {isChoice ? (
                <Text style={styles.conditioningOptionTitle}>{option.title}</Text>
              ) : null}
              {option.description ? (
                <Text style={styles.conditioningOptionDescription}>
                  {option.description}
                </Text>
              ) : null}
              {option.modalityLabel ? <Text style={styles.conditioningOptionDescription}>{option.modalityLabel}</Text> : null}
              {option.rows.map((exercise: any, idx: number) => (
                <ConditioningRow
                  key={exercise.id}
                  exercise={exercise}
                  idx={idx}
                  onQuickSwap={onQuickSwap}
                  onQuickRemove={onQuickRemove}
                />
              ))}
            </View>
          ))
        : null}
    </View>
  );
}

/**
 * A single exercise row. Renders:
 *   [1] Exercise Name                  [Change] [▶ play]
 *   Sets × Reps       Weight
 *                     [-] [value] [+]
 *   (optional rest hint)
 *   (curated coaching cue)
 *
 * The leading index is the athlete's waypoint through the list — "1", "2", and
 * "1a"/"1b" for a superset pair. It briefly gave way to a role badge; Sam ruled
 * the index back on 2026-07-27, because the D2 ordering already says what
 * matters and a "MAIN LIFT" label earned nothing the position did not.
 */
interface StrengthExerciseCardProps {
  exercise: any;
  quickExercise: EditableExercise;
  onQuickSwap: (exercise: EditableExercise) => void;
  onQuickRemove: (exercise: EditableExercise) => void;
  /**
   * R-116 — the completion checkbox, built by `ExecutionChecklistItem` and
   * PLACED here, because only this card knows where its weight stepper is.
   * Absent for the surfaces that render a card outside the checklist.
   */
  checkbox?: React.ReactNode;
  label: string;
  isGrouped: boolean;
  isLastInGroup?: boolean;
  prescriptionLabel?: string;
  cueTextOverride?: string | null;
  /**
   * R-104. Which implement the athlete actually picks up for THIS row on THIS
   * day's kit. Optional so the combined-day picker and add-on rows, which have
   * no kit in hand, keep rendering exactly as they did.
   */
  selectedImplement?: SelectedImplementToday | null;
  /** Today's effective kit; apparatus in a cue must be present here. */
  availableEquipment?: readonly EquipmentTag[] | null;
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
  editingWeightId: string | null;
  editingWeightText: string;
  setEditingWeightText: (s: string) => void;
  formatWeight: (ex: any, selectedImplement?: string | null) => string;
  getLoadControlMode: (ex: any, selectedImplement?: string | null) => LoadControlMode;
  incrementWeight: (ex: any, selectedImplement?: string | null) => void;
  decrementWeight: (ex: any, selectedImplement?: string | null) => void;
  incrementBandResistance: (ex: any) => void;
  decrementBandResistance: (ex: any) => void;
  startEditingWeight: (ex: any) => void;
  commitWeightEdit: () => void;
  onSelectExercise: (name: string) => void;
}
function StrengthExerciseCard({
  exercise,
  quickExercise,
  onQuickSwap,
  onQuickRemove,
  checkbox,
  label,
  isGrouped,
  isLastInGroup = true,
  prescriptionLabel,
  cueTextOverride,
  selectedImplement,
  availableEquipment,
  expandedCues,
  toggleCue,
  editingWeightId,
  editingWeightText,
  setEditingWeightText,
  formatWeight,
  getLoadControlMode,
  incrementWeight,
  decrementWeight,
  incrementBandResistance,
  decrementBandResistance,
  startEditingWeight,
  commitWeightEdit,
  onSelectExercise,
}: StrengthExerciseCardProps) {
  const exerciseName = exercise.exercise?.name || `Exercise`;
  const exerciseDisplayName = displayExerciseName(exerciseName);
  const setsReps = prescriptionLabel ?? formatStrengthSetsReps(exercise);
  const restLabel = exercise.restSeconds >= 90 ? formatRest(exercise.restSeconds) : null;
  // R-104: the cue must fit the implement in the athlete's hands. `RDLs` is
  // authored for barbell OR dumbbells and its cue says "bar slides down leg" —
  // on a dumbbell day that names equipment they have not got, so it is
  // SUPPRESSED and flagged rather than reworded. There is no authored dumbbell
  // RDL cue and `EXERCISE_CUES` is gated to Sam's sheet, so inventing one here
  // is the thing his ruling forbids.
  const resolvedCue = cueForImplement(
    exerciseName,
    selectedImplement?.implement ?? null,
    availableEquipment,
  );
  const cueText = cueTextOverride !== undefined ? cueTextOverride : resolvedCue.text;
  // ── SAM'S UI CORRECTION: TYPED ALWAYS, SHOWN ONLY WHEN IT EXPLAINS A CHANGE.
  //
  // ⚠ **AND A LOADED ROW IS NEVER LABELLED "BODYWEIGHT".** Sam named the
  // contradiction: `Single-Leg RDL` resolved to bodyweight (his own ruled set of
  // movements performable unloaded) while carrying 20 kg, and the row read
  // "· Bodyweight … 20kg". The two owners are each right on their own terms —
  // which is exactly why the SCREEN has to refuse to print the pair.
  // ⚠ **ASK THE SAME SOURCE THE ROW PRINTS, NOT THE STORED FIELD.** The first
  // version of this guard read `exercise.prescribedWeightKg` and the row still
  // shipped "Bodyweight today" beside **20kg** — because the number the athlete
  // sees comes from `formatWeight`, which resolves the athlete's own weight
  // OVERRIDE first. A guard that reads a different field from the display it is
  // guarding is not guarding it. Caught on the simulator, not by a cell.
  const selectedImplementKind = selectedImplement?.implement ?? null;
  const loadControlMode = getLoadControlMode(exercise, selectedImplementKind);
  const displayedWeight = String(formatWeight(exercise, selectedImplementKind) ?? '').trim();
  const carriesExternalLoad = displayedWeight !== '' && !/^bw$/i.test(displayedWeight);
  const implementIsHonest = !(selectedImplement?.implement === 'bodyweight' && carriesExternalLoad);
  const showImplementBadge = !!selectedImplement?.changedToday && implementIsHonest;
  const implementLabel = selectedImplementLabel(selectedImplement);
  const normalLabel = selectedImplementLabel(
    selectedImplement ? { ...selectedImplement, implement: selectedImplement.normalImplement } : null,
  );
  // ── ONE LINE, AND IDENTITY OUTRANKS IMPLEMENT ─────────────────────────────
  //
  // Sam, 2026-08-18: *"If only the implement changes, keep the current implement
  // notice instead. Never show both, and do not add notices to unchanged rows."*
  //
  // The order is not arbitrary. **A DIFFERENT EXERCISE IS A BIGGER FACT THAN A
  // DIFFERENT IMPLEMENT** — if the athlete is looking at a lift the block did not
  // choose, that is what they need explained, and the implement is a detail of
  // the row that replaced it.
  /**
   * ⚠ **THE SENTENCE AND THE NAME IN IT ARE BOTH THE DOMAIN'S, NOT THIS
   * SCREEN'S** (Sam, 2026-08-20). This block used to pick the name and compose
   * the words itself, which is how the row and the injury REVIEW came to name
   * two different exercises for one change. `rules/injurySubstitutionSource` is
   * the single owner now, and it is the same one the review reads.
   *
   * ⚠ **`originExerciseName` IS NOT READ HERE AND MUST NOT BE.** It is the
   * authored exercise, kept as internal history per Sam's ruling and rendered
   * nowhere — the owner refuses to consult it for exactly this reason.
   */
  const substitution = (exercise as {
    substitutedFrom?: InjurySubstitutionSourceRef;
  })?.substitutedFrom;
  const substitutionBadgeText = injurySubstitutionBadge({
    substitution,
    displayName: (name) => displayExerciseName(name),
  });
  // "Dumbbells today — no barbell". One line, only on the rows it explains.
  const implementBadgeText = !substitutionBadgeText && showImplementBadge && implementLabel
    ? (normalLabel ? `${implementLabel} today — no ${normalLabel.toLowerCase()}` : `${implementLabel} today`)
    : null;
  const affectedRowNotice = substitutionBadgeText ?? implementBadgeText;
  const isEditing = editingWeightId === exercise.exerciseId;
  const componentId = exercise.id || exercise.exerciseId;
  const exerciseToken = stableTestIdToken(componentId);
  /* R-115 — read, never decided. See the notice below. */
  const injuryWithholding = exercise?.unavailableForInjury ?? null;
  const cueOpen = !!expandedCues[String(exercise.id ?? exercise.exerciseId ?? '')];

  const controls = (
    /* ══ THE CONTROLS ARE A SIBLING OF THE TEXT STACK — FOURTH PASS ═══════
      *
      * *"The controls remain vertically centred against the row, NOT
      * responsible for determining the text stack's height."*
      *
      * ⚠ **THEY WERE INSIDE THE DOSE LINE, AND THAT IS WHY THE RHYTHM STAYED
      * LOOSE.** The stepper is ~34px tall; sitting it beside `2 × 3` forced
      * that line to 34px, so Form cues could never sit 1-3px under the dose
      * however small the margins were. Measured on glass: 25-27pt between
      * lines that were supposed to be 1-3px apart. No margin could have
      * fixed it — the control was the line's height.
      *
      * Out here the text stack is three text lines and nothing else, free to
      * be genuinely compact, while the grid's `alignItems: 'center'` centres
      * the controls against the whole row. With a compact stack the row's
      * centre IS the dose line, which is what "align with the sets x reps
      * line" asks for — and it holds however the name wraps, because the
      * stack's height no longer depends on the controls. */
    /* ══ ONE `controlsRow`, TWO SIBLINGS — SAM, 2026-08-20, THIRD PASS ═════
      *
      * *"Do not position them through separate parents, independent margins,
      * absolute offsets or row-level centring. The weight stepper and
      * checkbox must be sibling children of one `controlsRow`."*
      *
      * ⚠ **THE DRIFT HAD ONE CAUSE: `marginTop: 3` ON THE CHECKBOX.** It was
      * added when the tick sat on the NAME line and needed nudging onto it.
      * When the tick moved to the control line the nudge stayed, so every
      * checkbox sat 3px low — and because rows differ in height, the error
      * read as progressive drift down the list. It is DELETED, not
      * compensated: the two controls are now siblings in one
      * `alignItems: 'center'` row, so their centres coincide by construction
      * and nothing can offset one without the other. */
    <View style={styles.controlsRow}>
    {loadControlMode === 'none' ? null : loadControlMode === 'bodyweight' ? (
      <View
        style={[styles.weightControl, styles.staticLoadControl]}
        testID={`workout-exercise-load-${exerciseToken}`}
        accessibilityLabel="Bodyweight"
      >
        <Text
          style={styles.weightValueText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          BW
        </Text>
      </View>
    ) : (
      <View style={styles.weightControl}>
        <Pressable
          onPress={() => loadControlMode === 'band'
            ? decrementBandResistance(exercise)
            : decrementWeight(exercise, selectedImplementKind)}
          style={styles.weightBtnLeft}
          hitSlop={{ top: 8, bottom: 8, left: 8 }}
          accessibilityLabel={loadControlMode === 'band'
            ? 'Decrease band resistance'
            : 'Decrease weight'}
        >
          <Text style={styles.weightBtnText}>−</Text>
        </Pressable>
        {isEditing && loadControlMode !== 'band' ? (
          <AppTextInput
            style={styles.weightInput}
            value={editingWeightText}
            onChangeText={setEditingWeightText}
            onBlur={commitWeightEdit}
            onSubmitEditing={commitWeightEdit}
            placeholder={loadControlMode === 'bodyweight_plus' ? 'BW' : 'kg'}
            placeholderTextColor="#5A5A5A"
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
          />
        ) : loadControlMode === 'band' ? (
          <View
            style={styles.weightValueWrap}
            testID={`workout-exercise-load-${exerciseToken}`}
            accessibilityLabel={`Band resistance, ${displayedWeight}`}
          >
            <Text
              style={styles.weightValueText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {displayedWeight}
            </Text>
          </View>
        ) : (
        /**
         * ⚠ **THE LOAD IS SPOKEN AND ADDRESSABLE, NOT JUST DRAWN.**
         *
         * This control is `accessible` (a bare `accessibilityLabel` makes it
         * so), which REPLACES its subtree in the accessibility tree — so the
         * number the athlete reads on the glass was reachable by nobody
         * else. Two consequences, and the second is why this changed here:
         * a VoiceOver athlete heard *"Edit weight"* and was never told the
         * weight; and **no real-route guard could assert a prescribed load
         * at all**, which is exactly how a replacement wearing the outgoing
         * lift's 20 kg shipped and stayed shipped. A value with no reader is
         * a value nothing can hold.
         *
         * The label now CARRIES the value and the row keeps its own id. The
         * `Edit weight` wording is retained as the prefix rather than
         * replaced — it is what the control DOES, and no flow that finds
         * this control by that text stops finding it.
         */
        <Pressable
          onPress={() => startEditingWeight(exercise)}
          style={styles.weightValueWrap}
          testID={`workout-exercise-load-${exerciseToken}`}
          accessibilityLabel={`Edit weight, ${displayedWeight}`}
        >
          <Text
            style={styles.weightValueText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {displayedWeight}
          </Text>
        </Pressable>
        )}
        <Pressable
          onPress={() => loadControlMode === 'band'
            ? incrementBandResistance(exercise)
            : incrementWeight(exercise, selectedImplementKind)}
          style={styles.weightBtnRight}
          hitSlop={{ top: 8, bottom: 8, right: 8 }}
          accessibilityLabel={loadControlMode === 'band'
            ? 'Increase band resistance'
            : 'Increase weight'}
        >
          <Text style={styles.weightBtnText}>+</Text>
        </Pressable>
      </View>
    )}
    {checkbox}
    </View>
  );

  return (
    <Card
      tone={isGrouped ? 'raised' : 'default'}
      radius="md"
      padding="none"
      testID={`workout-exercise-row-${exerciseToken}`}
      style={[
        styles.exerciseCard,
        isGrouped && styles.exerciseCardGrouped,
        isGrouped && isLastInGroup && styles.exerciseCardGroupedLast,
        // Unavailable, not gone: the row keeps its name, its dose and its load
        // — the ruling preserves them — and reads as work not to be done today.
        !!injuryWithholding && styles.exerciseCardWithheld,
      ]}
    >
      {/* ══ THE ROW GRID — SAM, 2026-08-20, THIRD PASS ═══════════════════════
        *
        * *"Stop adjusting isolated margins — the row's underlying grid is wrong.
        * The exercise name begins after the number gutter, but sets/reps and
        * Form cues jump back left underneath the number."*
        *
        * ⚠ **THAT WAS STRUCTURAL AND NO MARGIN COULD HAVE FIXED IT.** The number
        * badge was a sibling of the NAME, inside the header row — so the gutter
        * existed on line one and nowhere else, and lines two and three started at
        * the card's edge, under the number. Three lines, two different left
        * edges, which is why the block read as three disconnected rows however
        * tight the gaps were.
        *
        * The row is now an explicit grid: ONE fixed-width number gutter, ONE
        * content column, and every text line a child of that column — so all
        * three share one left edge BY CONSTRUCTION, and a wrapping name cannot
        * push anything back into the gutter. */}
      <View style={styles.exerciseRowGrid}>
        <View style={styles.exerciseNumberGutter}>
          {label ? <Text style={styles.exerciseLabelText}>{label}</Text> : null}
        </View>
        <View style={styles.exerciseContentColumn}>
      <ExerciseHeaderRow
        name={exerciseDisplayName}
        onPlay={() => onSelectExercise(exerciseName)}
      />

      {/* Line two: the dose, and the controls that belong to it. */}
      <View style={styles.statsRow}>
        <View style={styles.statsLeftColumn}>
          <Text
            style={styles.statsPrimary}
            testID={`workout-exercise-prescription-${exerciseToken}`}
          >
            {setsReps}
          </Text>
        </View>
        {/* ── THE TYPED IMPLEMENT, ASSERTABLE BUT NOT SHOWN ────────────────
            Sam ruled the always-on label too cluttered, and he is right — it
            repeated "· Dumbbells" down every row of an ordinary session. The
            implement is still resolved for EVERY row (legality, load handling
            and the form cues all read it); this 1x1 carries it so a flow or a
            guard can still ask "which implement is this row?" without the
            athlete reading a word. Same idiom as the set count and the position
            directly below. */}
        {implementLabel && implementIsHonest ? (
          <View
            style={{ width: 1, height: 1 }}
            testID={`workout-exercise-implement-${exerciseToken}-${implementLabel.toLowerCase()}`}
          />
        ) : null}
        {/* The cue was written for a different implement and no authored variant
            exists. Sam: *"flag missing authored technique guidance rather than
            invent coaching copy."* An id, not a sentence — there is no signed
            athlete-facing wording for this yet, and inventing one is the same
            forbidden act as inventing the cue. */}
        {resolvedCue.missingCueForImplement ? (
          <View
            style={{ width: 1, height: 1 }}
            testID={`workout-exercise-cue-missing-for-implement-${exerciseToken}`}
          />
        ) : null}
        <View
          style={{ width: 1, height: 1 }}
          testID={`exercise-set-count-${exerciseToken}-${exercise.prescribedSets}`}
        />
        {/* ⚠ THE POSITION THE ATHLETE IS TOLD TO DO THIS IN, MADE ASSERTABLE.
            Same 1x1 idiom as the set count directly above — a VALUE encoded in
            an id, because the numeral is drawn inside an `accessible` header
            and no flow could otherwise ask "which exercise is fourth?". The
            card and this screen disagreed about exactly that until 2026-08-18
            and nothing on either surface could see it. */}
        <View
          style={{ width: 1, height: 1 }}
          testID={`session-strength-position-${label}-${stableTestIdToken(exerciseName)}`}
        />
      </View>


      {/* ⚠ **POWER SHOWS NO REST LINE — SAM, 2026-08-20 (R-116).** *"Power is
          visually an ordinary Strength row. Remove its unique visible rest line
          (`2:00 rest`). Do not give Power a separate row format or section."*
          Power was the only role whose rest cleared the 90s threshold, so the
          line WAS the special format — one row in the list wearing an extra
          line nothing else had.

          ⚠ **THIS HIDES A LINE; IT DELETES NO DATA.** *"hiding Power's rest line
          must not delete its domain prescription."* `restSeconds` is untouched
          on the row, still stored, still generated, still read by everything
          that reads it — `restLabel` above is computed exactly as before and a
          guard asserts the row still carries its rest. Only this Text is
          gated. */}
      {restLabel && exercise?.role !== 'power' ? (
        <View style={styles.detailsRow}>
          <Text style={styles.restHint}>{restLabel}</Text>
        </View>
      ) : null}

      {/* Curated coaching cue, collapsed by default (Sam, run-7 ruling 2).
          Generator per-exercise notes are still deliberately NOT rendered: the
          curated layer owns every athlete-visible word; generation provides
          structure only (sets/reps/weight/type). Stage 3 ownership ruling. */}
      {/* ── THE ONE AFFECTED-ROW NOTICE ──────────────────────────────────
          Sam, 2026-08-18: *"Only show equipment context when it explains a
          temporary session change … one concise affected-row badge/notice."*
          It renders on the rows today actually changed and nowhere else, so an
          ordinary session carries none of these at all. */}
      {affectedRowNotice ? (
        <Text
          style={styles.implementBadge}
          testID={substitutionBadgeText
            ? `workout-exercise-swapped-badge-${exerciseToken}`
            : `workout-exercise-implement-badge-${exerciseToken}`}
        >
          {affectedRowNotice}
        </Text>
      ) : null}
      {/*
        ⚠ **THE INJURY SENTENCE IS THE DOMAIN'S, RENDERED VERBATIM — R-115.**
        *"The explanation names the active injury fact without inventing medical
        advice."* Every word comes from `unavailableForInjury.explanation`, which
        `rules/injuryWithheldRows.explanationFor` composes from the athlete's own
        stored injury fact — the body part they reported and the exercise's own
        name. **This screen authors NO part of it**, which is the same law that
        deleted the keyword red-flag replies (R-108): athlete-facing words about
        someone's body come from a stored fact, or they do not exist.

        ⚠ **RE-SITED BY THE INTEGRATOR, 2026-08-20.** R-115 was written against
        the pre-R-116 card, where this notice followed a copy of the affected-row
        badge and the cue disclosure that R-116 has since MOVED into the grid's
        text stack. Taking R-115's block verbatim would have restored that
        superseded position and drawn the badge and the cue TWICE. It now sits
        where the affected-row notice actually lives — last line of the text
        stack, above the cue — so both notices read as one column and the
        accepted R-116 grid is untouched.
      */}
      {injuryWithholding ? (
        <Text
          style={styles.injuryWithheldNotice}
          testID={`workout-exercise-injury-withheld-${exerciseToken}`}
        >
          {injuryWithholding.explanation}
        </Text>
      ) : null}
      <CueDisclosure
        exerciseId={String(exercise.id ?? exercise.exerciseId ?? '')}
        cueText={cueText}
        expandedCues={expandedCues}
        toggleCue={toggleCue}
        onPlay={() => onSelectExercise(exerciseName)}
        playAccessibilityLabel={`Play ${exerciseDisplayName} demo`}
      />
      {/* ⚠ **AN OPEN CUE PUSHES THE CONTROLS BELOW IT — Sam, 2026-08-27**: *"when
          you tap form cues - a lot of the exercises form cues cover and glitch
          with the weight toggle … you can drop the weight toggle below the last
          line"*. The controls are `position: 'absolute'` at the card's
          bottom-right — pinned there by his own 2026-08-20 ruling so they centre
          against a COLLAPSED row without setting its height — and an expanded
          cue simply flowed underneath them.
          So the pin holds while the row is collapsed, which is the state that
          ruling was about, and an open cue moves them into the flow as the last
          line. ONE element either way: `controls` is built once, and the stepper
          and checkbox stay siblings inside the one `controlsRow`. */}
      {cueOpen ? (
        /* A SLOT, NOT A SECOND STYLE. `controls` is absolutely positioned by the
           2026-08-20 ruling, so it pins to its nearest positioned ancestor —
           give it one here, sized to the control, and the very same element
           lands below the cue instead of over it. Nothing about the control
           itself changes, which is why the card still has exactly one control
           row. */
        <View style={styles.stackedControlsSlot}>{controls}</View>
      ) : null}
        </View>
        {cueOpen ? null : controls}
      </View>
      <QuickExerciseActions
        exercise={quickExercise}
        onQuickSwap={onQuickSwap}
        onQuickRemove={onQuickRemove}
      />
    </Card>
  );
}

/**
 * THE ATHLETE'S OWN PACE, UNDER THE PERCENTAGE THAT ASKED FOR IT.
 *
 * `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md` C2: the 2km time trial was
 * collected, validated and stored, and `deriveMas` had ZERO production callers —
 * so a card said `Intensity: 110% MAS` and never said 110% of what. This hook is
 * that reader, and it is the ONLY one: the pace is derived here, at the read,
 * from the words already on the row. Nothing writes a pace into a program, so
 * logging a faster 2km reprices every card at once and no stored number can go
 * stale. See `rules/masPace.ts` for why that is structural rather than tidy.
 */
function usePersonalPace(notes: string | null | undefined) {
  const answer = useProfileStore((s: any) => s.onboardingData?.twoKmTimeTrial);
  const experienceLevel = useProfileStore((s: any) => s.onboardingData?.experienceLevel);
  return React.useMemo(
    () => personalPaceLine({ intensityText: notes, answer, experienceLevel }),
    [notes, answer, experienceLevel],
  );
}

const CONDITIONING_EMPHASISED_LABELS = new Set([
  'Work', 'Recovery', 'Rounds', 'Reps', 'Blocks', 'Intensity',
]);

/** One typography owner for every structured conditioning prescription. */
function ConditioningPrescriptionCopy({
  copy,
  style,
  testID,
}: {
  copy: string;
  style: any;
  testID?: string;
}) {
  const lines = copy.split('\n');
  return (
    <Text style={style} testID={testID}>
      {lines.map((line, index) => {
        const match = /^([^:]+):\s*(.*)$/.exec(line);
        const label = match?.[1] ?? null;
        const emphasised = label !== null && CONDITIONING_EMPHASISED_LABELS.has(label);
        return (
          <React.Fragment key={`${index}-${line}`}>
            {index > 0 ? '\n' : null}
            {emphasised ? (
              <>
                <Text style={styles.conditioningPrescriptionLabel}>{label}:</Text>
                {` ${match?.[2] ?? ''}`}
              </>
            ) : line}
          </React.Fragment>
        );
      })}
    </Text>
  );
}

/**
 * One conditioning phase, as a flat-list row.
 *
 * Was a tinted "phase card" inside the conditioning branch. The tint carried
 * the category, so it retires with the box — the badge says Conditioning now,
 * and the row sits on the page like every other row.
 */
function ConditioningPhaseRow({
  exercise,
  modalityLabel,
  checkbox,
  onQuickSwap,
  onQuickRemove,
}: {
  exercise: any;
  modalityLabel?: string;
  /** The checklist's own checkbox for this row. See `renderItem`. */
  checkbox?: React.ReactNode;
  onQuickSwap: (exercise: EditableExercise) => void;
  onQuickRemove: (exercise: EditableExercise) => void;
}) {
  const phaseName = exercise.exercise?.name || 'Phase';
  const phaseDisplayName = displayExerciseName(phaseName, 'Phase');
  const description = exercise.notes || exercise.exercise?.description || '';
  const componentId = exercise.id || exercise.exerciseId;
  const exerciseToken = stableTestIdToken(componentId);
  const paceLine = usePersonalPace(description);

  return (
    <View
      style={styles.exerciseCard}
      testID={`workout-exercise-row-${exerciseToken}`}
    >
      <View style={[styles.exerciseHeaderRow, styles.exerciseHeaderWithQuickActions]}>
        <View style={styles.exerciseNameWrap}>
          <Text style={styles.exerciseName} numberOfLines={2}>
            {phaseDisplayName}
          </Text>
        </View>
        {/* On the NAME line, because a conditioning block has no weight stepper
            to sit beside. ⚠ **NOT `controlsRow`** — that style is the STRENGTH
            card's single control line and a law counts its uses to keep it
            single (R, Sam 2026-08-20). This reuses `addonCheckboxSlot`, the
            shape the add-on row already uses for exactly this case: a tick with
            no stepper beside it. */}
        {checkbox ? <View style={styles.addonCheckboxSlot}>{checkbox}</View> : null}
      </View>
      {modalityLabel ? <Text style={styles.conditioningPhaseBody} testID={`conditioning-mode-${exerciseToken}`}>{modalityLabel}</Text> : null}
      {description ? (
        <ConditioningPrescriptionCopy
          copy={description}
          style={styles.conditioningPhaseBody}
          testID={`workout-exercise-prescription-${exerciseToken}`}
        />
      ) : null}
      {paceLine ? (
        <Text
          style={styles.personalPace}
          testID={`workout-exercise-pace-${exerciseToken}`}
        >
          {paceLine}
        </Text>
      ) : null}
      <QuickExerciseActions
        exercise={editableExerciseForRow(exercise)!}
        onQuickSwap={onQuickSwap}
        onQuickRemove={onQuickRemove}
      />
    </View>
  );
}

/**
 * A single conditioning row inside a combined-day option card.
 */
interface ConditioningRowProps {
  exercise: any;
  idx: number;
  onQuickSwap: (exercise: EditableExercise) => void;
  onQuickRemove: (exercise: EditableExercise) => void;
}
function ConditioningRow({
  exercise,
  idx,
  onQuickSwap,
  onQuickRemove,
}: ConditioningRowProps) {
  const name = exercise.exercise?.name || `Phase ${idx + 1}`;
  const displayName = displayExerciseName(name, `Phase ${idx + 1}`);
  const notes = exercise.notes || '';
  const prescription = formatConditioningRowPrescription(exercise);
  const componentId = exercise.id || exercise.exerciseId;
  const exerciseToken = stableTestIdToken(componentId);
  // The RAW notes, not `cleanNotes(notes)`: step 2 of that cleaner replaces
  // every en dash with a space, so "90–100% MAS" reaches the glass as
  // "90 100% MAS" and a band parse over the cleaned string would read a lone
  // 100. Parse the words the row CARRIES, render beneath the words it SHOWS.
  const paceLine = usePersonalPace(notes);

  return (
    <View
      style={styles.conditioningRow}
      testID={`workout-exercise-row-${exerciseToken}`}
    >
      <View style={styles.conditioningBullet} />
      <View style={styles.conditioningRowContent}>
        <View style={styles.conditioningRowHeader}>
          <Text style={styles.conditioningRowName}>{displayName}</Text>
        </View>
        {!notes && prescription ? (
          <Text
            style={styles.conditioningRowPrescription}
            testID={`workout-exercise-prescription-${exerciseToken}`}
          >
            {prescription}
          </Text>
        ) : null}
        {notes ? (
          <ConditioningPrescriptionCopy
            copy={cleanNotes(notes)}
            style={styles.conditioningRowNotes}
            testID={`workout-exercise-prescription-${exerciseToken}`}
          />
        ) : null}
        {paceLine ? (
          <Text
            style={styles.personalPace}
            testID={`workout-exercise-pace-${exerciseToken}`}
          >
            {paceLine}
          </Text>
        ) : null}
        <QuickExerciseActions
          exercise={editableExerciseForRow(exercise)!}
          onQuickSwap={onQuickSwap}
          onQuickRemove={onQuickRemove}
        />
      </View>
    </View>
  );
}

/**
 * Team training uses the same plain checklist-row language as Strength.
 * Its section header already carries the meaning; repeating it in an accent
 * card created a second visual system inside the same execution checklist.
 */
function TeamTrainingRow({ checkbox }: { checkbox?: React.ReactNode }) {
  return (
    <View style={styles.exerciseCard} testID="team-training-section">
      <View style={styles.exerciseHeaderRow}>
        <View style={styles.exerciseNameWrap}>
          <Text style={styles.exerciseName}>{signedCopy('session.team_training.row')}</Text>
        </View>
        {checkbox}
      </View>
    </View>
  );
}

/**
 * Common exercise header: [label] Name
 *
 * ⚠ **THE VISIBLE PLAY BUTTON MOVED TO THE FORM-CUES LINE — SAM, 2026-08-21.**
 *
 * Long names wrapped around the button and moved it to a different horizontal
 * position on every row. The name keeps its existing demo tap target, while the
 * visible button is rendered by `CueDisclosure` beside the fixed "Form cues"
 * label. Mobility, Power, Strength and Recovery therefore share one alignment.
 *
 * **Neither behaviour changed.** Same `onPlay`, same handler, same
 * `Play <name> demo` label on both the name and the button; the checkbox keeps
 * its `accessibilityRole="checkbox"`, its checked state and its toggle.
 *
 * The play target is a small, low-opacity affordance — present but never
 * competing with the exercise name. Pressing brightens it (opacity → 1,
 * fill intensifies) so the athlete gets visual confirmation of the tap.
 */
interface ExerciseHeaderRowProps {
  name: string;
  onPlay: () => void;
}
function ExerciseHeaderRow({
  name,
  onPlay,
}: ExerciseHeaderRowProps) {
  /* ⚠ **THE NUMBER LEFT THIS COMPONENT (third pass).** It is the row GRID's
   * gutter now, not a sibling of the name — that is the whole fix for
   * "sets/reps and Form cues jump back left underneath the number". */
  return (
    <>
      <View style={styles.exerciseHeaderRow}>
        <View style={styles.exerciseNameWrap}>
          <Pressable
            style={styles.exerciseNamePress}
            onPress={onPlay}
            accessibilityRole="button"
            accessibilityLabel={`Play ${name} demo`}
          >
            <Text style={styles.exerciseName} numberOfLines={2}>
              {name}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}


/* ⚠ **THE SESSION-ONLY PILL HUB IS DELETED — SAM, 2026-08-19.**
 *
 * *"Do not keep separate Day and Session implementations. Both must render
 * one shared hub."* This file grew its own row of bordered text pills when
 * the five labelled actions landed, while the Day screen already had the
 * signed card of tinted icon chips. Same heading, same five doors, two
 * visual languages. The shared owner is `components/SessionChangeHub`. */

/**
 * The row shortcut Sam restored on 2026-08-24. These do not own a second edit
 * engine: both callbacks terminate at the same ranked swap and durable removal
 * owners as the labelled hub below the session.
 */
function QuickExerciseActions({
  exercise,
  onQuickSwap,
  onQuickRemove,
}: {
  exercise: EditableExercise;
  onQuickSwap: (exercise: EditableExercise) => void;
  onQuickRemove: (exercise: EditableExercise) => void;
}) {
  const token = stableTestIdToken(exercise.targetId ?? exercise.key);
  return (
    <View style={styles.exerciseRowActions}>
      <Pressable
        onPress={() => onQuickSwap(exercise)}
        accessibilityRole="button"
        accessibilityLabel={`Quick swap ${displayExerciseName(exercise.name)}`}
        testID={`quick-swap-exercise-${token}`}
        hitSlop={8}
        style={({ pressed }) => [styles.exerciseRowActionBtn, pressed && { opacity: 0.6 }]}
      >
        <MaterialCommunityIcons name="autorenew" size={15} color={colors.text.secondary} />
      </Pressable>
      <Pressable
        onPress={() => onQuickRemove(exercise)}
        accessibilityRole="button"
        accessibilityLabel={`Quick remove ${displayExerciseName(exercise.name)}`}
        testID={`quick-remove-exercise-${token}`}
        hitSlop={8}
        style={({ pressed }) => [
          styles.exerciseRowActionBtn,
          styles.exerciseRowActionBtnDanger,
          pressed && { opacity: 0.6 },
        ]}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={15} color="rgba(255, 127, 127, 0.72)" />
      </Pressable>
    </View>
  );
}

/**
 * Pro-mode play button — smaller, muted at rest, brightens only on press.
 * Replaces the previous IconButton(tone="accent") so the lime accent only
 * shows up as tactile feedback, never as resting visual weight.
 */
interface PlayButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
}
function PlayButton({ onPress, accessibilityLabel }: PlayButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
      style={({ pressed }) => [
        styles.playBtn,
        pressed && styles.playBtnActive,
      ]}
    >
      <PlayIcon />
    </Pressable>
  );
}

/**
 * The curated cue, collapsed behind a "Form cues" disclosure.
 *
 * ## Why this reverses the always-visible ruling
 *
 * Sam's run-7 ruling 2. The cue used to render unconditionally, and that rule
 * had a specific reason: AI-generated per-exercise notes were rendering on the
 * same rows, so collapsing the cue would have let the generator's words outrank
 * Sam's. Stage 3 killed the AI notes — the curated layer is now the ONLY source
 * of a row's coaching text — so the reason expired, and what was left was the
 * same sentence repeated down every row of the session. This is noise reduction,
 * not a change of ownership: the words behind the disclosure are still Sam's,
 * still reached through `buildCueText` and canonicalisation.
 *
 * It replaces a `CueToggle` that was already here but unreachable — it only
 * collapsed when a row had generator notes, and no row has had those since
 * Stage 3, so in practice it always took its always-visible branch.
 *
 * ## One implementation, three row types
 *
 * Strength, recovery and add-on rows all mount THIS component. They previously
 * each rendered their own `{cueText ? <Text> : null}`, which is how the two
 * render layers drifted; the shared component means "collapsed by default" is
 * one fact rather than three copies that have to agree.
 *
 * A row with no curated cue renders nothing at all — never an empty disclosure
 * that opens onto blank space.
 */
interface CueDisclosureProps {
  cueText: string | null;
  exerciseId: string;
  expandedCues: Record<string, boolean>;
  toggleCue: (exerciseId: string) => void;
  onPlay?: () => void;
  playAccessibilityLabel?: string;
}
function CueDisclosure({
  cueText,
  exerciseId,
  expandedCues,
  toggleCue,
  onPlay,
  playAccessibilityLabel,
}: CueDisclosureProps) {
  const hasPlay = !!onPlay && !!playAccessibilityLabel;
  if (!cueText && !hasPlay) return null;
  const expanded = !!expandedCues[exerciseId];
  return (
    <View style={styles.cueContainer}>
      <View style={styles.cueActionRow}>
        {cueText ? (
          <Pressable
            onPress={() => toggleCue(exerciseId)}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            style={styles.cueToggleRow}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? 'Hide form cues' : 'Show form cues'}
            testID={`exercise-cue-toggle-${stableTestIdToken(exerciseId)}`}
          >
            <Text style={styles.cueToggleText}>
              {expanded ? '▾ Form cues' : '▸ Form cues'}
            </Text>
          </Pressable>
        ) : null}
        {hasPlay ? (
          <PlayButton onPress={onPlay} accessibilityLabel={playAccessibilityLabel} />
        ) : null}
      </View>
      {cueText && expanded ? <Text style={styles.cueText}>{cueText}</Text> : null}
    </View>
  );
}

/**
 * Finish-session CTA — the "ship it" moment.
 *
 * Pro mode: the button stands alone. No eyebrow label, no supporting
 * text — the label "Log session" says everything the athlete needs to
 * know at this position in the scroll. The glow stays (per the app-wide
 * rule: glow is reserved for completion / success, and finishing a
 * session is exactly that completion moment).
 */
interface FinishMomentProps {
  onPress: () => void;
}
function FinishMoment({ onPress }: FinishMomentProps) {
  return (
    <View style={styles.finishSection}>
      <Button
        label={signedCopy('session.log_action')}
        size="lg"
        onPress={onPress}
        testID="finish-session-action"
      />
    </View>
  );
}

interface ExerciseEditSheetProps {
  visible: boolean;
  sessionId: string;
  step: ExerciseEditStep;
  editableExercises: EditableExercise[];
  onClose: () => void;
  onStep: (step: ExerciseEditStep) => void;
  /** The athlete picked a row to swap. Goes straight to the ranked menu. */
  onSwapPick: (exercise: EditableExercise) => void;
  /** LEVEL 1 -> the headings. Carries the family list so Back can climb to it. */
  onAddFamily: (
    family: AddFamilyId,
    fromFamily?: Extract<ExerciseEditStep, { kind: 'add_family' }>,
  ) => void;
  /**
   * A HEADING -> either Sam's extra question or straight to the exercises. The
   * screen does not choose; `openAddGroup` reads how many leaves are legal.
   */
  onAddGroup: (
    family: AddFamilyId,
    group: AddGroupId,
    fromGroup?: Extract<ExerciseEditStep, { kind: 'add_group' }>,
  ) => void;
  /** THE EXTRA QUESTION'S ANSWER -> the exercises. */
  onAddLeaf: (
    family: AddFamilyId,
    leaf: AddLeafId,
    fromLeaf?: Extract<ExerciseEditStep, { kind: 'add_leaf' }>,
  ) => void;
  onApplyInjuryReview: (step: Extract<ExerciseEditStep, { kind: 'injury_review' }>) => void;
  onApplySwapToday: (step: Extract<ExerciseEditStep, { kind: 'confirm_swap' }>) => void;
  onApplyAddToday: (step: Extract<ExerciseEditStep, { kind: 'confirm_add' }>) => void;
  onRemoveToday: (exercise: EditableExercise) => void;
  onOfferRemovedReplacement: (exercise: EditableExercise) => void;
  onKeepRemovedWithoutReplacement: (exercise: EditableExercise) => void;
  onAddRemovedReplacement: (exercise: EditableExercise, suggestion: SuggestedSwap) => void;
  onFutureScope: (step: FutureScopeStep) => void;
  onTodayOnly: () => void;
  /** Sam's scope question, answered. Routed to the ONE exclusion transaction owner. */
  onExclusionScope: (exercise: EditableExercise, scope: ExerciseExclusionScope) => void;
}

/**
 * ADD, REMOVE AND SWAP — plus the injury review, which is where the Injury
 * action's answer lands. R-123: the sheet itself is `SessionActionSheet`; this
 * component owns the steps and nothing about the chrome around them.
 */
/**
 * THE STEPS THAT COME AFTER A CHANGE HAS ALREADY LANDED. On these the shell's
 * exit says "Close", not "Cancel": the removal is done, the swap is done, and a
 * word promising to undo it would be lying. The pending removal decision and
 * its replacement list are deliberately absent: leaving either one changes
 * nothing.
 */
const AFTER_THE_CHANGE_LANDED: ReadonlySet<ExerciseEditStep['kind']> = new Set([
  'exclusion_scope', 'future_scope', 'result', 'coach_fallback',
]);

function ExerciseEditSheet(props: ExerciseEditSheetProps) {
  const { visible, step, onClose } = props;
  const open = visible && step.kind !== 'closed';

  /**
   * ⚠ **THE LAST OPEN STEP IS HELD SO THE SHEET CAN FADE OUT WITH ITS CONTENT
   * STILL IN IT.** Closing sets the step to `closed`, and this component used
   * to answer that by returning `null` — so Add, Remove and Swap SNAPPED shut
   * while Equipment and Injury faded, which is the inconsistency R-123 names
   * first. RN's `Modal` keeps its children mounted through the dismiss
   * animation; what it cannot do is invent the content the screen has already
   * thrown away.
   */
  const lastOpen = React.useRef<ExerciseEditStep>(step);
  if (step.kind !== 'closed') lastOpen.current = step;
  const shown = step.kind === 'closed' ? lastOpen.current : step;
  if (shown.kind === 'closed') return null;

  return (
    <SessionActionSheet
      visible={open}
      onClose={shown.kind === 'future_scope' ? props.onTodayOnly : onClose}
      testID="exercise-edit-sheet"
    >
      <ExerciseEditBody {...props} step={shown} />
    </SessionActionSheet>
  );
}

function ExerciseEditBody({
  sessionId,
  step,
  editableExercises,
  onClose,
  onStep,
  onSwapPick,
  onApplyInjuryReview,
  onApplySwapToday,
  onApplyAddToday,
  onRemoveToday,
  onOfferRemovedReplacement,
  onKeepRemovedWithoutReplacement,
  onAddRemovedReplacement,
  onFutureScope,
  onTodayOnly,
  onExclusionScope,
  onAddFamily,
  onAddGroup,
  onAddLeaf,
}: Omit<ExerciseEditSheetProps, 'visible'> & { step: Exclude<ExerciseEditStep, { kind: 'closed' }> }) {

  // TASK 8 (ruling 12); RETIREMENT PASS (Sam's ruling on the reviewer's
  // finding): every step below used to have a menu, an exercise_menu, or
  // (concern_reason/injury_area/injury_severity) each other to fall back to.
  // All are retired — every step here is now reached by a single direct tap
  // (a row button or a top-of-page icon), so there is nowhere shallower to
  // return to except closed. `future_scope` keeps its own destination
  // (`onTodayOnly`, unchanged) and `confirm_add` keeps returning to
  // `add_kind` (that pairing survives untouched, since add was never routed
  // through exercise_menu or concern_reason).
  /**
   * WHERE BACK GOES, OR `undefined` WHERE THERE IS NOWHERE SHALLOWER.
   *
   * ⚠ **`undefined` IS NOT "CLOSE". IT IS "DRAW NO BACK AT ALL".** This
   * function used to fall through to `onClose()` on every step it had no
   * answer for, so `pick_exercise`, `add_family`, `choose_swap`,
   * `confirm_remove`, `coach_fallback` and `future_scope` all showed a Back
   * button that was really an exit. Sam's acceptance is *"Back moves up
   * exactly one step"*, and this app already refuses to draw a door that
   * cannot act (`SessionChangeHub`). Cancel is the exit, on every step, drawn
   * once by the shell.
   *
   * ⚠ **`choose_swap` AND `confirm_remove` GAIN THE BACK THEY SHOULD HAVE
   * HAD.** Both are only ever reached from `pick_exercise` — `prepareSwap` has
   * one caller and `confirm_remove` has one setter, both inside the picker —
   * so the step above them is that picker, and closing the sheet was never it.
   *
   * `exclusion_scope` still has none, and that is not an oversight: behind it
   * is a removal that has ALREADY HAPPENED, so going back would offer to remove
   * an exercise that is no longer in the session. `result` and `coach_fallback`
   * are outcomes, not questions. `future_scope` is asked AFTER the change
   * landed; its old Back applied the today-only default and closed, which is
   * exactly what Cancel does there now — one affordance instead of two that did
   * the same thing.
   */
  const backTarget = (): (() => void) | undefined => {
    // A swap chosen from the menu has somewhere shallower to go, and it is the
    // menu. An injury-flow swap does not carry one.
    if (step.kind === 'confirm_swap') {
      const menu = step.fromMenu;
      return menu ? () => onStep(menu) : undefined;
    }
    if (step.kind === 'confirm_add') {
      // The list it came from, when it came from one. `add_kind` — the seven
      // hand-written labels this replaced — is gone, so there is no shallower
      // step for an add that arrived any other way.
      const pick = step.fromPick;
      return pick ? () => onStep(pick) : undefined;
    }
    // ⚠ **EVERY ADD STEP CLIMBS TO THE LIST IT WAS ACTUALLY OPENED FROM.**
    //
    // The depth is not uniform — Sam's extra question exists under Lower body
    // and Upper body and nowhere else — so Back cannot be "go up one kind". The
    // exercises are reached from a LEAF step on one branch and from the GROUP
    // step on the other, and each carries whichever it was. Hard-coding either
    // would skip a level on one branch and invent one on the other.
    if (step.kind === 'add_pick') {
      const list = step.fromList;
      return list ? () => onStep(list) : undefined;
    }
    if (step.kind === 'add_leaf') {
      const group = step.fromGroup;
      return group ? () => onStep(group) : undefined;
    }
    if (step.kind === 'add_group') {
      const family = step.fromFamily;
      return family ? () => onStep(family) : undefined;
    }
    if (step.kind === 'choose_swap') {
      return () => onStep({ kind: 'pick_exercise', action: 'swap' });
    }
    if (step.kind === 'confirm_remove') {
      return () => onStep({ kind: 'pick_exercise', action: 'remove' });
    }
    if (step.kind === 'choose_removal_replacement') {
      return () => onStep({ kind: 'decide_removal', exercise: step.exercise });
    }
    return undefined;
  };

  useSessionActionStep({
    key: exerciseEditStepKey(step),
    eyebrow: 'Session edit',
    title: exerciseEditTitle(step),
    subtitle: exerciseEditSubtitle(step),
    onBack: backTarget(),
    cancelLabel: step.kind === 'decide_removal'
      ? 'Go back'
      : AFTER_THE_CHANGE_LANDED.has(step.kind) ? 'Close' : 'Cancel',
  });

  // ⚠ **INJURY NO LONGER COMES THROUGH HERE (Sam, 2026-08-20).** It was the
  // last door that reached this picker from the top of the page with no row
  // context, and asking it "which exercise?" was the defect: an injury affects
  // however many rows it affects, and only the app can know which. It opens the
  // guided flow directly now and reviews the whole session. What is left is
  // Swap and Remove, both of which really are about one row.
  const renderExercisePicker = (action: ExercisePickAction) => {
    if (editableExercises.length === 0) {
      return (
        <>
          <Text style={styles.exerciseEditBody}>
            There are no editable gym exercises in this session.
          </Text>
        </>
      );
    }
    // `pick_exercise` rows are NOT iconized (ruling 10 scope line): the label
    // is an unbounded, dynamic exercise name (`editableExercises` — the
    // athlete's actual session content), not a fixed enum like the steps
    // below. There is no established name -> icon vocabulary anywhere in the
    // app for arbitrary exercise names, and inventing one is its own design
    // pass, not an icon-only change. Now that `swap_reason`/`add_kind`/
    // `future_scope` are paid, this exception is the dynamic-content case the
    // brief anticipates, not a leftover gap.
    return editableExercises.map((exercise) => (
      <ExerciseSheetOption
        key={exercise.key}
        label={displayExerciseName(exercise.name)}
        /* ⚠ **THE INGRESS TEST IDS MOVED HERE WITH THE INGRESS ITSELF.**
         * They named the per-row swap/remove icons, which Sam deleted on
         * 2026-08-19; this picker IS the swap/remove ingress now, one row per
         * exercise. Deleting the ids with the icons would have left the explorer
         * and the lifecycle witness pointing at a door that exists under a new
         * name — the "gate must watch the deleted surface" shape. */
        testID={
          action === 'swap'
            ? explorerTestId.componentSwapIngress(sessionId, exercise.targetId ?? exercise.key)
            : explorerTestId.componentDeleteIngress(sessionId, exercise.targetId ?? exercise.key)
        }
        onPress={() => {
          // SWAP MEANS ONLY "I WANT A DIFFERENT EXERCISE" (Sam, 2026-08-19), so
          // the pick goes STRAIGHT to the ranked alternatives. Equipment and
          // Injury are their own actions on the hub and ask their own questions.
          if (action === 'swap') onSwapPick(exercise);
          else onStep({ kind: 'confirm_remove', exercise });
        }}
      />
    ));
  };

  const renderStep = () => {
    switch (step.kind) {
      case 'pick_exercise':
        return <>{renderExercisePicker(step.action)}</>;
      /**
       * ONE REVIEW OF ALL PROPOSED CHANGES (Sam, 2026-08-20).
       *
       * Every affected row is listed, whatever the ladder answered for it, and
       * the two outcomes are visibly different things: a row being SWAPPED names
       * what it becomes, a row being WITHHELD says so in the same words the
       * session itself will show it under afterwards.
       *
       * ⚠ **THERE IS NO PER-ROW APPROVE, AND THAT IS THE RULING.** *"Apply the
       * approved changes together."* One button, one write, all of them or none.
       *
       * ⚠ **NO CLAIM IS COMPOSED HERE.** The headline and the button label are
       * fields on the review, derived by `utils/sessionInjuryReview` from what it
       * actually found — including the case where it found nothing. A cheerful
       * line written on the glass would be a second, un-derived claim, which is
       * the exact shape of *"never claim the session was safely changed if
       * nothing changed"*.
       */
      case 'injury_review': {
        const { review } = step;
        return (
          <>
            <Text style={styles.exerciseEditBody} testID="injury-review-headline">
              {review.headline}
            </Text>
            {/* ── 1. REAL SWAPS, AND THE ONLY ARROWS ON THIS SCREEN ────────
              * R-124, Sam: *"Do not show false arrows between unrelated
              * exercises."* Every entry here came from rungs 1-4 and really is
              * a replacement for the row it names. */}
            {review.changes.map((change) => (
              <View
                key={`${change.kind}:${change.from}`}
                style={styles.exerciseEditSuggestionCard}
                testID={`injury-review-change-${change.kind}`}
              >
                <Text style={styles.exerciseEditSuggestionName}>
                  {`${displayExerciseName(change.from)} \u2192 ${displayExerciseName(change.to!)}`}
                </Text>
                <Text style={styles.exerciseEditSuggestionMeta}>{change.explanation}</Text>
              </View>
            ))}
            {review.conditioningChanges.length > 0 ? (
              <View style={styles.exerciseEditGroup} testID="injury-review-conditioning">
                <Text style={styles.exerciseEditGroupLabel}>{SECTION_LABELS.conditioning}</Text>
                {review.conditioningChanges.map(change => (
                  <View key={`conditioning:${change.from}:${change.to}`} style={styles.exerciseEditSuggestionCard}>
                    <Text style={styles.exerciseEditSuggestionName}>
                      {!change.from && change.to ? `+ ${displayExerciseName(change.to)}` : change.to
                        ? `${displayExerciseName(change.from)} → ${displayExerciseName(change.to)}`
                        : `− ${displayExerciseName(change.from!)}`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {review.restored.map(name => (
              <View key={`restored:${name}`} style={styles.exerciseEditSuggestionCard} testID="injury-review-restored">
                <Text style={styles.exerciseEditSuggestionName}>{`+ ${displayExerciseName(name)}`}</Text>
              </View>
            ))}
            {review.withdrawn.map(name => (
              <View key={`withdrawn:${name}`} style={styles.exerciseEditSuggestionCard} testID="injury-review-withdrawn">
                <Text style={styles.exerciseEditSuggestionName}>{`− ${displayExerciseName(name)}`}</Text>
              </View>
            ))}
            {/* ── 2. PAUSED — A LIST, WITH NOTHING ON THE OTHER SIDE OF IT ──
              * *"List the paused work and the adjusted session separately."*
              * These rows have no partner, so they are rendered in a section
              * that structurally cannot draw one. */}
            {review.paused.length > 0 ? (
              <View style={styles.exerciseEditGroup} testID="injury-review-paused">
                <Text style={styles.exerciseEditGroupLabel}>
                  {`${signedCopy('injury_review.paused_heading')} `
                    + `${review.bodyPart.toUpperCase()}`}
                </Text>
                {review.paused.map((change) => (
                  <View
                    key={`paused:${change.from}`}
                    style={styles.exerciseEditSuggestionCard}
                    testID="injury-review-change-paused"
                  >
                    <Text style={styles.exerciseEditSuggestionName}>
                      {displayExerciseName(change.from)}
                    </Text>
                    <Text style={styles.exerciseEditSuggestionMeta}>{change.explanation}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {/* ── 3. THE BLOCK THAT GOES IN THEIR PLACE, NAMED AGAINST NOTHING ── */}
            {review.added.length > 0 ? (
              <View style={styles.exerciseEditGroup} testID="injury-review-added">
                <Text style={styles.exerciseEditGroupLabel}>
                  {signedCopy('injury_review.added_heading')}
                </Text>
                {review.added.map((candidate) => (
                  <View
                    key={`added:${candidate.name}`}
                    style={styles.exerciseEditSuggestionCard}
                    testID="injury-review-added-row"
                  >
                    <Text style={styles.exerciseEditSuggestionName}>
                      {displayExerciseName(candidate.name)}
                    </Text>
                    <Text style={styles.exerciseEditSuggestionMeta}>
                      {`${candidate.sets} x ${candidate.repsMin}-${candidate.repsMax}`
                        + `${candidate.perSide ? ' per side' : ''}`
                        + `${candidate.weightKg !== null ? ` \u00b7 ${candidate.weightKg}kg` : ''}`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {/* R-103's partial-coverage disclosure, for the session as a whole. */}
            {review.untrainedInWords.length > 0 ? (
              <Text style={styles.exerciseEditBody} testID="injury-review-untrained">
                {`That means no ${review.untrainedInWords.join(', ')} this session.`}
              </Text>
            ) : null}
            {review.untouched.length > 0 ? (
              <Text style={styles.exerciseEditBody} testID="injury-review-untouched">
                {`The rest of your session is unchanged: ${review.untouched
                  .map((name) => displayExerciseName(name)).join(', ')}.`}
              </Text>
            ) : null}
            <Button
              label={review.approveLabel}
              variant="primary"
              size="md"
              testID="injury-review-apply"
              onPress={() => onApplyInjuryReview(step)}
            />
          </>
        );
      }
      /* ⚠ **`add_kind` IS DELETED — 2026-08-19.**
       *
       * Seven hand-written labels over a table of TWELVE suggestions that asked
       * nothing about the athlete's kit or their injuries, and offered whichever
       * of two names the session did not already contain. Sam: *"Add any legal
       * exercise, mobility or conditioning component. Respect equipment, injury
       * and genuine session limits."* Sam's hierarchy — `add_family` /
       * `add_group` / `add_leaf` / `add_pick` — replaces it, over the app's own
       * vocabulary. */
      /* LEVEL 1 — SAM'S THREE. The glyph is the SESSION SCREEN'S own, through
       * `SESSION_SECTION_ICON_KIND` (R-116's one owner), because these three
       * buttons name the same three sections the athlete's session is already
       * divided into. Adding under "Conditioning" here lands in the section
       * called Conditioning there. */
      case 'add_family':
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              Everything here is safe with today’s kit and how you are pulling up.
            </Text>
            {step.families.map((family) => (
              <ExerciseSheetOption
                key={family.id}
                label={family.label}
                sub={`${family.count} to choose from`}
                icon={<RowIcon kind={SESSION_SECTION_ICON_KIND[family.id]} size={18} />}
                testID={`add-family-${family.id}`}
                onPress={() => onAddFamily(family.id, step)}
              />
            ))}
          </>
        );
      /* LEVEL 2 — Sam's headings. Every row carries its FAMILY'S glyph, which
       * is the honest one: these are all Strength, or all Conditioning. */
      case 'add_group':
        return (
          <>
            {step.groups.map((group) => (
              <ExerciseSheetOption
                key={group.id}
                label={group.label}
                sub={`${group.count} to choose from`}
                icon={<RowIcon kind={SESSION_SECTION_ICON_KIND[step.family]} size={18} />}
                testID={`add-group-${group.id}`}
                onPress={() => onAddGroup(step.family, group.id, step)}
              />
            ))}
          </>
        );
      /* SAM'S EXTRA STEP — Hinge / Squat / Single leg / Accessories, and the
       * Upper body four. Reached ONLY from a heading with more than one legal
       * leaf, which is what *"only where needed"* means in code. */
      case 'add_leaf':
        return (
          <>
            {step.leaves.map((leaf) => (
              <ExerciseSheetOption
                key={leaf.id}
                label={leaf.label}
                sub={`${leaf.count} to choose from`}
                icon={<RowIcon kind={SESSION_SECTION_ICON_KIND[step.family]} size={18} />}
                testID={`add-leaf-${leaf.id}`}
                onPress={() => onAddLeaf(step.family, leaf.id, step)}
              />
            ))}
          </>
        );
      /* THE EXERCISES — *"exercise choices"*, all of them.
       *
       * ⚠ **THE SCROLLING AND THE OPEN-AT-THE-TOP RULE BOTH MOVED TO THE SHELL
       * (R-123).** Three add levels each kept a `maxHeight: 360` `ScrollView`
       * of their own, keyed by their own coordinate — and `pick_exercise`,
       * `choose_swap` and `injury_review`, whose lists are just as unbounded,
       * had none at all and ran off the bottom of the screen. One scroll owner,
       * keyed by `exerciseEditStepKey`, answers both. */
      case 'add_pick':
        return (
          <>
            {step.options.map((option) => (
              <Button
                key={option.name}
                label={option.name}
                variant="secondary"
                size="md"
                onPress={() => onStep({
                  kind: 'confirm_add',
                  addKind: 'Other',
                  suggestion: option.suggestion,
                  fromPick: step,
                })}
                style={styles.exerciseEditSecondaryButton}
              />
            ))}
          </>
        );
      case 'confirm_remove':
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              This will remove it from today’s session.
            </Text>
            <Button
              label="Remove exercise"
              variant="danger"
              size="md"
              onPress={() => onRemoveToday(step.exercise)}
              testID={explorerTestId.componentDeleteConfirm(
                sessionId,
                step.exercise.targetId ?? step.exercise.key,
              )}
            />
          </>
        );
      case 'decide_removal':
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              Would you like to replace {displayExerciseName(step.exercise.name)} with another exercise, or remove it without a replacement?
            </Text>
            <Button
              label="Yes, show replacements"
              variant="primary"
              size="md"
              onPress={() => onOfferRemovedReplacement(step.exercise)}
            />
            <Button
              label="No, remove it"
              variant="secondary"
              size="md"
              onPress={() => onKeepRemovedWithoutReplacement(step.exercise)}
              style={styles.exerciseEditSecondaryButton}
            />
          </>
        );
      case 'choose_removal_replacement':
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              Pick a safe replacement for {displayExerciseName(step.exercise.name)}.
            </Text>
            {step.groups.map((group) => (
              <View key={group.id} style={styles.exerciseEditGroup}>
                <Text style={styles.exerciseEditGroupLabel}>{group.label}</Text>
                {group.options.map((option) => (
                  <Button
                    key={`${group.id}:${option.name}`}
                    label={option.name}
                    variant="secondary"
                    size="md"
                    onPress={() => onAddRemovedReplacement(step.exercise, option.suggestion)}
                    style={styles.exerciseEditSecondaryButton}
                  />
                ))}
              </View>
            ))}
          </>
        );
      case 'choose_swap':
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              Pick what you would rather do instead of{' '}
              {displayExerciseName(step.exercise.name)}.
            </Text>
            {step.groups.map((group) => (
              <View key={group.id} style={styles.exerciseEditGroup}>
              {/* THE LABEL IS THE POINT. Six unlabelled options are a list;
                  three labelled groups tell the athlete HOW FAR each option
                  is from what they were given. */}
              <Text style={styles.exerciseEditGroupLabel}>{group.label}</Text>
              {group.options.map((option) => (
                <Button
                  key={`${group.id}:${option.name}`}
                  label={option.name}
                  variant="secondary"
                  size="md"
                  onPress={() => onStep({
                    kind: 'confirm_swap',
                    exercise: step.exercise,
                    suggestion: option.suggestion,
                    reason: step.reason,
                    fromMenu: step,
                  })}
                  style={styles.exerciseEditSecondaryButton}
                />
                ))}
              </View>
            ))}
          </>
        );
      case 'confirm_swap': {
        const isRestFallback = step.suggestion.kind === 'rest';
        const replacement = step.suggestion.kind === 'exercise'
          ? step.suggestion.suggestion
          : null;
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              {isRestFallback
                ? `No safe useful substitute is available for ${displayExerciseName(step.exercise.name)}. Remove this exercise and rest the slot for today.`
                : `Replace ${displayExerciseName(step.exercise.name)} with ${displayExerciseName(replacement?.name)} for today’s session.`}
            </Text>
            <View style={styles.exerciseEditSuggestionCard}>
              <Text style={styles.exerciseEditSuggestionName}>
                {isRestFallback ? 'Rest this exercise slot' : displayExerciseName(replacement?.name)}
              </Text>
              <Text style={styles.exerciseEditSuggestionMeta}>
                {isRestFallback
                  ? 'Rest is only used because no safe useful work remains.'
                  : suggestionPrescription(replacement!)}
              </Text>
            </View>
            <Button
              label="Apply change"
              variant="primary"
              size="md"
              onPress={() => onApplySwapToday(step)}
            />
          </>
        );
      }
      case 'confirm_add':
        return (
          <>
            <Text style={styles.exerciseEditBody}>
              Add {displayExerciseName(step.suggestion.name)} to today’s session.
            </Text>
            <View style={styles.exerciseEditSuggestionCard}>
              <Text style={styles.exerciseEditSuggestionName}>{displayExerciseName(step.suggestion.name)}</Text>
              <Text style={styles.exerciseEditSuggestionMeta}>
                {suggestionPrescription(step.suggestion)}
              </Text>
            </View>
            <Button
              label="Add exercise"
              variant="primary"
              size="md"
              onPress={() => onApplyAddToday(step)}
            />
          </>
        );
      case 'future_scope':
        return (
          <>
            <Text style={styles.exerciseEditBody}>{futureScopeBody(step)}</Text>
            <Text style={styles.exerciseEditQuestion}>
              Apply this change to future weeks?
            </Text>
            <ExerciseSheetOption
              label="Today only"
              sub="Keep this as a one-off change"
              icon={todayOnlyIcon(OPTION_ICON_ACCENT)}
              onPress={onTodayOnly}
            />
            <ExerciseSheetOption
              label="Future weeks too"
              sub="Save this as an ongoing adjustment"
              icon={futureWeeksIcon(OPTION_ICON_ACCENT)}
              onPress={() => onFutureScope(step)}
            />
          </>
        );
      /* ── SAM'S SCOPE QUESTION, RENDERED FROM THE ONE VOCABULARY OWNER ──────
       *
       * The question, the three labels and the three explanations all come from
       * `rules/exerciseExclusions`, which My Status reads too — a question
       * worded two ways is two questions to the person answering it.
       *
       * The explorer test ids are the SAME ones the two-answer step carried, so
       * the accessibility walk and the component-deletion trace keep addressing
       * this control by the identity they already know. `'today'` still means
       * "today only"; `'future'` is claimed by `until_changed`, the answer that
       * replaced "Future weeks too"; and `'block'` is the new third id. */
      case 'exclusion_scope':
        return (
          <>
            <ExplorerRenderWitness
              testID={explorerTestId.componentDeleteResult(
                sessionId,
                step.exercise.targetId ?? step.exercise.key,
              )}
            />
            <Text style={styles.exerciseEditBody}>
              {displayExerciseName(step.exercise.name)} was removed from today’s session.
            </Text>
            <Text style={styles.exerciseEditQuestion}>
              {EXERCISE_EXCLUSION_QUESTION}
            </Text>
            {EXERCISE_EXCLUSION_SCOPES.map((scope) => (
              <ExerciseSheetOption
                key={scope}
                label={EXERCISE_EXCLUSION_SCOPE_LABEL[scope]}
                sub={EXERCISE_EXCLUSION_SCOPE_DETAIL[scope]}
                icon={scope === 'today_only'
                  ? todayOnlyIcon(OPTION_ICON_ACCENT)
                  : futureWeeksIcon(OPTION_ICON_ACCENT)}
                testID={explorerTestId.componentDeleteScope(
                  sessionId,
                  step.exercise.targetId ?? step.exercise.key,
                  EXCLUSION_SCOPE_TEST_ID[scope],
                )}
                onPress={() => onExclusionScope(step.exercise, scope)}
              />
            ))}
          </>
        );
      case 'coach_fallback':
        // R5.7 — THE BETA COACH CUT. `programControlActions` still RETURNS a
        // `coach_fallback` route (`:305/:411/:935`) and it stays frozen under
        // LR-6, so this step still renders. What it must never do is strand
        // the athlete at a sheet with nothing to press — the half-alive
        // surface C(a) exists to prevent. It reports the refusal it already
        // carries and closes.
        //
        // PROPOSED COPY, UNSIGNED, on the line below `step.message`.
        return (
          <>
            <Text style={styles.exerciseEditBody}>{step.message}</Text>
            <Text style={styles.exerciseEditBody}>
              {'Nothing has changed. You can make this change yourself from the day or session controls.'}
            </Text>
            <Button
              label="Close"
              variant="secondary"
              size="md"
              onPress={onClose}
              style={styles.exerciseEditSecondaryButton}
            />
          </>
        );
      case 'result':
        return (
          <>
            <Text style={styles.exerciseEditBody}>{step.message}</Text>
            <Button
              label="Done"
              variant={step.ok ? 'primary' : 'secondary'}
              size="md"
              onPress={onClose}
            />
          </>
        );
      default:
        return null;
    }
  };

  return <View style={styles.exerciseEditOptions}>{renderStep()}</View>;
}

/**
 * THE STEP'S SCROLL IDENTITY — what tells the shell this is a DIFFERENT list.
 *
 * `kind` alone is not enough: walking Lower body -> Hinge is two `add_group`
 * steps in a row, and a shared key would leave the second one opening at the
 * first one's scroll offset. That is the exact defect measured on the simulator
 * while the Add hierarchy was built. Every level that carries a coordinate puts
 * it in the key.
 */
function exerciseEditStepKey(step: Exclude<ExerciseEditStep, { kind: 'closed' }>): string {
  switch (step.kind) {
    case 'pick_exercise':
      return `pick_exercise:${step.action}`;
    case 'add_group':
      return `add_group:${step.family}`;
    case 'add_leaf':
      return `add_leaf:${step.family}:${step.group}`;
    case 'add_pick':
      return `add_pick:${step.family}:${step.leaf}`;
    case 'confirm_add':
      return `confirm_add:${step.suggestion.name}`;
    case 'confirm_swap':
      /* `SuggestedSwap` is a union and only its `exercise` arm carries a name;
       * the `rest` arm has none. The ROW is what identifies this step either
       * way, and it is present on both. */
      return `confirm_swap:${step.exercise.key}`;
    case 'choose_swap':
    case 'confirm_remove':
    case 'decide_removal':
    case 'choose_removal_replacement':
    case 'exclusion_scope':
      return `${step.kind}:${step.exercise.key}`;
    default:
      return step.kind;
  }
}

function exerciseEditTitle(step: ExerciseEditStep): string {
  switch (step.kind) {
    case 'pick_exercise':
      return step.action === 'swap' ? 'Swap which exercise?' : 'Remove which exercise?';
    case 'injury_review':
      return step.review.nothingChanges ? 'Nothing needs changing' : 'Review these changes';
    case 'add_family':
      return 'What do you want to add?';
    case 'add_group':
      return step.familyLabel;
    case 'add_leaf':
      return step.groupLabel;
    case 'add_pick':
      return step.label;
    case 'confirm_remove':
      return 'Remove this exercise?';
    case 'decide_removal':
      return 'Replace it?';
    case 'choose_removal_replacement':
      return 'Choose a replacement';
    case 'choose_swap':
      return 'What would you rather do?';
    case 'confirm_swap':
      return 'Swap exercise?';
    case 'confirm_add':
      return 'Add exercise?';
    case 'exclusion_scope':
      return 'Exercise removed';
    case 'future_scope':
      if (step.action === 'swap') return 'Exercise swapped';
      return 'Exercise added';
    case 'coach_fallback':
      return step.title;
    case 'result':
      return step.title;
    default:
      // Unreachable: every live ExerciseEditStep kind has its own case
      // above. Kept only as a type-safe fallback, never as athlete-facing
      // copy — the retired "Edit exercises" title does not belong here.
      return '';
  }
}

function exerciseEditSubtitle(step: ExerciseEditStep): string | null {
  switch (step.kind) {
    case 'pick_exercise':
      return 'Team training entries are left alone.';
    case 'injury_review':
      /* The athlete's own answer echoed back, so the review is plainly the
       * answer to the ONE question they were asked. */
      return `${step.review.bodyPart} \u00b7 ${step.review.severity}/10`;
    case 'confirm_remove':
    case 'confirm_swap':
      return displayExerciseName(step.exercise.name);
    case 'decide_removal':
    case 'choose_removal_replacement':
      return null;
    case 'confirm_add':
      return 'Add one exercise or small block, not another full session.';
    case 'add_family':
      return 'Add one exercise or small block, not another full session.';
    case 'add_group':
    case 'add_leaf':
      return 'Pick the kind of work.';
    case 'add_pick':
      return 'Everything here is legal with today’s kit and injuries.';
    case 'exclusion_scope':
      /* Sam's phone, 2026-08-26 (checklist #6): the body already opens with
       * "<Name> was removed from today's session", so a bare-name subtitle
       * printed the exercise twice. The sentence keeps the name; the
       * subtitle stands down. */
      return null;
    case 'future_scope':
      return 'Default is today only.';
    case 'coach_fallback':
      return 'Coach fallback';
    default:
      return null;
  }
}

function futureScopeBody(step: FutureScopeStep): string {
  if (step.action === 'swap') {
    return `${displayExerciseName(step.exercise.name)} was replaced with ${displayExerciseName(step.suggestion.name)} in today’s session.`;
  }
  return `${displayExerciseName(step.suggestion.name)} was added to today’s session.`;
}

interface ExerciseSheetOptionProps {
  label: string;
  sub?: string;
  /** Ruling 10 — the same 38x38 icon chip `SheetOption`/`MenuOption` use
   * elsewhere. Optional because `pick_exercise` renders this component over
   * an unbounded, dynamic list of real exercise names with no established
   * icon vocabulary (see the `renderExercisePicker` comment below) — every
   * FIXED-vocabulary caller (`swap_reason`, `add_kind`, `future_scope`) now
   * passes one. */
  icon?: React.ReactNode;
  testID?: string;
  onPress: () => void;
}

interface SessionOptionsRowProps {
  label: string;
  sub: string;
  icon: React.ReactNode;
  iconTint: string;
  testID: string;
  onPress: () => void;
}

/**
 * The active-session menu uses the same flat row rhythm as Day plan options:
 * one circular icon well, label/subline, and a quiet divider. The glyph itself
 * comes from SessionChangeHub's original icon owner so moving the actions can
 * never redraw the dumbbell, medical cross or plus.
 */
function SessionOptionsRow({
  label, sub, icon, iconTint, testID, onPress,
}: SessionOptionsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.sessionOptionsRow, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.sessionOptionsIcon, { backgroundColor: iconTint }]}>
        {icon}
      </View>
      <View style={styles.sessionOptionsText}>
        <Text style={styles.sessionOptionsLabel}>{label}</Text>
        <Text style={styles.sessionOptionsSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

function ExerciseSheetOption({ label, sub, icon, testID, onPress }: ExerciseSheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      /* R-109 (Sam, 2026-08-20): *"fix the six accessibility labels so athletes hear
         exercise names, not internal IDs."* The row is ONE accessibility leaf
         (`accessibilityRole="button"`), so its label is the whole of what a
         screen-reader user hears — and it was the test id.
         ⚠ **THE IDENTITY IS NOT LOST: `testID` still sets
         `accessibilityIdentifier`, which is what Maestro's `id:` and the
         explorer match on.** Only the SPOKEN name changes. */
      accessibilityLabel={label}
      style={({ pressed }) => [
        icon ? styles.exerciseEditOptionWithIcon : styles.exerciseEditOption,
        pressed && styles.exerciseEditOptionPressed,
      ]}
    >
      {icon ? <View style={styles.exerciseEditOptionIcon}>{icon}</View> : null}
      <View style={[styles.exerciseEditOptionTextWrap, icon && { flex: 1 }]}>
        <Text style={styles.exerciseEditOptionLabel}>{label}</Text>
        {sub ? <Text style={styles.exerciseEditOptionSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

function PlayIcon() {
  // Small solid play triangle, lime-on-dark. Sized to match the 16×16
  // outline ring — the triangle sits centered with comfortable inner
  // padding so the affordance remains tappable but visually quiet.
  return (
    <Svg width={7} height={7} viewBox="0 0 12 12">
      <Polygon points="3,2 3,10 10,6" fill="#C8FF00" />
    </Svg>
  );
}

/* ⚠ **THE PER-ROW ICON VOCABULARY IS DELETED — 2026-08-19.**
 *
 * `SwapIcon`, `RemoveIcon`, `PlusIcon` and `InjuryIcon` drew the always-visible
 * row controls and the old header row. Both went when the labelled hub landed;
 * the glyphs stayed, referenced by nothing. The hub draws its own five in
 * `components/SessionChangeHub`, where a SHARED vocabulary belongs. Proven
 * unused by `tsc --noUnusedLocals` before deletion. */

// ── ExerciseSheetOption icons (ruling 10 — swap_reason / add_kind /
// future_scope) ──
// Redrawn locally rather than imported — the same convention `SwapIcon` and
// `PlusIcon` above already state ("this row's icon vocabulary does not reach
// across screens"): where a concept is the SAME fact as elsewhere
// (add_kind's body areas vs. `GuidedInjuryFlowSheet`'s injury regions;
// Prehab/Mobility/Conditioning vs. `PlanChangeSheet`'s session-type rows) the
// glyph reuses the same visual family, but the SVG path lives here.
const optionGlyph = (color: string, children: React.ReactNode) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);
const OPTION_ICON_ACCENT = '#C8FF00';
/* `otherOptionIcon` DELETED with the two enums that shared it
 * (`swap_reason` and `add_kind`), both of which are gone. */
/* `ADD_EXERCISE_KIND_ICON` DELETED with the `add_kind` step it decorated
 * (2026-08-19). Seven icons for seven labels that no longer exist. */
/* `SWAP_REASON_ICON` DELETED with the `swap_reason` step it decorated
 * (2026-08-19). Six icons for six labels that no longer exist. */
/** future_scope — "Today only" vs. "Future weeks too": a blank calendar day
 * (same family as `PlanChangeSheet`'s move-destination day glyph) vs. that
 * same day with a repeat loop, because the row is asking whether the change
 * repeats. */
const todayOnlyIcon = (color: string) => optionGlyph(color, (
  <><Path d="M4 5h16v15H4z" /><Path d="M4 10h16" /><Path d="M9 3v4" /><Path d="M15 3v4" /></>
));
const futureWeeksIcon = (color: string) => <LfaIcon name="future-weeks" color={color} />;

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

/**
 * The horizontal inset inside an exercise card — where its content starts and
 * where its checkbox ends. Declared once because the "Select all" row has to
 * land on exactly the same line (Sam, 2026-08-22), and a second copy of 13
 * would drift the first time either is touched.
 */
const EXERCISE_CARD_INSET = 13;

/**
 * The width the exercise content column keeps clear on its right for the quick
 * actions. ONE number: the column reserves it, and the open-cue control slot
 * cancels it so the controls drop straight down rather than 68pt inboard.
 */
const EXERCISE_COLUMN_ACTION_RESERVE = 68;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C0C0C' },
  smokeContractMarkerRoot: {
    // Container holds the mount probe + ready/failed marker. Real
    // size (60×30) + absolute position so it survives any parent
    // layout collapse (the renderer is mounted as a sibling of
    // day-workout-title inside the header).
    position: 'absolute',
    top: 96,
    left: 96,
    width: 64,
    height: 30,
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeContractMounted: {
    // Cyan 30×30 mount probe — always rendered in smoke mode.
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
    height: 30,
    backgroundColor: '#00B8D4',
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeContractMarker: {
    // Ready/failed state marker — offset from the mount probe so
    // Maestro hit-tests can distinguish them.
    position: 'absolute',
    top: 0,
    left: 32,
    width: 30,
    height: 30,
    zIndex: 2147483647,
    elevation: 2147483647,
  },
  smokeContractReady: {
    backgroundColor: '#00C853',
  },
  smokeContractFailed: {
    backgroundColor: '#FF1744',
  },
  smokeContractMarkerText: {
    fontSize: 1,
    color: 'transparent',
  },

  // ── Header ──
  // The bottom divider mirrors the Finish section's whisper line: a
  // hairline at #121212 (just above the #0C0C0C screen background).
  // Together these two lines bracket the session — a quiet open, a
  // quiet close — and create rhythm without adding visual weight.
  // paddingBottom dropped md → sm so the header metadata sits visually
  // closer to the first exercise block; combined with the scroll's
  // tighter paddingTop, the session content reads as a direct
  // continuation of the header.
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#121212',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerContent: {},
  // ── Scroll body ──
  scroll: { flex: 1 },
  scrollContent: {
    // Split padding so the gap between the header's metadata row and the
    // first exercise block stays tight (~12–16px) without crowding the
    // "SUPERSET" label. Horizontal + bottom padding unchanged.
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  banner: { marginBottom: spacing.md },

  // Coach-update banner — explains *why* this session was changed.
  // A quietly-elevated card with a lime "COACH UPDATE" eyebrow + one
  // line per note. Sits above the exercise list so attribution lands
  // before the athlete starts the workout. Mobile-friendly: compact
  // padding, no decorations, single accent colour to match the rest
  // of the screen's coach-state vocabulary.
  coachNotesBanner: {
    backgroundColor: 'rgba(200, 255, 0, 0.06)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(200, 255, 0, 0.55)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: 4,
  },
  coachNotesEyebrow: {
    color: colors.accent.lime,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  coachNotesText: {
    color: '#E8F5B0',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  coachNotesToggle: {
    paddingTop: 4,
    alignSelf: 'flex-start',
  },
  coachNotesToggleText: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    opacity: 0.85,
  },
  coachNotesDetails: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(200, 255, 0, 0.18)',
    gap: 2,
  },
  coachNotesDetailLine: {
    color: '#C4D88A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
  },

  sessionDescription: {
    color: '#B0B0B0',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptyBody: {
    color: '#9A9A9A',
    fontSize: 14,
    textAlign: 'center',
  },

  // ── Section labels ──
  sectionLabel: { marginBottom: spacing.sm, marginTop: spacing.xs },

  // ── Exercise list ──
  //
  // Fully flat. Each exercise sits on the screen background with zero
  // surface contrast — transparent fill, zero-width border (so there's
  // no 1px slot either), zero shadow. The Card primitive is now a pure
  // layout/press shell; every visual trace of a "card" is erased. What
  // separates one exercise from the next is whitespace alone: the list
  // gap opens up to 10px so the document reads as a training list
  // written on a dark page, not a stack of widgets.
  // ~8px between cards (R-116 final).
  exerciseList: { gap: 8 },
  executionSections: { gap: spacing.sm },
  executionSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  executionSectionHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  // R-116 — the calendar sits with the date, and the section glyph with its
  // heading. Both are decoration beside text that already says the words.
  // ⚠ R-116, SECOND PASS — *"Vertically centre the calendar icon with the date
  // text. They must share one aligned row and baseline/centre, with a small
  // R-214: the date and its count are gone; Start session took their place at
  // the line's left, the options dots stay at its right. Spacing below the
  // title only — the controls own their own geometry.
  headerSubtitleRow: {
    /* ⚠ **R-214a (Sam, 2026-08-25): *"the padding above start session matches
     * the padding below start session before mobility"*.** It was 3, tuned when
     * this row held a grey caption bound tight to the wordmark above it; a
     * control row is not a caption, and 3 read as the button touching the logo.
     *
     * THE GAP BELOW IS THREE TERMS, so this is written as their SUM rather than
     * as the number 20 — change any one of them and both sides move together,
     * which is the only way a "these two match" ruling survives a later spacing
     * pass: the header's own paddingBottom (sm), the scroll's paddingTop (xs),
     * and the first section header's paddingVertical (sm) above its heading. */
    marginTop: spacing.sm + spacing.xs + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionOptionsButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionOptionsRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sessionOptionsIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sessionOptionsText: { flex: 1 },
  sessionOptionsLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sessionOptionsSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  executionSectionIcon: { marginRight: 10 },
  // R-116 — rows with no stepper still reserve the right-side control slot.
  recoveryControlRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  controlRowSpacer: { flex: 1 },
  // No absolute positioning (third pass): the add-on row uses the same
  // sibling-in-one-row shape as every other control pair.
  addonCheckboxSlot: { flexDirection: 'row', alignItems: 'center' },
  executionSectionHeading: { flex: 1, gap: 2 },
  /* ⚠ **R-216 (Sam, 2026-08-25): *"replace the capitalised headings for each
   * section here to be regular sentence case like the day view is"*.**
   *
   * The `textTransform: 'uppercase'` and its 0.5 tracking are GONE, and nothing
   * replaces them: `SECTION_LABELS` already reads `Mobility / Warm-up` and
   * `Strength`, which is exactly what the Day card prints. The two surfaces
   * were shouting and speaking the same words — one owner, two voices. Do not
   * re-case the strings here to "match"; the label is the label. */
  executionSectionTitle: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  /* R-217 — the quick-add plus. A hairline drops from the last card to a small
   * outlined circle, the same "one more of these" shape the Week card uses. */
  /* R-217a (Sam, 2026-08-25), all three tightened together on his eye pass:
   * *"the little gap between the line and the last exercise needs to be
   * smaller, the line itself can be slightly smaller, and the + button itself
   * can be slightly smaller"*. Gap sm -> xs, connector 10 -> 6, button 28 -> 24
   * with its glyph 16 -> 14 and its own top gap 6 -> 4.
   *
   * ⚠ **SECOND PASS, SAME EYE:** *"move to 0 ... keep the plus the same size but
   * move the circle to 20 ... the tap area can shrink i want there to be less
   * space there"*. The line now starts ON the last card's edge, the circle is
   * 20 around an unchanged 14 glyph, and `hitSlop` drops 10 -> 4. **The glyph
   * staying put while the ring closes on it is the whole instruction — do not
   * "rebalance" the plus down to fit the smaller circle.** */
  /* ⚠ **THE `paddingTop: 0` WAS NOT THE GAP — `executionSectionBody` HAS
   * `gap: spacing.sm`, AND THE PLUS IS ONE OF ITS CHILDREN.** So the flex gap
   * sat between the last card and this row no matter what padding it carried,
   * which is the space Sam photographed. The negative margin CANCELS that one
   * gap and nothing else, and it is written as the same token so the two can
   * never drift apart — a literal `-8` would silently reopen the gap the day
   * the body's spacing changed. */
  quickAddRow: { alignItems: 'center', paddingTop: 0, marginTop: -spacing.sm },
  quickAddConnector: {
    width: StyleSheet.hairlineWidth,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  quickAddButton: {
    marginTop: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  executionSectionCount: {
    color: colors.text.tertiary,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  executionSectionBody: { paddingBottom: spacing.md, gap: spacing.sm },
  // R-111: content first, checkbox last — the tick is the row's right edge.
  // `flex-start` + the checkbox's own marginTop land it on the exercise-name
  // line (card padding 4 + half the 2px difference between the 20px name
  // line-height and the 22px box), which is exactly where the play button used
  // to sit. Centring is what put it level with the weight stepper instead.
  // The wrapper is a plain container now: the card owns the row's geometry, so
  // this must not add a direction, an alignment or a gap that competes with it.
  executionItem: {},
  executionItemComplete: { opacity: 0.42 },
  // ⚠ `marginTop: 3` IS DELETED (third pass). It nudged the tick onto the NAME
  // line under R-111; when R-116 moved it to the control line the nudge stayed
  // and every checkbox sat 3px low, which read as drift down the list. The
  // control row's `alignItems: 'center'` owns the alignment now, alone.
  executionCheckbox: {
    ...sessionExecutionCheckbox,
  },
  executionCheckboxComplete: {
    ...sessionExecutionCheckboxChecked,
  },
  executionCheckmark: { ...sessionExecutionCheckmark },
  executionItemContent: { flex: 1 },
  executionFallbackLabel: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },
  // ══ THE SUBTLE CONTAINER — SAM, 2026-08-20, R-116 FINAL ═══════════════════
  //
  // *"each exercise should sit inside a subtle compact container so its
  // information reads as one unit … 1px low-contrast neutral border; extremely
  // subtle background tint; 10-12px radius; ~6px vertical and 8px horizontal
  // internal padding; ~5-6px between cards; no shadow, glow or heavy panel
  // styling. Do not recreate the large padded cards from the reference."*
  //
  // ⚠ **THE BORDER IS NEUTRAL, NOT ACCENT.** A lime edge would read as a
  // selected or actionable row, and *"the entire card must not become a
  // misleading button"* — `Card` is a layout shell here with no `onPress`, and
  // the only pressables inside it remain the name/Play, the stepper and the
  // tick. Its tint is 2.5% white: enough to separate the block from the page,
  // far below the contrast of anything the athlete can act on.
  //
  // ⚠ **AND IT WRAPS THE GRID WITHOUT TOUCHING IT.** The padding is on the
  // container; the gutter, the text stack and the control group keep their own
  // geometry, so the alignment proven above is unchanged.
  // ⚠ **SAM SUPERSEDED "SIX ON ONE SCREEN" — 2026-08-20, R-116 FINAL.**
  // *"Each exercise should be a comfortable, scrollable card … Scrolling is
  // expected. Do not compress the cards merely to fit six exercises on
  // screen."* The previous pass spent its whole budget buying back a sixth row;
  // the ruling now says generous space AROUND each exercise and tight grouping
  // WITHIN it. Those are different axes and this is the one that changed.
  exerciseCard: {
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 11,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: EXERCISE_CARD_INSET,
    paddingRight: EXERCISE_CARD_INSET,
    ...shadows.none,
  },

  // ── Superset / paired wrapper ──
  //
  // Pro mode: a thin lime left rail that reads as structure, not
  // highlight. Further quieted in this pass: alpha 0.22 → 0.14 (lower
  // opacity = darker against the page), which lets the rail recede to
  // a near-invisible guide. paddingLeft tightens 10 → 6 so the rail
  // aligns much closer to the exercise number column — "these items
  // are indexed together" reads structurally at a glance. paddingBottom
  // (6) is slightly larger than paddingTop (2) so the rail extends a
  // whisker past the last paired row, giving a soft visual end rather
  // than a hard clip. marginTop/Bottom (6) keeps the ~16px air around
  // the block; the SUPERSET eyebrow sits above inside the rail indent.
  pairWrap: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(200, 255, 0, 0.14)',
    paddingLeft: 6,
    paddingTop: 2,
    paddingBottom: 6,
    gap: 0,
    marginTop: 6,
    marginBottom: 6,
  },
  pairTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 2,
  },
  // SUPERSET label — brightness stepped down (0.7 → 0.55) so it sits at
  // a similar visual weight to the muted rail beside it. Neither element
  // dominates; they co-operate as a quiet structural frame.
  pairTagText: {
    color: colors.accent.lime,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    opacity: 0.55,
  },
  // Grouped rows are already transparent from the base exerciseCard
  // override; no additional surface treatment needed. Last-in-group
  // marker kept for future hooks but currently no-op.
  exerciseCardGrouped: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  exerciseCardGroupedLast: {},
  // R-115 — a withheld row is dimmed, never hidden and never deleted.
  exerciseCardWithheld: { opacity: 0.55 },
  injuryWithheldNotice: {
    color: '#FF9A8B',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 6,
  },
  // The Skip marker that REPLACES the checkbox on a withheld row. Same 22x22
  // footprint and the same `marginTop` as `executionCheckbox`, so the row's
  // right edge does not shift between an ordinary row and a withheld one.
  executionSkipMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,154,139,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 3,
  },
  executionSkipText: { color: '#FF9A8B', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.2 },

  // ── Exercise header row ──
  // Label (index) is now plain text, not a chip — the index is information,
  // not decoration. Tighter bottom gap pulls the stats row closer so the
  // exercise reads as one coherent block rather than a stack of rows.
  // ⚠ **R-116, SECOND PASS — SAM: "compress each exercise's left text stack
  // MATERIALLY … so these read as one compact unit, not three separate rows."**
  // The first cut only trimmed the gaps between the three lines and left the
  // row's own padding untouched, so they still read as three rows with less air.
  // Now: this margin 8 -> 0, the list gap between exercises 10 -> 8, the card's
  // vertical padding cut, and the cue row's padding halved. Nothing is resized —
  // every font, control and tap target is untouched; only the air is gone.
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 0,
  },
  exerciseHeaderWithQuickActions: { paddingRight: 68 },
  exerciseLabelBadge: {
    minWidth: 18,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // Number labels are navigational waypoints, not dominant signals. Smaller
  // size, lighter weight, and a dimmer grey so the athlete's eye lands on
  // the exercise name immediately; the index is available when they need it
  // but never competes for attention.
  exerciseLabelText: {
    color: '#5A5A5A',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    width: '100%',
    textAlign: 'center',
  },
  exerciseNameWrap: {
    flex: 1,
  },
  // The visible Play control now lives on the fixed Form-cues line, so the name
  // gets the full content width and wraps independently of every row control.
  exerciseNamePress: {
    flexShrink: 1,
  },
  // Session exercise names share one upright treatment across Mobility,
  // Strength, Power and Recovery.
  exerciseName: {
    color: '#F2F2F2',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 19,
  },
  // Per-row swap/remove icon buttons (ruling 12) — replace the single
  // retired "Change" pill styles.
  exerciseRowActions: {
    position: 'absolute',
    top: 12,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  // The box is back to the original 22pt so the two glyphs sit at the same
  // spacing and the same height as before; the comfortable tap area comes from
  // hitSlop instead of an oversized invisible box.
  exerciseRowActionBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  exerciseRowActionBtnDanger: {
    backgroundColor: 'transparent',
  },
  // Muted play target — outline affordance, no resting fill at all.
  // Pushed one more step down: 16×16 ring at opacity 0.45 with a faint
  // ring (alpha 0.22). At this weight the play icon is a secondary tool
  // the athlete can reach for — it never pulls focus from the exercise
  // title beside it. Pressed state still snaps the ring to full lime as
  // tactile feedback (fill + border brighten, opacity → 1).
  playBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  playBtnActive: {
    backgroundColor: 'rgba(200, 255, 0, 0.18)',
    borderColor: 'rgba(200, 255, 0, 0.55)',
    opacity: 1,
  },

  // ── Stats row (Pro mode) ──
  // One horizontal line: sets × reps on the left, weight control on the
  // right. No column labels. Space-between gives the left text natural
  // breathing room without forced flex column widths.
  // ⚠ **R-116, THIRD PASS — THE ROW IS A GRID, NOT A STACK OF MARGINS.**
  //
  // Sam: *"one fixed-width number gutter; one left content column; … all three
  // content lines must share the exact same left edge; one right control
  // group."* The number used to be a sibling of the NAME, so the gutter existed
  // on line one only and the two lines below started under it.
  exerciseRowGrid: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  // Fixed width — the gutter never changes size, so the content column's left
  // edge is the same on every row. It stretches to the card height so the
  // number centres vertically and its right border becomes one quiet divider.
  exerciseNumberGutter: {
    width: 32,
    marginLeft: -13,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(200, 255, 0, 0.35)',
    marginRight: 13,
  },
  // Every text line lives in here, so they cannot disagree about their left
  // edge. `minWidth: 0` lets a long name wrap INSIDE the column instead of
  // widening it and shoving the controls off the row.
  exerciseContentColumn: { flex: 1, minWidth: 0, paddingRight: EXERCISE_COLUMN_ACTION_RESERVE },
  // Line two. The dose takes the free width; the controls do not shrink.
  // Line two is now TEXT ONLY — the controls left it, so its height is the
  // text's own and the 1-3px rhythm is reachable.
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statsLeftColumn: { flex: 1, minWidth: 0 },
  // ⚠ **THE ONE CONTROL ROW.** Stepper and checkbox are SIBLINGS here — no
  // wrapper between them, no independent margin, no absolute offset, no
  // translation. `alignItems: 'center'` is what makes their centres coincide,
  // and it is the only thing that decides it.
  /* Pinned bottom-right while the row is collapsed — Sam's 2026-08-20 geometry,
     which centres the controls against a compact row without setting its
     height. An OPEN cue renders the same element inside a positioned slot
     below the cue instead. */
  controlsRow: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexShrink: 0,
  },
  // The open-cue slot. Positioned, so the absolute control pins to THIS corner,
  // and tall enough to hold it — a slot with no height would collapse and the
  // control would overlap whatever came next, which is the defect it exists to
  // fix. (Named without the `controlsRow` prefix on purpose: a law counts that
  // string to keep the card's control line single.)
  stackedControlsSlot: {
    position: 'relative',
    height: 34,
    /* 4 → 1. The control sits UNDER THE LAST LINE, not a line below it. The
       drop already tracked the cue's length (the slot is the last child of the
       text column, so it follows however many lines the cue wraps to); the gap
       was what made every row look like a fixed landing place. Sam, twice, and
       the second time on 4: *"padding below last line and the weight toggle
       could be a bit smaller"*. */
    marginTop: 1,
    /* ⚠ **THEY DROP STRAIGHT DOWN — Sam, 2026-08-27.** The first cut put them
       68pt to the left, because this slot lives inside `exerciseContentColumn`
       and that column reserves `paddingRight: 68` for the quick actions, while
       the collapsed controls are absolute against the WHOLE grid and know
       nothing about it. Cancelling exactly that reserve puts the slot's right
       edge back on the card's, so the control lands directly under where it
       already was. The number is negated from the column's own padding on
       purpose: two literals would drift the moment either changed. */
    marginRight: -EXERCISE_COLUMN_ACTION_RESERVE,
  },
  // The dose uses the Form-cues type recipe so the two secondary lines read at
  // one scale. It stays brighter because it is still the prescribed work.
  statsPrimary: {
    color: '#F2F2F2',
    fontSize: 12.5,
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 16,
  },

  // ── Weight segmented control ──
  //
  // Further quieted for the continuous-list treatment. Border alpha drops
  // ~25% (0.16 → 0.12), divider lines on the ± buttons drop to match
  // (0.10 → 0.075). Explicit shadows.none guarantees no elevation or
  // glow. The full control is 22px tall, with the value using the same 12.5px /
  // 16px line box as sets and reps. Functionality is untouched.
  weightControl: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 22,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.12)',
    backgroundColor: 'rgba(200, 255, 0, 0.025)',
    overflow: 'hidden',
    // ⚠ `alignSelf: 'flex-start'` DELETED (third pass) — it was a REAL cause of
    // the drift Sam saw, not just the checkbox's `marginTop`. In a row that
    // centres its children, this pinned the stepper to the TOP, so the two
    // controls were aligned by two different rules. The controlsRow's
    // `alignItems: 'center'` now decides for both, alone.
    ...shadows.none,
  },
  staticLoadControl: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightBtnLeft: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(200, 255, 0, 0.075)',
  },
  weightBtnRight: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(200, 255, 0, 0.075)',
  },
  weightBtnText: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    opacity: 0.8,
  },
  weightValueWrap: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightValueText: {
    color: '#F2F2F2',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
    width: '100%',
    textAlign: 'center',
  },
  weightInput: {
    color: '#F2F2F2',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
    paddingHorizontal: 0,
    paddingVertical: 0,
    width: 60,
    textAlign: 'center',
  },

  // ── Notes / rest ──
  // Tightened against the stats row above. Notes and rest hint both
  // recede into quiet secondary greys — legible, but never competing
  // with the primary numbers in the row above. Line heights nudged
  // down by 1px (17 → 16) for a denser read while keeping the text
  // comfortably readable.
  detailsRow: {
    marginTop: 6,
    gap: 2,
  },
  exerciseNotes: {
    color: '#6E6E6E',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  restHint: {
    color: '#6A6A6A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── Cue toggle ──
  // R-116 — Form cues sit DIRECTLY below sets x reps. 6 -> 1: the disclosure
  // keeps its own `paddingVertical` tap area, so the target does not shrink.
  cueContainer: { marginTop: 3 },
  cueActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cueToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // 2 -> 1 of padding, with `hitSlop` on the Pressable replacing it, so the
    // line tightens without the tap target shrinking.
    paddingVertical: 1,
  },
  // ~12-13px, REGULAR and muted — the quietest of the three, and not italic:
  // the italic pair above is the prescription, this is the note under it.
  cueToggleText: {
    color: '#6E6E6E',
    fontSize: 12.5,
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  cueText: {
    marginTop: 2,
    color: '#6E6E6E',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },

  // ── Recovery ──
  recoveryPrescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
    marginTop: 2,
  },
  recoveryPrescription: {
    color: colors.accent.lime,
    fontSize: 15,
    fontWeight: '700',
  },
  recoveryRest: {
    color: '#7A7A7A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  recoveryAddonSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  recoveryAddonCard: {
    borderColor: 'rgba(200, 255, 0, 0.16)',
    backgroundColor: 'rgba(200, 255, 0, 0.045)',
  },
  recoveryAddonHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  recoveryAddonTitleWrap: {
    flex: 1,
    gap: 2,
  },
  recoveryAddonEyebrow: {
    color: '#A7A7A7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recoveryAddonTitle: {
    color: '#F2F2F2',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  recoveryAddonMeta: {
    color: '#9A9A9A',
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  recoveryAddonExercises: {
    gap: spacing.sm,
  },
  recoveryAddonExercise: {
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 2,
  },
  recoveryAddonExerciseName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
  },
  recoveryAddonPrescription: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  recoveryAddonSkip: {
    color: '#6E6E6E',
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: spacing.sm,
  },

  // ── Conditioning (pure) ──
  conditioningPhaseBody: {
    color: '#D0D0D0',
    fontSize: 14,
    lineHeight: 23,
    fontWeight: '500',
    marginTop: 5,
  },
  conditioningPrescriptionLabel: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  conditioningRest: {
    color: '#7A7A7A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: spacing.xs,
  },

  // ── Power, as the first list row ──
  //
  // Options sit on the page with the same zero-surface treatment as every
  // exercise row; only the dose takes the lime, matching the weight control.
  powerOptions: { gap: 2, marginTop: 4 },

  // ── The optional cluster's one header ──
  //
  // Eyebrow scale, not heading scale. It divides the list rather than opening a
  // new section: the work below it is still the same session, just no-penalty.
  // Held quiet so it separates without competing with the exercise names — the
  // reason a label on every row was worse than a label on the group.
  optionalWorkHeader: {
    color: '#5A5A5A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },

  // ── In-list conditioning choice ──
  disclosureChevron: {
    color: '#7A7A7A',
    fontSize: 20,
    fontWeight: '400',
    paddingHorizontal: spacing.xs,
  },
  conditioningOption: { gap: spacing.xs, marginTop: spacing.xs },
  chooseOneLabel: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  conditioningOptionTitle: {
    color: colors.accent.lime,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  conditioningOptionDescription: {
    color: '#C8C8C8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.xs,
  },
  conditioningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  conditioningRowContent: {
    flex: 1,
    position: 'relative',
    paddingRight: 68,
  },
  conditioningBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.lime,
    marginTop: 6,
    flexShrink: 0,
    opacity: 0.9,
  },
  conditioningRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  conditioningRowName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  conditioningRowPrescription: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  conditioningRowNotes: {
    color: '#8A8A8A',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 5,
  },
  // The derived pace is a PRESCRIPTION, not a note — it is the number the
  // athlete runs to — so it takes the prescription's accent rather than the
  // grey the notes sit in. One step quieter than the prescription line above
  // it so the two do not compete for the same row.
  personalPace: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  // ── Feedback + Finish ──
  // The finish section is the explicit "end of session" anchor. The
  // divider above the button drops to #121212 — just barely above the
  // #0C0C0C screen background — so it reads as a whispered fade line,
  // not a ruled edge. Combined with the generous xxl/lg whitespace, the
  // separation registers as "the session ends here" without adding any
  // new surface contrast to the screen.
  feedbackSection: { marginTop: spacing.lg },
  /**
   * THE GAP UNDER "Need to make a change?" MATCHES THE GAP ABOVE IT — Sam,
   * 2026-08-22: *"reduce the gap between the bottom of the need to make a
   * change box, and the log session button so it's the same as the gap between
   * the top of the need to make a change box and the strength drop down box"*.
   *
   * MEASURED, not eyeballed: the box's own `card` carries `marginTop:
   * spacing.md` (16), and this carried `spacing.xxl` + `spacing.lg` — 72 —
   * so the button sat four and a half times further from the box than the box
   * sat from the session. `spacing.md` is not a new number; it is the one
   * already on the other side of the same box.
   *
   * The hairline went with the padding it was spacing for. It drew `#121212`
   * on a `#0C0C0C` screen — six values apart at hairline width, which is to say
   * nothing at all — so removing it changes the spacing and not the picture.
   */
  /**
   * ⚠ **IT SHARES THE CARD'S INSET, IT DOES NOT MATCH IT BY EYE.**
   *
   * Sam, 2026-08-22: *"make sure the check box lines up perfectly with the
   * other check boxes - right now it's lined up inside the others"*. It was:
   * this row carried `paddingHorizontal: spacing.md` (16) on top of
   * `scrollContent`'s own 16, while an exercise tick sits inside a card whose
   * inset is 13 — so every tick above it stood 3px further out.
   *
   * `EXERCISE_CARD_INSET` is now the one number both read. Two literals that
   * happen to agree are two literals that stop agreeing; a shared constant is
   * what makes "perfectly" survive the next edit to either.
   */
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: EXERCISE_CARD_INSET,
    paddingRight: EXERCISE_CARD_INSET,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  selectAllLabel: {
    color: '#8A8A8A',
    fontSize: 14,
    fontWeight: '600',
  },
  /* The feedback sheet's scrolling body — `flexShrink: 1` with an auto basis,
     so it measures its content and gives space back when the sheet's cap binds.
     `flex: 1` collapses to nothing here (the sliver-sheet defect in `ui/Sheet`). */
  feedbackSheetBody: { flexShrink: 1 },
  finishSection: {
    marginTop: spacing.md,
    ...shadows.none,
  },

  /* R-124's one line. Quiet by design — it is context for a session that has
   * already been adjusted, not a warning and not a second prescription line. */
  injuryAdjustmentNotice: {
    marginTop: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 127, 127, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 127, 127, 0.28)',
  },
  injuryAdjustmentText: {
    color: '#E8B9B9',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },

  /* The title, subtitle, Back, Cancel, scrolling and sheet padding these
     styled are the shell's now (R-123). */
  // The affected-row equipment notice. Quiet by design — it is context for a
  // change, not a second prescription line.
  implementBadge: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  exerciseEditOptions: {
    gap: 10,
    /* NO `marginTop`: the shell already spaces its body from the step header,
     * and keeping this one too doubled the gap to 32pt — visible on glass as a
     * hole between "What would you rather do?" and the line under it, which
     * Equipment (whose copy is the shell's subtitle) did not have. */
  },
  exerciseEditOption: {
    minHeight: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#1B1B1B',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  exerciseEditOptionPressed: {
    backgroundColor: 'rgba(200, 255, 0, 0.06)',
    borderColor: 'rgba(200, 255, 0, 0.28)',
  },
  exerciseEditOptionWithIcon: {
    minHeight: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#1B1B1B',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseEditOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exerciseEditOptionTextWrap: {
    gap: 3,
  },
  exerciseEditOptionLabel: {
    color: '#F2F2F2',
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseEditOptionSub: {
    color: '#8A8A8A',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  exerciseEditBody: {
    color: '#C8C8C8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseEditQuestion: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  exerciseEditSuggestionCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.16)',
    backgroundColor: 'rgba(200, 255, 0, 0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 4,
  },
  exerciseEditSuggestionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  exerciseEditSuggestionMeta: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '700',
  },
  /* The pill-hub styles are DELETED with the local component they styled
   * (2026-08-19). The shared owner carries the Day card's own values. */
  exerciseEditGroup: {
    marginTop: 10,
    gap: 6,
  },
  exerciseEditGroupLabel: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  exerciseEditSecondaryButton: {
    marginTop: 2,
  },
});
