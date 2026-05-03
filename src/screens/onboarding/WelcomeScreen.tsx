import React, { useEffect, useRef } from 'react';
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
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';

// AFL background image
const welcomeBg = require('../../../assets/footy-bg.jpg');

type WelcomeScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Welcome'
>;

const FEATURES = [
  {
    label: 'YOUR PLAN',
    title: 'Built for footy',
    description: 'Strength, running, recovery — all in one week.',
  },
  {
    label: 'YOUR SCHEDULE',
    title: 'Fits your week',
    description: 'Built around team training and game day.',
  },
  {
    label: 'YOUR BODY',
    title: 'Keeps you available',
    description: 'Smart load so you can train hard and stay on the park.',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
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
                key={index}
                style={{
                  opacity: cardAnims[index].opacity,
                  transform: [{ translateY: cardAnims[index].translateY }],
                }}
              >
                <View style={styles.featureCard}>
                  <View style={styles.featureLabelWrap}>
                    <Text style={styles.featureLabel}>{feature.label}</Text>
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>
                    {feature.description}
                  </Text>
                </View>
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
    letterSpacing: 1.5,
    lineHeight: 48,
  },
  tagline: {
    color: '#999999',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },

  // Features — vertical cards, no icons, label-based
  featuresSection: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: 'rgba(20,20,20,0.9)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    // Slightly more visible than before (0.05 → 0.07) so the cards feel
    // intentional against the dark image bleed above them.
    borderColor: 'rgba(255,255,255,0.07)',
  },
  featureLabelWrap: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  featureLabel: {
    color: '#C8FF00',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  featureTitle: {
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDescription: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 18,
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
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonPressed: {
    backgroundColor: '#D8D8D8',
  },
  ctaText: {
    color: '#0C0C0C',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ctaSubtext: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 12,
  },
});
