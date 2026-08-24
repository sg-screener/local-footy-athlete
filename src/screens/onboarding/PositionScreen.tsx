import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import type { RoleBucket } from '../../types/domain';
import { ROLE_BUCKET_OPTIONS, normalizeRoleBucket } from '../../utils/roleBuckets';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';

type PositionScreenProps = NativeStackScreenProps<
  OnboardingStackParamList,
  'Position'
>;

/**
 * Full-width role list. Kept as a single list (no group headers) per
 * onboarding UX refresh — clean choices read faster than labelled stacks.
 *
 * Selection visuals come from the shared <SelectableTile /> primitive so
 * the look is identical to every other selection surface in the product.
 */
const ROLE_OPTIONS = ROLE_BUCKET_OPTIONS;

export const PositionScreen: React.FC<PositionScreenProps> = ({
  navigation,
}) => {
  const savedPosition = useProfileStore((state) => state.onboardingData.position);
  const [selectedPosition, setSelectedPosition] = useState<RoleBucket | null>(
    savedPosition ? normalizeRoleBucket(savedPosition) : null,
  );
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Position');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const handleSelect = useCallback((position: RoleBucket) => {
    setSelectedPosition(position);
    void commitAndAdvance({ position }, () => {
      setTimeout(() => navigation.navigate('Motivation'), 220);
    });
  }, [navigation, commitAndAdvance]);

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
      <View style={styles.titleSection}>
        <Text
          variant="h1"
          color={colors.text.primary}
          style={styles.title}
        >
          WHAT POSITION FITS YOU BEST?
        </Text>
        <Text
          variant="bodySmall"
          color={colors.text.secondary}
          style={styles.subtitle}
        >
          Your position gives LFA a small programming bias.
        </Text>
      </View>

      <View style={styles.list}>
        {ROLE_OPTIONS.map((role) => {
          const isSelected = selectedPosition === role.id;
          return (
            <SelectableTile
              key={role.id}
              isSelected={isSelected}
              onPress={() => handleSelect(role.id)}
              style={styles.tile}
            >
              <Text
                style={[
                  styles.tileText,
                  isSelected && styles.tileTextSelected,
                ]}
              >
                {role.label}
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
    marginBottom: spacing.xl,
  },
  title: {
    ...headingXL,
    marginBottom: spacing.sm,
  },
  subtitle: {
    lineHeight: 20,
  },
  list: {
    gap: 12,
    paddingBottom: spacing.xl,
  },
  tile: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 60,
  },
  tileText: {
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'left',
  },
  tileTextSelected: {
    color: colors.text.primary,
    fontWeight: '700',
  },
});
