import React from 'react';
import Svg, { Path } from 'react-native-svg';

const WORDMARK_WIDTH = 871;
const WORDMARK_HEIGHT = 314;

export interface LfaWordmarkProps {
  width?: number;
  color?: string;
  testID?: string;
}

/**
 * The supplied LFA wordmark, kept as one vector owner for every app surface.
 * White is the dark-app default; a caller may pass black for a future light
 * surface without introducing a second set of paths.
 */
export function LfaWordmark({
  width = 64,
  color = '#FFFFFF',
  testID = 'lfa-wordmark',
}: LfaWordmarkProps) {
  return (
    <Svg
      width={width}
      height={(width * WORDMARK_HEIGHT) / WORDMARK_WIDTH}
      viewBox="0 0 871 314"
      fill="none"
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel="LFA"
    >
      <Path
        d="M869 314.121H772.5L769.297 301.812L760.41 267.906H631.5L741 188.621L722.015 92.2275L585 314.121H503L699.001 0H778.5L869 314.121Z"
        fill={color}
      />
      <Path
        d="M588 69.6641H396.366L384 133.621H550.5L504.5 202.621H369L344.5 314.121H263L331.91 0H638L588 69.6641Z"
        fill={color}
      />
      <Path
        d="M100.5 242.621H240.5L225.5 314.121H0L62.5 0H149L100.5 242.621Z"
        fill={color}
      />
    </Svg>
  );
}
