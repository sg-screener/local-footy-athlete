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
 * NOTHING WHEN THERE IS NOTHING. A day with no active modifiers renders no strip
 * and costs no space, which is the property `CoachNotesSection` already had and
 * which slice 4's guard must keep.
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
  if (count <= 0) return null;
  return (
    <Pressable
      onPress={onPress}
      testID={`modifiers-strip-${surface}`}
      accessibilityRole="button"
      accessibilityLabel={`${signedCopy(
        count === 1 ? 'modifiers.strip.count_one' : 'modifiers.strip.count',
        { count },
      )}. ${signedCopy('modifiers.strip.subline')}`}
      style={({ pressed }) => [styles.strip, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.icon}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="#1EA7FF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 16v-5" />
          <Path d="M12 8h.01" />
        </Svg>
      </View>
      <View style={styles.text}>
        <Text style={styles.count} testID={`modifiers-strip-${surface}-count`}>
          {signedCopy(
            count === 1 ? 'modifiers.strip.count_one' : 'modifiers.strip.count',
            { count },
          )}
        </Text>
        <Text style={styles.subline}>{signedCopy('modifiers.strip.subline')}</Text>
      </View>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
        stroke="#8A8A8A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M9 18l6-6-6-6" />
      </Svg>
    </Pressable>
  );
}

// NO NEW COLOUR TOKEN AND NO NEW FONT SIZE — the merge's governing rule. Every
// value here is already on these screens: the info blue is the "Time" chip's,
// the greys are the day card's, and the sizes are the timeline's.
const styles = StyleSheet.create({
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
  icon: { width: 16, alignItems: 'center' },
  text: { flex: 1, gap: 1 },
  count: { color: '#E8EAED', fontSize: 14, fontWeight: '700' },
  subline: { color: '#8A8A8A', fontSize: 12, lineHeight: 16 },
});
