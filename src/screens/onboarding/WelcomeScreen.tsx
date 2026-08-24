import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  ImageBackground,
  Dimensions,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import {
  isDevOnboardingSkipEnabled,
  runDevOnboardingSkip,
} from '../../utils/devOnboardingSkip';
import { logger } from '../../utils/logger';

// AFL background image
const welcomeBg = require('../../../assets/footy-bg.jpg');

type WelcomeScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Welcome'
>;

type FeatureCardData = {
  label: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const FEATURES: FeatureCardData[] = [
  {
    label: 'YOUR PLAN',
    title: 'Built for footy',
    description: 'Strength, running, recovery - all in one week.',
    icon: 'dumbbell',
  },
  {
    label: 'YOUR SCHEDULE',
    title: 'Fits your week',
    description: 'Built around team training and game day.',
    icon: 'calendar-month-outline',
  },
  {
    label: 'YOUR BODY',
    title: 'Keeps you available',
    description: 'Smart load so you can train hard and stay on the park.',
    icon: 'shield-check-outline',
  },
];

const FeatureCard: React.FC<{ feature: FeatureCardData }> = ({ feature }) => (
  <View style={styles.featureCard}>
    <View style={styles.featureIconBox}>
      <MaterialCommunityIcons
        name={feature.icon}
        size={21}
        color={colors.accent.lime}
      />
    </View>
    <View style={styles.featureTextBlock}>
      <View style={styles.featureLabelWrap}>
        <Text style={styles.featureLabel}>{feature.label}</Text>
      </View>
      <Text style={styles.featureTitle}>{feature.title}</Text>
      <Text style={styles.featureDescription}>{feature.description}</Text>
    </View>
  </View>
);

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const [isSkippingSetup, setIsSkippingSetup] = useState(false);
  const showDevSkip = isDevOnboardingSkipEnabled();
  // Animations
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(-16)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(FEATURES.map(() => ({
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(24),
  }))).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.sequence([
      // Hero
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(heroTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      // Tagline
      Animated.timing(taglineOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      // Cards staggered
      Animated.stagger(120, cardAnims.map((anim) =>
        Animated.parallel([
          Animated.timing(anim.opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(anim.translateY, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      )),
      // CTA
      Animated.parallel([
        Animated.timing(ctaOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(ctaScale, { toValue: 1, friction: 7, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleGetStarted = () => {
    navigation.navigate('Name');
  };

  // Exposed for unit testing — the live `onPress` handler must invoke this
  // *exact* function so a press equals a call to runDevOnboardingSkip.
  // Top-of-handler log proves the press fired even if state guards or
  // async errors short-circuit later. The smoke wrapper greps for this
  // line in the simulator system log.
  const handleDevSkipSetup = async () => {
    logger.info('[dev-skip] press handler invoked');
    if (isSkippingSetup) {
      logger.warn('[dev-skip] press handler skipped: already in-flight');
      return;
    }
    setIsSkippingSetup(true);
    try {
      await runDevOnboardingSkip();
    } catch (err: any) {
      logger.error('[dev-onboarding-skip] Failed:', err?.message ?? err);
      setIsSkippingSetup(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* AFL background — dark, moody, blurred */}
      <ImageBackground
        source={welcomeBg}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={2}
      >
        <LinearGradient
          colors={[
            'rgba(12,12,12,0.1)',
            'rgba(12,12,12,0.4)',
            'rgba(12,12,12,0.85)',
            '#0C0C0C',
          ]}
          locations={[0, 0.4, 0.7, 0.85]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.root}>
          {/* Hero */}
          <Animated.View
            style={[
              styles.heroSection,
              {
                opacity: heroOpacity,
                transform: [{ translateY: heroTranslateY }],
              },
            ]}
          >
            <Text style={styles.heroTitle}>BUILT FOR</Text>
            <Text style={styles.heroTitle}>FOOTY.</Text>
          </Animated.View>

          <Animated.View style={{ opacity: taglineOpacity }}>
            <Text style={styles.tagline}>
              Training built around your season.
            </Text>
          </Animated.View>

          {/* Feature cards */}
          <View style={styles.featuresSection}>
            {FEATURES.map((feature, index) => (
              <Animated.View
                key={feature.label}
                style={{
                  opacity: cardAnims[index].opacity,
                  transform: [{ translateY: cardAnims[index].translateY }],
                }}
              >
                <FeatureCard feature={feature} />
              </Animated.View>
            ))}
          </View>

          {/*
           * No elastic spacer — CTA sits directly after the cards so the
           * page reads as one intentional column. Prior version used
           * <View style={{ flex: 1 }} /> to push the CTA to the bottom,
           * which looked stranded once the hero + 3 cards already occupy
           * most of the viewport on standard phones.
           */}

          {/* CTA */}
          <Animated.View
            style={[
              styles.ctaContainer,
              {
                opacity: ctaOpacity,
                transform: [{ scale: ctaScale }],
              },
            ]}
          >
            <Pressable
              testID="onboarding-welcome-cta"
              accessibilityRole="button"
              accessibilityLabel="Build My Program"
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
              ]}
              onPress={handleGetStarted}
            >
              <Text style={styles.ctaText}>Build My Program  →</Text>
            </Pressable>
            <Text style={styles.ctaSubtext}>
              Takes about 3 minutes
            </Text>
            {/*
             * TEMP DEV ONLY — Maestro smoke-test entry point.
             *
             * Required contract (verified by WelcomeScreen.dev-skip.test.tsx
             * and used by .maestro/coach-bike-flow.yaml):
             *   - testID === 'onboarding-dev-skip-button'
             *   - accessibilityLabel === 'onboarding-dev-skip-button'
             *     (intentionally identical to testID so Maestro's
             *     accessibility-finder fallback resolves the same node)
             *   - Visible *static* text contains 'Skip onboarding (dev)'
             *     so Maestro can match by `text:` if the testID lookup
             *     ever silently misses.
             *   - onPress is bound DIRECTLY to handleDevSkipSetup, which
             *     calls runDevOnboardingSkip first thing.
             *
             * Do NOT add `disabled` here — a transient `true` disables
             * the press handler and Maestro's tap silently succeeds
             * (returns COMPLETED) while onPress never fires. Style the
             * in-flight state via the `isSkippingSetup` flag in style
             * only; never gate the press itself.
             */}
            {showDevSkip && (
              <Pressable
                testID="onboarding-dev-skip-button"
                accessible
                accessibilityRole="button"
                accessibilityLabel="onboarding-dev-skip-button"
                hitSlop={16}
                style={({ pressed }) => [
                  styles.devSkipButton,
                  pressed && styles.devSkipButtonPressed,
                  isSkippingSetup && styles.devSkipButtonDisabled,
                ]}
                onPress={handleDevSkipSetup}
              >
                <Text style={styles.devSkipText}>
                  {isSkippingSetup
                    ? 'Skipping onboarding…'
                    : 'Skip onboarding (dev)'}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0C',
  },
  backgroundImage: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.6,
  },
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
    paddingHorizontal: 22,
  },

  // Hero
  heroSection: {
    // Was SCREEN_HEIGHT * 0.06 — on tall devices that became a lot of dead
    // space. Tightening to .045 brings the column up slightly while still
    // leaving room for the status bar + image bleed above.
    paddingTop: SCREEN_HEIGHT * 0.045,
    marginBottom: 14,
  },
  heroTitle: {
    color: colors.text.primary,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 48,
  },
  tagline: {
    color: '#A8A8A8',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },

  // Features
  featuresSection: {
    gap: 12,
  },
  featureCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(18,18,18,0.92)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 2,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
  },
  featureTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  featureLabelWrap: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  featureLabel: {
    color: '#C8FF00',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
  },
  featureTitle: {
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDescription: {
    color: '#9C9C9C',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },

  // CTA — sits directly below the card stack with a single rhythmic gap.
  // `marginTop: 'auto'` lets any excess vertical space accumulate above
  // (pushing the CTA down on tall devices) while never letting it stick to
  // the very bottom — there's always the minimum marginTop of spacing.xl
  // between the last card and the button.
  ctaContainer: {
    marginTop: spacing.xl,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#F3F5EC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C8FF00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 2,
  },
  ctaButtonPressed: {
    backgroundColor: '#E1E5D4',
  },
  ctaText: {
    color: '#0C0C0C',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  ctaSubtext: {
    color: '#9A9A9A',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 12,
  },
  devSkipButton: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  devSkipButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  devSkipButtonDisabled: {
    opacity: 0.6,
  },
  devSkipText: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '600',
  },
});
