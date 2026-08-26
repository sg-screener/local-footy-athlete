import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../components/common/Text';
import { StoredStateExportButton } from '../../dev/StoredStateExportButton';
import { Button } from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import {
  buildProgramGenerationRequestDiagnostics,
  generateProgramFromProfile,
  getProgramGenerationProfileFieldDiagnostics,
} from '../../services/api/generateProgram';
import {
  logOnboardingPipelineError,
  seedOnboardingProgram,
  toOnboardingPipelineError,
} from '../../utils/onboardingCompletion';
import { runOnboardingProgramGeneration } from '../../utils/onboardingGenerationOutcome';
import type { TrainingProgram } from '../../types/domain';
import { logger } from '../../utils/logger';
import { todayISOLocal } from '../../utils/appDate';
import {
  assessOnboardingCompleteness,
  onboardingIncompleteMessage,
} from '../../utils/onboardingCompleteness';
import type { OnboardingStepName } from '../../utils/onboardingSteps';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type CompleteScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Complete'
>;

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';
}

/**
 * Loading copy is split into two stages so we never dead-end on a
 * repeating "Finalising…" message:
 *
 *   1. BASE_SEQUENCE runs once, in order, as the introduction.
 *   2. After the base is exhausted the rotation switches to LOOP_TAIL
 *      and wraps forever. The wrap is index-based (modulo) — so we
 *      always advance to the *next* item, never re-show the same line.
 *
 * The long-wait fallback is a one-shot interjection: at
 * LONG_WAIT_THRESHOLD ms still loading, the next tick shows
 * LONG_WAIT_MESSAGE, then drops us into LOOP_TAIL (resetting its
 * index) and the loop continues from there.
 *
 * Because LOOP_TAIL has 4 distinct lines and we only ever advance, the
 * UI can never get "stuck" repeating one message — even if generation
 * takes minutes.
 */
const BASE_SEQUENCE = [
  'Analysing your profile...',
  'Mapping your training week...',
  'Balancing strength and conditioning...',
  'Adjusting for your schedule...',
  'Accounting for injuries...',
  'Optimising recovery and load...',
];

const LOOP_TAIL = [
  'Refining session structure...',
  'Balancing weekly load...',
  'Dialling in recovery...',
  'Finalising your program...',
];

const LONG_WAIT_MESSAGE =
  'Taking a bit longer than usual - fine-tuning your plan...';

const MESSAGE_INTERVAL = 5000; // ~5s per status line (in the 4–6s window)
const FADE_DURATION = 175;      // crossfade between messages
const LONG_WAIT_THRESHOLD = 50000; // inject long-wait line once at ~50s
const MIN_DISPLAY_MS = 20_000;  // deliberate build experience after fast local generation
// How far above its centred resting place the ready group starts, in points.
// Far enough to read as a drop, short enough that the tick never leaves the
// middle third of the screen on the smallest phone we support.
const READY_SLIDE_FROM = -44;
// The footer's own top padding, above the CTA. Named because the ready state's
// centring subtracts it: the athlete's eye measures to the TOP OF THE BUTTON,
// not to the top of the bar the button sits in.
const FOOTER_TOP_PADDING = 12;

export const CompleteScreen: React.FC<CompleteScreenProps> = ({ navigation }) => {
  const [phase, setPhase] = useState<'generating' | 'ready' | 'error'>('generating');
  const [errorMessage, setErrorMessage] = useState('');
  // Set when generation was refused for a missing answer: the error state then
  // offers the step that owns it instead of a pointless retry.
  const [incompleteStep, setIncompleteStep] = useState<OnboardingStepName | null>(null);
  // Whether the error state offers Try Again. A non-retryable failure (an auth
  // or config problem) must not offer a retry that cannot possibly work.
  const [canRetry, setCanRetry] = useState(true);
  // The currently-displayed loading line. Held in state so the fade-in
  // re-renders with the new copy.
  const [currentMessage, setCurrentMessage] = useState(BASE_SEQUENCE[0]);
  // MEASURED, NOT ASSUMED. The ready group is centred in the band the athlete
  // actually sees — screen top to the top of the CTA — and that band's lower
  // edge depends on how tall the footer renders, which is a device question.
  const [footerHeight, setFooterHeight] = useState(0);
  const hasStarted = useRef(false);

  // Sequence + long-wait state lives in refs because the rotation interval
  // closes over its initial render. Refs let us mutate cursor / mode / flag
  // values without re-creating the interval each tick.
  //
  // sequenceMode: which array we're walking ('base' or 'loop').
  // sequenceIndex: position inside the active array.
  // currentMessageRef: mirror of currentMessage state — used by the
  //   tick callback to compare "what's about to show next" against
  //   "what's on screen right now" so we never flash the same line twice
  //   back-to-back.
  const sequenceModeRef = useRef<'base' | 'loop'>('base');
  const sequenceIndexRef = useRef(0);
  const currentMessageRef = useRef(BASE_SEQUENCE[0]);
  const longWaitPendingRef = useRef(false);
  const longWaitShownRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());

  // Animated values
  // loadingOpacity drives the entire generating-state group (spinner +
  // title + status line) as a single unit during the cross-fade out.
  // readyOpacity drives the entire ready-state group (check circle +
  // title + subtext) during the cross-fade in. buttonOpacity is delayed
  // slightly behind readyOpacity so the CTA settles last.
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const readyOpacity = useRef(new Animated.Value(0)).current;
  // The ready group DROPS INTO THE MIDDLE OF THE SCREEN — Sam, 2026-08-27.
  // The three education cards are the generating state's company; once the
  // program exists they leave, and the tick + "your program is ready" is the
  // only thing on the screen, centred. The slide is the manner of that: the
  // group enters from READY_SLIDE_FROM above its centred resting place.
  const readyTranslateY = useRef(new Animated.Value(READY_SLIDE_FROM)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const loadingMsgOpacity = useRef(new Animated.Value(1)).current;
  const card1Opacity = useRef(new Animated.Value(0)).current;
  const card2Opacity = useRef(new Animated.Value(0)).current;
  const card3Opacity = useRef(new Animated.Value(0)).current;
  const card1TranslateY = useRef(new Animated.Value(12)).current;
  const card2TranslateY = useRef(new Animated.Value(12)).current;
  const card3TranslateY = useRef(new Animated.Value(12)).current;

  const insets = useSafeAreaInsets();

  const onboardingData = useProfileStore((state) => state.onboardingData);
  const completeOnboarding = useProfileStore((state) => state.completeOnboarding);
  const setCurrentProgram = useProgramStore((state) => state.setCurrentProgram);
  const setCurrentMicrocycle = useProgramStore((state) => state.setCurrentMicrocycle);
  const setTodayWorkout = useProgramStore((state) => state.setTodayWorkout);

  // ── Staggered card entrance ──
  useEffect(() => {
    const stagger = Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(card1Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card1TranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(card2Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card2TranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(card3Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(card3TranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]);
    // Delay slightly so the header renders first
    const timer = setTimeout(() => stagger.start(), 300);
    return () => clearTimeout(timer);
  }, []);

  // ── Rotating loading messages ──
  //
  // Tick algorithm — picks the next message every MESSAGE_INTERVAL ms,
  // wrapped in a fade-out → swap → fade-in. Decision tree, in priority
  // order:
  //
  //   1. Long-wait pending and not yet shown → show LONG_WAIT_MESSAGE
  //      (one-shot), then preposition the cursor at the start of
  //      LOOP_TAIL so the *next* tick lands on LOOP_TAIL[0].
  //   2. We're in 'base' mode → advance through BASE_SEQUENCE; when
  //      exhausted, transition to 'loop' mode at LOOP_TAIL[0].
  //   3. We're in 'loop' mode → advance index modulo LOOP_TAIL.length.
  //
  // Duplicate guard: after picking a candidate, if it's identical to
  // currentMessageRef, advance once more. With the structure above this
  // can only kick in on a forced transition (e.g. long-wait → loop[0]
  // when we'd just shown loop[0]); never during normal progression.
  useEffect(() => {
    if (phase !== 'generating') return;

    const pickNext = (): string => {
      // (1) Long-wait one-shot interjection
      if (longWaitPendingRef.current && !longWaitShownRef.current) {
        longWaitPendingRef.current = false;
        longWaitShownRef.current = true;
        sequenceModeRef.current = 'loop';
        // -1 so the next tick's `+= 1` lands on index 0 of LOOP_TAIL
        sequenceIndexRef.current = -1;
        return LONG_WAIT_MESSAGE;
      }

      // (2) Base sequence — runs once
      if (sequenceModeRef.current === 'base') {
        sequenceIndexRef.current += 1;
        if (sequenceIndexRef.current < BASE_SEQUENCE.length) {
          return BASE_SEQUENCE[sequenceIndexRef.current];
        }
        // Base exhausted → switch to loop tail at index 0
        sequenceModeRef.current = 'loop';
        sequenceIndexRef.current = 0;
        return LOOP_TAIL[0];
      }

      // (3) Loop tail — wraps with modulo, always moves forward
      sequenceIndexRef.current =
        (sequenceIndexRef.current + 1) % LOOP_TAIL.length;
      let candidate = LOOP_TAIL[sequenceIndexRef.current];
      // Defensive duplicate guard: if a forced transition (e.g. just
      // showed long-wait → loop[0] but loop[0] was *also* the message
      // before long-wait) would duplicate, skip ahead one slot.
      if (candidate === currentMessageRef.current) {
        sequenceIndexRef.current =
          (sequenceIndexRef.current + 1) % LOOP_TAIL.length;
        candidate = LOOP_TAIL[sequenceIndexRef.current];
      }
      return candidate;
    };

    const interval = setInterval(() => {
      Animated.timing(loadingMsgOpacity, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(() => {
        const next = pickNext();
        currentMessageRef.current = next;
        setCurrentMessage(next);
        Animated.timing(loadingMsgOpacity, {
          toValue: 1,
          duration: FADE_DURATION,
          useNativeDriver: true,
        }).start();
      });
    }, MESSAGE_INTERVAL);

    return () => clearInterval(interval);
  }, [phase]);

  // ── Long-wait fallback ──
  // After LONG_WAIT_THRESHOLD ms still loading, mark the long-wait line
  // as pending. The rotation effect above picks it up at the next tick,
  // shows it once, and drops the rotation into LOOP_TAIL afterwards.
  useEffect(() => {
    if (phase !== 'generating') return;

    const longWaitTimer = setTimeout(() => {
      if (!longWaitShownRef.current) {
        longWaitPendingRef.current = true;
      }
    }, LONG_WAIT_THRESHOLD);

    return () => clearTimeout(longWaitTimer);
  }, [phase]);

  // ── Generate program on mount ──
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    generateProgram();
  }, []);

  const generateProgram = async () => {
    setPhase('generating');
    setErrorMessage('');
    setCanRetry(true);

    // Refuse before generating. Reaching this screen with a gap means Review
    // was bypassed (a deep link, a back-stack jump) — generating around it
    // would hand the athlete a program built on answers they never gave.
    const completeness = assessOnboardingCompleteness(onboardingData);
    if (!completeness.complete && completeness.firstIncompleteStep) {
      logger.warn('[Onboarding][generation] refused: profile incomplete', {
        missingSteps: completeness.missingSteps.map((step) => step.name),
      });
      setIncompleteStep(completeness.firstIncompleteStep);
      setErrorMessage(onboardingIncompleteMessage(completeness));
      setPhase('error');
      return;
    }

    // One Effective Onboarding Date: one generation attempt owns one date.
    // A retry starts a new attempt and may therefore capture a new date.
    const effectiveTodayISO = todayISOLocal();

    // Generation owns the outcome AND its reason. The screen renders that
    // outcome; it never elects a different program. The silent DEFAULT_PROGRAM
    // substitution that used to live here is retired (Sam ruling, 2026-07-25):
    // it discarded an honest typed refusal, installed a fixture that carries no
    // exposure contract, and reported the resulting install throw to the
    // athlete as a save failure — the wrong reason for the wrong event.
    // See docs/ONBOARDING_GENERATION_OWNERSHIP_REASSESSMENT_2026-07-25.md.
    const outcome = await runOnboardingProgramGeneration({
      generate: () => generateProgramFromProfile(onboardingData, {
        // Onboarding authors the athlete's first block. Recording the selected
        // identities here preserves the healthy base beneath later temporary
        // injury/equipment facts, so clearing a fact restores rather than
        // turning the temporary substitute into the block's history.
        recordSelections: 'author',
        // DECLARED strict, deliberately. A FIRST week that cannot meet its own
        // contract is a generation defect, not a consequence of anything the
        // athlete has done to their calendar yet — and the onboarding
        // generation ruling (Sam, 2026-07-25) says this must fail HONESTLY
        // rather than install something reduced. `runOnboardingProgramGeneration`
        // owns the reporting. Stated so the reliance is visible.
        // See docs/ONBOARDING_GENERATION_OWNERSHIP_REASSESSMENT_2026-07-25.md.
        weekAcceptance: 'restoration',
        todayISO: effectiveTodayISO,
      }),
      onAttemptFailed: (failure, attempt) => {
        logger.error('[Onboarding][generation] Program generation failed', {
          stage: 'generation',
          attempt,
          kind: failure.failureKind,
          isTransient: failure.isTransient,
          diagnostic: failure.diagnostic,
        });
        if (isDevBuild()) {
          logger.warn('[ProgramGen][dev] Generation attempt failed', {
            attempt,
            kind: failure.failureKind,
            diagnostic: failure.diagnostic,
            request: buildProgramGenerationRequestDiagnostics(
              onboardingData,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              effectiveTodayISO,
            ),
            missingProfileFields: getProgramGenerationProfileFieldDiagnostics(onboardingData),
          });
        }
      },
    });

    if (outcome.kind === 'failed') {
      setCanRetry(outcome.canRetry);
      setErrorMessage(outcome.userMessage);
      setPhase('error');
      return;
    }

    const program: TrainingProgram = outcome.program;

    try {
      seedProgram(program, effectiveTodayISO);
    } catch (error) {
      const pipelineError = toOnboardingPipelineError(
        error,
        'accepted_state_transaction',
        'store_generated_program',
      );
      logOnboardingPipelineError('Program installation failed', pipelineError);
      // A genuine install failure — and now the ONLY thing this copy can mean.
      setCanRetry(true);
      setErrorMessage('Your program was created, but it could not be saved. Please try again.');
      setPhase('error');
      return;
    }

    transitionToReady();
  };

  // Cross-fade from the generating group to the ready group. We:
  //   1. Wait out any remaining MIN_DISPLAY_MS budget so the loading
  //      screen never flashes past on a fast generation.
  //   2. Fade the loading group (spinner + title + status line) to 0.
  //   3. Swap phase so the ready group mounts (still at opacity 0).
  //   4. Fade the ready group + button in.
  // No layout jump because both groups share the same headerSection slot.
  const transitionToReady = () => {
    const elapsed = Date.now() - startedAtRef.current;
    const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
      Animated.timing(loadingOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => {
        setPhase('ready');
        Animated.parallel([
          Animated.timing(readyOpacity, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(readyTranslateY, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 400,
            delay: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, wait);
  };

  const seedProgram = (
    program: TrainingProgram,
    effectiveTodayISO: string,
  ) => {
    seedOnboardingProgram({
      onboardingData,
      program,
      todayISO: effectiveTodayISO,
      programStore: {
        setCurrentProgram,
        setCurrentMicrocycle,
        setTodayWorkout,
      },
    });
  };

  const handleStartTraining = () => {
    try {
      // Completion is an outcome with a reason now (Sam's ruling #3): it refuses
      // rather than closing over a profile the app cannot build on. The screen
      // routes that refusal to the step that owns the answer, exactly as the
      // pre-generation completeness check above already does.
      const outcome = completeOnboarding();
      if (outcome.ok === false) {
        const assessment = assessOnboardingCompleteness(onboardingData);
        if (assessment.firstIncompleteStep) setIncompleteStep(assessment.firstIncompleteStep);
        setErrorMessage(outcome.message);
        setPhase('error');
        return;
      }
    } catch (error) {
      const pipelineError = toOnboardingPipelineError(
        error,
        'onboarding_navigation',
        'complete_onboarding',
      );
      logOnboardingPipelineError('Onboarding completion/navigation failed', pipelineError);
      setErrorMessage('Your program is saved, but onboarding could not finish. Please try again.');
      setPhase('error');
    }
  };

  const handleRetry = () => {
    if (incompleteStep) {
      navigation.navigate(incompleteStep as never);
      return;
    }
    hasStarted.current = false;
    loadingOpacity.setValue(1);
    readyOpacity.setValue(0);
    readyTranslateY.setValue(READY_SLIDE_FROM);
    buttonOpacity.setValue(0);
    loadingMsgOpacity.setValue(1);
    sequenceModeRef.current = 'base';
    sequenceIndexRef.current = 0;
    currentMessageRef.current = BASE_SEQUENCE[0];
    longWaitPendingRef.current = false;
    longWaitShownRef.current = false;
    startedAtRef.current = Date.now();
    setCurrentMessage(BASE_SEQUENCE[0]);
    generateProgram();
  };

  /* ── Error state ── */
  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <Text
            variant="h3"
            color={colors.status.error}
            align="center"
            style={{ marginBottom: spacing.md, fontWeight: '700' }}
          >
            {incompleteStep ? 'One more answer needed' : 'Something went wrong'}
          </Text>
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            align="center"
            style={{ lineHeight: 20, paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}
          >
            {errorMessage || 'Failed to generate your program. Tap below to try again.'}
          </Text>
          {(incompleteStep || canRetry) && (
            <Button
              title={incompleteStep ? 'Finish that step' : 'Try Again'}
              onPress={handleRetry}
              size="lg"
              fullWidth
            />
          )}
          {/*
           * The evidence lives on the far side of this refusal (Sam, locked
           * out 2026-07-30). "Finish that step" is the athlete's way forward;
           * this is the diagnostician's, and it must not require the flow that
           * is currently refusing. See dev/StoredStateExportButton.
           */}
          <StoredStateExportButton testID="onboarding-refusal-export-button" />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Generating / Ready state ── */
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            /* READY OWNS THE WHOLE SCREEN. With the cards gone there is
               nothing to scroll, so the content grows to fill and centres
               its one group instead of sitting under a top padding.
               THE BAND IS SCREEN-TOP TO BUTTON-TOP — Sam, 2026-08-27: "equal
               padding between top of screen and top of 'start your program'".
               Centring inside the scroll view alone lands too low, because the
               scroll view starts BELOW the notch inset and runs UNDER the
               absolutely-positioned footer. The bottom padding pays back both:
               the inset the content never had, and the footer above its CTA. */
            phase === 'ready' && styles.scrollContentReady,
            phase === 'ready' && {
              paddingBottom: insets.top + Math.max(0, footerHeight - FOOTER_TOP_PADDING),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Spinner / Ready indicator */}
          {/* Two phase-specific Animated.Views share the same headerSection
              slot. The loading group fades out, then the ready group fades
              in — no layout jump, no abrupt content swap. */}
          <View style={[
            styles.headerSection,
            phase === 'ready' && styles.headerSectionReady,
          ]}>
            {phase === 'generating' && (
              <Animated.View style={[styles.phaseGroup, { opacity: loadingOpacity }]}>
                {/* Spinner kept but de-emphasised — the rotating status
                    line is the primary feedback signal. */}
                <ActivityIndicator
                  size="large"
                  color={colors.accent.lime}
                  style={[styles.spinner, styles.spinnerMuted]}
                />
                <Text
                  variant="h1"
                  color={colors.text.primary}
                  align="center"
                  style={styles.headerTitle}
                >
                  Building your program…
                </Text>
                <Animated.View style={{ opacity: loadingMsgOpacity }}>
                  <Text
                    variant="bodySmall"
                    color={colors.text.secondary}
                    align="center"
                    style={styles.headerSubtext}
                  >
                    {currentMessage}
                  </Text>
                </Animated.View>
              </Animated.View>
            )}

            {phase === 'ready' && (
              <Animated.View
                style={[
                  styles.phaseGroup,
                  { opacity: readyOpacity, transform: [{ translateY: readyTranslateY }] },
                ]}
              >
                <View style={styles.readyCircle}>
                  <Feather name="check" size={28} color={colors.text.inverse} />
                </View>
                <Text
                  variant="h1"
                  color={colors.text.primary}
                  align="center"
                  style={styles.headerTitle}
                >
                  Your program is ready
                </Text>
                <Text
                  variant="bodySmall"
                  color={colors.text.secondary}
                  align="center"
                  style={styles.headerSubtext}
                >
                  Time to get to work
                </Text>
              </Animated.View>
            )}
          </View>

          {/* Education cards — staggered entrance, and they belong to the
              WAIT. They read while the program is being built; the moment it
              exists they fade out on the same `loadingOpacity` as the spinner
              and unmount, leaving the ready group alone on the screen. */}
          {phase === 'generating' && (
          <Animated.View style={[styles.cardsSection, { opacity: loadingOpacity }]}>
            <Animated.View style={{ opacity: card1Opacity, transform: [{ translateY: card1TranslateY }] }}>
              <EducationCard
                icon="zap"
                title="How this works"
                body="Built around your goals, schedule, available days, and injury history."
              />
            </Animated.View>
            <Animated.View style={{ opacity: card2Opacity, transform: [{ translateY: card2TranslateY }] }}>
              <EducationCard
                icon="refresh-cw"
                title="It adapts with you"
                body="Miss a session? Busy week? Feeling sore? Your program can adjust with you."
              />
            </Animated.View>
            <Animated.View style={{ opacity: card3Opacity, transform: [{ translateY: card3TranslateY }] }}>
              <EducationCard
                icon="target"
                title="Built for local footy"
                body="Designed for performance, durability, and game day readiness."
              />
            </Animated.View>
          </Animated.View>
          )}
        </ScrollView>

        {/* Fixed bottom — loading hint or CTA */}
        <View
          style={styles.footer}
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        >
          {phase === 'generating' && (
            <Text variant="bodySmall" color={colors.text.tertiary} align="center" style={styles.footerHint}>
              This takes about 20 seconds
            </Text>
          )}
          <Animated.View style={{ opacity: buttonOpacity }}>
            {phase === 'ready' && (
              <Pressable style={styles.ctaButton} onPress={handleStartTraining}>
                <Text style={styles.ctaText}>Start your program →</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};

/* ── Education Card ── */
interface EducationCardProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
}

const EducationCard: React.FC<EducationCardProps> = ({ icon, title, body }) => (
  <View style={styles.educationCard}>
    <View style={styles.educationRow}>
      <View style={styles.iconColumn}>
        <View style={styles.iconContainer}>
          <Feather name={icon} size={15} color={colors.accent.lime} />
        </View>
      </View>
      <View style={styles.educationText}>
        <Text style={styles.educationTitle}>{title}</Text>
        <Text style={styles.educationBody}>{body}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  root: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 120,
  },
  // The ready screen holds ONE group and nothing else, so it fills the scroll
  // area and centres it. The paddings are symmetrical on purpose: an uneven
  // pair would put the tick off-centre by half the difference.
  scrollContentReady: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 0,
    // paddingBottom is supplied at render time — it depends on the device's
    // top inset and the measured footer.
  },

  // ── Header ──
  headerSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  // The 36pt gap exists to separate the header from the cards. With the cards
  // gone it would lift the group off centre, so it goes with them.
  headerSectionReady: {
    marginBottom: 0,
  },
  // Wrapper for each phase's children. Inherits the centred layout from
  // headerSection so swapping groups in/out via opacity stays in place.
  phaseGroup: {
    alignItems: 'center',
    width: '100%',
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  // Spinner stays as a backdrop signal — opacity drop hands the visual
  // hierarchy over to the rotating status line.
  spinnerMuted: {
    opacity: 0.55,
  },
  readyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.lime,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...headingXL,
    marginBottom: 8,
  },
  headerSubtext: {
    lineHeight: 20,
    minHeight: 20,
  },

  // ── Education cards ──
  cardsSection: {
    gap: 12,
  },
  educationCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 12,
    paddingLeft: 0,
    paddingRight: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
  },
  educationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  educationText: {
    flex: 1,
  },
  iconColumn: {
    width: 54,
    alignItems: 'center',
    flexShrink: 0,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(200, 255, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  educationTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  educationBody: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: FOOTER_TOP_PADDING,
    paddingBottom: 34,
    backgroundColor: colors.surface.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerHint: {
    marginBottom: 4,
    opacity: 0.6,
  },
  ctaButton: {
    backgroundColor: colors.accent.lime,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: colors.text.inverse,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
