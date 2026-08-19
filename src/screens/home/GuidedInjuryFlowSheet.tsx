import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { Button, Sheet } from '../../components/ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import {
  GUIDED_INJURY_AREA_OPTIONS,
  GUIDED_INJURY_REGION_OPTIONS,
  GUIDED_INJURY_SEVERITY_OPTIONS,
  GUIDED_INJURY_TRIGGER_OPTIONS,
  type GuidedInjuryFlowResult,
  type GuidedInjuryRegion,
  GUIDED_INJURY_AREA_HINT,
  GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL,
  guidedInjuryAreaIsProgrammable,
} from '../../utils/guidedInjuryControl';
import { explorerTestId } from '../../utils/stableTestId';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { LfaIcon } from '../../components/icons/LfaIcon';

// ── Icons (ruling 10) ──────────────────────────────────────────────────────
// Inline stroked SVG, the house pattern (`HomeScreenV2`'s `svg` helper /
// `PlanChangeSheet`'s `glyph` helper). One recognisable shape per region, and
// areas REUSE their region's glyph (the brief's own instruction) rather than
// inventing seventeen more — an area is a subdivision of the region an
// athlete already picked, not a new concept.
const REGION_COLOR: Record<GuidedInjuryRegion, string> = {
  upper_body: '#1EA7FF',
  lower_body: '#FFC247',
  back_midline: '#7CC4FF',
  other: '#8A94A6',
};
const glyph = (color: string, children: React.ReactNode) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </Svg>
);
/** Upper body — an injured person rather than a generic shoulders silhouette. */
const upperBodyIcon = (color: string) => <LfaIcon name="upper-body-injury" color={color} />;
/** Lower body — a dedicated legs mark. */
const lowerBodyIcon = (color: string) => <LfaIcon name="lower-body" color={color} />;
/** Back / midline — the shared curved spine mark. */
const backMidlineIcon = (color: string) => <LfaIcon name="spine" color={color} />;
/** Other — a question mark. The region has no shape of its own to draw. */
const otherRegionIcon = (color: string) => glyph(color, (
  <><Path d="M9.3 9a2.7 2.7 0 1 1 3.7 2.5c-.6.3-1 .9-1 1.7v.3" /><Path d="M12 16.7h.01" /></>
));
const REGION_ICON: Record<GuidedInjuryRegion, (color: string) => React.ReactNode> = {
  upper_body: upperBodyIcon,
  lower_body: lowerBodyIcon,
  back_midline: backMidlineIcon,
  other: otherRegionIcon,
};
/**
 * Severity — ascending bars, like a signal-strength meter: N bars lit for
 * severity level N (1 of 4 mild, up to 4 of 4 "avoid"). Colour climbs the
 * same ladder the sub-copy already describes (mild -> annoying -> limiting
 * -> bad), so the glyph and the words agree.
 */
const SEVERITY_BAR_COLORS = ['#4CAF50', '#FFC247', '#FF8A4C', '#F44336'];
const severityBarsIcon = (level: number, color: string) => {
  const bars = [
    { x: 2, h: 6 }, { x: 8, h: 10 }, { x: 14, h: 14 }, { x: 20, h: 18 },
  ].slice(0, level);
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      {bars.map((bar) => (
        <Path
          key={bar.x}
          d={`M${bar.x} 22h2v-${bar.h}h-2z`}
          fill={color}
        />
      ))}
    </Svg>
  );
};
/** Triggers — a shared spark, deliberately identical on all 13 chips. Thirteen
 * distinct trigger glyphs (sprinting vs. kicking vs. pressing vs. "always
 * there"...) would be noise nobody reads at chip size; the spark marks "this
 * is a cause", the label still says which one. */
const triggerSparkIcon = (color: string) => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill={color} stroke="none">
    <Path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" />
  </Svg>
);

const INJURY_AREA_TEST_IDS: Record<string, string> = {
  Neck: 'neck',
  Shoulder: 'shoulder',
  Elbow: 'elbow',
  'Wrist / hand': 'wrist-hand',
  'Chest / ribs': 'chest-ribs',
  'Other upper body': 'other-upper-body',
  'Hip / groin': 'hip-groin',
  Hamstring: 'hamstring',
  Quad: 'quad',
  Knee: 'knee',
  'Calf / Achilles': 'calf-achilles',
  'Ankle / foot': 'ankle-foot',
  'Other lower body': 'other-lower-body',
  'Lower back': 'lower-back',
  'Upper back': 'upper-back',
  'Abs / side': 'abs-side',
  'Other midline': 'other-midline',
};

const INJURY_TRIGGER_TEST_IDS: Record<string, string> = {
  Sprinting: 'sprinting',
  'Change of direction': 'change-of-direction',
  Kicking: 'kicking',
  Running: 'running',
  'Jumping / landing': 'jumping-landing',
  'Heavy lifting': 'heavy-lifting',
  'Squatting / lunging': 'squatting-lunging',
  'Hinging / bending': 'hinging-bending',
  Pressing: 'pressing',
  Pulling: 'pulling',
  'Contact / games': 'contact-games',
  'Always there': 'always-there',
  Other: 'other',
};

type FlowStep =
  | 'region'
  | 'area'
  | 'custom_area'
  | 'stop_training'
  | 'severity'
  | 'triggers';

interface GuidedInjuryFlowSheetProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (result: GuidedInjuryFlowResult) => void | Promise<void>;
  initial?: Partial<GuidedInjuryFlowResult>;
  titlePrefix?: string;
  episodeId?: string;
}

export function GuidedInjuryFlowSheet({
  visible,
  onClose,
  onComplete,
  initial,
  titlePrefix,
  episodeId,
}: GuidedInjuryFlowSheetProps) {
  const [step, setStep] = useState<FlowStep>('region');
  const [region, setRegion] = useState<GuidedInjuryRegion | null>(null);
  const [area, setArea] = useState('');
  const [customArea, setCustomArea] = useState('');
  /** Sam's refusal, shown when the typed area is one the app cannot program around. */
  const [areaRefusal, setAreaRefusal] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState(GUIDED_INJURY_SEVERITY_OPTIONS[1]);
  const [triggers, setTriggers] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setStep('region');
    setRegion(initial?.region ?? null);
    setArea(initial?.region && initial.region !== 'other' ? initial.area ?? '' : '');
    setCustomArea(initial?.region === 'other' ? initial.area ?? '' : '');
    setTriggers(initial?.triggers ?? []);
    const severity = GUIDED_INJURY_SEVERITY_OPTIONS.find(
      (option) => option.severityBand === initial?.severityBand,
    ) ?? GUIDED_INJURY_SEVERITY_OPTIONS[1];
    setSelectedSeverity(severity);
  }, [
    visible,
    initial?.area,
    initial?.region,
    initial?.severityBand,
    initial?.triggers,
  ]);

  const selectedArea = (area || customArea).trim();
  const isTrainingPaused = selectedSeverity.adjustmentLevel === 'training_paused';

  const submit = (trainingPaused: boolean) => {
    void onComplete({
      region: region ?? 'other',
      area: selectedArea || 'unknown',
      severity: selectedSeverity.severity,
      severityBand: selectedSeverity.severityBand,
      adjustmentLevel: trainingPaused ? 'training_paused' : selectedSeverity.adjustmentLevel,
      triggers: trainingPaused ? [] : triggers,
      seriousSymptoms: false,
    });
  };

  const toggleTrigger = (trigger: string) => {
    setTriggers((current) => {
      if (current.includes(trigger)) return current.filter((item) => item !== trigger);
      if (current.length >= 3) return current;
      return [...current, trigger];
    });
  };

  const back = () => {
    if (step === 'region') {
      onClose();
    } else if (step === 'area' || step === 'custom_area') {
      setStep('region');
    } else if (step === 'stop_training') {
      setStep('severity');
    } else if (step === 'severity') {
      setStep(region === 'other' ? 'custom_area' : 'area');
    } else {
      setStep('severity');
    }
  };

  const renderStep = () => {
    if (step === 'region') {
      return (
        <>
          <Text style={styles.title}>Where is the issue?</Text>
          {GUIDED_INJURY_REGION_OPTIONS.map((option) => (
            <FlowOption
              key={option.id}
              testID={`injury-region-${option.id}`}
              label={option.label}
              icon={REGION_ICON[option.id](REGION_COLOR[option.id])}
              selected={region === option.id}
              onPress={() => {
                setRegion(option.id);
                if (option.id === 'other') {
                  setStep('custom_area');
                } else {
                  setStep('area');
                }
              }}
            />
          ))}
        </>
      );
    }

    if (step === 'area' && region && region !== 'other') {
      return (
        <>
          <Text style={styles.title}>Where is the issue?</Text>
          {/*
            SAM'S WORDS, from the 2026-07-30 ruling. The "Other upper body" and "Other
            lower body" rows are gone because they resolved to no bucket, so the athlete
            whose area is not listed needs telling what to do instead.
          */}
          <Text style={styles.body}>{GUIDED_INJURY_AREA_HINT}</Text>
          {GUIDED_INJURY_AREA_OPTIONS[region].map((option) => (
            <FlowOption
              key={option}
              testID={`injury-area-${INJURY_AREA_TEST_IDS[option]}`}
              label={option}
              // Areas reuse their region's glyph family (Sam's brief) — the
              // area step never left the region the athlete already picked.
              icon={REGION_ICON[region](REGION_COLOR[region])}
              selected={area === option}
              onPress={() => {
                setArea(option);
                setStep('severity');
              }}
            />
          ))}
          <BackButton onPress={back} />
        </>
      );
    }

    if (step === 'custom_area') {
      return (
        <>
          <Text style={styles.title}>What area is it?</Text>
          <AppTextInput
            value={customArea}
            onChangeText={(next: string) => {
              setCustomArea(next);
              // The refusal clears as soon as they change the answer — a refusal that
              // outlives the answer it refused reads as a broken field.
              if (areaRefusal) setAreaRefusal(null);
            }}
            placeholder="e.g. calf, wrist, elbow"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            autoCapitalize="none"
            testID="injury-area-custom-input"
            accessibilityLabel="injury-area-custom-input"
          />
          {areaRefusal ? (
            <Text style={styles.safetyNote} testID="injury-area-custom-refusal">
              {areaRefusal}
            </Text>
          ) : null}
          <Button
            label="Continue"
            testID="injury-area-custom-continue"
            glow={false}
            disabled={customArea.trim().length === 0}
            onPress={() => {
              // HONESTLY REFUSED AT THE POINT OF ANSWERING (Sam's ruling, 2026-07-30).
              //
              // The app used to accept anything here, store it, change the week's dose
              // through the severity answer, and filter no movement — so it looked like
              // it had listened. It had, about the dose. It was still programming the
              // movement that hurt.
              if (!guidedInjuryAreaIsProgrammable(customArea)) {
                setAreaRefusal(GUIDED_INJURY_UNRESOLVABLE_AREA_REFUSAL);
                return;
              }
              setAreaRefusal(null);
              setStep('severity');
            }}
          />
          <BackButton onPress={back} />
        </>
      );
    }

    if (step === 'stop_training') {
      return (
        <>
          <Text style={styles.title}>Stop affected training</Text>
          <Text style={styles.body}>
            This is outside normal S&amp;C adjustment. LFA can't diagnose or rehab injuries.
            Stop affected training for now and get medical or physio advice.
          </Text>
          <Text style={styles.safetyNote}>
            If you had a sudden pop, numbness/tingling, chest pain, dizziness,
            head/neck symptoms, or can't walk normally, get proper medical advice.
          </Text>
          <Button
            label="Pause affected training"
            testID={explorerTestId.injuryIngress(episodeId ? 'update' : 'set', episodeId)}
            glow={false}
            onPress={() => submit(true)}
          />
          <Button
            label="Back"
            variant="secondary"
            glow={false}
            onPress={back}
            style={styles.secondaryButton}
          />
        </>
      );
    }

    if (step === 'severity') {
      return (
        <>
          <Text style={styles.title}>How much is it limiting you?</Text>
          {GUIDED_INJURY_SEVERITY_OPTIONS.map((option, index) => (
            <FlowOption
              key={option.label}
              testID={`injury-severity-${option.severityBand}`}
              label={option.label}
              sub={option.sub}
              icon={severityBarsIcon(index + 1, SEVERITY_BAR_COLORS[index])}
              selected={selectedSeverity.label === option.label}
              onPress={() => {
                setSelectedSeverity(option);
                if (option.adjustmentLevel === 'training_paused') {
                  setTriggers([]);
                  setStep('stop_training');
                } else {
                  setStep('triggers');
                }
              }}
            />
          ))}
          <BackButton onPress={back} />
        </>
      );
    }

    return (
      <>
        <Text style={styles.title}>What brings it on?</Text>
        <Text style={styles.body}>Select up to 3 triggers</Text>
        <View style={styles.triggerGrid}>
          {GUIDED_INJURY_TRIGGER_OPTIONS.map((trigger) => (
            <Pressable
              key={trigger}
              testID={`injury-trigger-${INJURY_TRIGGER_TEST_IDS[trigger]}`}
              accessibilityRole="button"
              accessibilityLabel={`injury-trigger-${INJURY_TRIGGER_TEST_IDS[trigger]}`}
              onPress={() => toggleTrigger(trigger)}
              style={({ pressed }) => [
                styles.triggerChip,
                triggers.includes(trigger) && styles.triggerChipSelected,
                pressed && { opacity: 0.75 },
              ]}
            >
              {triggerSparkIcon(triggers.includes(trigger) ? colors.accent.lime : colors.text.secondary)}
              <Text
                style={[
                  styles.triggerText,
                  triggers.includes(trigger) && styles.triggerTextSelected,
                ]}
              >
                {trigger}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          label="Apply training adjustment"
          testID={explorerTestId.injuryIngress(episodeId ? 'update' : 'set', episodeId)}
          glow={false}
          onPress={() => submit(isTrainingPaused)}
          style={styles.submitButton}
        />
        <BackButton onPress={back} />
      </>
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      testID={episodeId
        ? explorerTestId.injuryDetail(episodeId)
        : 'guided-injury-flow-sheet'}
    >
      {titlePrefix ? <Text style={styles.prefix}>{titlePrefix}</Text> : null}
      {renderStep()}
    </Sheet>
  );
}

/**
 * One region/area/severity row, with an icon chip (Sam's design ruling 10 —
 * every option row carries a meaningful icon). Same fixed 38x38 round chip as
 * `HomeScreenV2`'s `SheetOption` / `PlanChangeSheet`'s `MenuOption`, so this
 * sheet reads as the same app as the ones either side of it. `icon` is
 * optional in the type only because `BackButton` and the confirmation
 * buttons below never went through `FlowOption` at all — every live call
 * site now passes one.
 */
function FlowOption({
  testID,
  label,
  sub,
  icon,
  selected,
  danger,
  onPress,
}: {
  testID?: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  danger?: boolean;
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
      style={({ pressed }) => [
        icon ? styles.optionWithIcon : styles.option,
        selected && styles.optionSelected,
        pressed && { opacity: 0.72 },
      ]}
    >
      {icon ? (
        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
          {icon}
        </View>
      ) : null}
      <View style={icon ? { flex: 1 } : undefined}>
        <Text style={[styles.optionLabel, danger && styles.optionDanger]}>
          {label}
        </Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="injury-flow-back"
      style={({ pressed }) => [styles.back, pressed && { opacity: 0.72 }]}
    >
      <Text style={styles.backText}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  prefix: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
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
  safetyNote: {
    color: colors.status.warning,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
  optionIconSelected: {
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  optionSelected: {
    borderBottomColor: 'rgba(200,255,0,0.35)',
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  optionDanger: {
    color: colors.status.warning,
  },
  optionSub: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  input: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  triggerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  triggerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  triggerChipSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  triggerText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  triggerTextSelected: {
    color: colors.accent.lime,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  secondaryButton: {
    marginTop: spacing.md,
  },
  back: {
    paddingVertical: spacing.md,
  },
  backText: {
    color: colors.accent.lime,
    fontSize: 15,
    fontWeight: '800',
  },
});
