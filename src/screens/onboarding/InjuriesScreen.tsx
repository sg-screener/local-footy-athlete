import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import {
  answerCardSubtitle,
  answerCardTitle,
  headingXL,
} from '../../components/onboarding/onboardingStyles';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { colors } from '../../theme/colors';
import { OnboardingStackParamList } from '../../types/navigation';
import type { InjurySeverity, OnboardingInjury } from '../../types/domain';
import {
  GUIDED_INJURY_AREA_HINT,
  GUIDED_INJURY_AREA_OPTIONS,
  GUIDED_INJURY_REGION_OPTIONS,
  GUIDED_INJURY_SEVERITY_OPTIONS,
  type GuidedInjuryRegion,
  type GuidedInjurySeverityBand,
} from '../../utils/guidedInjuryControl';

type InjuriesScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Injuries'
>;

type InternalStep = 'question' | 'region' | 'area' | 'severity' | 'more';

const INJURY_BOTTOM_SCROLL_PADDING = 48;

function onboardingSeverity(band: GuidedInjurySeverityBand): InjurySeverity {
  if (band === 'mild') return 'Mild';
  if (band === 'slight') return 'Moderate';
  return 'Severe';
}

export const InjuriesScreen: React.FC<InjuriesScreenProps> = ({ navigation }) => {
  const [step, setStep] = useState<InternalStep>('question');
  const [region, setRegion] = useState<GuidedInjuryRegion | null>(null);
  const [area, setArea] = useState('');
  const [severityBand, setSeverityBand] = useState<GuidedInjurySeverityBand | null>(null);
  const [injuries, setInjuries] = useState<OnboardingInjury[]>([]);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Injuries');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const saveNoIssues = () => {
    void commitAndAdvance({ injuries: [] }, () => navigation.navigate('Review'));
  };

  const chooseRegion = (nextRegion: GuidedInjuryRegion) => {
    setRegion(nextRegion);
    setArea('');
    setSeverityBand(null);
    setStep('area');
  };

  const chooseArea = (nextArea: string) => {
    setArea(nextArea);
    setSeverityBand(null);
    setStep('severity');
  };

  const addCurrentInjury = () => {
    const option = GUIDED_INJURY_SEVERITY_OPTIONS.find(
      (candidate) => candidate.severityBand === severityBand,
    );
    if (!region || !area || !option) return;

    const injury: OnboardingInjury = {
      bodyArea: area,
      description: `${option.label} - ${option.sub}`,
      severity: onboardingSeverity(option.severityBand),
      severityScore: option.severity,
    };
    setInjuries((current) => [...current, injury]);
    setStep('more');
  };

  const addAnotherInjury = () => {
    setRegion(null);
    setArea('');
    setSeverityBand(null);
    setStep('region');
  };

  const editLastInjury = () => {
    const lastInjury = injuries[injuries.length - 1];
    const previousRegion = Object.entries(GUIDED_INJURY_AREA_OPTIONS).find(
      ([, options]) => options.includes(lastInjury?.bodyArea ?? ''),
    )?.[0] as GuidedInjuryRegion | undefined;
    const previousSeverity = GUIDED_INJURY_SEVERITY_OPTIONS.find(
      (option) => option.severity === lastInjury?.severityScore,
    )?.severityBand;
    if (!lastInjury || !previousRegion || !previousSeverity) return;

    setRegion(previousRegion);
    setArea(lastInjury.bodyArea);
    setSeverityBand(previousSeverity);
    setInjuries((current) => current.slice(0, -1));
    setStep('severity');
  };

  const finishInjuries = () => {
    void commitAndAdvance({ injuries }, () => navigation.navigate('Review'));
  };

  if (step === 'question') {
    return (
      <OnboardingLayout
        stepLabel={stepLabel}
        progressPercent={progressPercent}
        onBack={() => navigation.goBack()}
        saving={saving}
        saveError={saveError}
        onContinue={() => {}}
        hideFooter
      >
        <Title
          title="ARE YOU DEALING WITH ANY INJURIES RIGHT NOW?"
          subtitle="So we can adjust your training safely."
        />
        <View style={styles.optionList}>
          <OptionCard
            label="YES"
            subtext="I need training adjusted"
            onPress={() => setStep('region')}
          />
          <OptionCard
            label="NO"
            subtext="No current issues"
            onPress={saveNoIssues}
          />
        </View>
      </OnboardingLayout>
    );
  }

  if (step === 'region') {
    return (
      <OnboardingLayout
        stepLabel={stepLabel}
        progressPercent={progressPercent}
        onBack={() => setStep(injuries.length > 0 ? 'more' : 'question')}
        saving={saving}
        saveError={saveError}
        onContinue={() => {}}
        hideFooter
        scrollContentExtraBottomPadding={INJURY_BOTTOM_SCROLL_PADDING}
      >
        <Title title="WHERE IS THE ISSUE?" />
        <View style={styles.optionList}>
          {GUIDED_INJURY_REGION_OPTIONS.map((option) => (
            <OptionCard
              key={option.id}
              label={option.label}
              selected={region === option.id}
              onPress={() => chooseRegion(option.id)}
            />
          ))}
          <OptionCard
            label={injuries.length > 0 ? 'No more injuries' : 'No issues after all'}
            muted
            onPress={injuries.length > 0 ? finishInjuries : saveNoIssues}
          />
        </View>
      </OnboardingLayout>
    );
  }

  if (step === 'area' && region) {
    return (
      <OnboardingLayout
        stepLabel={stepLabel}
        progressPercent={progressPercent}
        onBack={() => setStep('region')}
        saving={saving}
        saveError={saveError}
        onContinue={() => {}}
        hideFooter
        scrollContentExtraBottomPadding={INJURY_BOTTOM_SCROLL_PADDING}
      >
        <Title title="WHERE IS THE ISSUE?" subtitle={GUIDED_INJURY_AREA_HINT} />
        <View style={styles.optionList}>
          {GUIDED_INJURY_AREA_OPTIONS[region].map((option) => (
            <OptionCard
              key={option}
              label={option}
              selected={area === option}
              onPress={() => chooseArea(option)}
            />
          ))}
        </View>
      </OnboardingLayout>
    );
  }

  if (step === 'severity') {
    return (
      <OnboardingLayout
        stepLabel={stepLabel}
        progressPercent={progressPercent}
        onBack={() => setStep('area')}
        onContinue={addCurrentInjury}
        continueDisabled={!severityBand}
        continueLabel="Continue"
        saving={saving}
        saveError={saveError}
        scrollContentExtraBottomPadding={INJURY_BOTTOM_SCROLL_PADDING}
      >
        <Title title={`HOW SEVERE IS YOUR ${area.toUpperCase()} ISSUE?`} />
        <View style={styles.optionList}>
          {GUIDED_INJURY_SEVERITY_OPTIONS.map((option) => (
            <OptionCard
              key={option.severityBand}
              label={option.label}
              subtext={option.sub}
              selected={severityBand === option.severityBand}
              onPress={() => setSeverityBand(option.severityBand)}
            />
          ))}
        </View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={editLastInjury}
      onContinue={() => {}}
      saving={saving}
      saveError={saveError}
      hideFooter
    >
      <Title title="ANY MORE INJURIES?" />
      <View style={styles.optionList}>
        <OptionCard label="YES" subtext="Add another injury" onPress={addAnotherInjury} />
        <OptionCard label="NO" subtext="That’s everything" onPress={finishInjuries} />
      </View>
    </OnboardingLayout>
  );
};

function Title({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleSection}>
      <Text variant="h1" color={colors.text.primary} style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function OptionCard({
  label,
  subtext,
  selected = false,
  muted = false,
  onPress,
}: {
  label: string;
  subtext?: string;
  selected?: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.optionCard,
        selected && styles.optionCardSelected,
        muted && styles.optionCardMuted,
        pressed && styles.optionCardPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected, muted && styles.mutedText]}>
        {label}
      </Text>
      {subtext ? <Text style={styles.optionSubtext}>{subtext}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: 24,
  },
  title: {
    ...headingXL,
    marginBottom: 12,
  },
  subtitle: {
    lineHeight: 20,
  },
  optionList: {
    gap: 10,
  },
  optionCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 17,
    borderWidth: 1.5,
    borderColor: colors.surface.tertiary,
  },
  optionCardSelected: {
    borderColor: colors.accent.lime,
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
  },
  optionCardMuted: {
    marginTop: 6,
  },
  optionCardPressed: {
    backgroundColor: colors.surface.tertiary,
  },
  optionLabel: {
    ...answerCardTitle,
    color: colors.text.primary,
  },
  optionLabelSelected: {
    color: colors.accent.lime,
  },
  optionSubtext: {
    ...answerCardSubtitle,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  mutedText: {
    color: colors.text.secondary,
  },
});
