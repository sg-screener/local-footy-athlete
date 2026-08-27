/**
 * ── THE ONE SECTION-ICON OWNER — SAM, 2026-08-20 (R-116) ───────────────────
 *
 * *"Do not invent new section icons. Reuse the exact established Day-screen icon
 * and colour mapping through one shared owner. The Session screen must match the
 * Day screen for every section kind … Unknown section kinds must fail a guard
 * rather than silently render without an icon."*
 *
 * ## WHY THIS FILE EXISTS
 *
 * The first cut of R-116 gave the Session screen its OWN table — three
 * MaterialCommunityIcons names picked to look right — while the Day screen kept
 * `PART_ICON_KIND` and `RowIcon`. Two tables, one question. They disagreed
 * immediately and visibly: **Mobility drew a different glyph on each screen, and
 * Team Training drew none at all on the Session screen.** That is the second-
 * representation defect this repo keeps paying for, caught on glass by Sam.
 *
 * So the Day screen's icons, colours and glyph paths move here UNCHANGED — every
 * `Path`, every hex value, copied verbatim — and BOTH screens import them.
 * `HomeScreenV2` now renders exactly what it always did, from this file.
 *
 * ## THE TWO VOCABULARIES, AND WHY THERE ARE STILL TWO
 *
 * The Day card enumerates the day's PARTS (`VisiblePartKind`); the Session
 * screen enumerates its execution SECTIONS (`SessionExecutionSectionId`). They
 * are different questions — a session has an `optional` cluster and an `other`
 * bucket that no part kind names — so this file maps BOTH onto one `RowIconKind`
 * rather than pretending one type can answer the other.
 *
 * ⚠ **BOTH MAPS ARE TOTAL `Record`s, WHICH IS THE GUARD SAM ASKED FOR.** Adding
 * a member to either union stops this file compiling until somebody chooses its
 * icon. A `Partial` here would let a new section render iconless and silent,
 * which is precisely how Team Training lost its glyph.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LfaIcon } from './LfaIcon';
import { PART_ICON_KIND, SESSION_SECTION_ICON_KIND } from '../../rules/sectionIconKinds';

export { PART_ICON_KIND, SESSION_SECTION_ICON_KIND };

export type { RowIconKind } from '../../rules/sectionIconKinds';
import type { RowIconKind } from '../../rules/sectionIconKinds';

export function rowIconColor(kind: RowIconKind): string {
  switch (kind) {
    /* ⚠ **THE ONLY COLOUR LEFT, AND IT IS NOT A SECTION THE ATHLETE TRAINS
     * THROUGH.** A game is a FIXTURE. Everything below is work, and work is
     * grey. */
    case 'game':
      return '#FFC247';
    /* ── EVERY WORK GLYPH IS GREY — Sam, 2026-08-20: *"icon for conditioning
     * should not be amber - keep same grey as the other logos"*. Conditioning
     * (`flame`) moved then, from `#D9874E`.
     *
     * `recovery` (`#3AA7D8`, blue) and `bolt` (`#B6D85A`, lime) DID NOT MOVE
     * WITH IT, and nothing had noticed until the Primer put a lime bolt on the
     * day card beside five grey glyphs. Sam, 2026-08-23: *"the icon is lime
     * green = should be grey to match everything else - mobility and recovery
     * may need to be changed to match as well"*. **His 2026-08-20 ruling already
     * covered them; they were simply left behind by it.**
     *
     * `mobility` was ALREADY grey and is unchanged — checked, not assumed.
     *
     * ⚠ **THE BLUE BADGE IS A DIFFERENT THING AND IS UNTOUCHED.** The `RECOVERY`
     * pill on the day card, and the blue battery on the Tired status control,
     * are not section glyphs and do not read from this table — Sam kept that
     * badge deliberately (see `sessionBuilder` SESSION_META.mobility). This
     * changes the SECTION ICON only. */
    case 'recovery':
    case 'bolt':
    case 'flame':
    case 'strength':
    case 'team':
    case 'pulse':
    case 'refresh':
    case 'mobility':
    case 'prehab':
    case 'core':
    case 'activity':
    default:
      return '#969696';
  }
}
export function RowIcon({ kind, size = 15, color }: { kind: RowIconKind; size?: number; color?: string }) {
  const iconColor = color ?? rowIconColor(kind);

  if (kind === 'mobility') {
    return <LfaIcon name="mobility" color={iconColor} size={size} />;
  }

  if (kind === 'prehab') {
    return <LfaIcon name="medical-shield" color={iconColor} size={size} />;
  }

  if (kind === 'team') {
    return (
      /* ⚠ **THIS BRANCH USED TO IGNORE `size` AND DRAW 16, ALWAYS.** Every
         other kind honours the prop, so a caller asking for a bigger row got a
         bigger everything EXCEPT team training — silently, with no error to
         read. Found while sizing the day card's glyphs up on 2026-08-27. The
         other two callers ask for 17 and 18, so this is a 1–2pt change there
         and they now say what they draw. */
      <MaterialCommunityIcons
        name="account-multiple-outline"
        size={size}
        color={iconColor}
        style={[styles.rowIcon, styles.teamTrainingIcon]}
      />
    );
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={iconColor}
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={styles.rowIcon}
    >
      {rowIconPaths(kind)}
    </Svg>
  );
}

function rowIconPaths(kind: RowIconKind) {
  switch (kind) {
    case 'game':
      return (
        <>
          <Path d="M8 4h8v4a4 4 0 01-8 0V4z" />
          <Path d="M8 6H5a3 3 0 003 3" />
          <Path d="M16 6h3a3 3 0 01-3 3" />
          <Path d="M12 12v4" />
          <Path d="M9 20h6" />
          <Path d="M10 16h4" />
        </>
      );
    case 'recovery':
      return (
        <>
          <Path d="M4 7h13a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" />
          <Path d="M20 10v4" />
          <Path d="M11 9l-3 4h3l-1 3 4-5h-3l1-2z" />
        </>
      );
    case 'pulse':
      return <Path d="M3 12h4l2-5 4 10 2-5h6" />;
    case 'refresh':
      return (
        <>
          <Path d="M20 11a8 8 0 00-14.3-4.9L4 8" />
          <Path d="M4 4v4h4" />
          <Path d="M4 13a8 8 0 0014.3 4.9L20 16" />
          <Path d="M20 20v-4h-4" />
        </>
      );
    case 'bolt':
      return <Path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />;
    case 'flame':
      return (
        <>
          <Path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 .2 3-1 4-2 5 0-4-2-6-4-8 .5 4-4 6-4 10 0 4 3 7 7 7z" />
          <Path d="M12 18c1.5 0 2.5-1.1 2.5-2.5 0-1-.5-1.8-1.5-2.8-.2 1.1-.8 1.8-1.7 2.5-.8.6-1.3 1.2-1.3 2.1 0 1.5 1 2.7 2 2.7z" />
        </>
      );
    case 'mobility':
      return (
        <>
          <Path d="M12 5v8" />
          <Path d="M8 9l4 4 4-4" />
          <Path d="M12 13l-5 7" />
          <Path d="M12 13l5 7" />
        </>
      );
    case 'prehab':
      return (
        <>
          <Path d="M12 3l7 3v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6l7-3z" />
          <Path d="M12 8v6" />
          <Path d="M9 11h6" />
        </>
      );
    case 'core':
      return (
        <>
          <Path d="M12 4a8 8 0 100 16 8 8 0 000-16z" />
          <Path d="M12 9a3 3 0 100 6 3 3 0 000-6z" />
        </>
      );
    case 'activity':
      return (
        <>
          <Path d="M8 5h11" />
          <Path d="M8 12h11" />
          <Path d="M8 19h11" />
          <Path d="M4 5h.01" />
          <Path d="M4 12h.01" />
          <Path d="M4 19h.01" />
        </>
      );
    case 'strength':
    default:
      return (
        <>
          <Path d="M6.5 6.5l11 11" />
          <Path d="M3.5 8.5l5-5" />
          <Path d="M5.5 10.5l5-5" />
          <Path d="M13.5 18.5l5-5" />
          <Path d="M15.5 20.5l5-5" />
        </>
      );
  }
}

const styles = StyleSheet.create({
  rowIcon: { opacity: 0.95 },
  teamTrainingIcon: { opacity: 1 },
});
