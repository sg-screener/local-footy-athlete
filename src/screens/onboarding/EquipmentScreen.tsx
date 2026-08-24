import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, SelectableTile } from '../../components/common';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { OnboardingStackParamList } from '../../types/navigation';
import { savedEquipmentAnswer } from '../../store/profileStore';
import { useOnboardingProgress } from '../../hooks/useOnboardingProgress';
import { useOnboardingStepCommit } from '../../hooks/useOnboardingStepCommit';
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout';
import { headingXL } from '../../components/onboarding/onboardingStyles';
import type {
  ConditioningEquipmentModality,
  EquipmentAnswer,
} from '../../types/domain';
import {
  CONDITIONING_MODALITY_LABELS,
  EQUIPMENT_TAG_LABELS,
  derivedConditioningModalityQuestions,
  derivedEquipmentChecklistTags,
  type AskableEquipmentTag,
} from '../../rules/equipmentVocabulary';
import {
  EQUIPMENT_LOCATION_PRESETS,
  equipmentLocationPreset,
  type EquipmentLocationChoice,
} from '../../rules/equipmentLocationPresets';
import { todayISOLocal } from '../../utils/appDate';

/**
 * WHERE "CONTINUE" LANDS IS AN INPUT — SEAT_INBOX item 24, Sam 2026-08-13.
 *
 * WHY IT MOVED. Sam ruled the away flow must reuse THIS screen rather than grow
 * a second one: *"this is basically what happens in the onboarding process - now
 * it can just be inside the app"*. A door that can only be entered from
 * onboarding cannot be reused, so the exit had to stop being hard-coded.
 *
 * IT DEFAULTS TO TODAY'S BEHAVIOUR, AND THAT DIRECTION IS THE WHOLE RULING.
 * Onboarding passes NOTHING and is behaviourally identical; only a new caller
 * supplies its own return. **A required param would have made onboarding's
 * behaviour a caller's responsibility** — which is how a signed screen quietly
 * changes — so `onDone` is optional and the fallback lives here, beside the
 * screen that owns it.
 *
 * NOTHING ABOUT THE QUESTION CHANGES. Sam's audit ruling 3 stands untouched:
 * "where do you train" first, the choice PRE-TICKS the checklist, the athlete
 * unticks what their place lacks, and THE STORED ANSWER IS THE FINAL TICKED
 * LIST. This prop moves where the athlete goes afterwards, and nothing else.
 */
type EquipmentScreenProps = NativeStackScreenProps<OnboardingStackParamList, 'Equipment'> & {
  /**
   * Called instead of advancing to the next ONBOARDING step. Omitted by
   * onboarding, which keeps the original navigate.
   */
  readonly onDone?: () => void;
};

/**
 * THE EQUIPMENT DOOR — Sam's audit ruling 3 (2026-07-31), verbatim intent:
 * "Where do you train?" first; the choice PRE-TICKS the checklist as a visible
 * starting point; the athlete unticks what their place doesn't have and ticks
 * what it does. THE STORED ANSWER IS THE FINAL TICKED LIST — an athlete
 * decision, never an inference. The location choice is stored as coach context
 * only; nothing downstream reads it.
 *
 * The checklist's CONTENT is derived from the exercise library
 * (`rules/equipmentVocabulary`); the presets are seeds over that derived list
 * (`rules/equipmentLocationPresets`). Ticks only at onboarding: an untick is
 * simply HAVE = no. Permanent NEVER exclusions live on the profile equipment
 * surface. Continuing with nothing ticked is a real answer — bodyweight-only
 * programming, never a refusal.
 */
export const EquipmentScreen: React.FC<EquipmentScreenProps> = ({ navigation, onDone }) => {
  // Seeded once on mount from the store's own named door.
  const existing = savedEquipmentAnswer();
  const { label: stepLabel, progressPercent } = useOnboardingProgress('Equipment');
  const { commitAndAdvance, saving, saveError } = useOnboardingStepCommit();

  const [location, setLocation] = useState<EquipmentLocationChoice | null>(null);
  const [tickedTags, setTickedTags] = useState<ReadonlySet<AskableEquipmentTag>>(() =>
    new Set(
      Object.entries(existing?.tags ?? {})
        .filter(([, possession]) => possession === 'have')
        .map(([tag]) => tag as AskableEquipmentTag),
    ));
  const [tickedModalities, setTickedModalities] = useState<ReadonlySet<ConditioningEquipmentModality>>(() =>
    new Set(
      Object.entries(existing?.modalities ?? {})
        .filter(([, possession]) => possession === 'have')
        .map(([modality]) => modality as ConditioningEquipmentModality),
    ));
  // Editing an already-given answer skips the location question — the ticks on
  // screen ARE the athlete's saved decision, and re-seeding would overwrite it.
  const [showChecklist, setShowChecklist] = useState<boolean>(!!existing);

  const askableTags = useMemo(
    () => derivedEquipmentChecklistTags() as AskableEquipmentTag[],
    [],
  );
  const askableModalities = useMemo(() => derivedConditioningModalityQuestions(), []);

  const chooseLocation = useCallback((choice: EquipmentLocationChoice) => {
    const preset = equipmentLocationPreset(choice);
    setLocation(choice);
    setTickedTags(new Set(preset.preTickedTags));
    setTickedModalities(new Set(preset.preTickedModalities));
    setShowChecklist(true);
  }, []);

  const toggleTag = useCallback((tag: AskableEquipmentTag) => {
    setTickedTags((previous) => {
      const next = new Set(previous);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }, []);
  const toggleModality = useCallback((modality: ConditioningEquipmentModality) => {
    setTickedModalities((previous) => {
      const next = new Set(previous);
      if (next.has(modality)) next.delete(modality); else next.add(modality);
      return next;
    });
  }, []);

  const handleContinue = useCallback(() => {
    // The FINAL TICKED LIST is the stored decision. NEVER marks made earlier on
    // the profile surface survive an onboarding-side re-tick edit only if the
    // athlete did not tick that item; a tick is the newer decision and wins.
    const tags: Record<string, EquipmentAnswer['tags'][AskableEquipmentTag]> = {};
    for (const tag of askableTags) {
      if (tickedTags.has(tag)) tags[tag] = 'have';
      else if (existing?.tags[tag] === 'never') tags[tag] = 'never';
    }
    const modalities: Record<string, EquipmentAnswer['modalities'][ConditioningEquipmentModality]> = {};
    for (const modality of askableModalities) {
      if (tickedModalities.has(modality)) modalities[modality] = 'have';
      else if (existing?.modalities[modality] === 'never') modalities[modality] = 'never';
    }
    const answer: EquipmentAnswer = { tags, modalities, answeredOn: todayISOLocal() };
    void commitAndAdvance(
      {
        equipmentAnswer: answer,
        // Context only (coach flavour) — declared coach_context_only; nothing
        // downstream reads it (Sam's ruling 3).
        ...(location ? { trainingLocation: equipmentLocationPreset(location).storesLocation } : {}),
      },
      // THE DEFAULT IS THE OLD LINE, VERBATIM. Onboarding passes no `onDone`,
      // so this resolves to exactly what shipped before item 24.
      onDone ?? (() => navigation.navigate('GymExperience')),
    );
  }, [askableTags, askableModalities, tickedTags, tickedModalities, existing, location,
    commitAndAdvance, navigation, onDone]);

  if (!showChecklist) {
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
        <View style={styles.section}>
          <Text variant="h1" color={colors.text.primary} style={styles.title}>
            Where do you train?
          </Text>
          <Text variant="body" color={colors.text.secondary} style={styles.subtitle}>
            We'll start the equipment list from your answer — you'll fine-tune it next.
          </Text>
          <View style={styles.tiles}>
            {EQUIPMENT_LOCATION_PRESETS.map((preset) => (
              <SelectableTile
                key={preset.id}
                isSelected={location === preset.id}
                onPress={() => chooseLocation(preset.id)}
                style={styles.tile}
              >
                <Text variant="bodyEmphasis" color={colors.text.primary}>
                  {preset.label}
                </Text>
              </SelectableTile>
            ))}
          </View>
        </View>
      </OnboardingLayout>
    );
  }

  const renderTick = (
    key: string,
    label: string,
    ticked: boolean,
    onPress: () => void,
  ) => (
    <SelectableTile key={key} isSelected={ticked} onPress={onPress} style={styles.tile}>
      <View style={styles.tileRow}>
        <Text
          variant="bodyEmphasis"
          color={ticked ? colors.text.primary : colors.text.secondary}
        >
          {label}
        </Text>
        <Text variant="caption" color={ticked ? colors.text.secondary : colors.text.tertiary}>
          {ticked ? 'Have it' : ''}
        </Text>
      </View>
    </SelectableTile>
  );

  return (
    <OnboardingLayout
      stepLabel={stepLabel}
      progressPercent={progressPercent}
      onBack={() => (existing ? navigation.goBack() : setShowChecklist(false))}
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
          We've ticked the usual kit{location ? ` for a ${equipmentLocationPreset(location).label.toLowerCase()}` : ''}.
          Untick anything your place doesn't have, and tick anything extra it does.
        </Text>

        <Text variant="bodyEmphasis" color={colors.text.primary} style={styles.groupHeading}>
          Gym equipment
        </Text>
        <View style={styles.tiles}>
          {askableTags.map((tag) =>
            renderTick(tag, EQUIPMENT_TAG_LABELS[tag], tickedTags.has(tag), () => toggleTag(tag)))}
        </View>

        <Text variant="bodyEmphasis" color={colors.text.primary} style={styles.groupHeading}>
          Cardio machines
        </Text>
        <View style={styles.tiles}>
          {askableModalities.map((modality) =>
            renderTick(
              modality,
              CONDITIONING_MODALITY_LABELS[modality],
              tickedModalities.has(modality),
              () => toggleModality(modality),
            ))}
        </View>
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
});
