import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/Text';
import { Sheet } from '../../components/ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ExplorerRenderWitness } from '../../components/ExplorerRenderWitness';
import type { EquipmentTag } from '../../data/exercisePools';
import type { ConditioningEquipmentModality } from '../../types/domain';
import {
  CONDITIONING_MODALITY_LABELS,
  EQUIPMENT_TAG_LABELS,
  type AskableEquipmentTag,
} from '../../rules/equipmentVocabulary';
import { ownedEquipmentKit } from '../../store/profileStore';
import { explorerTestId } from '../../utils/stableTestId';

/**
 * The athlete's this-week decision, against their OWN kit (Sam's ruling 5,
 * 2026-07-31). The seven preset setups are retired: an athlete marks which of
 * the things THEY HAVE are missing this week, or declares everything
 * available again.
 */
export type EquipmentLimitationDecision =
  | {
      kind: 'missing_this_week';
      tags: readonly EquipmentTag[];
      conditioningModalities: readonly ConditioningEquipmentModality[];
    }
  | { kind: 'available_again' };

interface EquipmentLimitationSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (decision: EquipmentLimitationDecision) => void | Promise<void>;
  activeFactId?: string | null;
  targetFactId?: string | null;
}

export function EquipmentLimitationSheet({
  visible,
  onClose,
  onApply,
  activeFactId,
  targetFactId,
}: EquipmentLimitationSheetProps) {
  // Read once per open: the sheet lists the athlete's baseline kit, which a
  // mid-sheet store change cannot legitimately alter.
  const kit = useMemo(() => ownedEquipmentKit(), [visible]);
  const [missingTags, setMissingTags] = useState<ReadonlySet<EquipmentTag>>(new Set());
  const [missingModalities, setMissingModalities] =
    useState<ReadonlySet<ConditioningEquipmentModality>>(new Set());

  const toggleTag = (tag: EquipmentTag) => {
    setMissingTags((previous) => {
      const next = new Set(previous);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };
  const toggleModality = (modality: ConditioningEquipmentModality) => {
    setMissingModalities((previous) => {
      const next = new Set(previous);
      if (next.has(modality)) next.delete(modality); else next.add(modality);
      return next;
    });
  };

  const nothingMarked = missingTags.size === 0 && missingModalities.size === 0;
  const apply = () => {
    if (nothingMarked) return;
    void onApply({
      kind: 'missing_this_week',
      tags: [...missingTags],
      conditioningModalities: [...missingModalities],
    });
    setMissingTags(new Set());
    setMissingModalities(new Set());
  };

  const labelFor = (item: EquipmentTag | ConditioningEquipmentModality): string =>
    (EQUIPMENT_TAG_LABELS as Record<string, string>)[item] ??
    (CONDITIONING_MODALITY_LABELS as Record<string, string>)[item] ??
    item;

  const optionTestId = (item: string): string =>
    activeFactId
      ? explorerTestId.equipmentUpdate(activeFactId, item)
      : targetFactId
        ? explorerTestId.equipmentSet(targetFactId, item)
        : explorerTestId.equipmentOption(item);

  const kitIsEmpty = kit.tags.length === 0 && kit.conditioningModalities.length === 0;

  return (
    <Sheet visible={visible} onClose={onClose} testID="home-equipment-limitation-sheet">
      <View>
        <Text style={styles.title}>Missing equipment this week?</Text>
        <Text style={styles.body}>
          {activeFactId
            ? 'A restriction is active. Mark what is missing, or clear it below.'
            : kitIsEmpty
              ? 'Your program is already bodyweight-only, so there is nothing to mark missing.'
              : "Mark what you won't have this week. Your program works around it."}
        </Text>
        {activeFactId ? (
          <ExplorerRenderWitness testID={explorerTestId.equipmentActive(activeFactId)} />
        ) : null}

        {kit.tags.map((tag) => (
          <MissingToggle
            key={tag}
            label={EQUIPMENT_TAG_LABELS[tag as AskableEquipmentTag] ?? labelFor(tag)}
            missing={missingTags.has(tag)}
            testID={optionTestId(tag)}
            onPress={() => toggleTag(tag)}
          />
        ))}
        {kit.conditioningModalities.map((modality) => (
          <MissingToggle
            key={modality}
            label={CONDITIONING_MODALITY_LABELS[modality]}
            missing={missingModalities.has(modality)}
            testID={optionTestId(modality)}
            onPress={() => toggleModality(modality)}
          />
        ))}

        {!kitIsEmpty ? (
          <Pressable
            onPress={apply}
            disabled={nothingMarked}
            testID="home-equipment-limitation-apply"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.applyButton,
              nothingMarked && styles.applyDisabled,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.applyLabel}>
              {nothingMarked ? 'Mark what is missing' : 'Apply for this week'}
            </Text>
          </Pressable>
        ) : null}

        {activeFactId ? (
          <Pressable
            onPress={() => void onApply({ kind: 'available_again' })}
            testID={explorerTestId.equipmentClear(activeFactId)}
            accessibilityRole="button"
            accessibilityLabel={explorerTestId.equipmentClear(activeFactId)}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.optionLabel}>Equipment available again</Text>
            <Text style={styles.optionSub}>End the temporary restriction</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

function MissingToggle({
  label,
  missing,
  testID,
  onPress,
}: {
  label: string;
  missing: boolean;
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
      <View style={styles.optionRow}>
        <Text style={[styles.optionLabel, missing && styles.missingLabel]}>{label}</Text>
        <Text style={styles.optionSub}>{missing ? 'Missing this week' : ''}</Text>
      </View>
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
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  missingLabel: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  optionSub: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  applyButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
  },
  applyDisabled: {
    opacity: 0.5,
  },
  applyLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
