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
  /** Dumbbells — round end weights, distinct from the barbell's flat plates. */
  dumbbells: (color) => glyph(color, (
    <><Circle cx="5.5" cy="12" r="2.5" /><Circle cx="18.5" cy="12" r="2.5" /><Path d="M8 12h8" /></>
  )),
  /** Cable machine — a pulley overhead, cable down to a D-handle. */
  cables: (color) => glyph(color, (
    <><Circle cx="12" cy="4.5" r="2" /><Path d="M12 6.5v9" /><Path d="M8.5 15.5h7l-1.5 4h-4z" /></>
  )),
  /** Weight machine — a plate stack on a guide rod with a selector pin. */
  machine: (color) => glyph(color, (
    <><Path d="M7 5h10" /><Path d="M7 9h10" /><Path d="M7 13h10" /><Path d="M12 13v6" /><Path d="M9 19h6" /></>
  )),
  /** Resistance band — a stretched, elastic S-curve. */
  bands: (color) => glyph(color, <Path d="M4 12c2-6 6-6 8 0s6 6 8 0" />),
  /** Bench — a flat top on two short legs. */
  bench: (color) => glyph(color, (
    <><Path d="M3 11h18" /><Path d="M3 11v3" /><Path d="M21 11v3" /><Path d="M6 14v4" /><Path d="M18 14v4" /></>
  )),
  /** Pull-up bar — a bar mounted high between two posts (a doorway rig). */
  pullup_bar: (color) => glyph(color, (
    <><Path d="M4 6v4" /><Path d="M20 6v4" /><Path d="M4 8h16" /></>
  )),
  /** Kettlebell — a ball with a handle loop on top. */
  kettlebell: (color) => glyph(color, (
    <><Circle cx="12" cy="15" r="6" /><Path d="M9 9a3 3 0 0 1 6 0v2H9z" /></>
  )),
  /** Foam roller — a capsule lying on its side. */
  foam_roller: (color) => glyph(color, (
    <Path d="M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z" />
  )),
  /** Plyo box — an isometric cube. */
  plyo_box: (color) => glyph(color, (
    <><Path d="M4 10l8-4 8 4-8 4z" /><Path d="M4 10v7l8 4 8-4v-7" /><Path d="M12 14v7" /></>
  )),
};
export const CONDITIONING_MODALITY_ICON: Record<ConditioningEquipmentModality, (color: string) => React.ReactNode> = {
  /** Bike / bike erg — two wheels and a frame. */
  bike_erg: (color) => glyph(color, (
    <><Circle cx="6" cy="17.5" r="3.5" /><Circle cx="18" cy="17.5" r="3.5" /><Path d="M6 17.5 10 8h4l3 5" /><Path d="M10 8l3 5h5" /><Circle cx="15" cy="5.5" r="1.3" /></>
  )),
  /** Air / assault bike — one large fan wheel, no rear wheel (unlike the erg bike). */
  air_bike: (color) => glyph(color, (
    <><Circle cx="12" cy="9" r="5" /><Path d="M12 4v5l4 2" /><Path d="M8 19h8" /><Path d="M10 19v-4" /><Path d="M14 19v-4" /></>
  )),
  /** Row erg — a rail, a seat, and the cable running up to the handle. */
  row: (color) => glyph(color, (
    <><Path d="M2 19h20" /><Path d="M6 19v-3h4v3" /><Path d="M10 16l8-10" /></>
  )),
  /** Ski erg — two angled ski planks. */
  ski: (color) => glyph(color, (
    <><Path d="M5 20L9 4" /><Path d="M15 20L19 4" /></>
  )),
  /** Treadmill — a belt loop on a stand, an incline post at the front. */
  treadmill: (color) => glyph(color, (
    <><Path d="M3 18h14a3 3 0 0 0 0-6H7a3 3 0 0 0 0 6" /><Path d="M17 12V8" /><Path d="M20 21H4" /></>
  )),
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
