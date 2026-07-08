import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { useCoachUpdatesStore } from '../../store/coachUpdatesStore';
import { useAthletePreferencesStore } from '../../store/athletePreferencesStore';
import { useCoachPreferencesStore } from '../../store/coachPreferencesStore';
import { useReadinessStore } from '../../store/readinessStore';
import { generateProgramFromProfile } from '../../services/api/generateProgram';
import {
  clearCoachAdjustments,
  clearCoachChat,
  resetProgramAndOnboarding,
  resetToDevPostOnboardingState,
} from '../../utils/resetCoach';
import { mapToLegacyGameDay } from '../../utils/profileMutations';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { SelectableTile } from '../../components/common/SelectableTile';
import { Button as V2Button, Sheet } from '../../components/ui';
import { buildMailto, getClientEnvConfig } from '../../config/env';
import { WEEK_DAYS, DAY_SHORT, REBUILD_MSG_INTERVAL_MS } from '../home/homeScreenConstants';
import { logger } from '../../utils/logger';
import { selectActiveCoachNotes } from '../../utils/activeCoachNotes';
import {
  ROLE_BUCKET_OPTIONS,
  normalizeRoleBucket,
  roleBucketLabel,
} from '../../utils/roleBuckets';
import type { DayOfWeek, ExperienceLevel, OnboardingData, RoleBucket, SeasonPhase } from '../../types/domain';

type SetupSheetStep =
  | 'overview'
  | 'playerName'
  | 'playerPosition'
  | 'playerExperience'
  | 'programPhase'
  | 'programLfaDays'
  | 'programTeamDays'
  | 'programGameDay'
  | 'confirm'
  | 'building';

const GAME_DAY_OPTIONS: DayOfWeek[] = ['Friday', 'Saturday', 'Sunday'];
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

function sameDays(a?: DayOfWeek[], b?: DayOfWeek[]): boolean {
  const left = sortDays(a ?? []);
  const right = sortDays(b ?? []);
  return left.length === right.length && left.every((day, index) => day === right[index]);
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
  if (data.usualGameDay && WEEK_DAYS.includes(data.usualGameDay)) {
    return data.usualGameDay;
  }
  if (data.gameDay && WEEK_DAYS.includes(data.gameDay as DayOfWeek)) {
    return data.gameDay as DayOfWeek;
  }
  return null;
}

function classifySetupUpdateError(err: any): string {
  if (err && typeof err === 'object' && err.name === 'ProgramGenError') {
    return err.userMessage || 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const onboardingData = useProfileStore((s) => s.onboardingData);
  const updateOnboardingData = useProfileStore((s) => s.updateOnboardingData);
  const setCurrentProgram = useProgramStore((s) => s.setCurrentProgram);
  const setCurrentMicrocycle = useProgramStore((s) => s.setCurrentMicrocycle);
  const setTodayWorkout = useProgramStore((s) => s.setTodayWorkout);
  const clearManualOverrides = useProgramStore((s) => s.clearManualOverrides);
  const activeConstraints = useCoachUpdatesStore((s) => s.activeConstraints);
  const activeInjury = useCoachUpdatesStore((s) => s.activeInjury);
  const athletePrefs = useAthletePreferencesStore((s) => s.prefs);
  const modalityPreferences = useCoachPreferencesStore((s) => s.modalityPreferences);
  const readinessSignalsByDate = useReadinessStore((s) => s.signalsByDate);
  const env = getClientEnvConfig();
  const [isDevResetting, setIsDevResetting] = useState(false);
  const [setupSheetVisible, setSetupSheetVisible] = useState(false);
  const [setupSheetStep, setSetupSheetStep] = useState<SetupSheetStep>('overview');
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
    (onboardingData.seasonPhase || 'Pre-season') as SeasonPhase,
  );
  const [pendingPreferredDays, setPendingPreferredDays] = useState<DayOfWeek[]>([]);
  const [pendingTeamDays, setPendingTeamDays] = useState<DayOfWeek[]>([]);
  const [pendingGameDay, setPendingGameDay] = useState<DayOfWeek | null>(null);
  const [draftSeasonPhase, setDraftSeasonPhase] = useState<SeasonPhase>(
    (onboardingData.seasonPhase || 'Pre-season') as SeasonPhase,
  );
  const [draftPreferredDays, setDraftPreferredDays] = useState<DayOfWeek[]>([]);
  const [draftTeamDays, setDraftTeamDays] = useState<DayOfWeek[]>([]);
  const [draftGameDay, setDraftGameDay] = useState<DayOfWeek | null>(null);
  const [programDetailsSaved, setProgramDetailsSaved] = useState(false);
  const [setupUpdateError, setSetupUpdateError] = useState<string | null>(null);
  const [isSetupUpdating, setIsSetupUpdating] = useState(false);
  const [setupUpdateMsgIdx, setSetupUpdateMsgIdx] = useState(0);
  const setupUpdateMsgOpacity = useRef(new Animated.Value(1)).current;

  // Render-time proof — confirms the live Profile tab actually mounts
  // the Coach adjustments section. Pair with [reset-ui] press logs below.
  useEffect(() => {
    logger.debug('[profile] coach_adjustments_section_rendered');
  }, []);

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
  const onClearCoachAdjustments = () => {
    logger.debug('[reset-ui] clear_coach_adjustments_pressed');
    Alert.alert(
      'Clear coach adjustments?',
      'Clears active restrictions and coach-made program edits. Keeps your base program.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: () => {
            const summary = clearCoachAdjustments();
            Alert.alert(
              'Coach adjustments cleared',
              `Active injury: ${summary.activeInjuryCleared ? 'removed' : 'none'}\n` +
              `Coach Update cards: ${summary.coachUpdatesCleared}\n` +
              `Injury overrides: ${summary.injuryOverridesRemoved.length}`,
            );
          },
        },
      ],
    );
  };

  const onClearCoachChat = () => {
    logger.debug('[reset-ui] clear_coach_chat_pressed');
    Alert.alert(
      'Clear coach chat?',
      'Clears the coach conversation only. Keeps your program.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear chat',
          onPress: () => clearCoachChat(),
        },
      ],
    );
  };

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

  const openCoachWithSetupContext = () => {
    setSetupSheetVisible(false);
    navigation.navigate('CoachTab', {
      screen: 'Coach',
      params: { prefill: 'I need to update something about my setup.' },
    });
  };

  const openPlayerDetailsEditor = () => {
    setDraftName(pendingName);
    setDraftPosition(pendingPosition);
    setDraftExperience(pendingExperience);
    setSetupUpdateError(null);
    setSetupSheetStep('playerName');
  };

  const openProgramDetailsEditor = () => {
    setDraftSeasonPhase(pendingSeasonPhase);
    setDraftPreferredDays(pendingPreferredDays);
    setDraftTeamDays(pendingTeamDays);
    setDraftGameDay(pendingGameDay);
    setSetupUpdateError(null);
    setSetupSheetStep('programPhase');
  };

  const onProgramSetupChanged = () => {
    const currentName = onboardingData.firstName || '';
    const currentPosition = currentRole(onboardingData);
    const currentExperience = (onboardingData.experienceLevel as ExperienceLevel) || null;
    const currentSeasonPhase = (onboardingData.seasonPhase || 'Pre-season') as SeasonPhase;
    const currentPreferredDays = (onboardingData.preferredTrainingDays as DayOfWeek[]) || [];
    const currentTeamDays = (onboardingData.teamTrainingDays as DayOfWeek[]) || [];
    const currentGameDay = dayFromGameFields(onboardingData);
    setPendingName(currentName);
    setPendingPosition(currentPosition);
    setPendingExperience(currentExperience);
    setDraftName(currentName);
    setDraftPosition(currentPosition);
    setDraftExperience(currentExperience);
    setPendingSeasonPhase(currentSeasonPhase);
    setPendingPreferredDays(currentPreferredDays);
    setPendingTeamDays(currentTeamDays);
    setPendingGameDay(currentGameDay);
    setDraftSeasonPhase(currentSeasonPhase);
    setDraftPreferredDays(currentPreferredDays);
    setDraftTeamDays(currentTeamDays);
    setDraftGameDay(currentGameDay);
    setProgramDetailsSaved(false);
    setSetupUpdateError(null);
    setSetupSheetStep('overview');
    setSetupSheetVisible(true);
  };

  const displayName = onboardingData.firstName || 'Athlete';
  const position = onboardingData.position ? roleBucketLabel(onboardingData.position) : '';
  const experienceLevel = onboardingData.experienceLevel || '';
  const daysPerWeek = onboardingData.trainingDaysPerWeek;
  const teamDays = onboardingData.teamTrainingDays || [];
  const gameDay = onboardingData.gameDay || onboardingData.usualGameDay || '';
  const mainFocus = onboardingData.biggestLimitation || onboardingData.goals?.[0] || '';
  const activeIssues = selectActiveCoachNotes({
    activeConstraints,
    activeInjury,
    athletePrefs,
    modalityPreferences,
    onboardingData,
    readinessSignalsByDate,
  }).map((note) =>
    typeof note.severity === 'number' ? `${note.title} — ${note.severity}/10` : note.title,
  );
  const currentPhase = (onboardingData.seasonPhase || 'Pre-season') as SeasonPhase;
  const pendingIsInSeason = pendingSeasonPhase === 'In-season';
  const pendingGameDayValid = !pendingIsInSeason || Boolean(pendingGameDay);
  const lfaDayCountNeedsSync =
    programDetailsSaved &&
    (
      onboardingData.trainingDaysUnsure === true ||
      (onboardingData.trainingDaysPerWeek ?? 0) !== pendingPreferredDays.length
    );
  const playerProgramHasChanges =
    pendingPosition !== currentRole(onboardingData) ||
    pendingExperience !== ((onboardingData.experienceLevel as ExperienceLevel) || null);
  const setupHasChanges =
    playerProgramHasChanges ||
    pendingSeasonPhase !== currentPhase ||
    lfaDayCountNeedsSync ||
    !sameDays(pendingPreferredDays, onboardingData.preferredTrainingDays as DayOfWeek[] | undefined) ||
    !sameDays(pendingTeamDays, onboardingData.teamTrainingDays as DayOfWeek[] | undefined) ||
    (pendingIsInSeason && pendingGameDay !== dayFromGameFields(onboardingData));
  const canUpdateSetup =
    pendingPreferredDays.length >= 1 &&
    pendingGameDayValid &&
    setupHasChanges &&
    !isSetupUpdating;

  const closeSetupSheet = () => {
    if (isSetupUpdating) return;
    setSetupSheetVisible(false);
    setSetupSheetStep('overview');
    setSetupUpdateError(null);
  };

  const goBackInSetupSheet = () => {
    if (isSetupUpdating) return;
    setSetupUpdateError(null);
    if (setupSheetStep === 'playerExperience') {
      setSetupSheetStep('playerPosition');
      return;
    }
    if (setupSheetStep === 'playerPosition') {
      setSetupSheetStep('playerName');
      return;
    }
    if (setupSheetStep === 'programGameDay') {
      setSetupSheetStep('programTeamDays');
      return;
    }
    if (setupSheetStep === 'programTeamDays') {
      setSetupSheetStep('programLfaDays');
      return;
    }
    if (setupSheetStep === 'programLfaDays') {
      setSetupSheetStep('programPhase');
      return;
    }
    if (setupSheetStep === 'programPhase') {
      cancelProgramDetailsEdit();
      return;
    }
    setSetupSheetStep('overview');
  };

  const cancelPlayerDetailsEdit = () => {
    setDraftName(pendingName);
    setDraftPosition(pendingPosition);
    setDraftExperience(pendingExperience);
    setSetupUpdateError(null);
    setSetupSheetStep('overview');
  };

  const cancelProgramDetailsEdit = () => {
    setDraftSeasonPhase(pendingSeasonPhase);
    setDraftPreferredDays(pendingPreferredDays);
    setDraftTeamDays(pendingTeamDays);
    setDraftGameDay(pendingGameDay);
    setSetupUpdateError(null);
    setSetupSheetStep('overview');
  };

  const savePlayerDetails = () => {
    const trimmedName = draftName.trim();
    if (!trimmedName || !draftPosition || !draftExperience) return;

    setPendingName(trimmedName);
    setPendingPosition(draftPosition);
    setPendingExperience(draftExperience);

    if (trimmedName !== (onboardingData.firstName || '')) {
      updateOnboardingData({ firstName: trimmedName });
    }

    setSetupUpdateError(null);
    setSetupSheetStep('overview');
  };

  const saveProgramDetails = () => {
    if (draftPreferredDays.length < 1) return;
    if (draftSeasonPhase === 'In-season' && !draftGameDay) return;

    setPendingSeasonPhase(draftSeasonPhase);
    setPendingPreferredDays(sortDays(draftPreferredDays));
    setPendingTeamDays(sortDays(draftTeamDays));
    setPendingGameDay(draftSeasonPhase === 'In-season' ? draftGameDay : null);
    setProgramDetailsSaved(true);
    setSetupUpdateError(null);
    setSetupSheetStep('overview');
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

  const buildSetupPatch = (): Partial<OnboardingData> => {
    const preferredDays = sortDays(pendingPreferredDays);
    const teamTrainingDays = sortDays(pendingTeamDays);
    const trimmedName = pendingName.trim();
    const currentGameDay = dayFromGameFields(onboardingData);
    const patch: Partial<OnboardingData> = {};

    if (trimmedName && trimmedName !== (onboardingData.firstName || '')) {
      patch.firstName = trimmedName;
    }
    if (pendingPosition && pendingPosition !== currentRole(onboardingData)) {
      patch.position = pendingPosition;
    }
    if (
      pendingExperience &&
      pendingExperience !== ((onboardingData.experienceLevel as ExperienceLevel) || null)
    ) {
      patch.experienceLevel = pendingExperience;
    }

    if (pendingSeasonPhase !== currentPhase) {
      patch.seasonPhase = pendingSeasonPhase;
    }

    if (
      lfaDayCountNeedsSync ||
      !sameDays(preferredDays, onboardingData.preferredTrainingDays as DayOfWeek[] | undefined)
    ) {
      patch.preferredTrainingDays = preferredDays;
      patch.trainingDaysPerWeek = preferredDays.length;
      patch.trainingDaysUnsure = false;
    }

    if (!sameDays(teamTrainingDays, onboardingData.teamTrainingDays as DayOfWeek[] | undefined)) {
      patch.teamTrainingDays = teamTrainingDays;
      patch.teamTrainingDaysPerWeek = teamTrainingDays.length;
    }

    if (pendingSeasonPhase === 'In-season') {
      if (pendingGameDay !== currentGameDay || pendingSeasonPhase !== currentPhase) {
        patch.usualGameDay = pendingGameDay ?? undefined;
        patch.gameDay = pendingGameDay ? mapToLegacyGameDay(pendingGameDay) : undefined;
      }
    } else if (currentPhase === 'In-season') {
      patch.usualGameDay = undefined;
      patch.gameDay = undefined;
    }

    return patch;
  };

  const executeSetupUpdate = async () => {
    if (!canUpdateSetup && !setupUpdateError) return;
    const patch = buildSetupPatch();
    const nextProfile = { ...onboardingData, ...patch };
    setSetupUpdateError(null);
    setSetupUpdateMsgIdx(0);
    setupUpdateMsgOpacity.setValue(1);
    setSetupSheetStep('building');
    setIsSetupUpdating(true);
    try {
      const program = await generateProgramFromProfile(nextProfile);
      updateOnboardingData(patch);
      setCurrentProgram(program);
      if (program.microcycles && program.microcycles.length > 0) {
        const first = program.microcycles[0];
        setCurrentMicrocycle(first);
        const dow = new Date().getDay();
        const todayWorkout = first.workouts?.find((w) => w.dayOfWeek === dow);
        if (todayWorkout) setTodayWorkout(todayWorkout);
      }
      clearManualOverrides();
      setSetupSheetVisible(false);
      setSetupSheetStep('overview');
      setProgramDetailsSaved(false);
    } catch (err: any) {
      logger.error('[profile-setup-update] rebuild_failed', err?.diagnostic || err?.message || err);
      setSetupUpdateError(classifySetupUpdateError(err));
      setSetupSheetStep('confirm');
    } finally {
      setIsSetupUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 88 + insets.bottom },
        ]}
      >
        <View style={styles.header} testID="profile-page-header">
          <Text variant="h1" color={colors.text.primary} style={styles.headerTitle}>
            PROFILE
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary} style={styles.headerSubtitle}>
            Your program setup, coach adjustments and support.
          </Text>
        </View>

        {/* Program setup */}
        <View style={styles.section} testID="profile-program-setup-section">
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>PROGRAM SETUP</Text>
          <Card style={styles.summaryCard}>
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
            {mainFocus ? <ProfileRow label="Main goal / focus" value={mainFocus} /> : null}
            <TouchableOpacity
              style={styles.setupChangeButton}
              activeOpacity={0.7}
              onPress={onProgramSetupChanged}
              testID="profile-program-setup-change"
              accessibilityLabel="Something changed? Tell the coach"
            >
              <Text style={styles.setupChangeText}>
                Something changed? Tell the coach
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Coach adjustments */}
        <View
          style={styles.section}
          testID="profile-coach-adjustments-section"
          accessibilityLabel="Coach adjustments"
        >
          <Text variant="label" color={colors.accent.lime} style={styles.sectionTitle}>
            COACH ADJUSTMENTS
          </Text>
          <Card style={styles.infoCard}>
            <View style={styles.activeCoachState} testID="profile-active-coach-state">
              {activeIssues.length > 0 ? (
                <>
                  <Text variant="caption" color={colors.text.tertiary} style={styles.activeLabel}>
                    Active:
                  </Text>
                  {activeIssues.map((issue, index) => (
                    <Text
                      key={`${issue}-${index}`}
                      variant="bodySmall"
                      color={colors.text.primary}
                      style={styles.activeIssue}
                    >
                      • {issue}
                    </Text>
                  ))}
                </>
              ) : (
                <Text
                  variant="bodySmall"
                  color={colors.text.secondary}
                  testID="profile-no-active-coach-adjustments"
                >
                  No active coach changes.
                </Text>
              )}
            </View>
            {activeIssues.length > 0 ? (
              <>
                <View style={styles.resetDivider} />
                <TouchableOpacity
                  style={styles.resetRow}
                  activeOpacity={0.7}
                  onPress={onClearCoachAdjustments}
                  testID="profile-clear-coach-adjustments"
                  accessibilityLabel="Clear active changes"
                >
                  <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
                    Clear active changes
                  </Text>
                  <Text variant="caption" color={colors.text.tertiary}>
                    Clears active restrictions and coach-made edits. Keeps your base program.
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
            <View style={styles.resetDivider} />
            <TouchableOpacity
              style={styles.resetRow}
              activeOpacity={0.7}
              onPress={onClearCoachChat}
              testID="profile-clear-coach-chat"
              accessibilityLabel="Clear coach chat"
            >
              <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
                Clear coach chat
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                Clears the coach conversation only. Keeps your program.
              </Text>
            </TouchableOpacity>
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
            <Card style={styles.infoCard}>
              <TouchableOpacity
                style={styles.resetRow}
                activeOpacity={0.7}
                onPress={onDevPostOnboardingReset}
                disabled={isDevResetting}
                testID="profile-dev-reset-post-onboarding"
                accessibilityLabel="Reset to post-onboarding state"
              >
                <Text variant="body" color={colors.text.primary} style={{ fontWeight: '700' }}>
                  {isDevResetting ? 'Resetting...' : 'Reset to post-onboarding state'}
                </Text>
                <Text variant="caption" color={colors.text.tertiary}>
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
          <Card style={styles.infoCard}>
            <TouchableOpacity
              style={styles.legalRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Privacy')}
              testID="profile-privacy-policy"
              accessibilityLabel="Privacy Policy"
            >
              <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
                Privacy Policy
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
                How your app, training and coach data is handled.
              </Text>
            </TouchableOpacity>
            <View style={styles.resetDivider} />
            <TouchableOpacity
              style={styles.legalRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Terms')}
              testID="profile-terms-of-use"
              accessibilityLabel="Terms of Use"
            >
              <Text variant="body" color={colors.text.primary} style={{ fontWeight: '600' }}>
                Terms of Use
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
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
          <Card style={styles.dangerCard}>
            <TouchableOpacity
              style={styles.resetRow}
              activeOpacity={0.7}
              onPress={onFullReset}
              testID="profile-full-reset"
              accessibilityLabel="Full reset"
            >
              <Text variant="body" color={colors.status.error} style={{ fontWeight: '700' }}>
                Full reset
              </Text>
              <Text variant="caption" color={colors.text.tertiary}>
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
      <SetupUpdateSheet
        visible={setupSheetVisible}
        step={setupSheetStep}
        currentPhase={pendingSeasonPhase}
        displayName={pendingName}
        position={pendingPosition}
        experienceLevel={pendingExperience}
        draftName={draftName}
        draftPosition={draftPosition}
        draftExperience={draftExperience}
        draftSeasonPhase={draftSeasonPhase}
        draftPreferredDays={draftPreferredDays}
        draftTeamDays={draftTeamDays}
        draftGameDay={draftGameDay}
        preferredDays={pendingPreferredDays}
        teamDays={pendingTeamDays}
        gameDay={pendingGameDay}
        canUpdate={canUpdateSetup}
        error={setupUpdateError}
        isUpdating={isSetupUpdating}
        updateMsgIdx={setupUpdateMsgIdx}
        updateMsgOpacity={setupUpdateMsgOpacity}
        onClose={closeSetupSheet}
        onBack={goBackInSetupSheet}
        onOpenStep={setSetupSheetStep}
        onSetDraftName={setDraftName}
        onSetDraftPosition={setDraftPosition}
        onSetDraftExperience={setDraftExperience}
        onSetDraftSeasonPhase={setDraftSeasonPhase}
        onCancelPlayerDetails={cancelPlayerDetailsEdit}
        onSavePlayerDetails={savePlayerDetails}
        onToggleDraftPreferredDay={toggleDraftPreferredDay}
        onToggleDraftTeamDay={toggleDraftTeamDay}
        onSetDraftGameDay={setDraftGameDay}
        onCancelProgramDetails={cancelProgramDetailsEdit}
        onSaveProgramDetails={saveProgramDetails}
        onEditPlayerDetails={openPlayerDetailsEditor}
        onEditProgramDetails={openProgramDetailsEditor}
        onMessageCoach={openCoachWithSetupContext}
        onReviewUpdate={() => {
          setSetupUpdateError(null);
          setSetupSheetStep('confirm');
        }}
        onConfirmUpdate={executeSetupUpdate}
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
      style={styles.secondaryActionRow}
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

interface SetupUpdateSheetProps {
  visible: boolean;
  step: SetupSheetStep;
  currentPhase: SeasonPhase;
  displayName: string;
  position: RoleBucket | null;
  experienceLevel: ExperienceLevel | null;
  draftName: string;
  draftPosition: RoleBucket | null;
  draftExperience: ExperienceLevel | null;
  draftSeasonPhase: SeasonPhase;
  draftPreferredDays: DayOfWeek[];
  draftTeamDays: DayOfWeek[];
  draftGameDay: DayOfWeek | null;
  preferredDays: DayOfWeek[];
  teamDays: DayOfWeek[];
  gameDay: DayOfWeek | null;
  canUpdate: boolean;
  error: string | null;
  isUpdating: boolean;
  updateMsgIdx: number;
  updateMsgOpacity: Animated.Value;
  onClose: () => void;
  onBack: () => void;
  onOpenStep: (step: SetupSheetStep) => void;
  onSetDraftName: (name: string) => void;
  onSetDraftPosition: (position: RoleBucket) => void;
  onSetDraftExperience: (experience: ExperienceLevel) => void;
  onSetDraftSeasonPhase: (phase: SeasonPhase) => void;
  onCancelPlayerDetails: () => void;
  onSavePlayerDetails: () => void;
  onToggleDraftPreferredDay: (day: DayOfWeek) => void;
  onToggleDraftTeamDay: (day: DayOfWeek) => void;
  onSetDraftGameDay: (day: DayOfWeek) => void;
  onCancelProgramDetails: () => void;
  onSaveProgramDetails: () => void;
  onEditPlayerDetails: () => void;
  onEditProgramDetails: () => void;
  onMessageCoach: () => void;
  onReviewUpdate: () => void;
  onConfirmUpdate: () => void;
}

function SetupUpdateSheet({
  visible,
  step,
  currentPhase,
  displayName,
  position,
  experienceLevel,
  draftName,
  draftPosition,
  draftExperience,
  draftSeasonPhase,
  draftPreferredDays,
  draftTeamDays,
  draftGameDay,
  preferredDays,
  teamDays,
  gameDay,
  canUpdate,
  error,
  isUpdating,
  updateMsgIdx,
  updateMsgOpacity,
  onClose,
  onBack,
  onOpenStep,
  onSetDraftName,
  onSetDraftPosition,
  onSetDraftExperience,
  onSetDraftSeasonPhase,
  onCancelPlayerDetails,
  onSavePlayerDetails,
  onToggleDraftPreferredDay,
  onToggleDraftTeamDay,
  onSetDraftGameDay,
  onCancelProgramDetails,
  onSaveProgramDetails,
  onEditPlayerDetails,
  onEditProgramDetails,
  onMessageCoach,
  onReviewUpdate,
  onConfirmUpdate,
}: SetupUpdateSheetProps) {
  const building = step === 'building' || isUpdating;
  const showBack = !building && step !== 'overview';
  const preferredValid = preferredDays.length >= 1;
  const draftPreferredValid = draftPreferredDays.length >= 1;
  const draftGameDayValid = draftSeasonPhase !== 'In-season' || Boolean(draftGameDay);

  const content = building ? (
    <SetupUpdateBuildingState
      msgIdx={updateMsgIdx}
      msgOpacity={updateMsgOpacity}
    />
  ) : step === 'playerName' ? (
    <>
      <Text style={styles.sheetTitle}>What should I call you?</Text>
      <View style={styles.playerInputCard}>
        <Feather name="user" size={19} color={colors.text.tertiary} />
        <TextInput
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
      <Text style={styles.sheetTitle}>What footy role fits you best?</Text>
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
      <Text style={styles.sheetTitle}>What’s your training experience?</Text>
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
        label="Save player details"
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
  ) : step === 'programPhase' ? (
    <>
      <Text style={styles.sheetTitle}>What phase are you in?</Text>
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
        onPress={() => onOpenStep('programLfaDays')}
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
      <Text style={styles.sheetTitle}>What days can you train?</Text>
      <Text style={styles.sheetSubtitle}>
        We’ll build your LFA work around these days.
      </Text>
      <DayChipGrid
        days={WEEK_DAYS}
        selectedDays={draftPreferredDays}
        onToggleDay={onToggleDraftPreferredDay}
      />
      <Text style={styles.sheetHelperText}>
        Pick at least one day.
      </Text>
      <V2Button
        label="Continue"
        size="lg"
        disabled={!draftPreferredValid}
        onPress={() => onOpenStep('programTeamDays')}
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
      <Text style={styles.sheetTitle}>Team training days</Text>
      <Text style={styles.sheetSubtitle}>
        Which days does your team train? We’ll work your program around these.
      </Text>
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
      <Text style={styles.sheetTitle}>Usual game day</Text>
      <Text style={styles.sheetSubtitle}>
        We’ll keep your week built around match day.
      </Text>
      <DayChipGrid
        days={GAME_DAY_OPTIONS}
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
      <Text style={styles.sheetTitle}>Update your program?</Text>
      <Text style={styles.sheetSubtitle}>
        Your program will rebuild around your updated setup.
      </Text>
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
      <Text style={styles.sheetTitle}>Update program setup</Text>
      <Text style={styles.sheetSubtitle}>
        Change the details your program is built around.
      </Text>

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
          <TouchableOpacity
            style={styles.sheetCardAction}
            activeOpacity={0.72}
            onPress={onEditPlayerDetails}
          >
            <Text style={styles.sheetCardActionText}>Edit player details</Text>
            <Text style={styles.sheetCardChevron}>›</Text>
          </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.sheetCardAction}
            activeOpacity={0.72}
            onPress={onEditProgramDetails}
          >
            <Text style={styles.sheetCardActionText}>Edit program details</Text>
            <Text style={styles.sheetCardChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!preferredValid ? (
        <Text style={styles.sheetError}>Pick at least one LFA work day.</Text>
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
      <TouchableOpacity
        style={styles.sheetCoachFallback}
        activeOpacity={0.72}
        onPress={onMessageCoach}
      >
        <Text style={styles.sheetCoachFallbackText}>
          Need to explain something? Message the coach
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissable={!building}
      contentStyle={styles.setupSheetContent}
      testID="profile-setup-update-sheet"
    >
      {showBack ? (
        <TouchableOpacity
          style={styles.sheetBackButton}
          activeOpacity={0.72}
          onPress={onBack}
          accessibilityLabel="Back to setup update"
        >
          <Text style={styles.sheetBackText}>‹</Text>
        </TouchableOpacity>
      ) : null}

      {building ? (
        content
      ) : (
        <ScrollView
          style={styles.setupSheetScroll}
          contentContainerStyle={[
            styles.setupSheetScrollContent,
            showBack && styles.setupSheetScrollContentWithBack,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      )}
    </Sheet>
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

function SetupUpdateBuildingState({
  msgIdx,
  msgOpacity,
}: {
  msgIdx: number;
  msgOpacity: Animated.Value;
}) {
  return (
    <View style={styles.setupBuildingState}>
      <ActivityIndicator
        color={colors.accent.lime}
        size="large"
        style={styles.setupBuildingSpinner}
      />
      <Text style={styles.setupBuildingTitle}>Updating your program...</Text>
      <Text style={styles.setupBuildingSubtext}>This can take up to 1 minute</Text>
      <Animated.View style={[styles.setupBuildingMsgSlot, { opacity: msgOpacity }]}>
        <Text style={styles.setupBuildingMsg} numberOfLines={1}>
          {PROFILE_SETUP_UPDATE_MESSAGES[msgIdx]}
        </Text>
      </Animated.View>
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
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
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
  setupChangeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: 'rgba(200, 255, 0, 0.03)',
  },
  setupChangeText: {
    color: colors.accent.lime,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  activeCoachState: {
    marginBottom: spacing.md,
  },
  activeLabel: {
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  activeIssue: {
    marginTop: 2,
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
  setupSheetContent: {
    maxHeight: '92%',
  },
  setupSheetScroll: {
    maxHeight: '100%',
  },
  setupSheetScrollContent: {
    paddingBottom: spacing.xs,
  },
  setupSheetScrollContentWithBack: {
    paddingTop: 34,
  },
  sheetBackButton: {
    position: 'absolute',
    top: 18,
    left: spacing.lg,
    zIndex: 2,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackText: {
    color: colors.text.secondary,
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 32,
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
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  sheetCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
    overflow: 'hidden',
  },
  setupSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  setupSheetLabel: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 3,
  },
  setupSheetValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  sheetCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    backgroundColor: 'rgba(200, 255, 0, 0.03)',
  },
  sheetCardActionText: {
    color: colors.accent.lime,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  sheetCardChevron: {
    color: colors.text.tertiary,
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 25,
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
  setupBuildingState: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  setupBuildingSpinner: {
    marginBottom: spacing.md,
  },
  setupBuildingTitle: {
    color: colors.text.primary,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 25,
    textAlign: 'center',
    marginBottom: 6,
  },
  setupBuildingSubtext: {
    color: colors.text.tertiary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  setupBuildingMsg: {
    color: colors.accent.lime,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  setupBuildingMsgSlot: {
    height: 20,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  resetRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  legalRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  resetDivider: {
    height: 1,
    backgroundColor: colors.surface.tertiary,
    marginVertical: 0,
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
