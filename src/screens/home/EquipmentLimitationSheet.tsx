import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/Text';
import { Sheet } from '../../components/ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ExplorerRenderWitness } from '../../components/ExplorerRenderWitness';
import {
  TEMPORARY_EQUIPMENT_PRESETS,
  type TemporaryEquipmentPresetId,
} from '../../utils/equipmentAvailability';
import { explorerTestId } from '../../utils/stableTestId';

interface EquipmentLimitationSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (presetId: TemporaryEquipmentPresetId) => void | Promise<void>;
  activeFactId?: string | null;
}

export function EquipmentLimitationSheet({
  visible,
  onClose,
  onApply,
  activeFactId,
}: EquipmentLimitationSheetProps) {
  const presets = activeFactId
    ? TEMPORARY_EQUIPMENT_PRESETS
    : TEMPORARY_EQUIPMENT_PRESETS.filter((preset) => !preset.clearsActiveEquipment);
  return (
    <Sheet visible={visible} onClose={onClose} testID="home-equipment-limitation-sheet">
      <View>
        <Text style={styles.title}>Limited equipment this week</Text>
        <Text style={styles.body}>
          {activeFactId
            ? 'Your current restriction is active. Choose another setup or clear it.'
            : 'Pick the closest temporary setup.'}
        </Text>
        {activeFactId ? (
          <ExplorerRenderWitness testID={explorerTestId.equipmentActive(activeFactId)} />
        ) : null}
        {presets.map((preset) => (
          <EquipmentOption
            key={preset.id}
            label={preset.label}
            sub={preset.sub}
            testID={activeFactId
              ? preset.clearsActiveEquipment
                ? explorerTestId.equipmentClear(activeFactId)
                : explorerTestId.equipmentUpdate(activeFactId, preset.id)
              : explorerTestId.equipmentOption(preset.id)}
            onPress={() => onApply(preset.id)}
          />
        ))}
      </View>
    </Sheet>
  );
}

function EquipmentOption({
  label,
  sub,
  testID,
  onPress,
}: {
  label: string;
  sub: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={testID}
      style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      <Text style={styles.optionSub} numberOfLines={2}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  optionSub: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
