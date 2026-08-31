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
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { weekBoardDropRefusal, type WeekBoardBox, type WeekBoardDay } from '../../rules/weekBoard';
import {
  resolveWeekBoardSnapTarget,
  type WeekBoardSnapRow,
} from './weekBoardSnapTarget';

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

/** Where a box sits, in board coordinates. Filled by `onLayout`, never guessed. */
type Frame = { x: number; y: number; width: number; height: number };

export function WeekBoard({ rows, onAdd, onRemove, onMove, onRefused, settleNonce = 0, moveSource = null, todayISO }: {
  rows: readonly WeekBoardRow[];
  onAdd: (date: string) => void;
  onRemove: (date: string, box: WeekBoardBox) => void;
  /** R-218b — a completed drag. The BOARD decides the shape is legal; the
   *  producer still decides whether the program allows it. */
  onMove: (args: { fromDate: string; toDate: string; box: WeekBoardBox }) => void;
  /** Why a drop was refused, in the athlete's words. */
  onRefused: (message: string) => void;
  /**
   * Bumped by the parent when a dispatched move's flow ENDS (the plan-change
   * sheet closes) — the signal for a box still held at its drop point to
   * glide home. A box the accepted move re-homed has already unmounted, so
   * the bump is a no-op for it. Checklist #14, second round.
   */
  settleNonce?: number;
  /** Catch-up entry authorises dragging only the unlogged thing named by the prompt. */
  moveSource?: { readonly date: string; readonly kind: 'session' | 'team_training' | 'game' } | null;
  todayISO: string;
}) {
  /**
   * ⚠ **THE FRAMES ARE MEASURED, NOT COMPUTED FROM THE STYLESHEET.** A hit-test
   * that assumed "row height 58 + gap 8, date column 44" would be a second copy
   * of the layout, and it would be wrong the first time a label wrapped to two
   * lines or a phone changed its text size. `onLayout` reports what was actually
   * drawn.
   */
  const frames = React.useRef<Record<string, Frame>>({});
  const rowFrames = React.useRef<Record<string, Frame>>({});
  const boxesLeft = React.useRef<Record<string, number>>({});
  const [lockedTarget, setLockedTarget] = React.useState<{
    readonly date: string;
    readonly boxId: string;
    readonly state: 'ready' | 'blocked';
  } | null>(null);
  const [dragSource, setDragSource] = React.useState<{
    readonly date: string;
    readonly boxId: string;
  } | null>(null);
  const lockedTargetKey = React.useRef('');

  const rememberRow = (date: string) => (event: LayoutChangeEvent) => {
    rowFrames.current[date] = event.nativeEvent.layout;
  };
  const rememberBoxesContainer = (date: string) => (event: LayoutChangeEvent) => {
    boxesLeft.current[date] = event.nativeEvent.layout.x;
  };
  const rememberBox = (date: string, boxId: string) => (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    frames.current[`${date}:${boxId}`] = { x, y, width, height };
  };

  const measuredRows = React.useCallback((): WeekBoardSnapRow[] => rows.flatMap((row) => {
    const rowFrame = rowFrames.current[row.date];
    const left = boxesLeft.current[row.date];
    if (!rowFrame || left === undefined) return [];
    const boxes = row.board.boxes.flatMap((box) => {
      const frame = frames.current[`${row.date}:${box.id}`];
      return frame ? [{
        box,
        frame: {
          x: left + frame.x,
          y: rowFrame.y + frame.y,
          width: frame.width,
          height: frame.height,
        },
      }] : [];
    });
    return [{ date: row.date, frame: rowFrame, boxes }];
  }), [rows]);

  const snapTargetAt = React.useCallback((
    fromDate: string,
    box: WeekBoardBox,
    px: number,
    py: number,
  ) => resolveWeekBoardSnapTarget({
    x: px,
    y: py,
    sourceKind: box.kind,
    // A past unlogged session cannot swap future work back into history. If
    // the destination has room, the useful interpretation is always "put it
    // in that room", wherever across the day's row the finger happens to be.
    preferOpenSlot: fromDate < todayISO,
    rows: measuredRows(),
  }), [measuredRows, todayISO]);

  const boardPoint = React.useCallback((
    fromDate: string,
    boxId: string,
    localX: number,
    localY: number,
  ): { x: number; y: number } | null => {
    const origin = frames.current[`${fromDate}:${boxId}`];
    const rowFrame = rowFrames.current[fromDate];
    const left = boxesLeft.current[fromDate];
    return origin && rowFrame && left !== undefined
      ? { x: left + origin.x + localX, y: rowFrame.y + origin.y + localY }
      : null;
  }, []);

  const clearLockedTarget = React.useCallback(() => {
    lockedTargetKey.current = '';
    setLockedTarget(null);
  }, []);

  const finishDrag = React.useCallback(() => {
    clearLockedTarget();
    setDragSource(null);
  }, [clearLockedTarget]);

  const beginDrag = React.useCallback((date: string, boxId: string) => {
    clearLockedTarget();
    setDragSource({ date, boxId });
  }, [clearLockedTarget]);

  const previewDrop = React.useCallback((
    fromDate: string, boxId: string, localX: number, localY: number,
  ) => {
    const from = rows.find((row) => row.date === fromDate);
    const box = from?.board.boxes.find((entry) => entry.id === boxId);
    const point = boardPoint(fromDate, boxId, localX, localY);
    const landed = box && point ? snapTargetAt(fromDate, box, point.x, point.y) : null;
    if (!from || !box || !landed) {
      if (lockedTargetKey.current) clearLockedTarget();
      return;
    }
    const targetRow = rows.find((row) => row.date === landed.date);
    if (!targetRow) return;
    const refusal = weekBoardDropRefusal({
      box, from: from.board, target: landed.box, to: targetRow.board,
    });
    if (refusal === 'same_day') {
      if (lockedTargetKey.current) clearLockedTarget();
      return;
    }
    const state = !refusal ? 'ready' : 'blocked';
    const nextKey = `${landed.date}:${landed.box.id}:${state}`;
    if (nextKey === lockedTargetKey.current) return;
    lockedTargetKey.current = nextKey;
    setLockedTarget({ date: landed.date, boxId: landed.box.id, state });
    void Haptics.selectionAsync().catch(() => undefined);
  }, [boardPoint, clearLockedTarget, rows, snapTargetAt]);

  const frameInBoard = React.useCallback((date: string, boxId: string): Frame | null => {
    const frame = frames.current[`${date}:${boxId}`];
    const rowFrame = rowFrames.current[date];
    const left = boxesLeft.current[date];
    return frame && rowFrame && left !== undefined ? {
      x: left + frame.x,
      y: rowFrame.y + frame.y,
      width: frame.width,
      height: frame.height,
    } : null;
  }, []);

  const snapOffsetFor = React.useCallback((date: string, boxId: string) => {
    if (!dragSource || dragSource.date !== date || dragSource.boxId !== boxId
      || !lockedTarget || lockedTarget.state !== 'ready') return null;
    const source = frameInBoard(date, boxId);
    const target = frameInBoard(lockedTarget.date, lockedTarget.boxId);
    return source && target
      ? { x: target.x - source.x, y: target.y - source.y }
      : null;
  }, [dragSource, frameInBoard, lockedTarget]);

  // An accepted move removes the source box from its old day. That projection
  // update is the authoritative end of the drag; clear the magnetic target
  // only then, rather than flashing the card back home before the move lands.
  React.useEffect(() => {
    if (!dragSource) return;
    const sourceStillExists = rows.some((row) => row.date === dragSource.date
      && row.board.boxes.some((box) => box.id === dragSource.boxId));
    if (!sourceStillExists) finishDrag();
  }, [dragSource, finishDrag, rows]);

  /**
   * ⚠ **THE GESTURE REPORTS `x`/`y` RELATIVE TO THE BOX IT STARTED ON**, not to
   * the board, so they are converted here by adding that box's own measured
   * origin. Hit-testing the raw values would have matched whatever sits at the
   * same offset inside every row — a bug that looks like "the drop went to the
   * wrong day" and is really "the two numbers were never in the same space".
   */
  /**
   * Returns the box's marching orders — checklist #14, second round (Sam,
   * 2026-08-26: *"nope still not working properly"*). A drop that DISPATCHES a
   * move answers `'held'`: the box stays at the drop point while the program
   * decides, and either unmounts when the re-derived week lands it on its new
   * day, or glides home when `settleNonce` says the flow ended without a
   * change. Everything that ends here and now answers `'returned'` and the
   * box glides home immediately.
   */
  const handleDrop = React.useCallback((
    fromDate: string, boxId: string, localX: number, localY: number,
  ): 'held' | 'returned' => {
    const from = rows.find((row) => row.date === fromDate);
    const box = from?.board.boxes.find((entry) => entry.id === boxId);
    if (!from || !box) return 'returned';
    const point = boardPoint(fromDate, boxId, localX, localY);
    const landed = point ? snapTargetAt(fromDate, box, point.x, point.y) : null;
    // Dropped on nothing — the athlete changed their mind. Silence, not an error.
    if (!landed) return 'returned';
    const targetRow = rows.find((row) => row.date === landed.date);
    if (!targetRow) return 'returned';
    const refusal = weekBoardDropRefusal({
      box, from: from.board, target: landed.box, to: targetRow.board,
    });
    if (refusal === 'same_day') return 'returned';
    if (refusal) { onRefused(DROP_REFUSAL_COPY[refusal]); return 'returned'; }
    onMove({ fromDate, toDate: landed.date, box });
    return 'held';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardPoint, onMove, onRefused, rows, snapTargetAt]);

  return (
    <View style={styles.board} testID="week-board">
      {rows.map((row) => (
        <View
          key={row.date}
          style={[
            styles.row,
            lockedTarget?.date === row.date && styles.lockedRow,
          ]}
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
          <View style={styles.boxes} onLayout={rememberBoxesContainer(row.date)}>
            {row.board.boxes.map((box) => (
              <BoardBox
                key={box.id}
                box={box}
                date={row.date}
                settleNonce={settleNonce}
                onLayout={rememberBox(row.date, box.id)}
                onAdd={onAdd}
                onRemove={onRemove}
                onDrop={handleDrop}
                onHover={previewDrop}
                onDragStart={beginDrag}
                onDragFinish={finishDrag}
                snapOffset={snapOffsetFor(row.date, box.id)}
                dropState={lockedTarget?.date === row.date && lockedTarget.boxId === box.id
                  ? lockedTarget.state : null}
                moveEnabled={row.date >= todayISO || !!(moveSource && row.date === moveSource.date && (
                  moveSource.kind === 'game' ? box.kind === 'game'
                    : moveSource.kind === 'team_training' ? box.kind === 'team_training'
                      : box.kind !== 'game' && box.kind !== 'team_training' && box.kind !== 'empty'
                ))}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Why a training-session drop was refused, in words the athlete reads. */
const DROP_REFUSAL_COPY: Record<string, string> = {
  not_movable: "That one can't be moved from here.",
  onto_team_training: "Team training stays put — drop it on a free day instead.",
  onto_game: "Nothing goes on game day.",
  day_full: "That day is full — two sessions is the most.",
};

function BoardBox({ box, date, settleNonce = 0, onLayout, onAdd, onRemove, onDrop,
  onHover, onDragStart, onDragFinish, snapOffset, dropState, moveEnabled }: {
  box: WeekBoardBox;
  date: string;
  settleNonce?: number;
  onLayout: (event: LayoutChangeEvent) => void;
  onAdd: (date: string) => void;
  onRemove: (date: string, box: WeekBoardBox) => void;
  onDrop: (fromDate: string, boxId: string, px: number, py: number) => 'held' | 'returned';
  onHover: (fromDate: string, boxId: string, px: number, py: number) => void;
  onDragStart: (date: string, boxId: string) => void;
  onDragFinish: () => void;
  snapOffset: { readonly x: number; readonly y: number } | null;
  dropState: 'ready' | 'blocked' | null;
  moveEnabled: boolean;
}) {
  if (box.kind === 'empty') {
    return (
      <Pressable
        onPress={() => onAdd(date)}
        accessibilityRole="button"
        accessibilityLabel={`Add to ${date}`}
        testID={`week-board-add-${date}`}
        onLayout={onLayout}
        style={({ pressed }) => [
          styles.box, styles.emptyBox,
          dropState === 'ready' && styles.dropTargetReady,
          dropState === 'blocked' && styles.dropTargetBlocked,
          pressed && styles.boxPressed,
        ]}
      >
        <MaterialCommunityIcons
          name={dropState === 'ready' ? 'arrow-down' : 'plus'}
          size={18}
          color={dropState === 'ready' ? colors.text.accent : colors.text.tertiary}
        />
      </Pressable>
    );
  }

  /* Every real box can be managed here. The parent distinguishes fixture
   * transactions from training transactions; this component only reports the
   * box and date the athlete acted on. */
  /* THE BOX FOLLOWS THE FINGER ON THE UI THREAD. Only the DROP crosses back to
   * JS — a drag that re-rendered the week on every frame would fight the list
   * it is being dragged over. */
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const snapX = useSharedValue(0);
  const snapY = useSharedValue(0);
  const snapped = useSharedValue(0);

  /**
   * ⚠ **`activateAfterLongPress` IS WHAT LETS THIS LIVE INSIDE A SCROLLING
   * WEEK.** The board sits in the Program tab's ScrollView. A pan that claimed
   * the touch immediately would steal every attempt to scroll past the week;
   * requiring the finger to rest first means a flick still scrolls and only a
   * deliberate hold lifts a session. This is the failure the plan named as most
   * likely to bite, and it is answered by the gesture's own contract rather
   * than by fighting the parent for the responder.
   */
  /** 1 the moment `onEnd` hands the drop to JS — tells `onFinalize` the
   *  return-home decision belongs to `finishDrop`/`settleNonce` now. */
  const dropDecided = useSharedValue(0);

  const glideHome = React.useCallback(() => {
    dropDecided.value = 0;
    dx.value = withTiming(0, { duration: 180 });
    dy.value = withTiming(0, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (snapOffset) {
      snapX.value = withTiming(snapOffset.x, { duration: 110 });
      snapY.value = withTiming(snapOffset.y, { duration: 110 });
      snapped.value = 1;
    } else {
      snapped.value = 0;
    }
  }, [snapOffset, snapX, snapY, snapped]);

  /** JS side of the drop: ask the board, then either hold or glide home. */
  const finishDrop = React.useCallback((px: number, py: number) => {
    if (onDrop(date, box.id, px, py) === 'returned') {
      glideHome();
      onDragFinish();
    }
    // A 'held' box keeps its offset: the accepted move unmounts it onto its
    // new day, and settleNonce covers the flow ending without a change.
  }, [onDrop, date, box.id, glideHome, onDragFinish]);

  /* The flow this box's drop dispatched has ENDED (plan-change sheet closed).
   * If the box is still mounted it was not moved — glide it home. Skips the
   * mount render; a box at rest glides 0 → 0 harmlessly anyway. */
  const lastSettle = React.useRef(settleNonce);
  React.useEffect(() => {
    if (settleNonce !== lastSettle.current) {
      lastSettle.current = settleNonce;
      glideHome();
      onDragFinish();
    }
  }, [settleNonce, glideHome, onDragFinish]);

  const pan = Gesture.Pan()
    .enabled(moveEnabled)
    .activateAfterLongPress(220)
    .onStart((event) => {
      lifted.value = 1;
      // ⚠ **THE ONLY MOMENT `event.x`/`event.y` CAN BE TRUSTED IS THIS ONE.**
      // See the note on `onEnd`.
      startX.value = event.x;
      startY.value = event.y;
      runOnJS(onDragStart)(date, box.id);
    })
    .onUpdate((event) => {
      dx.value = event.translationX;
      dy.value = event.translationY;
      runOnJS(onHover)(
        date,
        box.id,
        startX.value + event.translationX,
        startY.value + event.translationY,
      );
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
      dropDecided.value = 1;
      runOnJS(finishDrop)(
        startX.value + event.translationX,
        startY.value + event.translationY,
      );
    })
    .onFinalize(() => {
      // ⚠ **THE BOX DOES NOT RETURN HOME ON ITS OWN — checklist #14, second
      // round.** The first fix glided it home immediately, but the accepted
      // move re-derives SLOWER than any glide (the plan-change flow runs a
      // whole transaction), so the athlete still watched the box land on its
      // OLD day and then jump. Now the DROP VERDICT decides (`finishDrop`):
      // a dispatched move HOLDS the box at the drop point until the flow
      // ends — the re-derived week unmounts it onto its new day, or
      // `settleNonce` sends it home when nothing changed. Only a gesture
      // that ended with NO drop (touch cancelled before `onEnd`) returns
      // here, because nobody else will.
      lifted.value = 0;
      if (!dropDecided.value) {
        dx.value = withTiming(0, { duration: 180 });
        dy.value = withTiming(0, { duration: 180 });
        runOnJS(onDragFinish)();
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: snapped.value ? snapX.value : dx.value },
      { translateY: snapped.value ? snapY.value : dy.value },
      { scale: lifted.value ? 1.03 : 1 },
    ] as never,
    opacity: 1,
    backgroundColor: lifted.value
      ? '#171A12'
      : box.kind === 'team_training'
        ? 'rgba(103,215,255,0.07)'
        : 'rgba(255,255,255,0.04)',
    borderWidth: lifted.value ? 1.5 : StyleSheet.hairlineWidth,
    borderColor: lifted.value
      ? colors.text.accent
      : box.kind === 'team_training'
        ? 'rgba(103,215,255,0.20)'
        : 'rgba(255,255,255,0.08)',
    shadowColor: lifted.value ? colors.text.accent : '#000000',
    shadowOpacity: lifted.value ? 0.24 : 0,
    shadowRadius: lifted.value ? 14 : 0,
    shadowOffset: { width: 0, height: lifted.value ? 7 : 0 },
    zIndex: lifted.value ? 20 : 0,
    elevation: lifted.value ? 8 : 0,
  }));

  const content = (
    <Animated.View
      style={[
        styles.box,
        box.kind === 'team_training' && styles.teamBox,
        dropState === 'ready' && styles.dropTargetReady,
        dropState === 'blocked' && styles.dropTargetBlocked,
        dragStyle,
      ]}
      testID={`week-board-box-${date}-${box.kind}`}
      onLayout={onLayout}
    >
      <Text style={styles.boxLabel} numberOfLines={2}>{box.label}</Text>
      <Pressable
        onPress={() => onRemove(date, box)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${box.label ?? 'this session'} on ${date}`}
        testID={`week-board-remove-${date}-${box.kind}`}
        hitSlop={8}
        style={({ pressed }) => [styles.binButton, pressed && { opacity: 0.6 }]}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={15} color="#FF7A85" />
      </Pressable>
    </Animated.View>
  );

  return <GestureDetector gesture={pan}>{content}</GestureDetector>;
}

const styles = StyleSheet.create({
  board: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  lockedRow: {
    backgroundColor: 'rgba(190,255,0,0.025)',
    borderRadius: 14,
  },
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
  weekday: {
    color: colors.text.tertiary, fontSize: 11, lineHeight: 14,
    fontWeight: '700', letterSpacing: 0.6,
  },
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
  dropTargetReady: {
    borderWidth: 1.5,
    borderColor: colors.text.accent,
    backgroundColor: 'rgba(190,255,0,0.10)',
  },
  dropTargetBlocked: {
    borderWidth: 1.5,
    borderColor: '#FF7A85',
    backgroundColor: 'rgba(255,122,133,0.08)',
  },
  boxPressed: { opacity: 0.6 },
  boxLabel: { flex: 1, color: colors.text.primary, fontSize: 13, fontWeight: '600' },
  binButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
});
