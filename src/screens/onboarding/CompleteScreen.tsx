import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useProgramStore } from '../../store/programStore';
import { DEFAULT_PROGRAM } from '../../data/defaultProgram';
import { generateProgramFromProfile } from '../../services/api/generateProgram';
import { useCalendarStore } from '../../store/calendarStore';
import { computeGameDatesForBlock } from '../../utils/sessionResolver';
import { logger } from '../../utils/logger';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type CompleteScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Complete'
>;

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
  'Taking a bit longer than usual — fine-tuning your plan...';

const MESSAGE_INTERVAL = 5000; // ~5s per status line (in the 4–6s window)
const FADE_DURATION = 175;      // crossfade between messages
const LONG_WAIT_THRESHOLD = 50000; // inject long-wait line once at ~50s
const MIN_DISPLAY_MS = 2000;    // floor so loading never flickers past

export const CompleteScreen: React.FC<CompleteScreenProps> = () => {
  const [phase, setPhase] = useState<'generating' | 'ready' | 'error'>('generating');
  const [errorMessage, setErrorMessage] = useState('');
  // The currently-displayed loading line. Held in state so the fade-in
  // re-renders with the new copy.
  const [currentMessage, setCurrentMessage] = useState(BASE_SEQUENCE[0]);
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
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const loadingMsgOpacity = useRef(new Animated.Value(1)).current;
  const card1Opacity = useRef(new Animated.Value(0)).current;
  const card2Opacity = useRef(new Animated.Value(0)).current;
  const card3Opacity = useRef(new Animated.Value(0)).current;
  const card1TranslateY = useRef(new Animated.Value(12)).current;
  const card2TranslateY = useRef(new Animated.Value(12)).current;
  const card3TranslateY = useRef(new Animated.Value(12)).current;

  const onboardingData = useProfileStore((state) => state.onboardingData);
  const completeOnboarding = useProfileStore((state) => state.completeOnboarding);
  const setCurrentProgram = useProgramStore((state) => state.setCurrentProgram);
  const setCurrentMicrocycle = useProgramStore((state) => state.setCurrentMicrocycle);
  const setTodayWorkout = useProgramStore((state) => state.setTodayWorkout);
  const setGameDay = useCalendarStore((state) => state.setGameDay);

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

    try {
      const program = await generateProgramFromProfile(onboardingData);
      seedProgram(program);
      transitionToReady();
    } catch (err: any) {
      logger.error('[ProgramGen] FAILED:', err?.message || err);

      // Overload errors: show error state with retry — don't silently fallback
      if (err?.name === 'OverloadError') {
        setErrorMessage(err.message);
        setPhase('error');
        return;
      }

      // Other errors: fallback to default program so onboarding isn't blocked
      seedProgram(DEFAULT_PROGRAM);
      transitionToReady();
    }
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

  const seedProgram = (program: typeof DEFAULT_PROGRAM) => {
    setCurrentProgram(program);
    if (program.microcycles && program.microcycles.length > 0) {
      const firstMicrocycle = program.microcycles[0];
      setCurrentMicrocycle(firstMicrocycle);

      const today = new Date();
      const dayOfWeek = today.getDay();
      const todayWorkout = firstMicrocycle.workouts?.find(
        (w) => w.dayOfWeek === dayOfWeek,
      );
      if (todayWorkout) {
        setTodayWorkout(todayWorkout);
      }
    }

    // ── Seed calendar with game dates for the active block ──
    // The resolver derives game proximity (G+1 recovery, G-1 reduction, etc.)
    // from calendarStore marks, so we MUST seed actual game dates here.
    const selectedGameDay = onboardingData?.gameDay;
    if (selectedGameDay && selectedGameDay !== 'Varies' && program.startDate && program.endDate) {
      const gameDates = computeGameDatesForBlock(
        selectedGameDay,
        program.startDate,
        program.endDate,
      );
      logger.debug(`[Onboarding] Seeding ${gameDates.length} game dates for ${selectedGameDay}:`, gameDates);
      gameDates.forEach((date) => setGameDay(date));
    }
  };

  const handleStartTraining = () => {
    completeOnboarding();
  };

  const handleRetry = () => {
    hasStarted.current = false;
    loadingOpacity.setValue(1);
    readyOpacity.setValue(0);
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
            Something went wrong
          </Text>
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            align="center"
            style={{ lineHeight: 20, paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}
          >
            {errorMessage || 'Failed to generate your program. Tap below to try again.'}
          </Text>
          <Button title="Try Again" onPress={handleRetry} size="lg" fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Generating / Ready state ── */
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Spinner / Ready indicator */}
          {/* Two phase-specific Animated.Views share the same headerSection
              slot. The loading group fades out, then the ready group fades
              in — no layout jump, no abrupt content swap. */}
          <View style={styles.headerSection}>
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
              <Animated.View style={[styles.phaseGroup, { opacity: readyOpacity }]}>
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

          {/* Education cards — staggered entrance */}
          <View style={styles.cardsSection}>
            <Animated.View style={{ opacity: card1Opacity, transform: [{ translateY: card1TranslateY }] }}>
              <EducationCard
                icon="zap"
                title="How this works"
                body="Your program is built for right now — based on your goals, schedule, and injuries"
              />
            </Animated.View>
            <Animated.View style={{ opacity: card2Opacity, transform: [{ translateY: card2TranslateY }] }}>
              <EducationCard
                icon="refresh-cw"
                title="It adapts with you"
                body="Miss a session? Busy week? Something hurts? Just message your AI coach and it will adjust your program instantly"
              />
            </Animated.View>
            <Animated.View style={{ opacity: card3Opacity, transform: [{ translateY: card3TranslateY }] }}>
              <EducationCard
                icon="target"
                title="Built for footy players"
                body="Designed for performance, durability, and game day readiness"
              />
            </Animated.View>
          </View>
        </ScrollView>

        {/* Fixed bottom — loading hint or CTA */}
        <View style={styles.footer}>
          {phase === 'generating' && (
            <Text variant="bodySmall" color={colors.text.tertiary} align="center" style={styles.footerHint}>
              Usually takes 30–60 seconds
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
    <View style={styles.educationHeader}>
      <View style={styles.iconContainer}>
        <Feather name={icon} size={15} color={colors.accent.lime} />
      </View>
      <Text style={styles.educationTitle}>{title}</Text>
    </View>
    <Text style={styles.educationBody}>{body}</Text>
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

  // ── Header ──
  headerSection: {
    alignItems: 'center',
    marginBottom: 36,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
  },
  educationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
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
  },
  educationBody: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    paddingLeft: 38, // align with title text (28 icon + 10 gap)
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
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
