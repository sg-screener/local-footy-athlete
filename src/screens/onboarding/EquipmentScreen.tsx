import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { useProfileStore } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import type {
  ConditioningEquipmentModality,
  EquipmentAnswer,
  EquipmentPossession,
} from '../../types/domain';
import {
  CONDITIONING_MODALITY_LABELS,
  EQUIPMENT_TAG_LABELS,
  derivedConditioningModalityQuestions,
  derivedEquipmentChecklistTags,
  type AskableEquipmentTag,
} from '../../rules/equipmentVocabulary';
import { todayISOLocal } from '../../utils/appDate';

type EquipmentScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'Equipment'>;

/**
 * THE EQUIPMENT DOOR — the onboarding step AND the answer's edit surface.
 *
 * The checklist's content is DERIVED from the exercise library (Sam's ruling 1,
 * 2026-07-31): `derivedEquipmentChecklistTags` / `derivedConditioningModalityQuestions`
 * are the items, and `test:equipment-vocabulary` holds them equal to what the
 * library can require. Nothing here lists equipment by hand.
 *
 * Each item cycles: unmarked ("not today") → HAVE → NEVER → unmarked. The two
 * marked states carry different silences (ownership sheet §2.2): NEVER is a
 * standing "stop offering this", HAVE is the athlete's kit. Continuing with
 * nothing marked is a real answer — bodyweight-only programming, never a refusal.
 */
export const EquipmentScreen: React.FC<EquipmentScreenProps> = ({ navigation }) => {
  const existing = useProfileStore((state) => state.onboardingData.equipmentAnswer);
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Equipment');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const [tags, setTags] = useState<Partial<Record<AskableEquipmentTag, EquipmentPossession>>>(
    () => ({ ...(existing?.tags as Partial<Record<AskableEquipmentTag, EquipmentPossession>>) }),
  );
  const [modalities, setModalities] = useState<
    Partial<Record<ConditioningEquipmentModality, EquipmentPossession>>
  >(() => ({ ...existing?.modalities }));

  const askableTags = useMemo(
    () => derivedEquipmentChecklistTags() as AskableEquipmentTag[],
    [],
  );
  const askableModalities = useMemo(() => derivedConditioningModalityQuestions(), []);

  const cycle = (current: EquipmentPossession | undefined): EquipmentPossession | undefined =>
    current === undefined ? 'have' : current === 'have' ? 'never' : undefined;

  const handleContinue = useCallback(() => {
    const answer: EquipmentAnswer = {
      tags,
      modalities,
      answeredOn: todayISOLocal(),
    };
    void commitAndAdvance({ equipmentAnswer: answer }, () =>
      navigation.navigate('GymExperience'));
  }, [tags, modalities, commitAndAdvance, navigation]);

  const renderItem = (
    key: string,
    label: string,
    possession: EquipmentPossession | undefined,
    onPress: () => void,
  ) => (
    <SelectableTile
      key={key}
      isSelected={possession === 'have'}
      onPress={onPress}
      style={styles.tile}
    >
      <View style={styles.tileRow}>
        <Text
          variant="bodyEmphasis"
          color={
            possession === 'have'
              ? colors.text.primary
              : possession === 'never'
                ? colors.text.tertiary
                : colors.text.secondary
          }
          style={possession === 'never' ? styles.neverLabel : undefined}
        >
          {label}
        </Text>
        <Text
          variant="caption"
          color={possession === 'have' ? colors.text.secondary : colors.text.tertiary}
        >
          {possession === 'have' ? 'Have it' : possession === 'never' ? 'Never' : ''}
        </Text>
      </View>
    </SelectableTile>
  );

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => navigation.goBack()}
      saving={saving}
      saveError={saveError}
      onContinue={handleContinue}
      continueDisabled={false}
    >
      <View style={styles.section}>
        <Text variant="h1" color={colors.text.primary} style={styles.title}>
          What can you train with?
        </Text>
        <Text variant="body" color={colors.text.secondary} style={styles.subtitle}>
          Tap once for what you have. Tap again for gear you'll never use — we'll stop
          offering it. Leave the rest blank.
        </Text>

        <Text variant="bodyEmphasis" color={colors.text.primary} style={styles.groupHeading}>
          Gym equipment
        </Text>
        <View style={styles.tiles}>
          {askableTags.map((tag) =>
            renderItem(tag, EQUIPMENT_TAG_LABELS[tag], tags[tag], () =>
              setTags((previous) => ({ ...previous, [tag]: cycle(previous[tag]) }))),
          )}
        </View>

        <Text variant="bodyEmphasis" color={colors.text.primary} style={styles.groupHeading}>
          Cardio machines
        </Text>
        <View style={styles.tiles}>
          {askableModalities.map((modality) =>
            renderItem(modality, CONDITIONING_MODALITY_LABELS[modality], modalities[modality], () =>
              setModalities((previous) => ({
                ...previous,
                [modality]: cycle(previous[modality]),
              }))),
          )}
        </View>

        <Text variant="caption" color={colors.text.tertiary} style={styles.noneNote}>
          Nothing here? Continue anyway — you'll get a bodyweight program.
        </Text>
      </View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...headingXL,
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 20,
    marginBottom: 20,
  },
  groupHeading: {
    marginBottom: 8,
    marginTop: 8,
  },
  tiles: {
    gap: 10,
    marginBottom: 16,
  },
  tile: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 24,
  },
  neverLabel: {
    textDecorationLine: 'line-through',
  },
  noneNote: {
    marginTop: 4,
  },
});
