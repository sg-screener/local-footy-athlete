import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { AppTextInput } from './keyboard/AppTextInput';
import { DiscreteSlider } from './DiscreteSlider';
import { TRACKED_LIFTS, type LastSetEstimateInput } from '../rules/estimatedOneRepMax';
import { colors } from '../theme/colors';

function NumberAnswer({ value, onChange, label, testID }: {
  value: number | null; onChange: (value: number | null) => void; label: string; testID: string;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  return <View style={styles.field}>
    <Text variant="caption">{label}</Text>
    <AppTextInput testID={testID} accessibilityLabel={label} value={text}
      keyboardType="decimal-pad" placeholder="—" style={styles.input}
      onChangeText={(next) => {
        setText(next);
        const parsed = next.trim() === '' ? NaN : Number(next);
        onChange(Number.isFinite(parsed) ? parsed : null);
      }} />
  </View>;
}

/** One optional question inside the existing session feedback/save flow. */
export function LastSetRirQuestion({ input, onChange }: {
  input: LastSetEstimateInput; onChange: (input: LastSetEstimateInput) => void;
}) {
  const id = `last-set-${input.liftId}`;
  const update = (patch: Partial<LastSetEstimateInput>) => onChange({ ...input, ...patch });
  const nonDominant = input.liftId === 'bulgarian_split_squat';
  const pullUp = input.liftId === 'pull_up';
  return <View style={styles.card} testID={id}>
    <View style={styles.heading}>
      <Text variant="bodySmallEmphasis" style={styles.title}>{TRACKED_LIFTS[input.liftId].label}</Text>
      <Pressable testID={`${id}-skip`} accessibilityRole="button"
        accessibilityLabel={`${input.skipped ? 'Undo skip' : 'Skip'} ${TRACKED_LIFTS[input.liftId].label}`}
        style={styles.skip} onPress={() => update({ skipped: !input.skipped, rir: null })}>
        <Text variant="caption">{input.skipped ? 'Undo skip' : 'Skip'}</Text>
      </Pressable>
    </View>
    {input.skipped ? <Text variant="caption">Skipped · no new estimate</Text> : <>
      <Text variant="caption">{nonDominant
        ? 'Non-dominant leg · last completed working set'
        : 'Last completed working set'}</Text>
      <Text variant="bodySmallEmphasis" testID={`${id}-summary`}>
        {input.actualWeightKg === null || input.actualReps === null
          ? 'Enter the weight and reps you actually completed.'
          : `Last set: ${pullUp ? '+' : ''}${input.actualWeightKg} kg × ${input.actualReps} reps${nonDominant ? ' · non-dominant leg' : ''}`}
      </Text>
      {nonDominant ? <Text variant="caption">Reps for this leg only. Add both dumbbells together for total weight.</Text> : null}
      <View style={styles.row}>
        <NumberAnswer testID={`${id}-weight`} label={pullUp ? 'Added weight (kg)' : 'Total weight (kg)'}
          value={input.actualWeightKg} onChange={(actualWeightKg) => update({ actualWeightKg })} />
        <NumberAnswer testID={`${id}-reps`} label={nonDominant ? 'Reps · non-dominant leg' : 'Completed reps'}
          value={input.actualReps} onChange={(actualReps) => update({ actualReps })} />
      </View>
      {pullUp ? <NumberAnswer testID={`${id}-bodyweight`} label="Bodyweight for this session (kg)"
        value={input.bodyWeightKg ?? null} onChange={(bodyWeightKg) => update({ bodyWeightKg })} /> : null}
      <Text variant="caption">{input.liftId === 'lat_pulldown'
        ? 'Machine / handle setup (needed for an estimate)' : 'Setup / technique (optional)'}</Text>
      <AppTextInput testID={`${id}-setup`} value={input.setup} style={styles.input}
        placeholder={input.liftId === 'lat_pulldown' ? 'e.g. Gym A · cable station · wide handle' : 'Note a different setup here'}
        onChangeText={(setup) => update({ setup })} />
      <Text variant="bodySmallEmphasis">How many more clean reps could you have done?</Text>
      <DiscreteSlider testID={`${id}-rir`} min={0} max={5}
        value={input.rir === '5+' ? 5 : input.rir}
        onChange={(value) => update({ rir: value === 5 ? '5+' : value as 0 | 1 | 2 | 3 | 4 })}
        formatReadout={(value) => value === null ? 'Unanswered' : `${value === 5 ? '5+' : value} more clean reps`}
        showStepLabels formatStepLabel={(value) => value === 5 ? '5+' : String(value)} />
      <Text variant="caption">Estimated 1RM is approximate. Earlier sets and fatigue can affect it.</Text>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { marginVertical: 12, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  skip: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 6 },
  input: { color: colors.text.primary, backgroundColor: colors.surface.secondary,
    borderRadius: 8, padding: 12, minHeight: 44 },
});
