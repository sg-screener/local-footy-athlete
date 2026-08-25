import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';

interface DiscreteSliderProps {
  value: number | null;
  onChange: (value: number) => void;
  testID: string;
  min: number;
  max: number;
  formatReadout?: (value: number | null) => string;
  showReadout?: boolean;
  showStepLabels?: boolean;
  style?: StyleProp<ViewStyle>;
}

const THUMB_SIZE = 28;

/** One shared touch-to-step slider for effort scales and bounded number answers. */
export function DiscreteSlider({
  value,
  onChange,
  testID,
  min,
  max,
  formatReadout,
  showReadout = true,
  showStepLabels = false,
  style,
}: DiscreteSliderProps): React.ReactElement {
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);
  const lastEmitted = useRef<number | null>(value);
  const steps = max - min;

  useEffect(() => {
    lastEmitted.current = value;
  }, [value]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    widthRef.current = width;
    setTrackWidth(width);
  }, []);

  const commitFromTouch = useCallback((locationX: number) => {
    const width = widthRef.current;
    if (width <= 0 || steps <= 0) return;
    const ratio = Math.min(1, Math.max(0, locationX / width));
    const nextValue = min + Math.round(ratio * steps);
    if (lastEmitted.current === nextValue) return;
    lastEmitted.current = nextValue;
    onChange(nextValue);
  }, [min, onChange, steps]);

  /* ── THE TWO GLITCHES (Sam, 2026-08-26: the feedback continuums) ──────────
   *
   * 1. `locationX` is relative to WHICHEVER child the finger is over. The
   *    track renders a rail, a fill and an absolutely-positioned thumb; the
   *    moment a drag crossed the thumb, `locationX` became thumb-relative
   *    (≈0-28), the value teleported toward `min`, the thumb jumped away from
   *    the finger, and the next event snapped it back — the visible stutter.
   *    The visual children are now `pointerEvents="none"`, so the track is
   *    the only event target and `locationX` keeps one meaning.
   * 2. The responder never HELD the gesture: the scrolling sheet under the
   *    form could take the responder mid-drag (default termination-request
   *    is yes), freezing the thumb mid-slide. Once granted, the drag is held.
   */
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => commitFromTouch(event.nativeEvent.locationX),
    onPanResponderMove: (event) => commitFromTouch(event.nativeEvent.locationX),
  }), [commitFromTouch]);

  const filledRatio = value === null || steps <= 0 ? 0 : (value - min) / steps;
  const thumbLeft = trackWidth > 0 ? filledRatio * trackWidth : 0;
  const labels = useMemo(
    () => Array.from({ length: Math.max(0, steps + 1) }, (_, index) => min + index),
    [min, steps],
  );

  return (
    <View style={style}>
      {showReadout && formatReadout ? (
        <Text
          testID={`${testID}-readout`}
          style={[styles.readout, value === null && styles.readoutEmpty]}
        >
          {formatReadout(value)}
        </Text>
      ) : null}
      <View
        testID={testID}
        style={[styles.track, showStepLabels && styles.trackWithLabels]}
        onLayout={onLayout}
        {...responder.panHandlers}
      >
        <View pointerEvents="none" style={styles.rail} />
        <View pointerEvents="none" style={[styles.fill, { width: thumbLeft }]} />
        {value !== null ? (
          <View
            testID={`${testID}-thumb`}
            pointerEvents="none"
            style={[styles.thumb, { left: thumbLeft - THUMB_SIZE / 2 }]}
          />
        ) : null}
      </View>
      {showStepLabels ? (
        <View style={styles.stepLabels}>
          {labels.map((label) => (
            <Text
              key={label}
              testID={`${testID}-step-${label}`}
              style={[styles.stepLabel, value === label && styles.stepLabelSelected]}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  trackWithLabels: {
    marginHorizontal: 8,
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
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepLabel: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 16,
  },
  stepLabelSelected: {
    color: colors.accent.lime,
    fontWeight: '800',
  },
});
