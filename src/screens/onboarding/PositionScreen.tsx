import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { Position } from '../../types/domain';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type PositionScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Position'
>;

/**
 * Flat 2-column grid. Reads left→right, back-line first. Kept as a single
 * list (no group headers) per onboarding UX refresh — clean grid reads
 * faster than three labelled stacks for six tiles.
 *
 * Selection visuals come from the shared <SelectableTile /> primitive so
 * the look is identical to every other selection surface in the product.
 */
const POSITIONS: { id: Position; label: string }[] = [
  { id: 'Small back', label: 'Small back' },
  { id: 'Key back', label: 'Key back' },
  { id: 'Midfielder', label: 'Midfielder' },
  { id: 'Ruck', label: 'Ruck' },
  { id: 'Small forward', label: 'Small forward' },
  { id: 'Key forward', label: 'Key forward' },
];

export const PositionScreen: React.FC<PositionScreenProps> = ({
  navigation,
}) => {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Position');
  const updateOnboardingData = useProfileStore(
    (state) => state.updateOnboardingData
  );

  const handleSelect = useCallback((position: Position) => {
    setSelectedPosition(position);
    updateOnboardingData({ position });
    setTimeout(() => {
      navigation.navigate('Motivation');
    }, 220);
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
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          What position do you play?
        </Text>
      </View>

      <View style={styles.grid}>
        {POSITIONS.map((position) => {
          const isSelected = selectedPosition === position.id;
          return (
            <SelectableTile
              key={position.id}
              isSelected={isSelected}
              onPress={() => handleSelect(position.id)}
              style={styles.tile}
            >
              <Text
                style={[
                  styles.tileText,
                  isSelected && styles.tileTextSelected,
                ]}
              >
                {position.label}
              </Text>
            </SelectableTile>
          );
        })}
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  titleSection: {
    marginBottom: 28,
  },
  title: {
    ...headingXL,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    // Two columns: (100% - 10px gap) / 2 → use flexBasis with subtraction.
    flexBasis: '48.5%',
    flexGrow: 1,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  tileText: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  tileTextSelected: {
    color: colors.text.primary,
    fontWeight: '700',
  },
});
