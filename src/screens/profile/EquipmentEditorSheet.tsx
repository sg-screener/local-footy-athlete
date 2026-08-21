import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/Text';
import { Sheet, SheetDescription, SheetHeader } from '../../components/ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type {
  ConditioningEquipmentModality,
  EquipmentAnswer,
  EquipmentPossession,
} from '../../types/domain';
import {
  CONDITIONING_MODALITY_LABELS,
  EQUIPMENT_TAG_LABELS,
  derivedConditioningModalityQuestions,
  derivedEquipmentChecklistTags,
  type AskableEquipmentTag,
} from '../../rules/equipmentVocabulary';
import { savedEquipmentAnswer } from '../../store/profileStore';
import { todayISOLocal } from '../../utils/appDate';
// SAME ICON OWNER AS THE THIS-WEEK SHEET (ruling 10) — `equipmentIconFor`
// reads the exact `EQUIPMENT_TAG_ICON` / `CONDITIONING_MODALITY_ICON` maps
// `EquipmentLimitationSheet` draws from, so the athlete's own kit looks like
// the same kit whether they are marking it missing this week or editing it
// here permanently. A second icon set for the same vocabulary would be the
// two-representations defect this equipment unit exists to delete.
import { equipmentIconFor } from '../home/EquipmentLimitationSheet';

interface EquipmentEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Commits through the owned profile+program transaction; never writes directly. */
  onSave: (answer: EquipmentAnswer) => void | Promise<void>;
  saving?: boolean;
  errorMessage?: string | null;
}

/**
 * THE PROFILE EQUIPMENT SURFACE — where NEVER lives (Sam's audit ruling 3,
 * 2026-07-31: onboarding is ticks only; permanent exclusions are edited here).
 *
 * Each item cycles: unmarked ("not today") → HAVE → NEVER → unmarked. NEVER is
 * a standing "stop offering this, permanently" (ownership sheet §2.2); for
 * capability resolution it equals unmarked — the difference is what the app
 * may ask or offer later, not what it programs. The list is DERIVED from the
 * exercise library, the same one owner as the onboarding step.
 */
const ITEM_ICON_ACCENT = '#C8FF00';
const ITEM_ICON_MUTED = '#5A5A5A';

export function EquipmentEditorSheet({
  visible,
  onClose,
  onSave,
  saving,
  errorMessage,
}: EquipmentEditorSheetProps) {
  const existing = savedEquipmentAnswer();
  const [tags, setTags] = useState<Partial<Record<AskableEquipmentTag, EquipmentPossession>>>(
    () => ({ ...(existing?.tags as Partial<Record<AskableEquipmentTag, EquipmentPossession>>) }));
  const [modalities, setModalities] = useState<
    Partial<Record<ConditioningEquipmentModality, EquipmentPossession>>
  >(() => ({ ...existing?.modalities }));

  const askableTags = derivedEquipmentChecklistTags() as AskableEquipmentTag[];
  const askableModalities = derivedConditioningModalityQuestions();

  const cycle = (current: EquipmentPossession | undefined): EquipmentPossession | undefined =>
    current === undefined ? 'have' : current === 'have' ? 'never' : undefined;

  const save = () => {
    void onSave({ tags, modalities, answeredOn: todayISOLocal() });
  };

  const renderItem = (
    key: string,
    label: string,
    possession: EquipmentPossession | undefined,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      testID={`profile-equipment-item-${key}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.itemIcon, possession === 'never' && styles.itemIconMuted]}>
        {equipmentIconFor(
          key as AskableEquipmentTag | ConditioningEquipmentModality,
          possession === 'never' ? ITEM_ICON_MUTED : ITEM_ICON_ACCENT,
        )}
      </View>
      <View style={styles.itemTextWrap}>
        <Text style={[styles.itemLabel, possession === 'never' && styles.neverLabel]}>
          {label}
        </Text>
        <Text style={styles.itemState}>
          {possession === 'have' ? 'Have it' : possession === 'never' ? 'Never' : ''}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      flexibleBody
      testID="profile-equipment-editor-sheet"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SheetHeader title="Equipment" subtitle="What do you have access to?" />
        <SheetDescription>
          Tap once for what you have. Tap again for gear you'll never use — we'll stop
          offering it. Leave the rest blank.
        </SheetDescription>
        <Text style={[styles.groupHeading, styles.firstGroupHeading]}>Gym equipment</Text>
        {askableTags.map((tag) =>
          renderItem(tag, EQUIPMENT_TAG_LABELS[tag], tags[tag], () =>
            setTags((previous) => ({ ...previous, [tag]: cycle(previous[tag]) }))))}
        <Text style={styles.groupHeading}>Cardio machines</Text>
        {askableModalities.map((modality) =>
          renderItem(modality, CONDITIONING_MODALITY_LABELS[modality], modalities[modality], () =>
            setModalities((previous) => ({
              ...previous,
              [modality]: cycle(previous[modality]),
            }))))}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        <Pressable
          onPress={save}
          disabled={!!saving}
          testID="profile-equipment-editor-save"
          accessibilityRole="button"
          style={({ pressed }) => [styles.saveButton, (pressed || saving) && { opacity: 0.7 }]}
        >
          <Text style={styles.saveLabel}>{saving ? 'Updating…' : 'Save equipment'}</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
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
  groupHeading: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  firstGroupHeading: {
    marginTop: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemIconMuted: {
    opacity: 0.5,
  },
  itemTextWrap: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLabel: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  neverLabel: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
  },
  itemState: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 13,
    marginTop: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
  },
  saveLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
