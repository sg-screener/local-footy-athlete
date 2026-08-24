import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { PlanChangeBinScopeId } from '../../utils/planChangeTypes';
import type { WeekBoardBox, WeekBoardDay } from '../../rules/weekBoard';

/**
 * ── THE WEEK BOARD ──────────────────────────────────────────────────────────
 *
 * ⚠ **R-218 (Sam, 2026-08-25).** *"you hit manage sessions — you get taken
 * straight here — the dates should not be selectable ... the day should be
 * broken into its own thing but in 2 sections ... For rest days you should have
 * a + icon on the box to add a session that day, and follow the same pathway
 * the current 'add a session' button does. For any box that has a session in
 * it, you should have a trash can symbol."*
 *
 * ## This file draws boxes. It decides nothing.
 *
 * WHAT a day holds is `rules/weekBoard`; WHETHER a change is allowed is
 * `planChangeProducer`. **Both were already owners before this screen existed,
 * and a board that re-derived either would be the second authority this repo
 * has paid for twice** (`week-identity-two-owners`, and the
 * `MOVE_SCOPE_SECTION_KIND` table deleted from the producer on 2026-08-12 for
 * exactly this reason).
 *
 * ## The `+` and the bin are the EXISTING doors
 *
 * Sam's words are *"follow the same pathway"*. Both controls raise the same
 * `changeSheetEntry` the retired menu rows raised, with this box's own date and
 * scope — so there is no second add flow and no second remove flow to drift.
 * **The old rows stay live until the last slice, at his instruction**, precisely
 * so the two can be compared on glass before either is deleted.
 */

export interface WeekBoardRow {
  readonly date: string;
  /** MON, TUE … straight off the resolved day; this file never formats a date. */
  readonly short: string;
  readonly dayNumber: string;
  readonly isToday: boolean;
  readonly board: WeekBoardDay;
}

export function WeekBoard({ rows, onAdd, onRemove }: {
  rows: readonly WeekBoardRow[];
  onAdd: (date: string) => void;
  onRemove: (date: string, scope: PlanChangeBinScopeId | null) => void;
}) {
  return (
    <View style={styles.board} testID="week-board">
      {rows.map((row) => (
        <View key={row.date} style={styles.row} testID={`week-board-day-${row.date}`}>
          {/* ⚠ **THE DATE IS NOT SELECTABLE — SAM, 2026-08-25.** It is a `View`
            * and not a `Pressable`, so there is no handler to accidentally
            * re-attach later. The whole-row tap this replaces is what made the
            * old flow "pick a day, then say what you meant"; here the CONTROL
            * says what you meant, so the day is a label. */}
          <View style={[styles.dateCell, row.isToday && styles.dateCellToday]}>
            <Text style={[styles.weekday, row.isToday && styles.weekdayToday]}>{row.short}</Text>
            <Text style={styles.dayNumber}>{row.dayNumber}</Text>
          </View>
          <View style={styles.boxes}>
            {row.board.boxes.map((box) => (
              <BoardBox
                key={box.id}
                box={box}
                date={row.date}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function BoardBox({ box, date, onAdd, onRemove }: {
  box: WeekBoardBox;
  date: string;
  onAdd: (date: string) => void;
  onRemove: (date: string, scope: PlanChangeBinScopeId | null) => void;
}) {
  if (box.kind === 'empty') {
    return (
      <Pressable
        onPress={() => onAdd(date)}
        accessibilityRole="button"
        accessibilityLabel={`Add a session on ${date}`}
        testID={`week-board-add-${date}`}
        style={({ pressed }) => [
          styles.box, styles.emptyBox, pressed && styles.boxPressed,
        ]}
      >
        <MaterialCommunityIcons name="plus" size={18} color={colors.text.tertiary} />
      </Pressable>
    );
  }

  /* A FIXTURE IS A LABEL HERE. It carries no bin and no drag: the game moves
   * and clears through its own door, which this board does not replace. */
  const removable = box.kind !== 'game';
  return (
    <View
      style={[styles.box, box.kind === 'team_training' && styles.teamBox]}
      testID={`week-board-box-${date}-${box.kind}`}
    >
      <Text style={styles.boxLabel} numberOfLines={2}>{box.label}</Text>
      {removable ? (
        <Pressable
          onPress={() => onRemove(date, box.binScope)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${box.label ?? 'this session'} on ${date}`}
          testID={`week-board-remove-${date}-${box.kind}`}
          hitSlop={8}
          style={({ pressed }) => [styles.binButton, pressed && { opacity: 0.6 }]}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={15} color="#FF7A85" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  /* ⚠ **THE DATE IS NOT A BOX — SAM, 2026-08-25 (R-218a): *"the dates don't
   * need to have their own boxes"*.** It was drawn as a filled, rounded cell
   * matching the session boxes beside it, which made the week read as three
   * boxes per row when only two of them are things the athlete can act on. A
   * label that looks like a control is the same defect as a control that looks
   * like a label. Today keeps its lime weekday and nothing else. */
  dateCell: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  dateCellToday: {},
  weekday: { color: colors.text.tertiary, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  weekdayToday: { color: colors.text.accent },
  dayNumber: { color: colors.text.primary, fontSize: 17, fontWeight: '700' },
  /* THE BOXES SHARE THE ROW EQUALLY — a day with one session and an empty box
   * reads as "half full", which is the whole point of showing the empty one. */
  boxes: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  box: {
    flex: 1,
    minHeight: 58,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  teamBox: { backgroundColor: 'rgba(103,215,255,0.07)', borderColor: 'rgba(103,215,255,0.20)' },
  emptyBox: {
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  boxPressed: { opacity: 0.6 },
  boxLabel: { flex: 1, color: colors.text.primary, fontSize: 13, fontWeight: '600' },
  binButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
});
