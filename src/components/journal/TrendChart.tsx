import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../common/Text';

/**
 * ONE STORY, ONE CHART — Sam's "no chart walls" guard, made structural.
 *
 * ── WHY `react-native-svg` AND NOT A CHART LIBRARY ──
 *
 * Measured before choosing: `victory-native` and `@shopify/react-native-skia` are
 * both dependencies and are **imported nowhere in `src/`**, so neither is proven
 * on the build Sam runs. `react-native-svg` IS proven — `AppNavigator`,
 * `PlanChangeSheet` and `GuidedInjuryFlowSheet` all render it today.
 *
 * Reaching for an unproven native module to draw a line between six points would
 * put a device-rebuild risk between the athlete and a chart, and would bring
 * axis/legend/theme defaults that fight the design language every other surface
 * here was hand-built to. If a later chart needs something genuinely hard,
 * `victory-native` is still there — adopted with a reason rather than by default.
 *
 * ── THIS COMPONENT CANNOT DRAW A DISHONEST CHART ──
 *
 * It takes points and nothing else: no threshold, no target, no band. Sam's
 * "never one floating dot" rule is enforced UPSTREAM — `rules/journalMonth.ts`
 * returns null until a series has enough points — so a caller cannot hand this a
 * single dot because it is never given one. The guard lives where it cannot be
 * forgotten rather than where it must be remembered.
 *
 * NO AXES, NO GRIDLINES, NO NUMBERS ON THE PLOT. The design's whole register is
 * calm; a chart that needs a legend is telling more than one story. The shape is
 * the story, and the words beside it are copy.
 */

export interface TrendChartPoint {
  readonly weekStart: string;
  readonly value: number;
}

const CHART_HEIGHT = 64;
const DOT_RADIUS = 2.5;

/**
 * Points scaled into the box.
 *
 * A FLAT SERIES SITS IN THE MIDDLE RATHER THAN AT THE BOTTOM. When every value
 * is identical the range is zero, and dividing by it would put the line on the
 * floor — which reads as "you collapsed" for an athlete who was perfectly
 * consistent. Mid-height is the honest picture of no change.
 */
function scale(values: readonly number[], height: number): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => height / 2);
  // SVG y grows downward, so a bigger value must sit HIGHER — hence the flip.
  return values.map((value) => height - ((value - min) / range) * height);
}

export function TrendChart({
  points,
  label,
  testID,
}: {
  points: readonly TrendChartPoint[];
  label: string;
  testID?: string;
}) {
  // Defensive rather than decorative: the upstream guard means this should be
  // unreachable, and rendering nothing is still better than dividing by zero if
  // it ever is reached.
  if (points.length < 2) return null;

  const width = 100;
  const values = points.map((point) => point.value);
  const ys = scale(values, CHART_HEIGHT - DOT_RADIUS * 2);
  const step = width / (points.length - 1);
  const coords = ys.map((y, index) => ({ x: index * step, y: y + DOT_RADIUS }));

  return (
    <View style={styles.wrap} testID={testID}>
      <Text variant="bodySmall" style={styles.label}>{label}</Text>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`}>
        <Polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          stroke={colors.text.accent}
          strokeWidth={1.5}
        />
        {/*
          THE LAST POINT IS THE ONLY ONE MARKED. Dotting every week turns a shape
          into a table and invites the athlete to read values off a chart that
          deliberately carries no axis.
        */}
        <Circle
          cx={coords[coords.length - 1].x}
          cy={coords[coords.length - 1].y}
          r={DOT_RADIUS}
          fill={colors.text.accent}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  label: { color: colors.text.secondary },
});
