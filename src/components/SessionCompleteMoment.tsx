/**
 * SessionCompleteMoment — polished post-save confirmation.
 *
 * Shown after the athlete fills in the post-session feedback panel and taps
 * "Save & Finish". Replaces the feedback form with a calm, confident
 * "Session logged" state before the screen dismisses.
 *
 * ## Design intent
 * - Subtle, not celebratory. No confetti, no balloons — just a clean mark of
 *   completion that reinforces progress and consistency.
 * - One animated element: the lime check mark scales + fades in (spring).
 *   Headline and support copy fade in together a beat later.
 * - Weekly-consistency line is derived locally from sessionFeedback, so the
 *   moment stays self-contained and doesn't require hook plumbing.
 * - Auto-continues (not shown) via a timer owned by the parent screen —
 *   this file is purely presentational.
 *
 * ## Logic parity
 * No side effects beyond the mount animation. Safe to render multiple times
 * (e.g. if the feedback save is re-attempted); the animation value is
 * re-initialised per mount.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from './common/Text';
import { Card } from './ui';
import { colors } from '../theme/colors';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { useProgramStore } from '../store/programStore';
import { getMondayForDate } from '../utils/sessionResolver';

interface Props {
  /** ISO date string 'YYYY-MM-DD' of the session just completed. */
  date: string;
  /**
   * Optional override headline. Defaults to "Session logged". Pass something
   * tailored (e.g. "Recovery logged") if a session type warrants it.
   */
  headline?: string;
}

/** Count completed sessions in the same ISO week as `date`, inclusive. */
function useWeekSessionCount(date: string): number {
  const sessionFeedback = useProgramStore((s: any) => s.sessionFeedback);
  return useMemo(() => {
    if (!date) return 0;
    const monday = getMondayForDate(date);
    const mondayDate = new Date(
      Number(monday.slice(0, 4)),
      Number(monday.slice(5, 7)) - 1,
      Number(monday.slice(8, 10)),
      12,
    );
    const sunday = new Date(mondayDate);
    sunday.setDate(mondayDate.getDate() + 6);
    let n = 0;
    for (const key of Object.keys(sessionFeedback || {})) {
      const entry = sessionFeedback[key];
      if (!entry) continue;
      // Only count sessions the athlete engaged with — skipped sessions
      // shouldn't feel like consistency points.
      if (entry.completion === 'skipped') continue;
      const [y, m, d] = key.split('-').map(Number);
      if (!y || !m || !d) continue;
      const k = new Date(y, m - 1, d, 12);
      if (k >= mondayDate && k <= sunday) n++;
    }
    return n;
  }, [sessionFeedback, date]);
}

/** Pick a calm consistency message based on the weekly count. */
function pickSupportCopy(weekCount: number): string {
  if (weekCount <= 1) return 'Consistency starts here.';
  if (weekCount === 2) return 'Two this week - momentum building.';
  if (weekCount === 3) return 'Three this week - solid rhythm.';
  if (weekCount === 4) return 'Four this week - big effort.';
  return `${weekCount} this week - keep showing up.`;
}

export const SessionCompleteMoment: React.FC<Props> = ({
  date,
  headline = 'Session logged',
}) => {
  const weekCount = useWeekSessionCount(date);
  const supportCopy = pickSupportCopy(weekCount);

  // ── Animations ──
  // Check icon: scale 0.6 → 1 (spring), opacity 0 → 1. The badge's subtle
  // shadow animates in naturally with its own opacity — no separate halo
  // layer to orchestrate.
  // Text block: opacity 0 → 1, translateY 6 → 0 (a beat later).
  const checkScale = useRef(new Animated.Value(0.6)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    // Mount-only animation — intentionally empty deps.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card
      tone="raised"
      padding="xl"
      radius="xl"
      style={styles.panel}
      testID="session-completion"
    >
      <View style={styles.inner}>
        {/*
         * Icon wrapper carries the only glow — a subtle lime RN shadow
         * applied to the 72×72 anchor itself. No concentric halo layers,
         * no foreground glow on the circle, no bleed into the text area.
         * The shadow animates in naturally with the badge's own opacity.
         */}
        <View style={styles.checkAnchor}>
          <Animated.View
            style={[
              styles.checkBadge,
              {
                transform: [{ scale: checkScale }],
                opacity: checkOpacity,
              },
            ]}
          >
            <Svg width={34} height={34} viewBox="0 0 24 24">
              <Path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#FFFFFF"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.textBlock,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslate }],
            },
          ]}
        >
          <Text style={styles.eyebrow}>COMPLETE</Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.supportCopy}>{supportCopy}</Text>
        </Animated.View>
      </View>
    </Card>
  );
};

const CHECK_SIZE = 72;

const styles = StyleSheet.create({
  panel: {
    marginBottom: spacing.md,
    // Subtle lime glow on the card itself — reinforces the reward moment
    // without being loud.
    ...shadows.accentShadow,
  },
  inner: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  // 72×72 wrapper for the badge. Carries a tight, low-intensity lime shadow
  // that RN renders around its visible content — which is the rounded
  // circle inside. That gives us the "glow behind the icon" without any
  // halo Views, so the glow can never reach the COMPLETE label below.
  // marginBottom tightened from spacing.lg (24) → 18 to pull the label
  // closer and create a single visual unit without losing clear separation.
  checkAnchor: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: colors.accent.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  // Solid circle — slightly deeper than brand lime (#C8FF00) so the success
  // state reads as refined / mature rather than the high-energy brand
  // accent. Still clearly in the lime family; the glow is rendered by the
  // wrapper. Paired with a white check for a more polished premium feel.
  checkBadge: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    backgroundColor: '#A8D500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  supportCopy: {
    color: '#9A9A9A',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    marginTop: 6,
    textAlign: 'center',
  },
});
