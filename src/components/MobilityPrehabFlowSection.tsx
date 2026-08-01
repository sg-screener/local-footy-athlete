import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { MobilityPrehabFlow } from '../utils/mobilityPrehabFlow';
import type { PoolExercise } from '../data/exercisePools';

interface MobilityPrehabFlowSectionProps {
  flow: MobilityPrehabFlow | null;
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
 * ## The tick is cosmetic, and that is a hard rule
 *
 * §6 item 9: a soft checkmark for the athlete's own sense of having done it —
 * never logged, never persisted beyond the session view, never synced, never
 * gating Finish Session. It is therefore plain component state, and the label
 * says so out loud rather than letting the athlete assume it counted for
 * something. `mobilityPrehabFlowTests` §6 fails if this component ever reaches
 * for a store.
 */
export function MobilityPrehabFlowSection({ flow }: MobilityPrehabFlowSectionProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [done, setDone] = React.useState(false);

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
            Mobility &amp; Prehab{done ? ' ✓' : ''}
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
        <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
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
              name={exercise.name}
              dose={movementDose(exercise)}
            />
          ))}

          <Pressable
            onPress={() => setDone((prev) => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel="Mark the mobility and prehab flow as done"
            style={({ pressed }) => [styles.doneRow, pressed && { opacity: 0.7 }]}
            testID="mobility-prehab-flow-done"
          >
            <View style={[styles.tick, done && styles.tickChecked]}>
              {done ? <Text style={styles.tickMark}>✓</Text> : null}
            </View>
            <Text style={styles.doneLabel}>
              {done ? 'Done — nothing is logged' : 'Mark as done'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function MovementRow({ name, dose }: { name: string; dose: string }) {
  return (
    <View style={styles.movementRow}>
      <Text style={styles.movementName}>{name}</Text>
      <Text style={styles.movementDose}>{dose}</Text>
    </View>
  );
}

function range(min: number | undefined, max: number | undefined): string {
  const low = Number(min ?? 0);
  const high = Number(max ?? low);
  return low === high ? `${low}` : `${low}-${high}`;
}

/** The pool entry's OWN dose, rendered. Nothing here chooses a number. */
function movementDose(movement: PoolExercise): string {
  const sets = movement.sets > 1 ? `${movement.sets} × ` : '';
  const side = movement.perSide ? ' / side' : '';
  const unit = movement.prescriptionType === 'duration' ? 's' : '';
  return `${sets}${range(movement.repsMin, movement.repsMax)}${unit}${side}`;
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
  chevron: { color: '#7A7A7A', fontSize: 20, fontWeight: '400' },

  body: { paddingBottom: spacing.md, gap: 6 },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  movementName: { flex: 1, color: '#D0D0D0', fontSize: 14, fontWeight: '500' },
  movementDose: { color: '#7A7A7A', fontSize: 13, fontWeight: '600' },

  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  // Deliberately not the lime CTA treatment — this action has no consequence,
  // so it must not borrow the visual weight of one that does.
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
  doneLabel: { color: '#7A7A7A', fontSize: 13, fontWeight: '600' },
});
