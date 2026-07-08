import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
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
} from '../../utils/guidedInjuryControl';

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
}

export function GuidedInjuryFlowSheet({
  visible,
  onClose,
  onComplete,
  initial,
  titlePrefix,
}: GuidedInjuryFlowSheetProps) {
  const [step, setStep] = useState<FlowStep>('region');
  const [region, setRegion] = useState<GuidedInjuryRegion | null>(null);
  const [area, setArea] = useState('');
  const [customArea, setCustomArea] = useState('');
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
              label={option.label}
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
          {GUIDED_INJURY_AREA_OPTIONS[region].map((option) => (
            <FlowOption
              key={option}
              label={option}
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
          <TextInput
            value={customArea}
            onChangeText={setCustomArea}
            placeholder="e.g. calf, wrist, elbow"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            autoCapitalize="none"
          />
          <Button
            label="Continue"
            glow={false}
            disabled={customArea.trim().length === 0}
            onPress={() => setStep('severity')}
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
          {GUIDED_INJURY_SEVERITY_OPTIONS.map((option) => (
            <FlowOption
              key={option.label}
              label={option.label}
              sub={option.sub}
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
              onPress={() => toggleTrigger(trigger)}
              style={({ pressed }) => [
                styles.triggerChip,
                triggers.includes(trigger) && styles.triggerChipSelected,
                pressed && { opacity: 0.75 },
              ]}
            >
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
          glow={false}
          onPress={() => submit(isTrainingPaused)}
          style={styles.submitButton}
        />
        <BackButton onPress={back} />
      </>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="guided-injury-flow-sheet">
      {titlePrefix ? <Text style={styles.prefix}>{titlePrefix}</Text> : null}
      {renderStep()}
    </Sheet>
  );
}

function FlowOption({
  label,
  sub,
  selected,
  danger,
  onPress,
}: {
  label: string;
  sub?: string;
  selected?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && { opacity: 0.72 },
      ]}
    >
      <Text style={[styles.optionLabel, danger && styles.optionDanger]}>
        {label}
      </Text>
      {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.back, pressed && { opacity: 0.72 }]}>
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
