import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { G, Path } from 'react-native-svg';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { SeasonPhase } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type SeasonPhaseScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'SeasonPhase'
>;

type PhaseOption = {
  id: SeasonPhase;
  label: string;
  tagline: string;
  icon:
    | {
        type: 'material';
        name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
      }
    | { type: 'aflFooty' };
};

const PHASE_OPTIONS: PhaseOption[] = [
  {
    id: 'Off-season',
    label: 'Off-season',
    tagline: 'Build your base',
    icon: { type: 'material', name: 'dumbbell' },
  },
  {
    id: 'Pre-season',
    label: 'Pre-season',
    tagline: 'Get game-ready',
    icon: { type: 'material', name: 'heart-pulse' },
  },
  {
    id: 'In-season',
    label: 'In-season',
    tagline: 'Stay strong & fresh',
    icon: { type: 'aflFooty' },
  },
];

// Mirrors assets/icons/afl-training.svg; the app uses react-native-svg
// components directly rather than importing .svg files.
const AflFootyIcon: React.FC<{ color: string; size: number }> = ({
  color,
  size,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <G rotation={90} origin="12, 12">
      <Path
        d="M3.8 12c1.7-3.1 4.5-4.8 8.2-4.8s6.5 1.7 8.2 4.8c-1.7 3.1-4.5 4.8-8.2 4.8S5.5 15.1 3.8 12z"
        stroke={color}
        strokeWidth={2.05}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7.5 12h9"
        stroke={color}
        strokeWidth={2.05}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.2 10.6v2.8"
        stroke={color}
        strokeWidth={2.05}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 10.4v3.2"
        stroke={color}
        strokeWidth={2.05}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.8 10.6v2.8"
        stroke={color}
        strokeWidth={2.05}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  </Svg>
);

/**
 * Phase picker. Selection visuals come from the shared <SelectableTile />
 * primitive — the previous inline radio dot was removed in favour of the
 * canonical corner checkmark so every selection surface looks identical.
 */
export const SeasonPhaseScreen: React.FC<SeasonPhaseScreenProps> = ({
  navigation,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<SeasonPhase | null>(null);
  const { label: stepLabel, progressPercent } =
    useOnboardingProgress('SeasonPhase');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData,
  );

  const handleSelect = useCallback((phase: SeasonPhase) => {
    setSelectedPhase(phase);
    updateOnboardingData({ seasonPhase: phase });

    setTimeout(() => {
      if (phase === 'Off-season') {
        navigation.navigate('TrainingCommitment');
      } else if (phase === 'Pre-season') {
        navigation.navigate('TeamTrainingDays');
      } else {
        navigation.navigate('GameDay');
      }
    }, 300);
  }, [navigation, updateOnboardingData]);

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      onContinue={() => {}}
      hideFooter
    >
      <View style={styles.titleSection}>
        <Text variant="h1" color={colors.text.primary} style={styles.title}>
          Where are you in your season?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          So your plan matches the phase you're in.
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {PHASE_OPTIONS.map((phase) => {
          const isSelected = selectedPhase === phase.id;
          const iconColor = isSelected
            ? colors.accent.lime
            : colors.text.secondary;
          return (
            <SelectableTile
              key={phase.id}
              isSelected={isSelected}
              onPress={() => handleSelect(phase.id)}
              style={styles.card}
            >
              <View style={styles.cardContent}>
                <View
                  style={[
                    styles.iconBox,
                    isSelected && styles.iconBoxSelected,
                  ]}
                >
                  {phase.icon.type === 'aflFooty' ? (
                    <AflFootyIcon color={iconColor} size={26} />
                  ) : (
                    <MaterialCommunityIcons
                      name={phase.icon.name}
                      size={20}
                      color={iconColor}
                    />
                  )}
                </View>
                <View style={styles.cardTextBlock}>
                  <Text variant="h4" color={colors.text.primary}>
                    {phase.label}
                  </Text>
                  <Text
                    variant="bodySmall"
                    color={
                      isSelected ? colors.accent.lime : colors.text.secondary
                    }
                    style={styles.cardTagline}
                  >
                    {phase.tagline}
                  </Text>
                </View>
              </View>
            </SelectableTile>
          );
        })}
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: spacing.xl,
  },
  title: {
    ...headingXL,
    marginBottom: spacing.sm,
  },
  subtitle: {
    lineHeight: 20,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 24,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  iconBoxSelected: {
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderColor: 'rgba(200,255,0,0.18)',
  },
  cardTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardTagline: {
    lineHeight: 20,
    marginTop: 4,
  },
});
