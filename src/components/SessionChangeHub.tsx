/**
 * ONE "NEED TO MAKE A CHANGE?" HUB, RENDERED BY BOTH SURFACES.
 *
 * Sam, 2026-08-19: *"The Need to make a change? section inside an active session
 * must use the same shared UI component and visual design as the Day screen —
 * not a separate row of plain text pills. Both surfaces must show the same five
 * actions: Equipment · Injury · Add · Remove · Swap. Reuse the Day-screen card
 * layout, icons, colours, labels, spacing and interaction states. Do not keep
 * separate Day and Session implementations."*
 *
 * ## WHAT WAS WRONG
 *
 * There were TWO hubs. The Day screen had the signed card — heading, sub-line
 * and a row of 48px tinted icon chips. The session screen had its own row of
 * plain bordered text pills, built when the five labelled actions landed. Same
 * heading, same intent, two implementations and two visual languages, so the
 * athlete met a different control depending on which screen they were on and
 * every future change had to be made twice.
 *
 * ## WHAT THIS OWNS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * It owns the CARD, the heading, the sub-line, the chip row, the icons, the
 * tints, the labels and the pressed state — everything the athlete sees. The
 * five action IDs and their glyphs live here so the two surfaces cannot drift
 * into different words or different pictures for the same door.
 *
 * It owns NOTHING about what a tap does. Each surface passes its own `onPress`,
 * because the Day screen acts on today's session and the session screen acts on
 * the one that is open — the same canonical doors, reached with the right date.
 *
 * ⚠ **THE `actions` LIST IS STILL THE WHOLE "NO DEAD BUTTONS" MECHANISM.** This
 * component renders what it is handed and nothing else. It has no knowledge of
 * which doors exist, so it cannot draw one with nowhere to go, and there is no
 * disabled state for a caller to hand it. An action the surface cannot serve is
 * simply not in the list.
 *
 * WRITER: `screens/home/HomeScreenV2` (Day) and `screens/home/DayWorkoutScreenV2`
 * (session). READER: the athlete. TEST: `test:session-change-hub` parity section.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Card } from './ui';
import { spacing } from '../theme/spacing';

/**
 * THE FIVE, IN THE ORDER SAM WRITES THEM: *"Equipment · Injury · Add · Remove ·
 * Swap"*. Exported so a parity guard can assert both surfaces offer the same
 * set rather than trusting two hand-written lists to stay equal.
 */
export const SESSION_CHANGE_ACTION_IDS = [
  'equipment', 'injury', 'add', 'remove', 'swap',
] as const;

export type SessionChangeActionId = (typeof SESSION_CHANGE_ACTION_IDS)[number];

export interface SessionChangeAction {
  id: SessionChangeActionId;
  onPress: () => void;
  /** Optional override; the shared label is used when absent. */
  accessibilityHint?: string;
}

/** The word the athlete reads. One place, so the two surfaces cannot disagree. */
export const SESSION_CHANGE_ACTION_LABEL: Record<SessionChangeActionId, string> = {
  equipment: 'Equipment',
  injury: 'Injury',
  add: 'Add',
  remove: 'Remove',
  swap: 'Swap',
};

/**
 * The tints are the ones already chosen on the Day screen for the doors that
 * existed there — the injury red and the remove pink are carried over verbatim
 * rather than re-picked, so nothing the athlete already recognises changes hue.
 */
const ACTION_TINT: Record<SessionChangeActionId, string> = {
  equipment: 'rgba(30, 167, 255, 0.12)',
  injury: 'rgba(255, 127, 127, 0.12)',
  add: 'rgba(198, 255, 0, 0.12)',
  remove: 'rgba(255, 161, 196, 0.12)',
  swap: 'rgba(185, 167, 255, 0.12)',
};

const ACTION_STROKE: Record<SessionChangeActionId, string> = {
  equipment: '#67D7FF',
  injury: '#FF7F7F',
  add: '#C6FF00',
  remove: '#FFA1C4',
  swap: '#B9A7FF',
};

function glyph(id: SessionChangeActionId): React.ReactNode {
  const stroke = ACTION_STROKE[id];
  const common = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
    stroke, strokeWidth: 1.9, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (id) {
    // A dumbbell — the kit itself.
    case 'equipment':
      return (
        <Svg {...common}>
          <Path d="M6.5 7v10M4 9v6M17.5 7v10M20 9v6M6.5 12h11" />
        </Svg>
      );
    // The warning triangle the Day screen's injury entries already draw.
    case 'injury':
      return (
        <Svg {...common}>
          <Path d="M12 9v4" /><Path d="M12 17h.01" />
          <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </Svg>
      );
    case 'add':
      return (
        <Svg {...common}><Path d="M12 5v14M5 12h14" /></Svg>
      );
    // A minus in a circle — removal, not deletion of the day.
    case 'remove':
      return (
        <Svg {...common}>
          <Path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" /><Path d="M8 12h8" />
        </Svg>
      );
    // Two arrows trading places.
    case 'swap':
      return (
        <Svg {...common}>
          <Path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
        </Svg>
      );
  }
}

export function SessionChangeHub({
  actions,
  testID = 'session-change-hub',
  subline = 'Update your status to modify your program.',
}: {
  actions: readonly SessionChangeAction[];
  testID?: string;
  subline?: string;
}) {
  if (actions.length === 0) return null;
  return (
    <Card tone="default" padding="lg" radius="lg" style={styles.card} testID={testID}>
      <Text style={styles.heading}>Need to make a change?</Text>
      <Text style={styles.subline}>{subline}</Text>
      <View style={styles.row} testID={`${testID}-actions`}>
        {actions.map((action) => {
          const label = SESSION_CHANGE_ACTION_LABEL[action.id];
          return (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={action.accessibilityHint}
              testID={`session-change-${action.id}`}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.chipIcon, { backgroundColor: ACTION_TINT[action.id] }]}>
                {glyph(action.id)}
              </View>
              {/* ⚠ **ONE LINE, SHRUNK TO FIT — NOT WRAPPED.** At five chips a
                  402pt screen gives each about 68pt and "Equipment" is the one
                  word that does not fit: it first truncated to "Equipm…", then,
                  when wrapped, broke mid-word as "Equipmen / t". A label that
                  hyphenates itself reads as a bug. `adjustsFontSizeToFit` drops
                  only that one word a fraction; the other four are unchanged. */}
              <Text
                style={styles.chipLabel}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/* The Day screen's own values, moved here with the component they style. */
const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  heading: { color: '#F5F5F5', fontSize: 15, fontWeight: '700' },
  subline: { color: '#8A8A8A', fontSize: 13, lineHeight: 18, marginTop: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  chip: { flex: 1, alignItems: 'center', gap: 6 },
  chipIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  chipLabel: {
    color: '#8A8F98', fontSize: 12, lineHeight: 16, fontWeight: '600',
    letterSpacing: 0.2, textAlign: 'center',
  },
});
