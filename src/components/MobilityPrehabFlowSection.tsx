import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { spacing } from '../theme/spacing';
import {
  sessionExecutionCheckbox,
  sessionExecutionCheckboxChecked,
  sessionExecutionCheckmark,
} from '../theme/sessionExecutionCheckbox';
import {
  mobilityFlowMovementDose,
  type MobilityPrehabFlow,
} from '../utils/mobilityPrehabFlow';

interface MobilityPrehabFlowSectionProps {
  flow: MobilityPrehabFlow | null;
  completedItemIds: ReadonlySet<string>;
  onToggleItem: (itemId: string) => void;
}

/**
 * The movement rows inside the shared session execution section.
 *
 * Each movement reports through the session's controlled execution owner.
 * Unticked movements are recorded as skipped, exactly like unticked Strength
 * work. Disclosure belongs to the same SessionExecutionSection used by
 * Strength and Team Training; this component owns only the row contents.
 */
export function MobilityPrehabFlowSection({
  flow,
  completedItemIds,
  onToggleItem,
}: MobilityPrehabFlowSectionProps) {
  if (!flow) return null;

  return (
    <View style={styles.body} testID="mobility-prehab-flow">
      {flow.movements.map(({ exercise }) => (
        <MovementRow
          key={`flow-movement-${exercise.id}`}
          itemId={`mobility:${exercise.id}`}
          name={exercise.name}
          dose={mobilityFlowMovementDose(exercise)}
          completed={completedItemIds.has(`mobility:${exercise.id}`)}
          onToggle={onToggleItem}
        />
      ))}
    </View>
  );
}

function MovementRow({ itemId, name, dose, completed, onToggle }: {
  itemId: string;
  name: string;
  dose: string;
  completed: boolean;
  onToggle: (itemId: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onToggle(itemId)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={`${completed ? 'Completed' : 'Mark complete'}: ${name}`}
      testID={`session-execution-check-${itemId}`}
      style={({ pressed }) => [
        styles.movementRow,
        completed && styles.movementComplete,
        pressed && { opacity: 0.65 },
      ]}
    >
      <View style={[styles.tick, completed && styles.tickChecked]}>
        {completed ? <Text style={styles.tickMark}>✓</Text> : null}
      </View>
      <Text style={styles.movementName}>{name}</Text>
      <Text style={styles.movementDose}>{dose}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: 6 },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  movementComplete: { opacity: 0.42 },
  movementName: { flex: 1, color: '#D0D0D0', fontSize: 14, fontWeight: '500' },
  movementDose: { color: '#7A7A7A', fontSize: 13, fontWeight: '600' },

  tick: {
    ...sessionExecutionCheckbox,
  },
  tickChecked: { ...sessionExecutionCheckboxChecked },
  tickMark: { ...sessionExecutionCheckmark },
});
