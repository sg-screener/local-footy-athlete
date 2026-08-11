import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
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
 * The collapsed "Mobility & Prehab" flow that sits at the top of the session.
 *
 * ## Why it looks quieter than everything below it
 *
 * The list under this is what the athlete was PRESCRIBED. This is what they may
 * do. Sam's ruling (§6 item 6) is that the flow is never load-bearing — the
 * product assumes it gets skipped — so it must not read as a first task that
 * has to be cleared before the session starts. It gets one hairline-ruled line
 * and no fill: available at a glance, silent if ignored, and visibly not a row
 * in the list it sits above.
 *
 * Each movement now reports through the session's controlled execution owner.
 * This component still owns only disclosure; it cannot save feedback or infer
 * session completion by itself.
 */
export function MobilityPrehabFlowSection({
  flow,
  completedItemIds,
  onToggleItem,
}: MobilityPrehabFlowSectionProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (!flow) return null;

  return (
    <View style={styles.section} testID="mobility-prehab-flow">
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Mobility and prehab flow, ${flow.movementCount} movements, optional`}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.7 }]}
        testID="mobility-prehab-flow-toggle"
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>
            Mobility / Warm-up
          </Text>
          {/*
            NO MINUTES CLAIM ANY MORE. The duration came from a pre-built bundle
            that no longer exists; a composed flow's length varies with the
            athlete's equipment (it SHRINKS rather than padding), so a promised
            "~N min" would be a signed sentence that can lie — the same argument
            Sam accepted for the Mobility door's description.

            PROPOSED, NOT SIGNED. Recorded in
            docs/COPY_SHEET_RULINGS_2026-07-30.md alongside batch 5c.
          */}
          <Text style={styles.summary}>
            {flow.movementCount} movements · optional
          </Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.text.tertiary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {/*
            ONE LIST. It used to be a bundle's name, the bundle's movements, and a
            "Primer" group of hand-mapped prehab picks. The bundles are retired and
            the primers went with them — D17's menus carry authored prehab slots —
            so what is left is Sam's movements at Sam's doses.
          */}
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
      ) : null}
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
  // One hairline above and below, nothing else. The rules are the only place
  // on this screen that draws a boundary — which is exactly the point: this
  // sits outside the list rather than at the top of it.
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  title: { color: '#D0D0D0', fontSize: 15, fontWeight: '700' },
  summary: { color: '#7A7A7A', fontSize: 12, fontWeight: '500' },
  body: { paddingBottom: spacing.md, gap: 6 },
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#5A5A5A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickChecked: { borderColor: colors.accent.lime },
  tickMark: { color: colors.accent.lime, fontSize: 11, fontWeight: '800' },
});
