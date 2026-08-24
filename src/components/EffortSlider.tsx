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
import React from 'react';
import type { ViewStyle } from 'react-native';
import { DiscreteSlider } from './DiscreteSlider';
import { EFFORT_MAX, EFFORT_MIN, effortReadout } from '../rules/effortScale';

interface EffortSliderProps {
  /** The athlete's rating, or null when they have not answered yet. */
  value: number | null;
  onChange: (rating: number) => void;
  /** Root testID; the thumb and readout derive theirs from it. */
  testID: string;
  style?: ViewStyle;
}

export function EffortSlider({ value, onChange, testID, style }: EffortSliderProps): React.ReactElement {
  return (
    <DiscreteSlider
      value={value}
      onChange={onChange}
      testID={testID}
      min={EFFORT_MIN}
      max={EFFORT_MAX}
      formatReadout={effortReadout}
      style={style}
    />
  );
}
