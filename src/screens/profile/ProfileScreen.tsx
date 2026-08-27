import React, { useEffect, useRef, useState } from 'react';
import {
  MAX_MOTIVATION_GOALS,
  MOTIVATION_GOAL_OPTIONS,
  motivationGoalLabel,
  resolveMotivation,
  type MotivationGoal,
} from '../../rules/motivationGoals';
import {
  Animated,
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { ownSeasonPhase } from '../../rules/seasonPhaseOwner';
import { classifyProgramMutationRefusal } from '../../rules/programMutationRefusal';
import {
  decideProfileSetupChange,
  profileSetupBlockCopy,
} from '../../rules/profileSetupChange';
import { commitProfileProgramTransaction } from '../../store/profileProgramTransaction';
import {
  resetProgramAndOnboarding,
  resetToDevPostOnboardingState,
} from '../../utils/resetCoach';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { todayISOLocal } from '../../utils/appDate';
import { Text } from '../../components/common/Text';
import { LfaWordmark } from '../../components/branding/LfaWordmark';
import { Card } from '../../components/common/Card';
import { SelectableTile } from '../../components/common/SelectableTile';
import { Button as V2Button, Sheet, SheetDescription, SheetHeader } from '../../components/ui';
import { buildMailto, getClientEnvConfig } from '../../config/env';
import {
  WEEK_DAYS,
  DAY_SHORT,
  PHASE_SHIFT_MIN_DISPLAY_MS,
  REBUILD_MSG_INTERVAL_MS,
} from '../home/homeScreenConstants';
import { storedGameAnchor } from '../../rules/gameAnchor';
import { logger } from '../../utils/logger';
import {
  ROLE_BUCKET_OPTIONS,
  normalizeRoleBucket,
  roleBucketLabel,
} from '../../utils/roleBuckets';
import type { DayOfWeek, ExperienceLevel, OnboardingData, RoleBucket, SeasonPhase, TwoKmTimeTrialAnswer } from '../../types/domain';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import {
  formatTwoKmTime,
  recordTwoKmTime,
  validateTwoKmTime,
} from '../../data/twoKmTimeTrial';
import { KeyboardSafeArea } from '../../components/keyboard/KeyboardSafeArea';
import { useRefusalOnContinue } from '../../hooks/useRefusalOnContinue';
import { EquipmentEditorSheet } from './EquipmentEditorSheet';
import { ProfileFieldSheet, type ProfileFieldId } from './ProfileFieldSheet';
import { SeasonPhaseShiftSheet } from '../../components/SeasonPhaseShiftSheet';
import { useSeasonPhaseControl } from '../../hooks/useSeasonPhaseControl';
import { formatEquipmentProfileSummary } from '../../rules/equipmentVocabulary';
import { signedCopy } from '../../rules/signedCopy';
import { BuildingState, BuildCompleteState } from '../../components/RebuildSheet';
import {
  EMPTY_SEASON_FINISH_DATE,
  SeasonFinishDateFields,
  seasonFinishDateDraft,
  type SeasonFinishDateDraft,
} from '../../components/season/SeasonFinishDateFields';
import { validateSeasonFinishDateParts } from '../../rules/seasonPhaseClock';


const SEASON_PHASE_OPTIONS: SeasonPhase[] = ['Off-season', 'Pre-season', 'In-season'];
const EXPERIENCE_OPTIONS: { id: ExperienceLevel; label: string }[] = [
  { id: 'Complete beginner', label: 'New to training' },
  { id: '1-2 years', label: 'Developing' },
  { id: '2-5 years', label: 'Consistent' },
  { id: '5+ years', label: 'Advanced' },
];
const PROFILE_SETUP_UPDATE_MESSAGES = [
  'Rebuilding your week...',
  'Updating training days...',
  'Checking team anchors...',
  'Applying setup changes...',
];

function formatList(values?: readonly string[]): string | null {
  if (!values || values.length === 0) return null;
  return values.join(', ');
}

function sortDays(days: DayOfWeek[]): DayOfWeek[] {
  return [...days].sort((a, b) => WEEK_DAYS.indexOf(a) - WEEK_DAYS.indexOf(b));
}

function formatDaySummary(days?: DayOfWeek[]): string {
  if (!days || days.length === 0) return 'Not set';
  return sortDays(days).map((day) => DAY_SHORT[day]).join(', ');
}

function formatPlayerDetail(value?: string): string {
  return value && value.trim().length > 0 ? value : 'Not set';
}

function formatExperienceDetail(value?: ExperienceLevel | null): string {
  if (!value) return 'Not set';
  return EXPERIENCE_OPTIONS.find((option) => option.id === value)?.label ?? value;
}

function currentRole(data: OnboardingData): RoleBucket | null {
  return data.position ? normalizeRoleBucket(data.position) : null;
}

function dayFromGameFields(data: OnboardingData): DayOfWeek | null {
  return storedGameAnchor(data);
}

// `classifySetupUpdateError` lived here and answered every refusal with
// "Something went wrong. Please try again." — including a phase mismatch,
// which trying again cannot fix. `classifyProgramMutationRefusal` owns the
// typed reason, its copy and its retryability for both this screen and the
// phase-shift sheet.

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const onboardingData = useProfileStore((s) => s.onboardingData);
  // The phase this screen shows and compares against is the OWNED one — what
  // the program is actually built as. Reading `onboardingData.seasonPhase`
  // here is what made the Save button dead on a skewed device: the sheet
  // displayed the profile's phase, so re-picking it was "no change", and the
  // rebuild that would have fixed the skew never ran.
  const currentProgramForPhase = useProgramStore((s) => s.currentProgram);
  const ownedSeasonPhase = ownSeasonPhase({
    program: currentProgramForPhase,
    profile: onboardingData,
  });
  const env = getClientEnvConfig();
  const [isDevResetting, setIsDevResetting] = useState(false);
  const [equipmentEditorVisible, setEquipmentEditorVisible] = useState(false);
  const [equipmentSaving, setEquipmentSaving] = useState(false);
  const [equipmentSaveError, setEquipmentSaveError] = useState<string | null>(null);

  /* THE "Something changed?" DEAD-TAP DIAGNOSTIC IS GONE — 2026-07-29 to
   * 2026-08-12, and it did its job.
   *
   * It existed to split two candidate causes on Sam's device: no counters
   * moving meant the touch never reached the control, counters moving with no
   * sheet meant Modal presentation. **SAM CONFIRMED 2026-08-12 THAT THE TAP NOW
   * WORKS**, so the split has an answer and the instrument comes out — counters,
   * their state, and the three `logger.warn` probes with them.
   *
   * NOT REMOVED IN THIS SWEEP: the `__DEV__`-visible stored-state export lower
   * down is a SEPARATE 2026-07-30 concern with its own reasoning, and
   * SEAT_INBOX item 14 says so explicitly. Read its own comment before touching
   * it. */
  /**
   * TRUE when a step was opened by a ROW'S PEN rather than by walking the group
   * from its first question — Sam, 2026-08-27. The step is the same screen
   * either way; what changes is where its button goes. Walking, it continues to
   * the next question. Pen, it saves and returns to the review, because the
   * athlete came here to change ONE line.
   */
  const [setupFieldEdit, setSetupFieldEdit] = useState(false);
  /**
   * The athlete's motivation goals, editable from the Profile page since
   * 2026-08-27 (Sam: *"make main goal/s editable too"*). Held as the same
   * pending/draft pair as every other setup answer, so it commits through the
   * one `decideProfileSetupChange` patch rather than writing on its own.
   *
   * ⚠ **`motivationOther` IS NOT TOUCHED HERE.** It is prose the athlete typed,
   * not one of the seven tiles; an editor that silently dropped it would delete
   * an answer the athlete never revisited.
   */
  /**
   * Set by a single-field save. The commit CANNOT run in the same tick: the
   * decision is computed from the `pending*` state this save just set, and that
   * state has not flushed yet — running it here would rebuild against the
   * previous answer. The effect below fires on the next render, when the new
   * answer is what the decision reads.
   */
  const [commitAfterFieldEdit, setCommitAfterFieldEdit] = useState(false);
  /**
   * ⚠ **SEASON PHASE USES THE SHEET IT ALREADY HAS** — Sam, 2026-08-27: *"you
   * can find the exact pop up to use by using the one in the 'shift season
   * phase' inside 'my status'"*. Not a copy of it: the SAME
   * `SeasonPhaseShiftSheet` driven by the SAME `useSeasonPhaseControl`, because
   * a phase change is not a field edit — it asks follow-up questions (finish
   * date, availability, game anchor) and rebuilds the whole season.
   */
  const phaseControl = useSeasonPhaseControl();
  /** Which single answer the popup is asking about. `null` means it is closed. */
  const [activeField, setActiveField] = useState<ProfileFieldId | null>(null);
  const [pendingGoals, setPendingGoals] = useState<MotivationGoal[]>([]);
  const [draftGoals, setDraftGoals] = useState<MotivationGoal[]>([]);
  // The 2km time trial (D14). Held as the two boxes the athlete types into,
  // committed as one answer through `recordTwoKmTime`. `null` seconds is the
  // real answer "haven't tested", so an athlete can also RETRACT a time here.
  const [draftTwoKmMinutes, setDraftTwoKmMinutes] = useState('');
  const [draftTwoKmSeconds, setDraftTwoKmSeconds] = useState('');
  const [pendingTwoKm, setPendingTwoKm] =
    useState<TwoKmTimeTrialAnswer | null>(null);

  // A blank seconds box means ":00". A blank MINUTES box is not a time at all,
  // and NaN is refused by the bound rather than coerced to something plausible.
  const draftTwoKmTotal = draftTwoKmMinutes.trim() === ''
    ? NaN
    : parseInt(draftTwoKmMinutes, 10) * 60
      + (draftTwoKmSeconds.trim() === '' ? 0 : parseInt(draftTwoKmSeconds, 10));
  const draftTwoKmStarted =
    draftTwoKmMinutes.trim() !== '' || draftTwoKmSeconds.trim() !== '';

  // WHEN the refusal is spoken belongs to `useRefusalOnContinue`, the same owner
  // the onboarding steps use (Sam, device pass 2026-07-29). A stepped sheet is
  // still no place to scold mid-keystroke: this editor validated on every
  // keypress too, so retyping a time flashed "That time looks off" at the
  // athlete on the way to a perfectly good one.
  //
  // The advance gate is the step's own CTA — "Save player details" — which is
  // this sheet's Continue. Disabled for ABSENCE only; a refused time leaves it
  // pressable, or the press that reveals the refusal could never happen.
  const {
    refusals: draftTwoKmRefusals,
    continueDisabled: draftTwoKmContinueDisabled,
    onAnswerEdited,
    attemptContinue: attemptTwoKmSave,
  } = useRefusalOnContinue({
    time: draftTwoKmStarted ? validateTwoKmTime(draftTwoKmTotal) : null,
  });
  const [pendingName, setPendingName] = useState(onboardingData.firstName || '');
  const [pendingPosition, setPendingPosition] = useState<RoleBucket | null>(
    currentRole(onboardingData),
  );
  const [pendingExperience, setPendingExperience] = useState<ExperienceLevel | null>(
    (onboardingData.experienceLevel as ExperienceLevel) || null,
  );
  const [draftName, setDraftName] = useState(onboardingData.firstName || '');
  const [draftPosition, setDraftPosition] = useState<RoleBucket | null>(
    currentRole(onboardingData),
  );
  const [draftExperience, setDraftExperience] = useState<ExperienceLevel | null>(
    (onboardingData.experienceLevel as ExperienceLevel) || null,
  );
  const [pendingSeasonPhase, setPendingSeasonPhase] = useState<SeasonPhase>(
    (ownedSeasonPhase.phase || 'Pre-season') as SeasonPhase,
  );
  const [pendingPreferredDays, setPendingPreferredDays] = useState<DayOfWeek[]>([]);
  const [pendingTeamDays, setPendingTeamDays] = useState<DayOfWeek[]>([]);
  const [pendingGameDay, setPendingGameDay] = useState<DayOfWeek | null>(null);
  const [draftSeasonPhase, setDraftSeasonPhase] = useState<SeasonPhase>(
    (ownedSeasonPhase.phase || 'Pre-season') as SeasonPhase,
  );
  const [draftPreferredDays, setDraftPreferredDays] = useState<DayOfWeek[]>([]);
  const [draftTeamDays, setDraftTeamDays] = useState<DayOfWeek[]>([]);
  const [draftGameDay, setDraftGameDay] = useState<DayOfWeek | null>(null);
  const [pendingSeasonFinishedOn, setPendingSeasonFinishedOn] =
    useState<string | null | undefined>(onboardingData.seasonFinishedOn);
  const [draftSeasonFinishDate, setDraftSeasonFinishDate] = useState<SeasonFinishDateDraft>(
    seasonFinishDateDraft(onboardingData.seasonFinishedOn),
  );
  const [draftSeasonFinishedOn, setDraftSeasonFinishedOn] =
    useState<string | null | undefined>(onboardingData.seasonFinishedOn);
  const [programDetailsSaved, setProgramDetailsSaved] = useState(false);
  const [setupUpdateError, setSetupUpdateError] = useState<string | null>(null);
  const [isSetupUpdating, setIsSetupUpdating] = useState(false);
  const [setupUpdateMsgIdx, setSetupUpdateMsgIdx] = useState(0);
  const [setupUpdateIsPhaseShift, setSetupUpdateIsPhaseShift] = useState(false);
  const setupUpdateMsgOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isSetupUpdating) return;

    setupUpdateMsgOpacity.setValue(1);
    const interval = setInterval(() => {
      Animated.timing(setupUpdateMsgOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setSetupUpdateMsgIdx((prev) => (prev + 1) % PROFILE_SETUP_UPDATE_MESSAGES.length);
        Animated.timing(setupUpdateMsgOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, REBUILD_MSG_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isSetupUpdating, setupUpdateMsgOpacity]);

  // ─── Reset handlers ────────────────────────────────────────────────
  const onFullReset = () => {
    logger.debug('[reset-ui] full_reset_pressed');
    Alert.alert(
      'Full reset?',
      "Wipes profile, program, calendar and coach history. Returns to onboarding. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset everything',
          style: 'destructive',
          onPress: () => resetProgramAndOnboarding(),
        },
      ],
    );
  };

  const onDevPostOnboardingReset = async () => {
    if (isDevResetting) return;
    logger.debug('[reset-ui] dev_post_onboarding_reset_pressed');
    setIsDevResetting(true);
    try {
      const result = await resetToDevPostOnboardingState();
      Alert.alert(
        result.usedFallback ? 'Developer reset warning' : 'Developer reset complete',
        result.message,
      );
      navigation.navigate('ProgramTab', { screen: 'Home' });
    } catch (err: any) {
      const message = err?.message ?? String(err);
      logger.error('[reset-ui] dev_post_onboarding_reset_failed', { message });
      Alert.alert('Developer reset failed', message);
    } finally {
      setIsDevResetting(false);
    }
  };


  const openPlayerDetailsEditor = () => {
    setSetupFieldEdit(false);
    setDraftGoals(pendingGoals);
    setDraftName(pendingName);
    setDraftPosition(pendingPosition);
    setDraftExperience(pendingExperience);
    seedTwoKmDrafts(pendingTwoKm);
    setSetupUpdateError(null);
  };

  const openProgramDetailsEditor = () => {
    setSetupFieldEdit(false);
    setDraftSeasonPhase(pendingSeasonPhase);
    setDraftPreferredDays(pendingPreferredDays);
    setDraftTeamDays(pendingTeamDays);
    setDraftGameDay(pendingGameDay);
    setDraftSeasonFinishDate(seasonFinishDateDraft(pendingSeasonFinishedOn));
    setDraftSeasonFinishedOn(pendingSeasonFinishedOn);
    setSetupUpdateError(null);
  };

  const onProgramSetupChanged = () => {
    const currentName = onboardingData.firstName || '';
    const currentPosition = currentRole(onboardingData);
    const currentExperience = (onboardingData.experienceLevel as ExperienceLevel) || null;
    const currentSeasonPhase = (ownedSeasonPhase.phase || 'Pre-season') as SeasonPhase;
    const currentPreferredDays = (onboardingData.preferredTrainingDays as DayOfWeek[]) || [];
    const currentTeamDays = (onboardingData.teamTrainingDays as DayOfWeek[]) || [];
    const currentGameDay = dayFromGameFields(onboardingData);
    const currentGoals = [...resolveMotivation(onboardingData).goals];
    setPendingGoals(currentGoals);
    setDraftGoals(currentGoals);
    setPendingName(currentName);
    setPendingPosition(currentPosition);
    setPendingExperience(currentExperience);
    setDraftName(currentName);
    setDraftPosition(currentPosition);
    setDraftExperience(currentExperience);
    const currentTwoKm = (onboardingData.twoKmTimeTrial as TwoKmTimeTrialAnswer) || null;
    setPendingTwoKm(currentTwoKm);
    seedTwoKmDrafts(currentTwoKm);
    setPendingSeasonPhase(currentSeasonPhase);
    setPendingPreferredDays(currentPreferredDays);
    setPendingTeamDays(currentTeamDays);
    setPendingGameDay(currentGameDay);
    setPendingSeasonFinishedOn(onboardingData.seasonFinishedOn);
    setDraftSeasonPhase(currentSeasonPhase);
    setDraftPreferredDays(currentPreferredDays);
    setDraftTeamDays(currentTeamDays);
    setDraftGameDay(currentGameDay);
    setDraftSeasonFinishDate(seasonFinishDateDraft(onboardingData.seasonFinishedOn));
    setDraftSeasonFinishedOn(onboardingData.seasonFinishedOn);
    setProgramDetailsSaved(false);
    setSetupUpdateError(null);
  };

  /**
   * THE ONE PEN. It only turns the rows on; the seeding happens when a row is
   * actually tapped.
   */
  /**
   * A PEN ON THE PROFILE PAGE. It seeds the whole setup the way the old
   * "Something changed?" door did — that seeding is what makes the untouched
   * lines save back unchanged — then opens the setup page directly on the one
   * question the athlete tapped. Saving that question returns to the review,
   * which is where the program-rebuild confirmation still lives.
   */
  /**
   * A row's tap. Seeds every draft the way the old "Something changed?" door did
   * — that seeding is what lets the untouched answers commit back unchanged —
   * then opens the POPUP for the one field. There is no other setup surface
   * left to open — the review page and its step machine are deleted.
   */
  const openProfileFieldEditor = (field: ProfileFieldId) => {
    onProgramSetupChanged();
    setSetupFieldEdit(true);
    setActiveField(field);
  };

  const closeFieldSheet = () => {
    if (isSetupUpdating) return;
    setActiveField(null);
    setSetupFieldEdit(false);
    setSetupUpdateError(null);
  };

  /** The Equipment pen: the same atomic editor, opened over the setup page. */
  const openEquipmentFromProfile = () => {
    onProgramSetupChanged();
    openEquipmentEditor();
  };

  const openEquipmentEditor = () => {
    // Equipment keeps its existing atomic editor and transaction. It opens
    // OVER THE PROFILE PAGE now — the review page that used to sit underneath
    // it is deleted, which is what Sam hit on 2026-08-27: dismissing this
    // editor dropped him onto a screen he had never asked for.
    setEquipmentSaveError(null);
    setEquipmentEditorVisible(true);
  };

  const displayName = onboardingData.firstName || 'Athlete';
  const position = onboardingData.position ? roleBucketLabel(onboardingData.position) : '';
  const experienceLevel = onboardingData.experienceLevel || '';
  const daysPerWeek = onboardingData.trainingDaysPerWeek;
  const teamDays = onboardingData.teamTrainingDays || [];
  const gameDay = onboardingData.gameDay || onboardingData.usualGameDay || '';
  /**
   * ⚠ **ALL OF THEM — Sam, 2026-08-27: *"I HAVE SELECTED 3 GOALS AND IT'S ONLY
   * SHOWING 1 HERE"*.** This line read `goals[0]` and dropped the rest, and it
   * preferred `biggestLimitation` over the goals entirely — a DIFFERENT answer
   * (the athlete's stated weakness) wearing the goals' label. The row says what
   * the athlete picked, in the order they picked it, and their own words after
   * it if they typed any.
   */
  const mainFocusMotivation = resolveMotivation(onboardingData);
  const mainFocus = [
    ...mainFocusMotivation.goals.map(motivationGoalLabel),
    ...(mainFocusMotivation.other ? [mainFocusMotivation.other] : []),
  ].join(', ')
    || onboardingData.biggestLimitation
    || '';
  const currentPhase = (ownedSeasonPhase.phase || 'Pre-season') as SeasonPhase;
  const lfaDayCountNeedsSync =
    programDetailsSaved &&
    (
      onboardingData.trainingDaysUnsure === true ||
      (onboardingData.trainingDaysPerWeek ?? 0) !== pendingPreferredDays.length
    );
  // ONE decision behind Save. `setupHasChanges` and `buildSetupPatch` used to
  // be two separate comparisons over the same fields; when they disagreed the
  // athlete got a live-looking button that committed nothing. The patch IS
  // the decision now — see rules/profileSetupChange.
  const setupDecision = decideProfileSetupChange({
    stored: onboardingData,
    ownedPhase: currentPhase,
    storedPosition: currentRole(onboardingData),
    lfaDayCountNeedsSync,
    selection: {
      name: pendingName,
      position: pendingPosition,
      experience: pendingExperience,
      twoKmSeconds: pendingTwoKm?.seconds ?? null,
      twoKmAnswer: pendingTwoKm,
      seasonPhase: pendingSeasonPhase,
      seasonFinishedOn: pendingSeasonFinishedOn,
      preferredDays: pendingPreferredDays,
      teamDays: pendingTeamDays,
      gameDay: pendingGameDay,
      goals: pendingGoals,
    },
  });
  const setupHasChanges = setupDecision.hasChanges;
  const canUpdateSetup = setupDecision.canSave && !isSetupUpdating;
  // A disabled Save always says why. A control that is off for an unstated
  // reason is the same failure as one that is on and inert.
  const setupBlockedCopy = setupDecision.blockedBy.length > 0
    ? profileSetupBlockCopy(setupDecision.blockedBy[0])
    : null;



  const cancelPlayerDetailsEdit = () => {
    setSetupFieldEdit(false);
    setDraftGoals(pendingGoals);
    setDraftName(pendingName);
    setDraftPosition(pendingPosition);
    setDraftExperience(pendingExperience);
    seedTwoKmDrafts(pendingTwoKm);
    setSetupUpdateError(null);
  };

  const cancelProgramDetailsEdit = () => {
    setSetupFieldEdit(false);
    setDraftSeasonPhase(pendingSeasonPhase);
    setDraftPreferredDays(pendingPreferredDays);
    setDraftTeamDays(pendingTeamDays);
    setDraftGameDay(pendingGameDay);
    setDraftSeasonFinishDate(seasonFinishDateDraft(pendingSeasonFinishedOn));
    setDraftSeasonFinishedOn(pendingSeasonFinishedOn);
    setSetupUpdateError(null);
  };

  /**
   * Load an existing answer back into the two boxes, or clear them.
   *
   * Reseeding REPLACES the answer, so any refusal on screen is about a time that
   * is no longer there — the same withdrawal an edit gets, for the same reason.
   */
  function seedTwoKmDrafts(answer: TwoKmTimeTrialAnswer | null) {
    onAnswerEdited();
    if (!answer || answer.seconds === null) {
      setDraftTwoKmMinutes('');
      setDraftTwoKmSeconds('');
      return;
    }
    setDraftTwoKmMinutes(String(Math.floor(answer.seconds / 60)));
    setDraftTwoKmSeconds(String(answer.seconds % 60).padStart(2, '0'));
  }

  /**
   * Commit a 2km time from the profile editor.
   *
   * Through `recordTwoKmTime`, exactly as onboarding does. That is the whole
   * reason the ingress exists: the update path and the onboarding path cannot
   * come to disagree about what is acceptable, because they are one call. The
   * bound refuses both with the same sentence, and neither ever clamps.
   */
  const commitTwoKm = (seconds: number | null) => {
    const result = recordTwoKmTime(seconds, 'profile_edit', todayISOLocal());
    if (!result.ok) return;
    setPendingTwoKm(result.answer);
    setSetupUpdateError(null);
  };

  /**
   * The step's CTA. Reveals the refusal and stays on the step when the time is
   * not acceptable; commits through the one ingress when it is.
   *
   * "I haven't tested it" does NOT come through here — `null` is an answer the
   * bound has nothing to say about, and it commits directly.
   */
  const saveTwoKm = () => {
    if (!attemptTwoKmSave()) return;
    commitTwoKm(draftTwoKmTotal);
  };

  const savePlayerDetails = () => {
    const trimmedName = draftName.trim();
    if (!trimmedName || !draftPosition || !draftExperience) return;

    setPendingName(trimmedName);
    setPendingPosition(draftPosition);
    setPendingExperience(draftExperience);

    setSetupUpdateError(null);
    /* ⚠ **A ONE-LINE EDIT DOES NOT WALK THE OLD PATHWAY.** Sam, 2026-08-27:
       editing his name carried him on to "what is your 2km time", then back to
       the review page he had never asked for. Answering one question ends the
       edit: the commit runs, and the athlete is returned to the menu. */
    if (setupFieldEdit) {
      setCommitAfterFieldEdit(true);
      return;
    }
  };

  const toggleDraftGoal = (goal: MotivationGoal) => {
    setDraftGoals((current) => {
      if (current.includes(goal)) return current.filter((entry) => entry !== goal);
      if (current.length >= MAX_MOTIVATION_GOALS) return current;
      return [...current, goal];
    });
  };

  const saveGoals = () => {
    if (draftGoals.length < 1) return;
    setPendingGoals(draftGoals);
    setSetupUpdateError(null);
    if (setupFieldEdit) {
      setCommitAfterFieldEdit(true);
      return;
    }
  };

  const saveProgramDetails = () => {
    if (draftPreferredDays.length < 1) return;
    if (draftSeasonPhase === 'In-season' && !draftGameDay) return;

    setPendingSeasonPhase(draftSeasonPhase);
    setPendingPreferredDays(sortDays(draftPreferredDays));
    setPendingTeamDays(
      draftSeasonPhase === 'Off-season' ? [] : sortDays(draftTeamDays),
    );
    setPendingGameDay(draftSeasonPhase === 'In-season' ? draftGameDay : null);
    setPendingSeasonFinishedOn(
      draftSeasonPhase === 'Off-season' ? draftSeasonFinishedOn : pendingSeasonFinishedOn,
    );
    setProgramDetailsSaved(true);
    setSetupUpdateError(null);
    if (setupFieldEdit) {
      setCommitAfterFieldEdit(true);
      return;
    }
  };

  const toggleDraftPreferredDay = (day: DayOfWeek) => {
    setDraftPreferredDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      return sortDays([...prev, day]);
    });
  };

  const toggleDraftTeamDay = (day: DayOfWeek) => {
    setDraftTeamDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : sortDays([...prev, day]),
    );
  };

  const selectDraftSeasonPhase = (phase: SeasonPhase) => {
    setDraftSeasonPhase(phase);
    if (phase === 'Off-season' && pendingSeasonPhase !== 'Off-season') {
      setDraftSeasonFinishDate({ ...EMPTY_SEASON_FINISH_DATE });
      setDraftSeasonFinishedOn(undefined);
    }
  };

  const changeDraftSeasonFinishDate = (value: SeasonFinishDateDraft) => {
    setDraftSeasonFinishDate(value);
    setDraftSeasonFinishedOn(undefined);
  };

  const continueFromSeasonFinish = () => {
    const validation = validateSeasonFinishDateParts(
      draftSeasonFinishDate.day,
      draftSeasonFinishDate.month,
      draftSeasonFinishDate.year,
      todayISOLocal(),
    );
    if (!validation.ok) return;
    setDraftSeasonFinishedOn(validation.dateISO);
  };

  const answerSeasonFinishNotSure = () => {
    setDraftSeasonFinishedOn(null);
  };

  /**
   * WHY SAVE IS OFF, IN THE ATHLETE'S WORDS. A control that is disabled for an
   * unstated reason is the same defect as one that is on and inert — the rule
   * the setup page already follows for its own Save.
   */
  const activeFieldBlockedReason = (() => {
    if (!activeField) return null;
    if (activeField === 'name' && !draftName.trim()) return 'Type your name to save.';
    if (activeField === 'role' && !draftPosition) return 'Pick the position that fits you.';
    if (activeField === 'experience' && !draftExperience) return 'Pick your training experience.';
    if (activeField === 'goals' && draftGoals.length < 1) return 'Pick at least one goal.';
    if (activeField === 'lfaDays' && draftPreferredDays.length < 1) {
      return 'Pick at least one day you can train.';
    }
    if (activeField === 'gameDay' && !draftGameDay) return 'Pick the day you usually play.';
    return null;
  })();

  /**
   * ONE ANSWER IN, ONE COMMIT OUT. Each field routes to the same group save the
   * setup page uses, so the drafts this popup did not touch commit back exactly
   * as they were, and the rebuild runs through the one transaction.
   */
  const saveActiveField = () => {
    if (activeFieldBlockedReason) return;
    switch (activeField) {
      case 'name':
      case 'role':
      case 'experience':
        savePlayerDetails();
        return;
      case 'goals':
        saveGoals();
        return;
      case 'lfaDays':
      case 'teamDays':
      case 'gameDay':
        saveProgramDetails();
        return;
      default:
        return;
    }
  };

  /**
   * Runs the commit a single-field save asked for, one render later. If the new
   * answer turned out to be no change at all, there is nothing to rebuild and
   * the page simply closes.
   */
  useEffect(() => {
    if (!commitAfterFieldEdit) return;
    setCommitAfterFieldEdit(false);
    if (!setupDecision.canSave) {
      // The answer came back the same as it already was. Nothing to rebuild.
      setActiveField(null);
      setSetupFieldEdit(false);
      return;
    }
    void executeSetupUpdate();
  }, [commitAfterFieldEdit, setupDecision.canSave]);

  const executeSetupUpdate = async () => {
    if (!canUpdateSetup && !setupUpdateError) return;
    // The very same decision the button read. There is no second comparison
    // left that could produce an empty patch behind an enabled Save.
    const patch = setupDecision.patch;
    const phaseIsChanging = patch.seasonPhase !== undefined;
    const startedAt = Date.now();
    setSetupUpdateError(null);
    setSetupUpdateMsgIdx(0);
    setupUpdateMsgOpacity.setValue(1);
    setSetupUpdateIsPhaseShift(phaseIsChanging);
    setIsSetupUpdating(true);
    try {
      const result = await commitProfileProgramTransaction({
        change: {
          kind: 'profile_setup',
          patch,
        },
        todayISO: todayISOLocal(),
        sourceSurface: 'profile_setup',
      });
      if (!result.ok) {
        const refusal = classifyProgramMutationRefusal({ reason: result.reason });
        logger.error('[profile-setup-update] refused', refusal.diagnostic ?? result.message);
        setSetupUpdateError(refusal.userMessage);
        return;
      }
      if (!result.changedProgram) {
        // A save that changed nothing is reported, not swallowed. Closing the
        // sheet on a no-change outcome is what made a dead Save button look
        // exactly like a working one.
        setSetupUpdateError(
          classifyProgramMutationRefusal({ reason: result.reason }).userMessage,
        );
        return;
      }
      setProgramDetailsSaved(false);
      /* A phase shift holds its building state for a beat, because rebuilding a
         whole season is a bigger thing than changing a name and vanishing
         instantly reads as "nothing happened". */
      if (phaseIsChanging) {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, PHASE_SHIFT_MIN_DISPLAY_MS - elapsed);
        if (wait > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, wait));
        }
      }
      setActiveField(null);
      setSetupFieldEdit(false);
    } catch (err: any) {
      logger.error('[profile-setup-update] rebuild_failed', err?.diagnostic || err?.message || err);
      setSetupUpdateError(classifyProgramMutationRefusal({ error: err }).userMessage);
    } finally {
      setIsSetupUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* THE PROFILE PAGE IS ALWAYS THE PAGE. Editing happens in a popup over
          it — there is no second full-screen setup surface any more. */}
      <ScrollView
          /* ⚠ **NO TAB-BAR PADDING NEEDED.** This was `88 + insets.bottom`, which
             is what a FLOATING tab bar would need cleared. This app's bar is a
             normal 84pt bar that takes its own space and already sits below the
             safe area, so that padding was pure empty screen under the last
             card — Sam, 2026-08-27: *"still lots of space"*. */
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.lg },
          ]}
        >
        <View style={styles.brandHeader}>
          <LfaWordmark />
        </View>

        {/* Program setup */}
        <View style={styles.section} testID="profile-program-setup-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>PROGRAM SETUP</Text>
          <Card style={[styles.summaryCard, styles.profilePageCardSurface]}>
            <ProfileRow
              onEdit={() => openProfileFieldEditor('name')}
              editTestID="profile-edit-name"
              label="Name"
              value={displayName}
            />
            {position ? (
              <ProfileRow
                onEdit={() => openProfileFieldEditor('role')}
                editTestID="profile-edit-role"
                label="Footy role"
                value={position}
              />
            ) : null}
            {experienceLevel ? (
              <ProfileRow
                onEdit={() => openProfileFieldEditor('experience')}
                editTestID="profile-edit-experience"
                label="Training Experience"
                value={experienceLevel}
              />
            ) : null}
            {/* Season phase sits directly under Training experience, and its pen
                opens the season-shift sheet rather than a field popup. */}
            <ProfileRow
              onEdit={() => phaseControl.open()}
              editTestID="profile-edit-phase"
              label="Season phase"
              value={currentPhase}
            />
            <ProfileRow
              onEdit={() => openProfileFieldEditor('lfaDays')}
              editTestID="profile-edit-lfa-days"
              label="LFA Days"
              value={
                daysPerWeek
                  ? `${daysPerWeek} ${daysPerWeek === 1 ? 'day' : 'days'} per week`
                  : 'Not set'
              }
            />
            {teamDays.length > 0 ? (
              <ProfileRow
                onEdit={() => openProfileFieldEditor('teamDays')}
                editTestID="profile-edit-team-days"
                label="Team Training"
                value={formatList(teamDays) ?? ''}
              />
            ) : null}
            {gameDay ? (
              <ProfileRow
                onEdit={() => openProfileFieldEditor('gameDay')}
                editTestID="profile-edit-game-day"
                label="Game Day"
                value={gameDay}
              />
            ) : null}
            {mainFocus ? (
              <ProfileRow
                onEdit={() => openProfileFieldEditor('goals')}
                editTestID="profile-edit-goals"
                label="Main goal/s"
                value={mainFocus}
              />
            ) : null}
            <ProfileRow
              onEdit={openEquipmentFromProfile}
              editTestID="profile-edit-equipment"
              label="Equipment"
              value={formatEquipmentProfileSummary(onboardingData)}
            />
          </Card>
        </View>

        {/* Learn / FAQ */}
        <View style={styles.section} testID="profile-learn-faq-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
            LEARN / FAQ
          </Text>
          <SecondaryActionRow
            title="Frequently Asked Questions"
            description="How the program, coach updates and game-week logic work."
            onPress={() => navigation.navigate('FAQ')}
          />
        </View>

        {__DEV__ ? (
          <View
            style={styles.section}
            testID="profile-developer-tools-section"
            accessibilityLabel="Developer tools"
          >
            <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
              DEVELOPER TOOLS
            </Text>
            <Card style={[styles.infoCard, styles.profilePageCardSurface]}>
              <TouchableOpacity
                style={styles.resetRow}
                activeOpacity={0.7}
                onPress={onDevPostOnboardingReset}
                disabled={isDevResetting}
                testID="profile-dev-reset-post-onboarding"
                accessibilityLabel="Reset to post-onboarding state"
              >
                <Text style={styles.secondaryActionTitle}>
                  {isDevResetting ? 'Resetting...' : 'Reset to post-onboarding state'}
                </Text>
                <Text style={styles.secondaryActionDescription}>
                  Clears test-session state and reloads a clean generated program.
                </Text>
              </TouchableOpacity>
            </Card>
          </View>
        ) : null}

        {/* Support */}
        <View style={styles.section} testID="profile-support-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
            SUPPORT
          </Text>
          <View style={styles.actionStack}>
            <SecondaryActionRow
              title="Leave Feedback"
              description="Tell us what feels clunky, missing or unclear."
              onPress={() => Linking.openURL(buildMailto(env.feedbackEmail, 'LFA Feedback'))}
            />
            <SecondaryActionRow
              title="Ask a Human"
              description={"Got a question the app can’t answer?\nWe’ll get back to you as soon as we can."}
              onPress={() => Linking.openURL(buildMailto(env.supportEmail, 'LFA - Speak to a Human'))}
            />
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section} testID="profile-legal-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
            LEGAL
          </Text>
          <Card style={[styles.infoCard, styles.profilePageCardSurface]}>
            <TouchableOpacity
              style={styles.legalRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Privacy')}
              testID="profile-privacy-policy"
              accessibilityLabel="Privacy Policy"
            >
              <Text style={styles.secondaryActionTitle}>
                Privacy Policy
              </Text>
              <Text style={styles.secondaryActionDescription}>
                How your app, training and coach data is handled.
              </Text>
            </TouchableOpacity>
            <View style={styles.legalDivider} />
            <TouchableOpacity
              style={styles.legalRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Terms')}
              testID="profile-terms-of-use"
              accessibilityLabel="Terms of Use"
            >
              <Text style={styles.secondaryActionTitle}>
                Terms of Use
              </Text>
              <Text style={styles.secondaryActionDescription}>
                Practical use, safety and training guidance terms.
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Danger zone */}
        <View
          style={styles.section}
          testID="profile-danger-zone-section"
          accessibilityLabel="Danger zone"
        >
          <Text variant="label" color={colors.status.error} style={styles.sectionTitle}>
            DANGER ZONE
          </Text>
          <Card style={[styles.profilePageCardSurface, styles.dangerCard]}>
            <TouchableOpacity
              style={styles.resetRow}
              activeOpacity={0.7}
              onPress={onFullReset}
              testID="profile-full-reset"
              accessibilityLabel="Full reset"
            >
              <Text style={[styles.secondaryActionTitle, { color: colors.status.error }]}>
                Full reset
              </Text>
              <Text style={styles.secondaryActionDescription}>
                Wipes profile, program, calendar and coach history. Returns to onboarding.
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

      </ScrollView>
      {/* ONE ANSWER, IN THE APP'S OWN POPUP. */}
      {activeField ? (
        <ProfileFieldSheet
          field={activeField}
          visible
          onClose={closeFieldSheet}
          onSave={saveActiveField}
          blockedReason={activeFieldBlockedReason}
          saving={isSetupUpdating}
          busyContent={isSetupUpdating ? (
            <BuildingState
              title="Updating your program…"
              msgIdx={setupUpdateMsgIdx}
              msgOpacity={setupUpdateMsgOpacity}
              messages={PROFILE_SETUP_UPDATE_MESSAGES}
              durationText={setupUpdateIsPhaseShift
                ? signedCopy('phase.shift.build.duration')
                : undefined}
            />
          ) : undefined}
          name={draftName}
          onChangeName={setDraftName}
          role={draftPosition}
          roleOptions={ROLE_BUCKET_OPTIONS}
          onSelectRole={setDraftPosition}
          experience={draftExperience}
          /* ⚠ **THE YEARS, NOT THE GRADE** — Sam, 2026-08-27: *"change this to be
             number of years instead … instead of advanced it says 5+ years"*.
             The stored answer IS the year range, and the Profile row this popup
             opened from already showed it — so "Advanced" in the popup and
             "5+ years" on the row were two names for one answer. The id is the
             label here; nothing new is authored. */
          /* The same "Advanced · 5+ years" the onboarding tile now shows, built
             the same way: the grade from the option, the years from the stored
             id. Three surfaces, one name for one answer. */
          experienceOptions={EXPERIENCE_OPTIONS.map((option) => ({
            id: option.id,
            label: option.id === 'Complete beginner'
              ? option.label
              : `${option.label} · ${option.id}`,
          }))}
          onSelectExperience={setDraftExperience}
          goals={draftGoals}
          onToggleGoal={toggleDraftGoal}
          weekDays={WEEK_DAYS}
          lfaDays={draftPreferredDays}
          onToggleLfaDay={toggleDraftPreferredDay}
          teamDays={draftTeamDays}
          onToggleTeamDay={toggleDraftTeamDay}
          gameDay={draftGameDay}
          onSelectGameDay={setDraftGameDay}
        />
      ) : null}
      {/* THE SAME SEASON-PHASE SHEET MY STATUS OPENS, driven by the same
          control — one owner for a phase change, two doors into it. */}
      <SeasonPhaseShiftSheet
        visible={phaseControl.visible}
        step={phaseControl.step}
        currentPhase={phaseControl.currentPhase}
        targetPhase={phaseControl.targetPhase}
        isRebuilding={phaseControl.isRebuilding}
        error={phaseControl.error}
        canRetry={phaseControl.canRetry}
        msgIdx={phaseControl.msgIdx}
        msgOpacity={phaseControl.msgOpacity}
        pendingPreferredDays={phaseControl.pendingPreferredDays}
        pendingTeamDays={phaseControl.pendingTeamDays}
        pendingGameDay={phaseControl.pendingGameDay}
        gameAnchorAnswered={phaseControl.gameAnchorAnswered}
        pendingSeasonFinishDate={phaseControl.pendingSeasonFinishDate}
        seasonFinishAttempted={phaseControl.seasonFinishAttempted}
        onClose={phaseControl.close}
        onBack={phaseControl.back}
        onTogglePendingPreferredDay={phaseControl.togglePreferredDay}
        onTogglePendingTeamDay={phaseControl.toggleTeamDay}
        onSetPendingGameDay={phaseControl.answerGameDay}
        onAnswerNoUsualGameDay={phaseControl.answerNoGameDay}
        onChangeSeasonFinishDate={phaseControl.setPendingSeasonFinishDate}
        onAnswerSeasonFinishNotSure={phaseControl.answerSeasonFinishNotSure}
        onSelectTargetPhase={phaseControl.selectTargetPhase}
        onAdvance={() => { void phaseControl.advance(); }}
      />
      <EquipmentEditorSheet
        visible={equipmentEditorVisible}
        saving={equipmentSaving}
        errorMessage={equipmentSaveError}
        onClose={() => setEquipmentEditorVisible(false)}
        onSave={async (answer) => {
          // The same owned transaction every profile edit commits through:
          // apply, rebuild, verify, or roll back together.
          setEquipmentSaving(true);
          setEquipmentSaveError(null);
          try {
            const result = await commitProfileProgramTransaction({
              change: { kind: 'equipment_answer', answer },
              todayISO: todayISOLocal(),
              sourceSurface: 'profile_equipment_editor',
            });
            if (!result.ok) {
              setEquipmentSaveError(
                classifyProgramMutationRefusal({ reason: result.reason }).userMessage,
              );
              return;
            }
            setEquipmentEditorVisible(false);
          } catch (err: any) {
            setEquipmentSaveError(classifyProgramMutationRefusal({ error: err }).userMessage);
          } finally {
            setEquipmentSaving(false);
          }
        }}
      />
    </SafeAreaView>
  );
}

/**
 * ONE LINE OF THE PROFILE, WITH ITS OWN PEN.
 *
 * Sam, 2026-08-27: *"why is the 'something changed? tell the coach' button even
 * there? you could just tap the profile tab and then each line has a pen next to
 * it instead"*. So the setup review is no longer a door the athlete has to find
 * — every line here opens the one question that owns it.
 *
 * A line with no editor gets no pen, rather than a pen that goes nowhere.
 */
function ProfileRow({
  label,
  value,
  onEdit,
  editTestID,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  editTestID?: string;
}) {
  /* ⚠ **NO MODE TO ENTER FIRST — Sam, 2026-08-27**: *"it would be cleaner if we
     just had the grey side arrow thing like in the FAQ - on the right side of
     each box - so you can just tap the arrow and the regular pop up still works
     as before - it's really just cutting out the pen icon tap first"*.
     The pen and its selectable mode are gone: an editable row LOOKS editable at
     all times, wearing the same grey chevron the FAQ row wears, and one tap
     opens its popup. A row with no editor keeps no chevron, so the arrow still
     means "there is something behind this". */
  const body = (
    <>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue}>
        {value}
      </Text>
      {onEdit ? (
        <Text style={[styles.secondaryActionChevron, styles.profileRowChevron]}>›</Text>
      ) : null}
    </>
  );
  if (!onEdit) return <View style={styles.profileRow}>{body}</View>;
  return (
    <TouchableOpacity
      style={styles.profileRow}
      activeOpacity={0.72}
      onPress={onEdit}
      testID={editTestID}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${label}. ${value}`}
    >
      {body}
    </TouchableOpacity>
  );
}

function SecondaryActionRow({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.secondaryActionRow, styles.profilePageCardSurface]}
      activeOpacity={0.72}
      onPress={onPress}
    >
      <View style={styles.secondaryActionText}>
        <Text style={styles.secondaryActionTitle}>{title}</Text>
        <Text style={styles.secondaryActionDescription}>{description}</Text>
      </View>
      <Text style={styles.secondaryActionChevron}>›</Text>
    </TouchableOpacity>
  );
}


/**
 * ONE LINE OF THE ATHLETE'S SETUP, AND ITS OWN WAY IN.
 *
 * Sam, 2026-08-27: *"instead of the 'edit player details' and having to go
 * through each step again - you just have a lime green pen icon at the right
 * side of each box which allows you to edit that line individually"*.
 *
 * The pen opens the ONE step that owns this line, and that step's button then
 * saves and comes back here. A row with no `onEdit` simply has no pen — that is
 * how a read-only line stays read-only, rather than by a disabled control.
 */
function SetupSummaryRow({
  label,
  value,
  onEdit,
  editTestID,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  editTestID?: string;
}) {
  return (
    <View style={styles.setupSheetRow}>
      <Text style={styles.setupSheetLabel}>{label}</Text>
      <Text style={styles.setupSheetValue}>{value}</Text>
      {onEdit ? (
        <TouchableOpacity
          onPress={onEdit}
          style={styles.setupRowPen}
          hitSlop={10}
          activeOpacity={0.6}
          testID={editTestID}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label}`}
        >
          <Feather name="edit-2" size={15} color={colors.accent.lime} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function DayChipGrid({
  days,
  selectedDays,
  onToggleDay,
  dimUnselected = false,
}: {
  days: DayOfWeek[];
  selectedDays: DayOfWeek[];
  onToggleDay: (day: DayOfWeek) => void;
  dimUnselected?: boolean;
}) {
  return (
    <View style={styles.sheetChipGrid}>
      {days.map((day) => {
        const selected = selectedDays.includes(day);
        return (
          <SelectableTile
            key={day}
            shape="chip"
            variant="grid"
            hideCheckmark
            isSelected={selected}
            dimmed={dimUnselected && !selected}
            onPress={() => onToggleDay(day)}
            style={styles.sheetDayChip}
          >
            <Text style={[styles.sheetDayChipText, selected && styles.sheetDayChipTextSelected]}>
              {DAY_SHORT[day]}
            </Text>
          </SelectableTile>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  brandHeader: {
    minHeight: 32,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  // One quiet surface for every card on the Profile page. Sheet cards remain
  // separate because they are temporary controls rather than page sections.
  profilePageCardSurface: {
    backgroundColor: '#101010',
  },
  infoCard: {
    padding: spacing.lg,
  },
  summaryCard: {
    padding: 0,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  profileRowLabel: {
    // 104, not 118. The column keeps every value aligned, but at 118 a short
    // label like "Team Training" left a 40pt hole before its answer.
    width: 104,
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  profileRowValue: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  actionStack: {
    gap: spacing.sm,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
  },
  secondaryActionText: {
    flex: 1,
    gap: spacing.xs,
  },
  secondaryActionTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  secondaryActionDescription: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  secondaryActionChevron: {
    color: colors.text.tertiary,
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 28,
  },
  setupPage: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  // The same page-level navigation geometry as My Status: one quiet header,
  // one back control, and the scroll owner below it. This replaces the modal
  // grab handle and its height negotiation entirely.
  setupPageHeader: {
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  setupPageBackButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupPageBackButtonDisabled: {
    opacity: 0.35,
  },
  setupPageScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  setupPageBuilding: {
    flex: 1,
    justifyContent: 'center',
  },
  setupPageScroll: {
    flex: 1,
  },
  sheetTitle: {
    color: colors.text.primary,
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 29,
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  playerInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    marginBottom: spacing.lg,
  },
  playerTextInput: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    paddingLeft: 12,
    paddingVertical: 8,
  },
  playerOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: spacing.lg,
    overflow: 'visible',
  },
  playerPositionTile: {
    flexBasis: '48.5%',
    flexGrow: 1,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
  },
  sheetHint: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  twoKmRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.md,
  },
  twoKmField: {
    flex: 1,
    minWidth: 0,
  },
  twoKmLabel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  twoKmInput: {
    minHeight: 56,
    backgroundColor: colors.surface.secondary,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    paddingHorizontal: 14,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  twoKmError: {
    color: colors.status.error,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  playerExperienceStack: {
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: spacing.lg,
    overflow: 'visible',
  },
  playerExperienceTile: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  programOptionStack: {
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: spacing.lg,
    overflow: 'visible',
  },
  programOptionTile: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  playerOptionText: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  playerOptionTextSelected: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  sheetSection: {
    marginBottom: spacing.lg,
  },
  sheetSectionTitle: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sheetCard: {
    backgroundColor: '#101010',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    overflow: 'hidden',
  },
  // The section heading and its one pen, on the same line.
  profileRowChevron: { marginLeft: 'auto', paddingLeft: 8 },
  setupRowPen: {
    marginLeft: 'auto',
    paddingLeft: 8,
    alignSelf: 'center',
  },
  setupSheetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  setupSheetLabel: {
    width: 104,
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  setupSheetValue: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  sheetCardAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: '#101010',
  },
  sheetCardActionText: {
    color: colors.accent.lime,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  sheetCardChevron: {
    color: colors.text.tertiary,
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 28,
  },
  sheetSecondaryButton: {
    marginTop: spacing.md,
  },
  sheetCoachFallback: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  sheetCoachFallbackText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  sheetChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: spacing.md,
    overflow: 'visible',
  },
  sheetDayChip: {
    minWidth: 58,
    alignItems: 'center',
  },
  sheetDayChipText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  sheetDayChipTextSelected: {
    color: colors.accent.lime,
  },
  sheetHelperText: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  setupNoteBlock: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  setupNotePreserved: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  setupNoteWiped: {
    color: '#D9874E',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  sheetError: {
    color: colors.status.errorLight,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  resetRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  legalRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  legalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface.tertiary,
  },
  dangerCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.45)',
  },
});
