import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
import { savedEquipmentAnswer, useProfileStore } from '../../store/profileStore';
import { EQUIPMENT_LOCATION_PRESETS } from '../../rules/equipmentLocationPresets';
import { todayISOLocal } from '../../utils/appDate';
import { canonicalEquipmentAnswerTags } from '../../utils/equipmentAvailability';
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
const ITEM_ICON_ACCENT = '#D8D800';
const ITEM_ICON_MUTED = '#5A5A5A';

export function EquipmentEditorSheet({
  visible,
  onClose,
  onSave,
  saving,
  errorMessage,
}: EquipmentEditorSheetProps) {
  const existing = savedEquipmentAnswer();
  const askableTags = derivedEquipmentChecklistTags() as AskableEquipmentTag[];
  const askableModalities = derivedConditioningModalityQuestions();

  /**
   * ⚠ **THE LIST OPENS ON WHAT ONBOARDING ALREADY SAID** — Sam, 2026-08-27:
   * *"EQUIPMENT LIST IS FUCKED - IT SHOULD BE THE SAME AS WHAT WAS SAID IN THE
   * ONBOARDING I.E. COMMERCIAL GYM = ALL TICKED - THEN TAP THEM TO REMOVE IT"*.
   *
   * It seeded from `savedEquipmentAnswer()` alone — the answer THIS EDITOR
   * writes — so an athlete who had never opened it before saw every item blank,
   * including the commercial-gym athlete whose program is built on having all of
   * it. The onboarding choice was never a checklist; it is resolved into a kit
   * by `resolveEquipmentCapabilities`, and that resolved kit is the honest
   * starting position: commercial gym arrives all ticked, a home or club kit
   * arrives with exactly what they said they had.
   *
   * The saved checklist still WINS where it exists, because it is the athlete's
   * own later edit — including the items they marked NEVER, which must not be
   * re-ticked by the kit underneath them.
   */
  /**
   * ⚠ **A SAVED ANSWER IS THE WHOLE ANSWER** — Sam, 2026-08-27: *"i also unticked
   * cable machines in my fucking onboarding and it's showing up as if i had
   * it"*. He is right, and the bug was mine from an hour earlier: onboarding
   * writes an entry ONLY for what was ticked, so an UNTICK leaves no entry at
   * all — and merging the location preset per-item put every unticked thing
   * straight back. An untick is an answer, and it looked identical to silence.
   *
   * So the preset seeds ONLY when the athlete has never answered the checklist.
   * The moment they have, their answer stands alone: ticked is have, marked is
   * never, and absent is DOES NOT HAVE, because they said so.
   */
  const seed = () => {
    if (existing) {
      return {
        tags: canonicalEquipmentAnswerTags(existing.tags) as Partial<Record<AskableEquipmentTag, EquipmentPossession>>,
        modalities: { ...existing.modalities },
      };
    }
    const location = useProfileStore.getState().onboardingData?.trainingLocation;
    const preset = EQUIPMENT_LOCATION_PRESETS.find(
      (candidate) => candidate.storesLocation === location);
    const tagSeed: Partial<Record<AskableEquipmentTag, EquipmentPossession>> = {};
    for (const tag of askableTags) {
      if (preset?.preTickedTags.includes(tag as never)) tagSeed[tag] = 'have';
    }
    const modalitySeed: Partial<Record<ConditioningEquipmentModality, EquipmentPossession>> = {};
    for (const modality of askableModalities) {
      if (preset?.preTickedModalities.includes(modality)) modalitySeed[modality] = 'have';
    }
    return { tags: tagSeed, modalities: modalitySeed };
  };

  const [tags, setTags] = useState<Partial<Record<AskableEquipmentTag, EquipmentPossession>>>(
    () => seed().tags);
  const [modalities, setModalities] = useState<
    Partial<Record<ConditioningEquipmentModality, EquipmentPossession>>
  >(() => seed().modalities);

  /**
   * ⚠ **THE SHEET IS ALWAYS MOUNTED, so seeding in `useState` runs ONCE — at app
   * start, against whatever the profile held then.** Re-seed each time it
   * opens, or an athlete who edits their kit, saves, and opens it again is
   * looking at the state from before their own save.
   */
  useEffect(() => {
    if (!visible) return;
    const fresh = seed();
    setTags(fresh.tags);
    setModalities(fresh.modalities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
    /* ⚠ **THE SAME ROW THE ATHLETE TICKED AT ONBOARDING** — Sam, 2026-08-27:
       *"it should look like dumbbell if you don't have it and barbell and plates
       if you do (without the 'have it' text) … both the app level and onboarding
       level"*. Have IS the selected tile; not-have is the plain one. The words
       are gone from both surfaces.
       NEVER keeps its label, and only its label: it is a THIRD state onboarding
       has no twin for — "stop offering this permanently" — and an unlabelled
       muted row would be indistinguishable from a blank one. */
    <Pressable
      key={key}
      onPress={onPress}
      testID={`profile-equipment-item-${key}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: possession === 'have' }}
      accessibilityLabel={possession === 'never' ? `${label}, never` : label}
      style={({ pressed }) => [
        styles.item,
        possession === 'have' && styles.itemHave,
        pressed && { opacity: 0.7 },
      ]}
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
        {possession === 'never' ? (
          <Text style={styles.itemState}>Never</Text>
        ) : null}
      </View>
      {possession === 'have' ? (
        <View style={styles.itemTick}>
          <Feather name="check" size={13} color="#0C0C0C" />
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      flexibleBody
      testID="profile-equipment-editor-sheet"
    >
      {/* ⚠ **A WAY OUT IN THE CORNER** — Sam, 2026-08-27: this popup is a long
          scrolling list, and the grab handle and backdrop are both a long way
          from a thumb that is halfway down it. Top RIGHT, which is where he
          asked for it; the phase sheet's chevron sits top left because it goes
          BACK a step, and this one closes. */}
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
        testID="profile-equipment-editor-close"
        style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
      >
        <Feather name="x" size={20} color={colors.text.secondary} />
      </Pressable>
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
      </ScrollView>
      {/* ⚠ **THE SAVE STAYS ON SCREEN** — Sam, 2026-08-27. It was the last child
          of the SCROLL VIEW, under fifteen items, so the athlete had to scroll
          to the bottom of a list they were still editing to find it. Outside the
          scroll view it is pinned to the foot of the popup and visible the whole
          time. */}
      <View style={styles.actionBar}>
        <Pressable
          onPress={save}
          disabled={!!saving}
          testID="profile-equipment-editor-save"
          accessibilityRole="button"
          style={({ pressed }) => [styles.saveButton, (pressed || saving) && { opacity: 0.7 }]}
        >
          <Text style={styles.saveLabel}>{saving ? 'Updating…' : 'Save equipment'}</Text>
        </Pressable>
      </View>
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
    paddingHorizontal: spacing.sm,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  // The onboarding tile's selected surface, so one kit looks like one kit.
  itemHave: {
    borderColor: '#7FA300',
    backgroundColor: '#1C2515',
  },
  itemTick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D8D800',
    alignItems: 'center',
    justifyContent: 'center',
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
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: 4,
    zIndex: 2,
  },
  // The pinned foot of the popup. The hairline is what tells the eye the list
  // continues underneath it rather than ending here.
  actionBar: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  saveButton: {
    marginTop: 0,
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
