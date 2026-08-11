import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '../../components/common/Text';
import { Button, Sheet } from '../../components/ui';
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
  const [missing, setMissing] = React.useState<ReadonlySet<SessionEquipmentRequirementKey>>(
    () => new Set(),
  );

  React.useEffect(() => {
    if (visible) setMissing(new Set());
  }, [visible]);

  const toggle = (key: SessionEquipmentRequirementKey) => {
    setMissing((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      testID="session-equipment-sheet"
      flexibleBody
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Equipment for this session</Text>
        <Text style={styles.body}>
          Untick anything you don’t have today. We’ll replace affected exercises using equipment you still have.
        </Text>

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
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.md },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  body: {
    color: '#A0A0A0',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
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
