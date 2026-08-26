import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { PlanChangeBinScopeId } from '../../utils/planChangeTypes';
import { weekBoardDropRefusal, type WeekBoardBox, type WeekBoardDay } from '../../rules/weekBoard';

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
  /** R-227: the date is before the program's start — drawn dimmed, with no
   *  add, no bin and no drag. Visible but inert (Sam, 2026-08-26). */
  readonly preProgram?: boolean;
  readonly board: WeekBoardDay;
}

/** Where a box sits, in board coordinates. Filled by `onLayout`, never guessed. */
type Frame = { x: number; y: number; width: number; height: number };

export function WeekBoard({ rows, onAdd, onRemove, onMove, onRefused }: {
  rows: readonly WeekBoardRow[];
  onAdd: (date: string) => void;
  onRemove: (date: string, scope: PlanChangeBinScopeId | null) => void;
  /** R-218b — a completed drag. The BOARD decides the shape is legal; the
   *  producer still decides whether the program allows it. */
  onMove: (args: { fromDate: string; toDate: string; box: WeekBoardBox }) => void;
  /** Why a drop was refused, in the athlete's words. */
  onRefused: (message: string) => void;
}) {
  /**
   * ⚠ **THE FRAMES ARE MEASURED, NOT COMPUTED FROM THE STYLESHEET.** A hit-test
   * that assumed "row height 58 + gap 8, date column 44" would be a second copy
   * of the layout, and it would be wrong the first time a label wrapped to two
   * lines or a phone changed its text size. `onLayout` reports what was actually
   * drawn.
   */
  const frames = React.useRef<Record<string, Frame>>({});
  const rowTops = React.useRef<Record<string, number>>({});
  const boxesLeft = React.useRef<Record<string, number>>({});

  const rememberRow = (date: string) => (event: LayoutChangeEvent) => {
    rowTops.current[date] = event.nativeEvent.layout.y;
  };
  const rememberBoxesContainer = (date: string) => (event: LayoutChangeEvent) => {
    boxesLeft.current[date] = event.nativeEvent.layout.x;
  };
  const rememberBox = (date: string, boxId: string) => (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    frames.current[`${date}:${boxId}`] = { x, y, width, height };
  };

  /** The box under a point in board coordinates, or null. */
  const boxAt = (px: number, py: number): { row: WeekBoardRow; box: WeekBoardBox } | null => {
    for (const row of rows) {
      const top = rowTops.current[row.date];
      const left = boxesLeft.current[row.date];
      if (top === undefined || left === undefined) continue;
      for (const box of row.board.boxes) {
        const frame = frames.current[`${row.date}:${box.id}`];
        if (!frame) continue;
        const x0 = left + frame.x;
        const y0 = top + frame.y;
        if (px >= x0 && px <= x0 + frame.width && py >= y0 && py <= y0 + frame.height) {
          return { row, box };
        }
      }
    }
    return null;
  };

  /**
   * ⚠ **THE GESTURE REPORTS `x`/`y` RELATIVE TO THE BOX IT STARTED ON**, not to
   * the board, so they are converted here by adding that box's own measured
   * origin. Hit-testing the raw values would have matched whatever sits at the
   * same offset inside every row — a bug that looks like "the drop went to the
   * wrong day" and is really "the two numbers were never in the same space".
   */
  const handleDrop = React.useCallback((
    fromDate: string, boxId: string, localX: number, localY: number,
  ) => {
    const from = rows.find((row) => row.date === fromDate);
    const box = from?.board.boxes.find((entry) => entry.id === boxId);
    if (!from || !box) return;
    const origin = frames.current[`${fromDate}:${boxId}`];
    const rowTop = rowTops.current[fromDate];
    const left = boxesLeft.current[fromDate];
    if (!origin || rowTop === undefined || left === undefined) return;
    const landed = boxAt(left + origin.x + localX, rowTop + origin.y + localY);
    // Dropped on nothing — the athlete changed their mind. Silence, not an error.
    if (!landed) return;
    const refusal = weekBoardDropRefusal({
      box, from: from.board, target: landed.box, to: landed.row.board,
    });
    if (refusal === 'same_day') return;
    if (refusal) { onRefused(DROP_REFUSAL_COPY[refusal]); return; }
    onMove({ fromDate, toDate: landed.row.date, box });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMove, onRefused, rows]);

  return (
    <View style={styles.board} testID="week-board">
      {rows.map((row) => (
        <View
          key={row.date}
          style={styles.row}
          testID={`week-board-day-${row.date}`}
          onLayout={rememberRow(row.date)}
        >
          {/* ⚠ **THE DATE IS NOT SELECTABLE — SAM, 2026-08-25.** It is a `View`
            * and not a `Pressable`, so there is no handler to accidentally
            * re-attach later. The whole-row tap this replaces is what made the
            * old flow "pick a day, then say what you meant"; here the CONTROL
            * says what you meant, so the day is a label. */}
          <View style={[styles.dateCell, row.isToday && styles.dateCellToday]}>
            <Text style={[styles.weekday, row.isToday && styles.weekdayToday]}>{row.short}</Text>
            <Text style={styles.dayNumber}>{row.dayNumber}</Text>
          </View>
          <View
            style={[styles.boxes, row.preProgram && { opacity: 0.45 }]}
            onLayout={rememberBoxesContainer(row.date)}
          >
            {row.board.boxes.map((box) => (
              <BoardBox
                key={box.id}
                box={box}
                date={row.date}
                frozen={!!row.preProgram}
                onLayout={rememberBox(row.date, box.id)}
                onAdd={onAdd}
                onRemove={onRemove}
                onDrop={handleDrop}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Why a drop was refused, in words the athlete reads. One per typed refusal. */
const DROP_REFUSAL_COPY: Record<string, string> = {
  not_movable: "That one can't be moved from here.",
  onto_team_training: "Team training stays put — drop it on a free day instead.",
  onto_game: "Nothing goes on game day.",
  day_full: "That day is full — two sessions is the most.",
};

function BoardBox({ box, date, frozen = false, onLayout, onAdd, onRemove, onDrop }: {
  box: WeekBoardBox;
  date: string;
  /** R-227: a pre-start day's box renders, and does nothing. */
  frozen?: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onAdd: (date: string) => void;
  onRemove: (date: string, scope: PlanChangeBinScopeId | null) => void;
  onDrop: (fromDate: string, boxId: string, px: number, py: number) => void;
}) {
  if (box.kind === 'empty') {
    if (frozen) {
      // R-227: no add doorway before the program's start — an empty label only.
      return <View onLayout={onLayout} style={[styles.box, styles.emptyBox]} />;
    }
    return (
      <Pressable
        onPress={() => onAdd(date)}
        accessibilityRole="button"
        accessibilityLabel={`Add a session on ${date}`}
        testID={`week-board-add-${date}`}
        onLayout={onLayout}
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
  const removable = box.kind !== 'game' && !frozen;
  const draggable = box.kind !== 'game' && !frozen;

  /* THE BOX FOLLOWS THE FINGER ON THE UI THREAD. Only the DROP crosses back to
   * JS — a drag that re-rendered the week on every frame would fight the list
   * it is being dragged over. */
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  /**
   * ⚠ **`activateAfterLongPress` IS WHAT LETS THIS LIVE INSIDE A SCROLLING
   * WEEK.** The board sits in the Program tab's ScrollView. A pan that claimed
   * the touch immediately would steal every attempt to scroll past the week;
   * requiring the finger to rest first means a flick still scrolls and only a
   * deliberate hold lifts a session. This is the failure the plan named as most
   * likely to bite, and it is answered by the gesture's own contract rather
   * than by fighting the parent for the responder.
   */
  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart((event) => {
      lifted.value = 1;
      // ⚠ **THE ONLY MOMENT `event.x`/`event.y` CAN BE TRUSTED IS THIS ONE.**
      // See the note on `onEnd`.
      startX.value = event.x;
      startY.value = event.y;
    })
    .onUpdate((event) => {
      dx.value = event.translationX;
      dy.value = event.translationY;
    })
    .onEnd((event) => {
      /**
       * ⚠ **`event.x` IN `onEnd` IS NOT WHERE THE FINGER LANDED — AND THAT BUG
       * SHIPPED ONCE.** Sam, 2026-08-25: *"the drag works but i cant seem to
       * drop anything anywhere"*.
       *
       * Pan reports `x`/`y` relative to its own view, and this view is being
       * TRANSLATED BY THE FINGER. So the finger stays at very nearly the same
       * point INSIDE the box for the whole drag, and `event.x` at the end is
       * roughly `event.x` at the start. Every drop therefore hit-tested back
       * onto the box it came from, resolved as `same_day`, and returned
       * silently — a drag that visibly worked and could never land.
       *
       * **The two trustworthy numbers are the START offset and the TRANSLATION**,
       * and neither is affected by the transform. Where the finger let go is
       * where it pressed, plus how far it travelled.
       */
      runOnJS(onDrop)(
        date, box.id,
        startX.value + event.translationX,
        startY.value + event.translationY,
      );
    })
    .onFinalize(() => {
      // The box always returns home. What the drop CHANGED is re-derived and
      // re-rendered from the program, never from where the finger stopped.
      //
      // ⚠ **HOME BY GLIDE, NEVER BY TELEPORT — Sam's phone, 2026-08-26
      // (checklist #14):** *"it snaps back for a micro second to where it
      // came before finalising on the right spot"*. `dx.value = 0` moved the
      // box to its origin IN ONE FRAME while the accepted drop was still
      // re-deriving the week — an instant flash of the old layout. A short
      // timed return reads as deliberate motion, and an accepted drop's
      // re-render lands while (or before) the glide finishes, so the old
      // position never flashes. Refused and abandoned drops keep the same
      // glide — one return, one look.
      lifted.value = 0;
      dx.value = withTiming(0, { duration: 180 });
      dy.value = withTiming(0, { duration: 180 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.value },
      { translateY: dy.value },
      { scale: lifted.value ? 1.03 : 1 },
    ] as never,
    opacity: lifted.value ? 0.92 : 1,
    zIndex: lifted.value ? 20 : 0,
    elevation: lifted.value ? 8 : 0,
  }));

  const content = (
    <Animated.View
      style={[styles.box, box.kind === 'team_training' && styles.teamBox, dragStyle]}
      testID={`week-board-box-${date}-${box.kind}`}
      onLayout={onLayout}
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
    </Animated.View>
  );

  return draggable ? <GestureDetector gesture={pan}>{content}</GestureDetector> : content;
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
