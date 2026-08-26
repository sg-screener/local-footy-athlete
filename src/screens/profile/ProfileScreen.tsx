import React, { useEffect, useRef, useState } from 'react';
import { motivationGoalLabel, resolveMotivation } from '../../rules/motivationGoals';
import {
  Animated,
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { Button as V2Button, SheetDescription, SheetHeader } from '../../components/ui';
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

type SetupPageStep =
  | 'overview'
  | 'playerName'
  | 'playerPosition'
  | 'playerExperience'
  | 'playerTimeTrial'
  | 'programPhase'
  | 'programSeasonFinish'
  | 'programLfaDays'
  | 'programTeamDays'
  | 'programGameDay'
  | 'confirm'
  | 'building'
  | 'complete';

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
  const insets = useSafeAreaInsets();
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
  const [setupPageVisible, setSetupPageVisible] = useState(false);
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
  const [setupPageStep, setSetupPageStep] = useState<SetupPageStep>('overview');
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
    setDraftName(pendingName);
    setDraftPosition(pendingPosition);
    setDraftExperience(pendingExperience);
    seedTwoKmDrafts(pendingTwoKm);
    setSetupUpdateError(null);
    setSetupPageStep('playerName');
  };

  const openProgramDetailsEditor = () => {
    setDraftSeasonPhase(pendingSeasonPhase);
    setDraftPreferredDays(pendingPreferredDays);
    setDraftTeamDays(pendingTeamDays);
    setDraftGameDay(pendingGameDay);
    setDraftSeasonFinishDate(seasonFinishDateDraft(pendingSeasonFinishedOn));
    setDraftSeasonFinishedOn(pendingSeasonFinishedOn);
    setSetupUpdateError(null);
    setSetupPageStep('programPhase');
  };

  const onProgramSetupChanged = () => {
    const currentName = onboardingData.firstName || '';
    const currentPosition = currentRole(onboardingData);
    const currentExperience = (onboardingData.experienceLevel as ExperienceLevel) || null;
    const currentSeasonPhase = (ownedSeasonPhase.phase || 'Pre-season') as SeasonPhase;
    const currentPreferredDays = (onboardingData.preferredTrainingDays as DayOfWeek[]) || [];
    const currentTeamDays = (onboardingData.teamTrainingDays as DayOfWeek[]) || [];
    const currentGameDay = dayFromGameFields(onboardingData);
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
    setSetupPageStep('overview');
    setSetupPageVisible(true);
  };

  const openEquipmentEditor = () => {
    // Equipment keeps its existing atomic editor and transaction. The setup
    // PAGE remains underneath it, so closing or saving the focused equipment
    // editor returns the athlete to the review page rather than Profile home.
    setEquipmentSaveError(null);
    setEquipmentEditorVisible(true);
  };

  const displayName = onboardingData.firstName || 'Athlete';
  const position = onboardingData.position ? roleBucketLabel(onboardingData.position) : '';
  const experienceLevel = onboardingData.experienceLevel || '';
  const daysPerWeek = onboardingData.trainingDaysPerWeek;
  const teamDays = onboardingData.teamTrainingDays || [];
  const gameDay = onboardingData.gameDay || onboardingData.usualGameDay || '';
  const mainFocus = onboardingData.biggestLimitation
    || (resolveMotivation(onboardingData).goals[0]
      ? motivationGoalLabel(resolveMotivation(onboardingData).goals[0])
      : '')
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
    },
  });
  const setupHasChanges = setupDecision.hasChanges;
  const canUpdateSetup = setupDecision.canSave && !isSetupUpdating;
  // A disabled Save always says why. A control that is off for an unstated
  // reason is the same failure as one that is on and inert.
  const setupBlockedCopy = setupDecision.blockedBy.length > 0
    ? profileSetupBlockCopy(setupDecision.blockedBy[0])
    : null;

  const closeSetupPage = () => {
    if (isSetupUpdating) return;
    setSetupPageVisible(false);
    setSetupPageStep('overview');
    setSetupUpdateError(null);
    setSetupUpdateIsPhaseShift(false);
  };

  const goBackInSetupPage = () => {
    if (isSetupUpdating) return;
    setSetupUpdateError(null);
    if (setupPageStep === 'playerTimeTrial') {
      setSetupPageStep('playerExperience');
      return;
    }
    if (setupPageStep === 'playerExperience') {
      setSetupPageStep('playerPosition');
      return;
    }
    if (setupPageStep === 'playerPosition') {
      setSetupPageStep('playerName');
      return;
    }
    if (setupPageStep === 'programGameDay') {
      setSetupPageStep('programTeamDays');
      return;
    }
    if (setupPageStep === 'programTeamDays') {
      setSetupPageStep('programLfaDays');
      return;
    }
    if (setupPageStep === 'programLfaDays') {
      setSetupPageStep(
        draftSeasonPhase === 'Off-season' && pendingSeasonPhase !== 'Off-season'
          ? 'programSeasonFinish'
          : 'programPhase',
      );
      return;
    }
    if (setupPageStep === 'programSeasonFinish') {
      setSetupPageStep('programPhase');
      return;
    }
    if (setupPageStep === 'programPhase') {
      cancelProgramDetailsEdit();
      return;
    }
    setSetupPageStep('overview');
  };

  const cancelPlayerDetailsEdit = () => {
    setDraftName(pendingName);
    setDraftPosition(pendingPosition);
    setDraftExperience(pendingExperience);
    seedTwoKmDrafts(pendingTwoKm);
    setSetupUpdateError(null);
    setSetupPageStep('overview');
  };

  const cancelProgramDetailsEdit = () => {
    setDraftSeasonPhase(pendingSeasonPhase);
    setDraftPreferredDays(pendingPreferredDays);
    setDraftTeamDays(pendingTeamDays);
    setDraftGameDay(pendingGameDay);
    setDraftSeasonFinishDate(seasonFinishDateDraft(pendingSeasonFinishedOn));
    setDraftSeasonFinishedOn(pendingSeasonFinishedOn);
    setSetupUpdateError(null);
    setSetupPageStep('overview');
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
    setSetupPageStep('overview');
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
    setSetupPageStep('playerTimeTrial');
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
    setSetupPageStep('overview');
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
    setSetupPageStep('programLfaDays');
  };

  const answerSeasonFinishNotSure = () => {
    setDraftSeasonFinishedOn(null);
    setSetupPageStep('programLfaDays');
  };

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
    setSetupPageStep('building');
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
        setSetupPageStep('confirm');
        return;
      }
      if (!result.changedProgram) {
        // A save that changed nothing is reported, not swallowed. Closing the
        // sheet on a no-change outcome is what made a dead Save button look
        // exactly like a working one.
        setSetupUpdateError(
          classifyProgramMutationRefusal({ reason: result.reason }).userMessage,
        );
        setSetupPageStep('confirm');
        return;
      }
      setProgramDetailsSaved(false);
      if (phaseIsChanging) {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, PHASE_SHIFT_MIN_DISPLAY_MS - elapsed);
        if (wait > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, wait));
        }
        setSetupPageStep('complete');
      } else {
        setSetupPageVisible(false);
        setSetupPageStep('overview');
      }
    } catch (err: any) {
      logger.error('[profile-setup-update] rebuild_failed', err?.diagnostic || err?.message || err);
      setSetupUpdateError(classifyProgramMutationRefusal({ error: err }).userMessage);
      setSetupPageStep('confirm');
    } finally {
      setIsSetupUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!setupPageVisible ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 88 + insets.bottom },
          ]}
        >
        <View style={styles.brandHeader}>
          <LfaWordmark />
        </View>

        {/* Program setup */}
        <View style={styles.section} testID="profile-program-setup-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>PROGRAM SETUP</Text>
          <Card style={[styles.summaryCard, styles.profilePageCardSurface]}>
            <ProfileRow label="Name" value={displayName} />
            {position ? <ProfileRow label="Footy role" value={position} /> : null}
            {experienceLevel ? <ProfileRow label="Training Experience" value={experienceLevel} /> : null}
            <ProfileRow
              label="LFA Days"
              value={
                daysPerWeek
                  ? `${daysPerWeek} ${daysPerWeek === 1 ? 'day' : 'days'} per week`
                  : 'Not set'
              }
            />
            {teamDays.length > 0 ? (
              <ProfileRow label="Team Training" value={formatList(teamDays) ?? ''} />
            ) : null}
            {gameDay ? <ProfileRow label="Game Day" value={gameDay} /> : null}
            {mainFocus ? <ProfileRow label="Main goal/s" value={mainFocus} /> : null}
            <ProfileRow
              label="Equipment"
              value={formatEquipmentProfileSummary(onboardingData)}
            />
            <SetupEditAction
              label="Something changed? Tell the coach"
              onPress={onProgramSetupChanged}
              testID="profile-program-setup-change"
              accessibilityLabel="Something changed? Tell the coach"
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

        {/* Footer */}
        <View style={styles.footer}>
          <Text variant="label" color={colors.accent.lime}>LFA</Text>
          <Text variant="caption" color={colors.text.tertiary} style={{ marginTop: spacing.xs }}>
            MVP 0.1
          </Text>
        </View>
        </ScrollView>
      ) : null}
      {setupPageVisible ? (
        <SetupUpdatePage
        step={setupPageStep}
        currentPhase={pendingSeasonPhase}
        displayName={pendingName}
        position={pendingPosition}
        experienceLevel={pendingExperience}
        draftName={draftName}
        draftPosition={draftPosition}
        draftExperience={draftExperience}
        draftSeasonPhase={draftSeasonPhase}
        draftSeasonFinishDate={draftSeasonFinishDate}
        draftPreferredDays={draftPreferredDays}
        draftTeamDays={draftTeamDays}
        draftGameDay={draftGameDay}
        preferredDays={pendingPreferredDays}
        teamDays={pendingTeamDays}
        gameDay={pendingGameDay}
        canUpdate={canUpdateSetup}
        blockedCopy={setupBlockedCopy}
        error={setupUpdateError}
        isUpdating={isSetupUpdating}
        setupUpdateIsPhaseShift={setupUpdateIsPhaseShift}
        updateMsgIdx={setupUpdateMsgIdx}
        updateMsgOpacity={setupUpdateMsgOpacity}
        onClose={closeSetupPage}
        onBack={goBackInSetupPage}
        onOpenStep={setSetupPageStep}
        onSetDraftName={setDraftName}
        onSetDraftPosition={setDraftPosition}
        onSetDraftExperience={setDraftExperience}
        onSetDraftSeasonPhase={selectDraftSeasonPhase}
        onChangeSeasonFinishDate={changeDraftSeasonFinishDate}
        onContinueSeasonFinish={continueFromSeasonFinish}
        onAnswerSeasonFinishNotSure={answerSeasonFinishNotSure}
        draftTwoKmMinutes={draftTwoKmMinutes}
        draftTwoKmSeconds={draftTwoKmSeconds}
        draftTwoKmRefusal={draftTwoKmRefusals.time}
        draftTwoKmContinueDisabled={draftTwoKmContinueDisabled}
        onSetDraftTwoKmMinutes={(text) => { setDraftTwoKmMinutes(text); onAnswerEdited(); }}
        onSetDraftTwoKmSeconds={(text) => { setDraftTwoKmSeconds(text); onAnswerEdited(); }}
        onSaveTwoKm={saveTwoKm}
        onCommitTwoKm={commitTwoKm}
        onCancelPlayerDetails={cancelPlayerDetailsEdit}
        onSavePlayerDetails={savePlayerDetails}
        onToggleDraftPreferredDay={toggleDraftPreferredDay}
        onToggleDraftTeamDay={toggleDraftTeamDay}
        onSetDraftGameDay={setDraftGameDay}
        onCancelProgramDetails={cancelProgramDetailsEdit}
        onSaveProgramDetails={saveProgramDetails}
        onEditPlayerDetails={openPlayerDetailsEditor}
        onEditProgramDetails={openProgramDetailsEditor}
        equipmentSummary={formatEquipmentProfileSummary(onboardingData)}
        onEditEquipment={openEquipmentEditor}
        onReviewUpdate={() => {
          setSetupUpdateError(null);
          setSetupPageStep('confirm');
        }}
        onConfirmUpdate={executeSetupUpdate}
      />
      ) : null}
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

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue}>
        {value}
      </Text>
    </View>
  );
}

function SetupEditAction({
  label,
  onPress,
  testID,
  accessibilityLabel = label,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.sheetCardAction}
      activeOpacity={0.72}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.sheetCardActionText}>{label}</Text>
      <Text style={styles.sheetCardChevron}>›</Text>
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

interface SetupUpdatePageProps {
  step: SetupPageStep;
  currentPhase: SeasonPhase;
  displayName: string;
  position: RoleBucket | null;
  experienceLevel: ExperienceLevel | null;
  draftName: string;
  draftPosition: RoleBucket | null;
  draftExperience: ExperienceLevel | null;
  draftTwoKmMinutes: string;
  draftTwoKmSeconds: string;
  /** Already gated by `useRefusalOnContinue` — render it or don't, no judgement. */
  draftTwoKmRefusal: string | null;
  draftTwoKmContinueDisabled: boolean;
  draftSeasonPhase: SeasonPhase;
  draftSeasonFinishDate: SeasonFinishDateDraft;
  draftPreferredDays: DayOfWeek[];
  draftTeamDays: DayOfWeek[];
  draftGameDay: DayOfWeek | null;
  preferredDays: DayOfWeek[];
  teamDays: DayOfWeek[];
  gameDay: DayOfWeek | null;
  canUpdate: boolean;
  /** Why Save is unavailable, or null when it is available. */
  blockedCopy: string | null;
  error: string | null;
  isUpdating: boolean;
  setupUpdateIsPhaseShift: boolean;
  updateMsgIdx: number;
  updateMsgOpacity: Animated.Value;
  onClose: () => void;
  onBack: () => void;
  onOpenStep: (step: SetupPageStep) => void;
  onSetDraftName: (name: string) => void;
  onSetDraftPosition: (position: RoleBucket) => void;
  onSetDraftExperience: (experience: ExperienceLevel) => void;
  onSetDraftTwoKmMinutes: (value: string) => void;
  onSetDraftTwoKmSeconds: (value: string) => void;
  /** The step's CTA. Reveals the refusal, or commits — the owner decides which. */
  onSaveTwoKm: () => void;
  /** Direct commit for "I haven't tested it", which no bound applies to. */
  onCommitTwoKm: (seconds: number | null) => void;
  onSetDraftSeasonPhase: (phase: SeasonPhase) => void;
  onChangeSeasonFinishDate: (value: SeasonFinishDateDraft) => void;
  onContinueSeasonFinish: () => void;
  onAnswerSeasonFinishNotSure: () => void;
  onCancelPlayerDetails: () => void;
  onSavePlayerDetails: () => void;
  onToggleDraftPreferredDay: (day: DayOfWeek) => void;
  onToggleDraftTeamDay: (day: DayOfWeek) => void;
  onSetDraftGameDay: (day: DayOfWeek) => void;
  onCancelProgramDetails: () => void;
  onSaveProgramDetails: () => void;
  onEditPlayerDetails: () => void;
  onEditProgramDetails: () => void;
  equipmentSummary: string;
  onEditEquipment: () => void;
  onReviewUpdate: () => void;
  onConfirmUpdate: () => void;
}

function SetupUpdatePage({
  step,
  currentPhase,
  displayName,
  position,
  experienceLevel,
  draftName,
  draftPosition,
  draftExperience,
  draftTwoKmMinutes,
  draftTwoKmSeconds,
  draftTwoKmRefusal,
  draftTwoKmContinueDisabled,
  draftSeasonPhase,
  draftSeasonFinishDate,
  draftPreferredDays,
  draftTeamDays,
  draftGameDay,
  preferredDays,
  teamDays,
  gameDay,
  canUpdate,
  blockedCopy,
  error,
  isUpdating,
  setupUpdateIsPhaseShift,
  updateMsgIdx,
  updateMsgOpacity,
  onClose,
  onBack,
  onOpenStep,
  onSetDraftName,
  onSetDraftPosition,
  onSetDraftExperience,
  onSetDraftTwoKmMinutes,
  onSetDraftTwoKmSeconds,
  onSaveTwoKm,
  onCommitTwoKm,
  onSetDraftSeasonPhase,
  onChangeSeasonFinishDate,
  onContinueSeasonFinish,
  onAnswerSeasonFinishNotSure,
  onCancelPlayerDetails,
  onSavePlayerDetails,
  onToggleDraftPreferredDay,
  onToggleDraftTeamDay,
  onSetDraftGameDay,
  onCancelProgramDetails,
  onSaveProgramDetails,
  onEditPlayerDetails,
  onEditProgramDetails,
  equipmentSummary,
  onEditEquipment,
  onReviewUpdate,
  onConfirmUpdate,
}: SetupUpdatePageProps) {
  const building = step === 'building' || isUpdating;
  const showBack = !building && step !== 'overview' && step !== 'complete';
  const preferredValid = preferredDays.length >= 1;
  const draftPreferredValid = draftPreferredDays.length >= 1;
  const draftGameDayValid = draftSeasonPhase !== 'In-season' || Boolean(draftGameDay);

  const content = building ? (
    <BuildingState
      title="Updating your program…"
      msgIdx={updateMsgIdx}
      msgOpacity={updateMsgOpacity}
      messages={PROFILE_SETUP_UPDATE_MESSAGES}
      durationText={setupUpdateIsPhaseShift
        ? signedCopy('phase.shift.build.duration')
        : undefined}
    />
  ) : step === 'complete' ? (
    <BuildCompleteState
      title={signedCopy('phase.shift.complete.title')}
      body={signedCopy('phase.shift.complete.body')}
      actionLabel={signedCopy('phase.shift.complete.action')}
      onDone={onClose}
      testID="profile-phase-shift-complete"
    />
  ) : step === 'playerName' ? (
    <>
      <SheetHeader title="Player details" subtitle="What should I call you?" />
      <View style={styles.playerInputCard}>
        <Feather name="user" size={19} color={colors.text.tertiary} />
        <AppTextInput
          style={styles.playerTextInput}
          value={draftName}
          onChangeText={onSetDraftName}
          placeholder="Type your name..."
          placeholderTextColor={colors.text.disabled}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => {
            if (draftName.trim()) onOpenStep('playerPosition');
          }}
          maxLength={30}
        />
      </View>
      <V2Button
        label="Continue"
        size="lg"
        disabled={!draftName.trim()}
        onPress={() => onOpenStep('playerPosition')}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelPlayerDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'playerPosition' ? (
    <>
      <SheetHeader title="Player details" subtitle="What position fits you best?" />
      <View style={styles.playerOptionGrid}>
        {ROLE_BUCKET_OPTIONS.map((option) => {
          const selected = draftPosition === option.id;
          return (
            <SelectableTile
              key={option.id}
              isSelected={selected}
              onPress={() => onSetDraftPosition(option.id)}
              style={styles.playerPositionTile}
            >
              <Text style={[styles.playerOptionText, selected && styles.playerOptionTextSelected]}>
                {option.label}
              </Text>
            </SelectableTile>
          );
        })}
      </View>
      <V2Button
        label="Continue"
        size="lg"
        disabled={!draftPosition}
        onPress={() => onOpenStep('playerExperience')}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelPlayerDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'playerExperience' ? (
    <>
      <SheetHeader title="Player details" subtitle="What’s your training experience?" />
      <View style={styles.playerExperienceStack}>
        {EXPERIENCE_OPTIONS.map((option) => {
          const selected = draftExperience === option.id;
          return (
            <SelectableTile
              key={option.id}
              isSelected={selected}
              onPress={() => onSetDraftExperience(option.id)}
              style={styles.playerExperienceTile}
            >
              <Text style={[styles.playerOptionText, selected && styles.playerOptionTextSelected]}>
                {option.label}
              </Text>
            </SelectableTile>
          );
        })}
      </View>
      <V2Button
        label="Continue"
        size="lg"
        disabled={!draftName.trim() || !draftPosition || !draftExperience}
        onPress={onSavePlayerDetails}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelPlayerDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'playerTimeTrial' ? (
    /* The 2km time trial (D14) -- the change-it-later door. Same two boxes as
       onboarding, same ingress, same refusal sentence. The ruled numbers are
       not restated here: whatever `validateTwoKmTime` says is what shows. */
    <>
      <SheetHeader title="Running" subtitle="What’s your recent 2km time?" />
      <SheetDescription>
        Sets your running paces. Leave it blank if you haven’t tested.
      </SheetDescription>
      <View style={styles.twoKmRow}>
        <View style={styles.twoKmField}>
          <Text style={styles.twoKmLabel}>Minutes</Text>
          <AppTextInput
            style={styles.twoKmInput}
            placeholder="7"
            placeholderTextColor={colors.text.tertiary}
            value={draftTwoKmMinutes}
            onChangeText={onSetDraftTwoKmMinutes}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.twoKmField}>
          <Text style={styles.twoKmLabel}>Seconds</Text>
          <AppTextInput
            style={styles.twoKmInput}
            placeholder="15"
            placeholderTextColor={colors.text.tertiary}
            value={draftTwoKmSeconds}
            onChangeText={onSetDraftTwoKmSeconds}
            keyboardType="numeric"
          />
        </View>
      </View>
      {/* Spoken on Save, never mid-keystroke — the owner has already decided
          whether this may be shown at all. */}
      {draftTwoKmRefusal ? (
        <Text style={styles.twoKmError}>{draftTwoKmRefusal}</Text>
      ) : null}
      <V2Button
        label="Save player details"
        size="lg"
        disabled={draftTwoKmContinueDisabled}
        onPress={onSaveTwoKm}
      />
      {/* Retracting a time is an answer too -- an athlete who mistyped one
          months ago must be able to say "actually, I haven't tested". */}
      <V2Button
        label="I haven’t tested it"
        variant="secondary"
        size="md"
        onPress={() => onCommitTwoKm(null)}
        style={styles.sheetSecondaryButton}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelPlayerDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'programPhase' ? (
    <>
      <SheetHeader title="Program setup" subtitle="What phase are you in?" />
      <View style={styles.programOptionStack}>
        {SEASON_PHASE_OPTIONS.map((option) => {
          const selected = draftSeasonPhase === option;
          return (
            <SelectableTile
              key={option}
              isSelected={selected}
              onPress={() => onSetDraftSeasonPhase(option)}
              style={styles.programOptionTile}
            >
              <Text style={[styles.playerOptionText, selected && styles.playerOptionTextSelected]}>
                {option}
              </Text>
            </SelectableTile>
          );
        })}
      </View>
      <V2Button
        label="Continue"
        size="lg"
        onPress={() => onOpenStep(
          draftSeasonPhase === 'Off-season' && currentPhase !== 'Off-season'
            ? 'programSeasonFinish'
            : 'programLfaDays',
        )}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelProgramDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'programSeasonFinish' ? (
    <>
      <SheetHeader
        title="Off-season"
        subtitle={signedCopy('phase.offseason.finish.title')}
      />
      <SheetDescription>
        This helps LFA start you at the right point of your off-season.
      </SheetDescription>
      <SeasonFinishDateFields
        value={draftSeasonFinishDate}
        onChange={onChangeSeasonFinishDate}
      />
      <V2Button
        label="Continue"
        size="lg"
        disabled={!draftSeasonFinishDate.day || !draftSeasonFinishDate.month || !draftSeasonFinishDate.year}
        onPress={onContinueSeasonFinish}
        style={{ marginTop: spacing.lg }}
      />
      <V2Button
        label="I'm not sure"
        variant="secondary"
        size="md"
        onPress={onAnswerSeasonFinishNotSure}
        style={styles.sheetSecondaryButton}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelProgramDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'programLfaDays' ? (
    <>
      <SheetHeader title="Program setup" subtitle="What days can you train?" />
      <SheetDescription>
        We’ll build your LFA work around these days.
      </SheetDescription>
      <DayChipGrid
        days={WEEK_DAYS}
        selectedDays={draftPreferredDays}
        onToggleDay={onToggleDraftPreferredDay}
      />
      <Text style={styles.sheetHelperText}>
        Pick at least one day.
      </Text>
      <V2Button
        label={draftSeasonPhase === 'Off-season' ? 'Save program details' : 'Continue'}
        size="lg"
        disabled={!draftPreferredValid}
        onPress={() => {
          if (draftSeasonPhase === 'Off-season') {
            onSaveProgramDetails();
            return;
          }
          onOpenStep('programTeamDays');
        }}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelProgramDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'programTeamDays' ? (
    <>
      <SheetHeader title="Team training" subtitle="Which days does your team train?" />
      <SheetDescription>
        We’ll work your program around these days.
      </SheetDescription>
      <DayChipGrid
        days={WEEK_DAYS}
        selectedDays={draftTeamDays}
        onToggleDay={onToggleDraftTeamDay}
      />
      <Text style={styles.sheetHelperText}>
        Leave blank if you don’t have team training this phase.
      </Text>
      <V2Button
        label={draftSeasonPhase === 'In-season' ? 'Continue' : 'Save program details'}
        size="lg"
        onPress={() => {
          if (draftSeasonPhase === 'In-season') {
            onOpenStep('programGameDay');
            return;
          }
          onSaveProgramDetails();
        }}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelProgramDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'programGameDay' ? (
    <>
      <SheetHeader title="Game day" subtitle="Which day do you usually play?" />
      <SheetDescription>
        We’ll keep your week built around match day.
      </SheetDescription>
      <DayChipGrid
        days={WEEK_DAYS}
        selectedDays={draftGameDay ? [draftGameDay] : []}
        onToggleDay={onSetDraftGameDay}
      />
      <V2Button
        label="Save program details"
        size="lg"
        disabled={!draftGameDayValid}
        onPress={onSaveProgramDetails}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onCancelProgramDetails}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : step === 'confirm' ? (
    <>
      <SheetHeader title="Program setup" subtitle="Update your program?" />
      <SheetDescription>
        Your program will rebuild around your updated setup.
      </SheetDescription>
      <View style={styles.setupNoteBlock}>
        <Text style={styles.setupNotePreserved}>✓ Setup changes saved</Text>
        <Text style={styles.setupNotePreserved}>✓ Team and game days preserved where possible</Text>
        <Text style={styles.setupNoteWiped}>× Custom coach edits may be replaced</Text>
      </View>
      {error ? <Text style={styles.sheetError}>{error}</Text> : null}
      <V2Button
        label={error ? 'Try again' : 'Continue'}
        size="lg"
        onPress={onConfirmUpdate}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onClose}
        style={styles.sheetSecondaryButton}
      />
    </>
  ) : (
    <>
      <SheetHeader title="Program setup" subtitle="Review your setup" />
      <SheetDescription>
        Change the details your program is built around.
      </SheetDescription>

      <View style={styles.sheetSection}>
        <Text style={styles.sheetSectionTitle}>PLAYER DETAILS</Text>
        <View style={styles.sheetCard}>
          <SetupSummaryRow label="Name" value={formatPlayerDetail(displayName)} />
          <SetupSummaryRow
            label="Footy role"
            value={formatPlayerDetail(position ? roleBucketLabel(position) : undefined)}
          />
          <SetupSummaryRow
            label="Training Experience"
            value={formatExperienceDetail(experienceLevel)}
          />
          <SetupEditAction
            label="Edit player details"
            onPress={onEditPlayerDetails}
          />
        </View>
      </View>

      <View style={styles.sheetSection}>
        <Text style={styles.sheetSectionTitle}>EQUIPMENT</Text>
        <View style={styles.sheetCard}>
          <SetupSummaryRow label="Training setup" value={equipmentSummary} />
          <SetupEditAction
            label="Edit equipment"
            onPress={onEditEquipment}
            testID="profile-setup-equipment-edit"
            accessibilityLabel="Edit equipment"
          />
        </View>
      </View>

      <View style={styles.sheetSection}>
        <Text style={styles.sheetSectionTitle}>PROGRAM SETUP</Text>
        <View style={styles.sheetCard}>
          <SetupSummaryRow label="Current phase" value={currentPhase} />
          <SetupSummaryRow
            label="LFA work days"
            value={formatDaySummary(preferredDays)}
          />
          <SetupSummaryRow
            label="Team training days"
            value={formatDaySummary(teamDays)}
          />
          {currentPhase === 'In-season' ? (
            <SetupSummaryRow
              label="Usual game day"
              value={gameDay ? gameDay : 'Not set'}
            />
          ) : null}
          <SetupEditAction
            label="Edit program details"
            onPress={onEditProgramDetails}
          />
        </View>
      </View>

      {/* A disabled Save states its reason. Before this, the button simply
          went dead — on a phase-skewed device it went dead on the very
          selection that would have repaired the skew, and said nothing. */}
      {!canUpdate && blockedCopy ? (
        <Text style={styles.sheetError} testID="profile-setup-blocked-reason">
          {blockedCopy}
        </Text>
      ) : null}
      <V2Button
        label="Update program"
        size="lg"
        disabled={!canUpdate}
        onPress={onReviewUpdate}
      />
      <V2Button
        label="Cancel"
        variant="secondary"
        size="md"
        onPress={onClose}
        style={styles.sheetSecondaryButton}
      />
    </>
  );

  return (
    <View style={styles.setupPage} testID="profile-setup-update-page">
      <View style={styles.setupPageHeader}>
        <TouchableOpacity
          style={[
            styles.setupPageBackButton,
            building && styles.setupPageBackButtonDisabled,
          ]}
          activeOpacity={0.72}
          onPress={showBack ? onBack : onClose}
          disabled={building}
          testID="profile-setup-update-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityState={{ disabled: building }}
        >
          <Feather name="chevron-left" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {building ? (
        <View style={styles.setupPageBuilding}>{content}</View>
      ) : (
        // Route the setup-page inputs through the shared keyboard owner so they
        // get scroll-into-view and the one Done bar (census finding #9).
        // Device-verify the page layout (L10).
        <KeyboardSafeArea
          style={styles.setupPageScroll}
          scrollProps={{
            contentContainerStyle: styles.setupPageScrollContent,
            showsVerticalScrollIndicator: false,
          }}
        >
          {content}
        </KeyboardSafeArea>
      )}
    </View>
  );
}

function SetupSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.setupSheetRow}>
      <Text style={styles.setupSheetLabel}>{label}</Text>
      <Text style={styles.setupSheetValue}>{value}</Text>
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
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  profileRowLabel: {
    width: 118,
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
  setupSheetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  setupSheetLabel: {
    width: 118,
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
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surface.tertiary,
    marginTop: spacing.lg,
  },
});
