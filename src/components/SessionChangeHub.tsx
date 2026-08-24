/**
 * ONE DAY-STATUS CARD. THE ACTIVE SESSION NOW USES ITS OWN OPTIONS SHEET.
 *
 * Sam, 2026-08-19 (the ruling that built this): *"The Need to make a change?
 * section inside an active session must use the same shared UI component and
 * visual design as the Day screen — not a separate row of plain text pills …
 * Do not keep separate Day and Session implementations."*
 *
 * Sam, 2026-08-25: the Day page keeps Tired, Sick and Injured as direct status
 * controls. Add, Move and Remove enter from the programmed session card's
 * compact plan-options control, so this physical-status card owns no scheduling
 * doorway. R-209 then moved the active session's Injury, Equipment and Add
 * actions behind its own compact header menu; that screen no longer mounts
 * this card. R-210 keeps the original glyph/tint owner here and imports those
 * exact values into the new flat menu rows, so relocating a door cannot redraw
 * the dumbbell, medical cross or plus.
 *
 * ## WHAT THIS OWNS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * It owns the CARD, the heading, the sub-line, the chip row, the icons, the
 * tints, the labels and the pressed state — everything the athlete sees.
 *
 * It owns NOTHING about what a tap does, and nothing about which taps exist.
 * Each surface passes its own `onPress`, its own `testID` and its own list,
 * because the Day screen acts on the athlete's STATE and the session screen
 * acts on the session that is open.
 *
 * ⚠ **THE `actions` LIST IS STILL THE WHOLE "NO DEAD BUTTONS" MECHANISM.** This
 * component renders what it is handed and nothing else. It has no knowledge of
 * which doors exist, so it cannot draw one with nowhere to go, and there is no
 * disabled state for a caller to hand it. An action the surface cannot serve is
 * simply not in the list.
 *
 * WRITER: `screens/home/HomeScreenV2` (Day, three status actions).
 * READER: the athlete. TEST: `test:session-change-hub` sections [8] and [9].
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Card } from './ui';
import { spacing } from '../theme/spacing';
import { signedCopy, type SignedCopy } from '../rules/signedCopy';

/**
 * THE DAY SURFACE'S DIRECT SET. These are athlete-state facts. Day/session plan
 * edits live on the programmed session card.
 */
export const DAY_CHANGE_ACTION_IDS = [
  'tired', 'sick', 'injured',
] as const;

/**
 * THE OPEN-SESSION SET. Quick row actions own Remove and Swap.
 */
export const SESSION_CHANGE_ACTION_IDS = [
  'equipment', 'injury', 'add',
] as const;

/** Every identity this card can draw. Neither surface offers all of them. */
export const CHANGE_ACTION_IDS = [
  'tired', 'sick', 'injured', 'equipment', 'injury', 'add',
] as const;

export type ChangeActionId = (typeof CHANGE_ACTION_IDS)[number];
/** Kept as the session surface's narrower type; it is what that screen passes. */
export type SessionChangeActionId = (typeof SESSION_CHANGE_ACTION_IDS)[number];

export interface SessionChangeAction {
  id: ChangeActionId;
  onPress: () => void;
  /**
   * The coordinate the walker, the explorer and the dev-e2e finder reach this
   * door by. Defaults to `session-change-<id>`; the Day surface passes the ids
   * its doors have always had (`home-tired-entry`, `home-injured-entry`, and
   * the readiness set/update id, which CHANGES when a fact is already active).
   * A chip that minted its own id from its label would silently rename a door.
   */
  testID?: string;
  /** Defaults to the shared label. Overridden where a door's spoken name differs. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** The word the athlete reads. One place, so no two surfaces can disagree. */
export const CHANGE_ACTION_LABEL: Record<ChangeActionId, string> = {
  tired: 'Tired',
  sick: 'Sick',
  injured: 'Injured',
  equipment: 'Equipment',
  injury: 'Injury',
  add: 'Add',
};

/** The previous name, kept so existing readers do not have to be rewritten. */
export const SESSION_CHANGE_ACTION_LABEL = CHANGE_ACTION_LABEL;

/**
 * The tints and strokes are the ones already chosen — the three status colours
 * are carried over VERBATIM from the Day screen at `1a7e7bd0` (cyan Tired,
 * amber Sick, red Injured) and the retained session-action tints from this
 * component's first version, so nothing the athlete already recognises changes hue.
 */
export const ACTION_TINT: Record<ChangeActionId, string> = {
  tired: 'rgba(103, 215, 255, 0.12)',
  sick: 'rgba(255, 202, 104, 0.12)',
  injured: 'rgba(255, 127, 127, 0.12)',
  equipment: 'rgba(30, 167, 255, 0.12)',
  injury: 'rgba(255, 127, 127, 0.12)',
  add: 'rgba(198, 255, 0, 0.12)',
};

const ACTION_STROKE: Record<ChangeActionId, string> = {
  tired: '#67D7FF',
  sick: '#FFCA68',
  injured: '#FF7F7F',
  equipment: '#67D7FF',
  injury: '#FF7F7F',
  add: '#C6FF00',
};

/**
 * ⚠ **THE THREE STATUS GLYPHS ARE RENEE'S, COPIED PATH-FOR-PATH FROM THE
 * SIGNED DAY SCREEN AT `1a7e7bd0`.** They are asserted by exact path data in
 * `test:day-first-timeline`, which is what caught their loss. Do not redraw
 * them; the battery, the thermometer and the medical cross are the pictures the
 * athlete has been taught.
 */
export function glyph(id: ChangeActionId): React.ReactNode {
  const stroke = ACTION_STROKE[id];
  const common = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
    stroke, strokeWidth: 1.9, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (id) {
    // A battery with a terminal — energy, drawn a touch heavier as it always was.
    case 'tired':
      return (
        <Svg {...common} strokeWidth={2.2}>
          <Path d="M3 8h15v8H3z" /><Path d="M21 11v2" /><Path d="M6 11v2" />
        </Svg>
      );
    // A thermometer — illness.
    case 'sick':
      return (
        <Svg {...common} strokeWidth={1.7}>
          <Path d="M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0Z" /><Path d="M12 10v6" />
        </Svg>
      );
    /**
     * A medical cross — injury, on EITHER surface.
     *
     * ⚠ **`injured` AND `injury` DRAW THE SAME PICTURE, BY SAM'S RULING.** The
     * first cut of this correction gave the session's Injury door a warning
     * triangle, reasoning that "I am injured" and "this exercise hurts" are
     * different questions and should not look alike. Sam, 2026-08-19, on seeing
     * it: *"injured still has the wrong icon - it should match the injured icon
     * on the day screen."*
     *
     * They fall through to one `case` rather than being two identical blocks,
     * so a future edit cannot change one and leave the other behind — which is
     * exactly the drift that made them differ in the first place.
     */
    case 'injured':
    case 'injury':
      return (
        <Svg {...common} strokeWidth={1.7}>
          <Path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" />
        </Svg>
      );
    // A dumbbell — the kit itself.
    case 'equipment':
      return (
        <Svg {...common}>
          <Path d="M6.5 7v10M4 9v6M17.5 7v10M20 9v6M6.5 12h11" />
        </Svg>
      );
    case 'add':
      return (
        <Svg {...common}><Path d="M12 5v14M5 12h14" /></Svg>
      );
  }
}

export function SessionChangeHub({
  actions,
  testID = 'session-change-hub',
  rowTestID,
  heading,
  subline,
  style,
}: {
  actions: readonly SessionChangeAction[];
  testID?: string;
  /** Defaults to `<testID>-actions`; the Day surface keeps `home-life-fact-chips`. */
  rowTestID?: string;
  /** Defaults to Day's signed status question. Session supplies its own heading. */
  heading?: SignedCopy;
  /** Defaults to the signed sub-line. The session surface narrows it to today. */
  subline?: string;
  /**
   * ⚠ **THE GAP ABOVE THIS CARD IS THE SURFACE'S, NOT THIS COMPONENT'S** —
   * Sam, 2026-08-22, on the Day view: *"make them all the same gap as the gap
   * between the 1 active modifier and the strength box"*.
   *
   * It carried `marginTop: spacing.md` (16) for both surfaces, and the two now
   * want different numbers: Day spaces every box on the screen at 8, while the
   * session screen's box is ruled to sit 16 from the section above it AND 16
   * from the Log button below it. A shared component holding one of those two
   * numbers makes the other surface wrong, so neither is held here — each
   * caller passes its own.
   */
  style?: StyleProp<ViewStyle>;
}) {
  if (actions.length === 0) return null;
  return (
    <Card tone="default" padding="lg" radius="lg" style={style} testID={testID}>
      {/* ⚠ **THE WORDS COME FROM THE SHEET, NOT FROM HERE.** They were literals
          in this file for one day and that is a word Sam could never re-word;
          `day.change_card.*` are the signed rows and moving the panel must not
          quietly orphan them. Held by `test:day-first-timeline`. */}
      <Text style={styles.heading}>
        {heading ?? signedCopy('day.change_card.heading')}
      </Text>
      <Text style={styles.subline}>
        {subline ?? signedCopy('day.change_card.subline')}
      </Text>
      <View style={styles.row} testID={rowTestID ?? `${testID}-actions`}>
        {actions.map((action) => {
          const label = CHANGE_ACTION_LABEL[action.id];
          return (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? label}
              accessibilityHint={action.accessibilityHint}
              testID={action.testID ?? `session-change-${action.id}`}
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
                  only that one word a fraction; the others are unchanged. */}
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
