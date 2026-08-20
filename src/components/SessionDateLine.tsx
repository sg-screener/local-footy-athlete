/**
 * ── THE DATE LINE — ONE COMPONENT, ONE OPTICAL CENTRE ──────────────────────
 *
 * Sam, 2026-08-20 (R-116, fourth pass): *"`alignItems: 'center'` alone has not
 * aligned the visible glyph — the calendar icon's internal bounds make it sit
 * low relative to the date … inspect and normalise the calendar glyph's visible
 * path/view-box inside its box; do not compensate with an unexplained
 * screen-specific margin. Also verify the same shared date component wherever
 * this header appears."*
 *
 * ## WHY CENTRING THE WRAPPER WAS NEVER GOING TO WORK
 *
 * `alignItems: 'center'` centres each child's LAYOUT BOX. It says nothing about
 * where the INK sits inside that box, and for an icon font the two are not the
 * same: the glyph is drawn on a baseline with descender space beneath it, so a
 * calendar in a 15pt box has its visible mass ABOVE the box's centre and reads
 * low against text whose own box is padded differently. Two centred boxes, two
 * different optical centres.
 *
 * ## THE THREE THINGS THAT FIX IT, AND THEY ARE ALL STRUCTURAL
 *
 * 1. **The glyph is drawn, not typed.** `CalendarGlyph` is an SVG whose visible
 *    path is deliberately symmetric about its viewBox centre — extent y 4..20
 *    in a 24-high box, centre exactly 12. There is no font metric left to be
 *    wrong about.
 * 2. **The icon box and the text share one height.** `DATE_LINE_HEIGHT` is the
 *    text's explicit `lineHeight` AND the icon box's `height`. Two boxes of
 *    equal height, centred in one row, have the same centre-Y — arithmetic, not
 *    taste.
 * 3. **Neither carries a margin.** Any `marginTop` on either would move one
 *    centre and not the other; that is precisely the bug this replaces, where
 *    the date Text's own `marginTop: 3` pushed it down inside the row.
 *
 * ⚠ **AND IT IS A COMPONENT SO IT CANNOT BE FIXED IN ONE PLACE ONLY.** The
 * header exists on the Session screen today. Extracting it is what makes "the
 * same shared date component wherever this header appears" true by construction
 * rather than by a promise — the icon lesson from earlier in this same ruling.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** The one height both the text and the icon box use. */
export const DATE_LINE_HEIGHT = 20;
/** The icon box. Fixed, so the text can never resize it. */
export const DATE_ICON_BOX = 16;

/**
 * A calendar whose VISIBLE INK is symmetric about the viewBox centre.
 *
 * viewBox 0 0 24 24, centre y = 12. The drawn extent is y 4 (tab tops) to y 20
 * (body bottom), whose midpoint is 12 — so centring this box centres what the
 * athlete can actually see, which an icon font does not promise.
 */
export function CalendarGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 4v3" />
      <Path d="M16 4v3" />
      <Path d="M4 7h16v13H4z" />
      <Path d="M4 11h16" />
    </Svg>
  );
}

export function SessionDateLine({ label, color, testID }: {
  label: string;
  color: string;
  testID?: string;
}) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={label}
      testID={testID ?? 'session-header-date-row'}
    >
      <View style={styles.iconBox} testID="session-header-calendar-icon">
        <CalendarGlyph size={14} color={color} />
      </View>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // Height === the text's lineHeight. This equality IS the alignment.
  iconBox: {
    width: DATE_ICON_BOX,
    height: DATE_LINE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No margin of any kind: one would move this centre and not the icon's.
  text: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: DATE_LINE_HEIGHT,
  },
});
