import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { DiscreteSlider } from './DiscreteSlider';
import { TRACKED_LIFTS, type LastSetEstimateInput } from '../rules/estimatedOneRepMax';

/** One optional question inside the existing session feedback/save flow. */
export function LastSetRirQuestion({ input, onChange }: {
  input: LastSetEstimateInput; onChange: (input: LastSetEstimateInput) => void;
}) {
  const id = `last-set-${input.liftId}`;
  const update = (patch: Partial<LastSetEstimateInput>) => onChange({ ...input, ...patch });
  return <View style={styles.card} testID={id}>
    <Text variant="bodySmallEmphasis">{TRACKED_LIFTS[input.liftId].label}</Text>
    <Text variant="bodySmallEmphasis">How many more clean reps could you have done on your last set?</Text>
    <DiscreteSlider testID={`${id}-rir`} min={0} max={5}
      value={input.rir === '5+' ? 5 : input.rir}
      onChange={(value) => update({
        rir: value === 5 ? '5+' : value as 0 | 1 | 2 | 3 | 4,
        skipped: false,
      })}
      showReadout={false}
      showStepLabels formatStepLabel={(value) => value === 5 ? '5+' : String(value)} />
  </View>;
}

const styles = StyleSheet.create({
  card: { marginVertical: 12, gap: 10 },
});
