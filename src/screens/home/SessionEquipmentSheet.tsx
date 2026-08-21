/**
 * EQUIPMENT — the dated temporary fact, asked once for the open session.
 *
 * R-123: the sheet chrome (open/close, safe area, title, scrolling, Back,
 * Cancel, reset-on-close, height) belongs to `SessionActionSheet`. What is left
 * here is the one question this action asks and what its answer does — which is
 * all this file ever had that was Equipment's.
 *
 * ⚠ **THE TICK SET NO LONGER RESETS ITSELF.** It used to, in a
 * `useEffect(…, [visible])` of its own — and that effect was load-bearing,
 * because RN's `Modal` keeps its children mounted through the whole dismiss
 * animation on iOS (`_shouldShowModal` ORs `visible` with `state.isRendered`)
 * and only drops them when `onDismiss` lands. Whether a reopen saw fresh state
 * therefore depended on animation timing, and each of the three sheets had made
 * its own arrangement about it. The shell keys the body by an epoch it mints on
 * every open, so the remount is deterministic and there is one rule instead of
 * three.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '../../components/common/Text';
import { Button, SheetDescription } from '../../components/ui';
import {
  SessionActionSheet,
  useSessionActionStep,
} from '../../components/SessionActionSheet';
import { spacing, borderRadius } from '../../theme/spacing';
import { equipmentIconFor } from './EquipmentLimitationSheet';
import type {
  SessionEquipmentRequirement,
  SessionEquipmentRequirementKey,
} from '../../utils/sessionEquipment';

interface SessionEquipmentSheetProps {
  visible: boolean;
  requirements: readonly SessionEquipmentRequirement[];
  onClose: () => void;
  onApply: (missing: ReadonlySet<SessionEquipmentRequirementKey>) => void;
}

export function SessionEquipmentSheet({
  visible,
  requirements,
  onClose,
  onApply,
}: SessionEquipmentSheetProps) {
  return (
    <SessionActionSheet
      visible={visible}
      onClose={onClose}
      testID="session-equipment-sheet"
    >
      <SessionEquipmentBody
        requirements={requirements}
        onClose={onClose}
        onApply={onApply}
      />
    </SessionActionSheet>
  );
}

/** THE ONE QUESTION. Equipment has a single step, so it declares no `onBack`. */
function SessionEquipmentBody({
  requirements,
  onClose,
  onApply,
}: Omit<SessionEquipmentSheetProps, 'visible'>) {
  const [missing, setMissing] = React.useState<ReadonlySet<SessionEquipmentRequirementKey>>(
    () => new Set(),
  );

  useSessionActionStep({
    key: 'equipment',
    eyebrow: 'Equipment',
    title: 'What are you missing?',
  });

  const toggle = (key: SessionEquipmentRequirementKey) => {
    setMissing((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <SheetDescription>
        Untick anything you don’t have today. We’ll replace affected exercises using equipment you still have.
      </SheetDescription>
      <View style={styles.list}>
        {requirements.map((requirement) => {
          const available = !missing.has(requirement.key);
          return (
            <Pressable
              key={requirement.key}
              onPress={() => toggle(requirement.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: available }}
              accessibilityLabel={`${requirement.label}: ${available ? 'available' : 'unavailable'}`}
              testID={`session-equipment-option-${requirement.key.replace(':', '-')}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.icon, !available && styles.iconMissing]}>
                {equipmentIconFor(requirement.value as any, available ? '#C8FF00' : '#666666')}
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.label, !available && styles.missingText]}>
                  {requirement.label}
                </Text>
                <Text style={styles.exerciseNames} numberOfLines={2}>
                  {requirement.exerciseNames.join(', ')}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={available ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                size={22}
                color={available ? '#C8FF00' : '#666666'}
              />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.profileNote}>
        Permanent change? Update your equipment in Profile.
      </Text>
      <Button
        label={missing.size > 0 ? 'Replace unavailable equipment' : 'Done'}
        size="lg"
        onPress={() => missing.size > 0 ? onApply(missing) : onClose()}
        testID="session-equipment-apply"
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    minHeight: 64,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#343434',
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.72 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  iconMissing: { backgroundColor: '#202020' },
  rowCopy: { flex: 1, marginHorizontal: spacing.md },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  missingText: { color: '#777777' },
  exerciseNames: { color: '#777777', fontSize: 13, lineHeight: 18, marginTop: 2 },
  profileNote: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
