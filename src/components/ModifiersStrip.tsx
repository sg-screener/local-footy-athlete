/**
 * THE ACTIVE-MODIFIERS STRIP — ONE COMPONENT, FOUR PROGRAM SURFACES.
 *
 * Her prototype calls it `dayModifierNotification`: an info glyph, a bold count
 * line, a quiet second line, and the WHOLE strip is the tap target. It appears
 * above the day card (ruling 4), at the top of the week view (the seat's note on
 * ruling 7), plus a permanent My Status doorway in both Program headers.
 *
 * **THE SEAT'S OWN WORDS ARE THE SPEC: "same component as the day screen's, not
 * a second one."** Multiple copies of a four-line row are multiple places for the count
 * to disagree with the list, and the copy that would drift is the one nobody
 * opens.
 *
 * Header doorways stay present at zero. The smaller Day/Week notices still hide
 * when there is nothing active, so a quiet program does not carry an empty
 * notification beneath the permanent route.
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
   * Distinguishes the mounts for the walker and the flows. The component
   * is one; its coordinates must not be, or a flow cannot say WHICH surface it
   * asserted. The two header surfaces are the permanent Day/Week doorways and
   * stay mounted at zero.
   */
  readonly surface: 'day' | 'week' | 'day-header' | 'week-header';
}

export function ModifiersStrip({ count, onPress, surface }: ModifiersStripProps) {
  // Program's notices appear only when something is active. The DOORWAY
  // surfaces stay mounted at zero, stating the honest zero condition.
  const doorway = surface === 'day-header' || surface === 'week-header';
  if (count <= 0 && !doorway) return null;
  const weekSurface = surface === 'week';
  const headerSurface = doorway;
  const countLabel = signedCopy(
    count === 1 ? 'modifiers.strip.count_one' : 'modifiers.strip.count',
    { count },
  );
  const weekLabel = signedCopy(
    count === 1 ? 'modifiers.strip.week_one' : 'modifiers.strip.week',
    { count },
  );
  const primaryLabel = headerSurface ? signedCopy('coach.status.title') : countLabel;
  const secondaryLabel = headerSurface
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
        : headerSurface
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
      ) : headerSurface ? (
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
    /* NO LIME EDGE ON THE DOORWAY — Sam, 2026-08-27: the header pill was
       carrying a lime border over a green-tinted fill, which read as a glow and
       pulled the eye above the day card. The doorway is a route, not the
       subject of the screen, so it takes the SAME neutral card treatment as
       `strip` above. No new token: both values are already on this screen. */
    borderColor: '#1F1F1F',
    backgroundColor: '#101010',
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
