/**
 * THE EFFORT SLIDER — Sam, 2026-08-12.
 *
 * > *"change the effort input from buttons to a slider. It must start empty,
 * >  not on 5 — an untouched form must not look like a real answer. Show the
 * >  word beside the number as it moves: 7 — hard."*
 *
 * WHY A SLIDER REPLACED THE CHIPS, and it is a consequence of the same day's
 * other ruling. Widening the scale to 1-10 turned three `fillRow` chip rows
 * into TEN chips on one non-wrapping row — an unusable tap target on a phone.
 * The chips were fine at five and are wrong at ten.
 *
 * NO NEW DEPENDENCY. `@react-native-community/slider` is not in this tree, and
 * adding a native module would need a rebuild Sam cannot do right now
 * (stand-down C). This is `PanResponder` over a measured track — pure JS, works
 * on the existing binary.
 *
 * EMPTY IS A REAL STATE, NOT ZERO. `value === null` renders no thumb, no filled
 * track and no number — just the prompt. That is the whole of Sam's second
 * sentence: a form nobody has touched must not read as an answer, and a slider
 * parked at 5 with "5 — steady" beside it is exactly that lie. It follows that
 * the athlete must be able to TOUCH the track to answer, since there is no
 * thumb to drag yet — a tap anywhere on the track commits that value.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
// THE SHARED TYPE OWNER, never `react-native`'s `Text` — `test:prototype-typography`
// fails any athlete-facing component that imports the raw one, because the
// shared owner resolves the caller's size and applies the line-box guard last.
// It caught this file on its first sweep.
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { EFFORT_MAX, EFFORT_MIN, effortReadout } from '../rules/effortScale';

interface EffortSliderProps {
  /** The athlete's rating, or null when they have not answered yet. */
  value: number | null;
  onChange: (rating: number) => void;
  /** Root testID; the thumb and readout derive theirs from it. */
  testID: string;
  style?: ViewStyle;
}

const STEPS = EFFORT_MAX - EFFORT_MIN;

export function EffortSlider({ value, onChange, testID, style }: EffortSliderProps): React.ReactElement {
  const [trackWidth, setTrackWidth] = useState(0);
  // Read inside the responder, which is created once — state would be stale.
  const widthRef = useRef(0);
  const lastEmitted = useRef<number | null>(value);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    widthRef.current = width;
    setTrackWidth(width);
  }, []);

  /**
   * A touch anywhere on the track becomes a rating. Rounded, never truncated:
   * truncating makes the top value reachable only at the exact right edge, so
   * `10` would be almost impossible to select with a thumb.
   */
  const commitFromTouch = useCallback((locationX: number) => {
    const width = widthRef.current;
    if (width <= 0) return;
    const ratio = Math.min(1, Math.max(0, locationX / width));
    const rating = EFFORT_MIN + Math.round(ratio * STEPS);
    if (lastEmitted.current === rating) return;
    lastEmitted.current = rating;
    onChange(rating);
  }, [onChange]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => commitFromTouch(event.nativeEvent.locationX),
      onPanResponderMove: (event) => commitFromTouch(event.nativeEvent.locationX),
    }),
  ).current;

  const filledRatio = value === null ? 0 : (value - EFFORT_MIN) / STEPS;
  const thumbLeft = trackWidth > 0 ? filledRatio * trackWidth : 0;

  return (
    <View style={style}>
      <Text
        testID={`${testID}-readout`}
        style={[styles.readout, value === null && styles.readoutEmpty]}
      >
        {effortReadout(value)}
      </Text>
      <View
        testID={testID}
        style={styles.track}
        onLayout={onLayout}
        {...responder.panHandlers}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { width: thumbLeft }]} />
        {/* NO THUMB WHILE UNANSWERED — see the header. */}
        {value !== null ? (
          <View
            testID={`${testID}-thumb`}
            style={[styles.thumb, { left: thumbLeft - THUMB_SIZE / 2 }]}
          />
        ) : null}
      </View>
    </View>
  );
}

const THUMB_SIZE = 28;

const styles = StyleSheet.create({
  /* ── THE READOUT SITS AT THE QUESTION'S SIZE — Sam, 2026-08-22 ──
     *"that slide to rate looks out of place - make it smaller or something - to
     match the side of the 'how hard was the game' size"*.
     It was 16pt under an 11pt `SectionLabel`, so the PROMPT was half the size
     of the hint below it and the un-answered state read as a heading of its
     own. 11pt is the section label's own size, to the point; the answered state
     keeps the primary colour and gains the weight, so the value still reads as
     the answer rather than as another label. */
  readout: {
    color: colors.text.primary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  readoutEmpty: {
    color: colors.text.secondary,
    fontWeight: '400',
    letterSpacing: 1.2,
  },
  track: {
    height: THUMB_SIZE,
    justifyContent: 'center',
    // The touch surface is the full row height; the visible rail is drawn by
    // the children, so a near-miss above or below the rail still answers.
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.disabled,
  },
  fill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.lime,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.accent.lime,
  },
});
