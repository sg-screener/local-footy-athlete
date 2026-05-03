import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { OnboardingInjury, InjurySeverity, InjuryCategory } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type InjuriesScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Injuries'
>;

// ─── Body area config ───

const BODY_AREAS = [
  'Groin',
  'Hamstring',
  'Knee',
  'Ankle',
  'Hip',
  'Lower back',
  'Shoulder',
  'Other area',
];

function getInjuryCategory(area: string): InjuryCategory {
  const lower = area.toLowerCase();
  if (lower === 'lower back') return 'lower-back';
  if (['shoulder'].includes(lower)) return 'upper-body';
  if (['groin', 'hamstring', 'knee', 'ankle', 'hip'].includes(lower)) return 'lower-body';
  return 'other';
}

// ─── Severity ───

const SEVERITY_OPTIONS: { value: InjurySeverity; label: string; subtext: string }[] = [
  { value: 'Mild', label: 'MILD', subtext: 'I can train through it' },
  { value: 'Moderate', label: 'MODERATE', subtext: 'It limits some movements' },
  { value: 'Severe', label: 'SEVERE', subtext: 'I need to train around it' },
];

// ─── Context-aware movement triggers ───

const LOWER_BODY_TRIGGERS = [
  'Sprinting',
  'Change of direction',
  'Kicking',
  'Heavy lifting',
  'Light running',
  'Always there',
];

const UPPER_BODY_TRIGGERS = [
  'Pressing (bench, push-ups)',
  'Overhead movements',
  'Pulling (rows, pull-ups)',
  'Contact / impact',
  'Always there',
];

const LOWER_BACK_TRIGGERS = [
  'Bending / hinging',
  'Heavy lifting',
  'Running',
  'Change of direction',
  'Sitting / stiffness',
  'Always there',
];

const OTHER_TRIGGERS = [
  'During training',
  'During games',
  'Heavy lifting',
  'Always there',
];

function getTriggersForArea(area: string): string[] {
  const category = getInjuryCategory(area);
  switch (category) {
    case 'lower-body': return LOWER_BODY_TRIGGERS;
    case 'upper-body': return UPPER_BODY_TRIGGERS;
    case 'lower-back': return LOWER_BACK_TRIGGERS;
    default: return OTHER_TRIGGERS;
  }
}

const MAX_TRIGGERS = 3;

// ─── Internal types ───

type InternalStep = 'question' | 'areas' | 'severity' | 'triggers' | 'notes';

interface InjuryDetail {
  severity?: InjurySeverity;
  movementTriggers: string[];
  notes: string;
}

// ─── Component ───

export const InjuriesScreen: React.FC<InjuriesScreenProps> = ({
  navigation,
}) => {
  const [step, setStep] = useState<InternalStep>('question');
  const [hasInjuries, setHasInjuries] = useState<boolean | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [injuryDetails, setInjuryDetails] = useState<{ [key: string]: InjuryDetail }>({});
  const [currentInjuryIndex, setCurrentInjuryIndex] = useState(0);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Injuries');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const currentArea = selectedAreas[currentInjuryIndex];
  const currentDetail: InjuryDetail = injuryDetails[currentArea] || { movementTriggers: [], notes: '' };
  const totalInjuries = selectedAreas.length;

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const ensureDetail = (area: string): InjuryDetail => {
    return injuryDetails[area] || { movementTriggers: [], notes: '' };
  };

  const updateSeverity = (area: string, severity: InjurySeverity) => {
    setInjuryDetails((prev) => ({
      ...prev,
      [area]: { ...ensureDetail(area), severity },
    }));
  };

  const toggleTrigger = (area: string, trigger: string) => {
    setInjuryDetails((prev) => {
      const detail = ensureDetail(area);
      const current = detail.movementTriggers;
      if (current.includes(trigger)) {
        return { ...prev, [area]: { ...detail, movementTriggers: current.filter((t) => t !== trigger) } };
      }
      if (current.length >= MAX_TRIGGERS) {
        // Replace oldest selection
        return { ...prev, [area]: { ...detail, movementTriggers: [...current.slice(1), trigger] } };
      }
      return { ...prev, [area]: { ...detail, movementTriggers: [...current, trigger] } };
    });
  };

  const updateNotes = (area: string, notes: string) => {
    setInjuryDetails((prev) => ({
      ...prev,
      [area]: { ...ensureDetail(area), notes },
    }));
  };

  // ─── Navigation handlers ───

  const handleYes = () => {
    setHasInjuries(true);
    setStep('areas');
  };

  const handleNo = () => {
    setHasInjuries(false);
    updateOnboardingData({ injuries: [] });
    navigation.navigate('Review');
  };

  const handleAreasSelected = () => {
    if (selectedAreas.length > 0) {
      setCurrentInjuryIndex(0);
      setStep('severity');
    }
  };

  const handleSeverityNext = () => {
    setStep('triggers');
  };

  const handleTriggersNext = () => {
    setStep('notes');
  };

  const handleNotesNext = () => {
    if (currentInjuryIndex < totalInjuries - 1) {
      setCurrentInjuryIndex((prev) => prev + 1);
      setStep('severity');
    } else {
      // All injuries done — save and navigate
      const injuries: OnboardingInjury[] = selectedAreas.map((area) => {
        const detail = injuryDetails[area] || { movementTriggers: [], notes: '' };
        const parts: string[] = [];
        if (detail.severity) parts.push(detail.severity);
        if (detail.movementTriggers.length > 0) parts.push(`Triggers: ${detail.movementTriggers.join(', ')}`);
        if (detail.notes) parts.push(detail.notes);
        return {
          bodyArea: area,
          description: parts.join(' — ') || '',
          severity: detail.severity,
          movementTriggers: detail.movementTriggers,
          notes: detail.notes || undefined,
        };
      });
      updateOnboardingData({ injuries });
      navigation.navigate('Review');
    }
  };

  const handleBack = () => {
    if (step === 'notes') {
      setStep('triggers');
    } else if (step === 'triggers') {
      setStep('severity');
    } else if (step === 'severity') {
      if (currentInjuryIndex > 0) {
        setCurrentInjuryIndex((prev) => prev - 1);
        setStep('notes');
      } else {
        setStep('areas');
      }
    }
  };

  const isLastInjury = currentInjuryIndex === totalInjuries - 1;

  // ─── Step 1: Do you have injuries? ───
  if (step === 'question') {
    return (
      <OnboardingLayout
        stepLabel={stepLabel}
        progressPercent={progressPercent}
        onBack={() => navigation.goBack()}
        onContinue={() => {}}
        continueDisabled={true}
        continueLabel=""
      >
        <View style={styles.titleSection}>
          <Text variant="h1" color={colors.text.primary} style={styles.title}>
            Are you dealing with any injuries right now?
          </Text>
        </View>

        <View style={styles.choiceContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.choiceCard,
              hasInjuries === true && styles.choiceCardSelected,
              pressed && styles.choiceCardPressed,
            ]}
            onPress={handleYes}
          >
            <View>
              <Text style={styles.choiceLabel}>YES</Text>
              <Text style={styles.choiceSubtext}>I need training adjusted</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.choiceCard,
              hasInjuries === false && styles.choiceCardSelected,
              pressed && styles.choiceCardPressed,
            ]}
            onPress={handleNo}
          >
            <View>
              <Text style={styles.choiceLabel}>NO</Text>
              <Text style={styles.choiceSubtext}>No current issues</Text>
            </View>
          </Pressable>
        </View>
      </OnboardingLayout>
    );
  }

  // ─── Step 2: Select body areas ───
  if (step === 'areas') {
    return (
      <OnboardingLayout
        stepLabel={stepLabel}
        progressPercent={progressPercent}
        onBack={() => setStep('question')}
        onContinue={handleAreasSelected}
        continueDisabled={selectedAreas.length === 0}
        continueLabel="Next"
      >
        <View style={styles.titleSection}>
          <Text variant="h1" color={colors.text.primary} style={styles.title}>
            WHERE ARE YOU FEELING ISSUES?
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
            Select any areas
          </Text>
        </View>

        <View style={styles.chipsContainer}>
          {BODY_AREAS.map((area) => (
            <Pressable
              key={area}
              style={({ pressed }) => [
                styles.chip,
                selectedAreas.includes(area) && styles.chipSelected,
                pressed && !selectedAreas.includes(area) && styles.choiceCardPressed,
              ]}
              onPress={() => toggleArea(area)}
            >
              <Text
                variant="bodySmall"
                color={selectedAreas.includes(area) ? colors.text.inverse : colors.text.primary}
                style={styles.chipText}
              >
                {area}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.nothingMajor,
            pressed && styles.choiceCardPressed,
          ]}
          onPress={() => {
            updateOnboardingData({ injuries: [] });
            navigation.navigate('Review');
          }}
        >
          <Text style={styles.nothingMajorText}>No issues</Text>
        </Pressable>
      </OnboardingLayout>
    );
  }

  // ─── Shared progress indicator for detail steps ───
  const progressIndicator = (
    <View style={styles.progressRow}>
      <Text style={styles.progressText}>
        {currentArea} — {currentInjuryIndex + 1} of {totalInjuries}
      </Text>
      <View style={styles.dotRow}>
        {selectedAreas.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i <= currentInjuryIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );

  // ─── Step 3: Severity ───
  if (step === 'severity') {
    return (
      <OnboardingLayout
        stepLabel={stepLabel}
        progressPercent={progressPercent}
        onBack={handleBack}
        onContinue={handleSeverityNext}
        continueDisabled={!currentDetail.severity}
        continueLabel="Next"
      >
        {progressIndicator}

        <View style={styles.titleSection}>
          {/*
           * Single dynamic title now — used to render a "Let's start with
           * your groin" prelude + a separate "How bad is it?" sectionLabel.
           * Collapsed into one direct question because the progressIndicator
           * above already shows which area we're on, so the prelude was
           * redundant once the title itself names the area.
           */}
          <Text variant="h1" color={colors.text.primary} style={styles.title}>
            HOW BAD IS YOUR {currentArea?.toUpperCase()}?
          </Text>
        </View>

        <View style={styles.optionList}>
          {SEVERITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [
                styles.optionCard,
                currentDetail.severity === opt.value && styles.optionCardSelected,
                pressed && styles.choiceCardPressed,
              ]}
              onPress={() => updateSeverity(currentArea, opt.value)}
            >
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionLabel,
                    currentDetail.severity === opt.value && styles.optionLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                <Text
                  style={[
                    styles.optionSubtext,
                    currentDetail.severity === opt.value && styles.optionSubtextSelected,
                  ]}
                >
                  {opt.subtext}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </OnboardingLayout>
    );
  }

  // ─── Step 4: Movement triggers (context-aware) ───
  if (step === 'triggers') {
    const triggers = getTriggersForArea(currentArea);
    const selectedTriggers = currentDetail.movementTriggers;
    const atMax = selectedTriggers.length >= MAX_TRIGGERS;

    return (
      <OnboardingLayout
        stepLabel={stepLabel}
        progressPercent={progressPercent}
        onBack={handleBack}
        onContinue={handleTriggersNext}
        continueDisabled={selectedTriggers.length === 0}
        continueLabel="Next"
      >
        {progressIndicator}

        <View style={styles.titleSection}>
          <Text variant="h1" color={colors.text.primary} style={styles.title}>
            WHAT BRINGS IT ON?
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
            Select up to {MAX_TRIGGERS}
          </Text>
          {atMax && (
            <Text style={styles.maxText}>Max {MAX_TRIGGERS} selected</Text>
          )}
        </View>

        <View style={styles.triggerList}>
          {triggers.map((trigger) => {
            const isSelected = selectedTriggers.includes(trigger);
            const isDimmed = atMax && !isSelected;
            return (
              <Pressable
                key={trigger}
                style={({ pressed }) => [
                  styles.triggerChip,
                  isSelected && styles.triggerChipSelected,
                  pressed && !isSelected && styles.choiceCardPressed,
                  isDimmed && styles.triggerChipDimmed,
                ]}
                onPress={() => toggleTrigger(currentArea, trigger)}
              >
                <Text
                  style={[
                    styles.triggerChipText,
                    isSelected && styles.triggerChipTextSelected,
                    isDimmed && styles.triggerChipTextDimmed,
                  ]}
                >
                  {trigger}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </OnboardingLayout>
    );
  }

  // ─── Step 5: Optional notes ───
  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={handleBack}
      onContinue={handleNotesNext}
      continueDisabled={false}
      continueLabel={isLastInjury ? 'Continue' : 'Next injury'}
    >
      {progressIndicator}

      <View style={styles.titleSection}>
        <Text variant="h1" color={colors.text.primary} style={styles.title}>
          ANYTHING ELSE?
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
          Optional
        </Text>
      </View>

      <TextInput
        style={styles.notesInput}
        placeholder="e.g. Had surgery 6 months ago, avoiding heavy lifts"
        placeholderTextColor={colors.text.tertiary}
        multiline
        numberOfLines={4}
        value={currentDetail.notes}
        onChangeText={(text) => updateNotes(currentArea, text)}
        textAlignVertical="top"
      />
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  // ── Shared ──
  titleSection: {
    marginBottom: spacing.xl,
  },
  title: {
    ...headingXL,
    marginBottom: spacing.md,
  },
  subtitle: {
    lineHeight: 20,
  },

  // ── Step 1: Question ──
  choiceContainer: {
    gap: 10,
  },
  choiceCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
  },
  choiceCardSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
  },
  choiceCardPressed: {
    backgroundColor: colors.surface.tertiary,
  },
  choiceLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  choiceSubtext: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '400',
  },

  // ── Step 2: Area chips ──
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  chip: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    ...shadows.xs,
  },
  chipSelected: {
    backgroundColor: colors.accent.lime,
    borderColor: colors.accent.lime,
  },
  chipText: {
    fontWeight: '500',
  },
  nothingMajor: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  nothingMajorText: {
    color: colors.text.tertiary,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // ── Progress indicator ──
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  progressText: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surface.tertiary,
  },
  dotActive: {
    backgroundColor: colors.accent.lime,
  },

  // ── Severity cards ──
  sectionLabel: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
  },
  optionCardSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
  },
  optionContent: {
    flexDirection: 'column',
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  optionLabelSelected: {
    color: colors.accent.lime,
  },
  optionSubtext: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '400',
  },
  optionSubtextSelected: {
    color: colors.text.secondary,
  },

  // ── Movement triggers ──
  maxText: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  triggerList: {
    gap: 10,
  },
  triggerChip: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerChipSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
  },
  triggerChipDimmed: {
    opacity: 0.35,
  },
  triggerChipText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  triggerChipTextSelected: {
    color: colors.accent.lime,
  },
  triggerChipTextDimmed: {},
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: colors.text.inverse,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Notes input ──
  notesInput: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '400',
    minHeight: 120,
    lineHeight: 22,
  },
});
