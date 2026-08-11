import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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
import { LfaIcon } from '../../components/icons/LfaIcon';

// ── Icons (ruling 10) ───────────────────────────────────────────────────────
// One recognisable glyph per equipment tag / conditioning modality, keyed off
// `EQUIPMENT_TAG_LABELS` / `CONDITIONING_MODALITY_LABELS` — the same derived
// vocabulary this sheet already reads, so a new askable tag cannot ship with
// no glyph (`equipmentIconFor` falls back to a neutral shape rather than
// rendering an empty chip). Exported so `EquipmentEditorSheet` (the profile
// surface asking the same vocabulary) draws the same glyphs — one icon owner
// for one vocabulary, not two pictures of one fact.
const EQUIPMENT_ICON_ACCENT = '#C8FF00';
const EQUIPMENT_ICON_MUTED = '#5A5A5A';
const glyph = (color: string, children: React.ReactNode) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);
export const EQUIPMENT_TAG_ICON: Record<AskableEquipmentTag, (color: string) => React.ReactNode> = {
  /** Barbell — rectangular end plates on a straight bar. */
  barbell: (color) => glyph(color, (
    <><Path d="M4 9v6" /><Path d="M7 7v10" /><Path d="M17 7v10" /><Path d="M20 9v6" /><Path d="M7 12h10" /></>
  )),
  /** Dumbbells — the same dumbbell mark used throughout the app. */
  dumbbells: (color) => <LfaIcon name="dumbbell" color={color} />,
  /** Cable machine — the previous upright selector/cable station trace. */
  cables: (color) => <LfaIcon name="cable-machine" color={color} />,
  /** Weight machine — Sam's approved seated plate-loaded machine trace. */
  machine: (color) => <LfaIcon name="weight-machine" color={color} />,
  /** Resistance band — a stretched, elastic S-curve. */
  bands: (color) => glyph(color, <Path d="M4 12c2-6 6-6 8 0s6 6 8 0" />),
  /** Bench — Sam's approved traced bench silhouette. */
  bench: (color) => <LfaIcon name="bench" color={color} />,
  /** Pull-up bar — the approved freestanding rig. */
  pullup_bar: (color) => <LfaIcon name="pull-up-bar" color={color} />,
  /** Kettlebell — the same kettlebell mark used throughout the app. */
  kettlebell: (color) => <LfaIcon name="kettlebell" color={color} />,
  /** Foam roller — Sam's supplied hollow, ribbed roller SVG. */
  foam_roller: (color) => <LfaIcon name="foam-roller" color={color} />,
  /** Plyo box — Sam's approved three-face box with grip chevrons. */
  plyo_box: (color) => <LfaIcon name="plyo-box" color={color} />,
};
export const CONDITIONING_MODALITY_ICON: Record<ConditioningEquipmentModality, (color: string) => React.ReactNode> = {
  /** Bike erg — Sam's approved traced machine. */
  bike_erg: (color) => <LfaIcon name="bike-erg" color={color} />,
  /** Air / assault bike — Sam's approved traced fan bike. */
  air_bike: (color) => <LfaIcon name="air-bike" color={color} />,
  /** Row erg — Sam's approved traced rower. */
  row: (color) => <LfaIcon name="row-erg" color={color} />,
  /** Ski erg — Sam's approved traced ski erg. */
  ski: (color) => <LfaIcon name="ski-erg" color={color} />,
  /** Treadmill — Sam's approved traced treadmill. */
  treadmill: (color) => <LfaIcon name="treadmill" color={color} />,
};
/** No askable tag or modality should ever hit this — every key in both
 * `Record`s above is exhaustive over the derived vocabulary, so TypeScript
 * fails the build before this could render. It exists so a FUTURE vocabulary
 * addition renders a real (if generic) glyph instead of an empty chip while
 * the icon gets designed, rather than the sheet breaking. */
export const equipmentIconFallback = (color: string) => glyph(color, (
  <Circle cx="12" cy="12" r="7" />
));
/** One lookup across both `Record`s, with the neutral fallback — the single
 * function both this sheet and `EquipmentEditorSheet` call, so "what glyph
 * does this tag get" has one owner. */
export function equipmentIconFor(
  item: EquipmentTag | ConditioningEquipmentModality,
  color: string,
): React.ReactNode {
  const tagIcon = (EQUIPMENT_TAG_ICON as Record<string, (color: string) => React.ReactNode>)[item];
  if (tagIcon) return tagIcon(color);
  const modalityIcon = (CONDITIONING_MODALITY_ICON as Record<string, (color: string) => React.ReactNode>)[item];
  if (modalityIcon) return modalityIcon(color);
  return equipmentIconFallback(color);
}

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
            icon={equipmentIconFor(tag, missingTags.has(tag) ? EQUIPMENT_ICON_MUTED : EQUIPMENT_ICON_ACCENT)}
            missing={missingTags.has(tag)}
            testID={optionTestId(tag)}
            onPress={() => toggleTag(tag)}
          />
        ))}
        {kit.conditioningModalities.map((modality) => (
          <MissingToggle
            key={modality}
            label={CONDITIONING_MODALITY_LABELS[modality]}
            icon={equipmentIconFor(modality, missingModalities.has(modality) ? EQUIPMENT_ICON_MUTED : EQUIPMENT_ICON_ACCENT)}
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
            style={({ pressed }) => [styles.optionWithIcon, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.optionIcon, styles.optionIconAccent]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={EQUIPMENT_ICON_ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 6L9 17l-5-5" />
              </Svg>
            </View>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Equipment available again</Text>
              <Text style={styles.optionSub}>End the temporary restriction</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

/**
 * One equipment/modality row, with its icon chip (Sam's design ruling 10).
 * Same fixed 38x38 round chip as `HomeScreenV2`'s `SheetOption` — the icon
 * dims to the muted tone the same moment the label gets its strikethrough,
 * so a marked-missing row reads as off in both the glyph and the text.
 */
function MissingToggle({
  label,
  icon,
  missing,
  testID,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
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
      style={({ pressed }) => [styles.optionWithIcon, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.optionIcon, missing && styles.optionIconMuted]}>{icon}</View>
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
  optionWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconMuted: {
    opacity: 0.5,
  },
  optionIconAccent: {
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  optionRow: {
    flex: 1,
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
