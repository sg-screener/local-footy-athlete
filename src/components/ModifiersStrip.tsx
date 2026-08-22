/**
 * THE ACTIVE-MODIFIERS STRIP — ONE COMPONENT, THREE SURFACES.
 *
 * Her prototype calls it `dayModifierNotification`: an info glyph, a bold count
 * line, a quiet second line, and the WHOLE strip is the tap target. It appears
 * above the day card (ruling 4), at the top of the week view (the seat's note on
 * ruling 7) and under the coach header (ruling 9).
 *
 * **THE SEAT'S OWN WORDS ARE THE SPEC: "same component as the day screen's, not
 * a second one."** Three copies of a four-line row is three places for the count
 * to disagree with the list, and the copy that would drift is the one nobody
 * opens.
 *
 * IT IS A DOORWAY, NOT THE CONTENT, AND THAT IS WHAT MAKES IT SAFE ON THE COACH
 * TAB. `CoachTabScreen` is a conversation that PINS TO BOTTOM on new content, so
 * anything placed inside its scroll is unreachable after three exchanges. One
 * row outside the scroll costs a fixed strip and never scrolls away; the detail
 * lives on the screen it opens. Read out of the prototype, not invented —
 * docs/UI_MERGE_SLICE3_PLAN_2026-08-10.md.
 *
 * NOTHING WHEN THERE IS NOTHING ON PROGRAM. Coach is different by explicit
 * ruling: My Status remains a permanent doorway and states the zero condition.
 * That keeps status reachable without making the day or week pay for an empty
 * notice.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from './common/Text';
import { signedCopy } from '../rules/signedCopy';

export interface ModifiersStripProps {
  /** From `useActiveModifiers`. Never a separately-counted number. */
  readonly count: number;
  readonly onPress: () => void;
  /**
   * Distinguishes the three mounts for the walker and the flows. The component
   * is one; its coordinates must not be, or a flow cannot say WHICH surface it
   * asserted.
   */
  readonly surface: 'day' | 'week' | 'coach';
}

export function ModifiersStrip({ count, onPress, surface }: ModifiersStripProps) {
  // Program only needs a notice when something is active. Coach owns the
  // permanent My Status doorway, including the honest zero state.
  if (count <= 0 && surface !== 'coach') return null;
  const weekSurface = surface === 'week';
  const coachSurface = surface === 'coach';
  const countLabel = signedCopy(
    count === 1 ? 'modifiers.strip.count_one' : 'modifiers.strip.count',
    { count },
  );
  const weekLabel = signedCopy(
    count === 1 ? 'modifiers.strip.week_one' : 'modifiers.strip.week',
    { count },
  );
  const primaryLabel = coachSurface ? signedCopy('coach.status.title') : countLabel;
  const secondaryLabel = coachSurface
    ? (count <= 0 ? signedCopy('modifiers.strip.none') : countLabel)
    : signedCopy('modifiers.strip.subline');
  return (
    <Pressable
      onPress={onPress}
      testID={`modifiers-strip-${surface}`}
      accessibilityRole="button"
      accessibilityLabel={weekSurface
        ? weekLabel
        : `${primaryLabel}. ${secondaryLabel}`}
      style={({ pressed }) => [weekSurface
        ? styles.weekStrip
        : coachSurface
          ? styles.coachStrip
          : styles.strip,
        pressed && { opacity: 0.7 }]}
    >
      {weekSurface ? (
        <>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"
            stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="12" cy="12" r="9" />
            <Path d="M12 16v-5" />
            <Path d="M12 8h.01" />
          </Svg>
          <Text style={styles.weekText} testID={`modifiers-strip-${surface}-count`}>
            {weekLabel}
          </Text>
        </>
      ) : coachSurface ? (
        <>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
            stroke="#C8FF00" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 7h10" />
            <Path d="M18 7h2" />
            <Circle cx="16" cy="7" r="2" />
            <Path d="M4 17h2" />
            <Path d="M10 17h10" />
            <Circle cx="8" cy="17" r="2" />
          </Svg>
          <Text style={styles.coachLabel} testID={`modifiers-strip-${surface}-count`}>
            {primaryLabel}
          </Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
            stroke="#B5B5B5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 18l6-6-6-6" />
          </Svg>
        </>
      ) : (
        <>
          {/* 21pt, not 16 — Sam, 2026-08-22: *"MAYBE INCREASE SIZE OF BOTH ICONS
              BY 30% OR SO - THEY LOOK A BIT SMALL"*, of this glyph and the
              missed-session box's question mark beside it. The CHEVRON below
              stays at 16: it is a direction, not a subject, and growing it
              would make the doorway shout louder than the notice. */}
          <View style={styles.icon}>
            <Svg width={21} height={21} viewBox="0 0 24 24" fill="none"
              stroke="#1EA7FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="12" r="9" />
              <Path d="M12 16v-5" />
              <Path d="M12 8h.01" />
            </Svg>
          </View>
          <View style={styles.text}>
            <Text style={styles.count} testID={`modifiers-strip-${surface}-count`}>
              {primaryLabel}
            </Text>
            <Text style={styles.subline}>{secondaryLabel}</Text>
          </View>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke="#8A8A8A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 18l6-6-6-6" />
          </Svg>
        </>
      )}
    </Pressable>
  );
}

// NO NEW COLOUR TOKEN AND NO NEW FONT SIZE — the merge's governing rule. Every
// value here is already on these screens: the info blue is the "Time" chip's,
// the greys are the day card's, and the sizes are the timeline's.
const styles = StyleSheet.create({
  weekStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 3,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  weekText: {
    color: '#C8FF00', fontSize: 10, fontWeight: '800', lineHeight: 13,
    letterSpacing: 0.25,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#1F1F1F',
  },
  coachStrip: {
    width: 176,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.42)',
    backgroundColor: '#11150D',
  },
  coachLabel: {
    flexGrow: 1,
    flexShrink: 1,
    color: '#F2F2F2',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  icon: { width: 21, alignItems: 'center' },
  text: { flex: 1, gap: 1 },
  count: { color: '#E8EAED', fontSize: 14, fontWeight: '700' },
  subline: { color: '#8A8A8A', fontSize: 12, lineHeight: 16 },
});
