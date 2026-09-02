import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { SheetDescription } from '../../components/ui';
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
import { shortDayMonthLabel } from '../../utils/appDate';
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
const EQUIPMENT_ICON_ACCENT = '#D8D800';
const EQUIPMENT_ICON_MUTED = '#5A5A5A';
const glyph = (color: string, children: React.ReactNode) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);
/** Tib bar — Sam approved a simple T mark for the new equipment answer. */
export const TIB_BAR_ICON_PATH = 'M6 5h12M12 5v14';
export const EQUIPMENT_TAG_ICON: Record<AskableEquipmentTag, (color: string) => React.ReactNode> = {
  tib_bar: (color) => glyph(color, <Path d={TIB_BAR_ICON_PATH} />),
  medicine_ball: (color) => <LfaIcon name="sandbag-dead-ball" color={color} />,
  /** Barbell and plates — Sam's supplied stacked-plate trace. */
  barbell: (color) => <LfaIcon name="barbell-plates" color={color} />,
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
  // ── Item 46/47, 2026-08-13 — the seven newly askable tags. ──
  // Most remain inline placeholders. Dip bars, the back-extension bench, the
  // ab wheel and the sand bag / dead ball now use Sam's approved traces.
  /** Squat rack — two uprights carrying a bar. */
  rack: (color) => glyph(color, (
    <><Path d="M5 4v16" /><Path d="M19 4v16" /><Path d="M5 9h14" /><Path d="M3 20h4" /><Path d="M17 20h4" /></>
  )),
  /** Trap bar — the hexagonal frame stood on end plates. */
  trap_bar: (color) => glyph(color, (
    <><Path d="M8 5h8l4 7-4 7H8l-4-7z" /><Path d="M4 10v4" /><Path d="M20 10v4" /></>
  )),
  /** Swiss ball — a plain sphere. */
  swiss_ball: (color) => glyph(color, <Path d="M12 3a9 9 0 100 18 9 9 0 100-18" />),
  /** Ab wheel — Sam's supplied twin-wheel perspective trace. */
  ab_wheel: (color) => <LfaIcon name="ab-wheel" color={color} />,
  /** 45° back extension — Sam's supplied split-pad machine trace. */
  back_extension_bench: (color) => <LfaIcon name="back-extension" color={color} />,
  /** Dip bars — Sam's supplied curved rails, centre brace and round feet. */
  dip_bars: (color) => <LfaIcon name="dip-bars" color={color} />,
  /** Rings / TRX — two straps dropping to a pair of rings. */
  rings_trx: (color) => glyph(color, (
    <><Path d="M4 4h16" /><Path d="M8 4v8" /><Path d="M16 4v8" /><Path d="M8 15a3 3 0 100 6 3 3 0 100-6" /><Path d="M16 15a3 3 0 100 6 3 3 0 100-6" /></>
  )),
  /** Sand bag / dead ball — Sam's supplied round stitched-bag trace. */
  sandbag: (color) => <LfaIcon name="sandbag-dead-ball" color={color} />,
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
  /**
   * THE SAME ANSWER, OVER THE TRIP THE ATHLETE JUST DESCRIBED — SEAT_INBOX
   * item 28, Sam 2026-08-13: *"when do you leave ... when do you return ...
   * then you are asked about the equipment stuff"*.
   *
   * ONE MENU, NOT TWO. Sam's ruling on the away flow names this sheet by its
   * behaviour — *"the athlete just removes the equipment they don't have while
   * on the trip"* — so away does not get a second equipment question. It gets
   * THIS one with a `span`, and the span is the only difference: the fact it
   * writes ends on its own instead of on Sunday.
   */
  | {
      kind: 'missing_for_span';
      tags: readonly EquipmentTag[];
      conditioningModalities: readonly ConditioningEquipmentModality[];
      from: string;
      until: string;
    }
  | { kind: 'available_again' };

interface EquipmentLimitationBodyProps {
  onApply: (decision: EquipmentLimitationDecision) => void | Promise<void>;
  activeFactId?: string | null;
  targetFactId?: string | null;
  /**
   * THE TRIP, WHEN THIS SHEET IS THE LAST STEP OF THE AWAY FLOW. Present =>
   * the answer is dated (`missing_for_span`) and lifts itself on the return
   * date; absent => the sheet keeps the this-week answer it has always given.
   * `until` is the LAST DAY AWAY, never the return date itself: Sam's build
   * order says the program is back to normal *on* the day the athlete returns.
   */
  span?: { from: string; until: string } | null;
}

/**
 * THE ONE EQUIPMENT MENU'S BODY — no modal of its own. Checklist #5, second
 * round (Sam, 2026-08-26): the away flow renders this INSIDE the week-edit
 * sheet's single modal, because iOS cannot present two sibling modals without
 * flashing the screen between their windows. The list, the marking, and the
 * decision the apply button emits are byte-identical to what the standalone
 * sheet emitted — one menu, one owner, a different host.
 */
export function EquipmentLimitationBody({
  onApply,
  activeFactId,
  targetFactId,
  span = null,
}: EquipmentLimitationBodyProps) {
  // Read once per mount: the list is the athlete's baseline kit, which a
  // mid-flow store change cannot legitimately alter.
  const kit = useMemo(() => ownedEquipmentKit(), []);
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
    void onApply(span
      ? {
          kind: 'missing_for_span',
          tags: [...missingTags],
          conditioningModalities: [...missingModalities],
          from: span.from,
          until: span.until,
        }
      : {
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
  const rowMissingLabel = span ? 'Missing while away' : 'Missing this week';

  return (
      <View style={styles.sheetBody} testID="home-equipment-limitation-sheet">
        <SheetDescription>
          {activeFactId
            ? 'A restriction is active. Mark what is missing, or clear it below.'
            : kitIsEmpty
              ? 'Your program is already bodyweight-only, so there is nothing to mark missing.'
              : span
                ? `Mark what you won't have while you're away. Your sessions work around it until ${shortDayMonthLabel(span.until)}.`
                : "Mark what you won't have this week. Your program works around it."}
        </SheetDescription>
        {activeFactId ? (
          <ExplorerRenderWitness testID={explorerTestId.equipmentActive(activeFactId)} />
        ) : null}

        {/* Sam's phone, 2026-08-26 (checklist #10): "lists all the equipment
          * again on an unscrollable page... not the best UX". A full kit is
          * ~20 rows — far taller than any phone. The list scrolls; the apply
          * bar stays reachable below it. `flexShrink: 1`, never `flex: 1`,
          * per the cappedBody rule on the Sheet primitive. */}
        <ScrollView
          style={styles.scrollList}
          showsVerticalScrollIndicator={false}
          testID="home-equipment-limitation-list"
        >
        {kit.tags.map((tag) => (
          <MissingToggle
            key={tag}
            label={EQUIPMENT_TAG_LABELS[tag as AskableEquipmentTag] ?? labelFor(tag)}
            icon={equipmentIconFor(tag, missingTags.has(tag) ? EQUIPMENT_ICON_MUTED : EQUIPMENT_ICON_ACCENT)}
            missing={missingTags.has(tag)}
            missingLabel={rowMissingLabel}
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
            missingLabel={rowMissingLabel}
            testID={optionTestId(modality)}
            onPress={() => toggleModality(modality)}
          />
        ))}
        </ScrollView>

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
              {nothingMarked
                ? 'Mark what is missing'
                : span ? "Apply while I'm away" : 'Apply for this week'}
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
  missingLabel,
  testID,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  missing: boolean;
  /** What the row SAYS once it is marked. "this week" is a claim, and it is
   *  false when the sheet was opened by the away flow over a dated span. */
  missingLabel: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      /* R-109 (Sam, 2026-08-20): *"fix the six accessibility labels so athletes hear
         exercise names, not internal IDs."* The row is ONE accessibility leaf
         (`accessibilityRole="button"`), so its label is the whole of what a
         screen-reader user hears — and it was the test id.
         ⚠ **THE IDENTITY IS NOT LOST: `testID` still sets
         `accessibilityIdentifier`, which is what Maestro's `id:` and the
         explorer match on.** Only the SPOKEN name changes. */
      accessibilityLabel={label}
      style={({ pressed }) => [styles.optionWithIcon, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.optionIcon, missing && styles.optionIconMuted]}>{icon}</View>
      <View style={styles.optionRow}>
        <Text style={[styles.optionLabel, missing && styles.missingLabel]}>{label}</Text>
        <Text style={styles.optionSub}>{missing ? missingLabel : ''}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* The sheet's own children flex inside cappedBody; both follow the Sheet
   * primitive's rule: flexShrink with auto basis, never flex: 1. */
  sheetBody: {
    flexShrink: 1,
  },
  scrollList: {
    flexShrink: 1,
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
    backgroundColor: 'rgba(216,216,0,0.12)',
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
