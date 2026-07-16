import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useProgramStore } from '../../store/programStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useProfileStore } from '../../store/profileStore';
import { computeGameDatesForBlock } from '../../utils/sessionResolver';
import { todayISOLocal } from '../../utils/appDate';
import { addDaysISO } from '../../utils/programBlockState';
import type { ProgramStackParamList } from '../../types/navigation';
import type { ProgramPhase } from '../../types/domain';

type ProgramCreateScreenProps = NativeStackScreenProps<ProgramStackParamList, 'ProgramCreate'>;

const PHASES: { label: string; value: ProgramPhase; description: string }[] = [
  {
    label: 'Post-Season',
    value: 'Post-Season',
    description: 'Recovery and deload after competition',
  },
  {
    label: 'Early-Off-Season',
    value: 'Early-Off-Season',
    description: 'Build work capacity and general fitness',
  },
  {
    label: 'Base-Building',
    value: 'Base-Building',
    description: 'Develop strength and power foundation',
  },
  {
    label: 'Pre-Season-Skills',
    value: 'Pre-Season-Skills',
    description: 'Integrate strength with sport-specific movement',
  },
  {
    label: 'Christmas-Block',
    value: 'Christmas-Block',
    description: 'High intensity block before season',
  },
  {
    label: 'Return-to-Skills',
    value: 'Return-to-Skills',
    description: 'Tactical and skill preparation',
  },
  {
    label: 'In-Season',
    value: 'In-Season',
    description: 'Maintain fitness during competition',
  },
];

const PHASE_DETAILS: Record<ProgramPhase, string> = {
  'Post-Season': 'Focus on recovery, light conditioning, and mental rest. Perfect for resetting after a demanding season.',
  'Early-Off-Season': 'Build general work capacity with varied movements. Prepare the body for more intense training.',
  'Base-Building': 'Develop strength and power using compound movements. The foundation for all other training phases.',
  'Pre-Season-Skills': 'Combine strength with sport-specific movements. Prepare for tactical demands of the game.',
  'Christmas-Block': 'High-intensity block to peak fitness before season starts. Focuses on power and explosiveness.',
  'Return-to-Skills': 'Tactical preparation with skill integration. Lower injury risk while maintaining fitness.',
  'In-Season': 'Maintain strength and fitness while managing recovery during competition weeks.',
};

export default function ProgramCreateScreen({ navigation }: ProgramCreateScreenProps) {
  const [selectedPhase, setSelectedPhase] = useState<ProgramPhase>('Base-Building');
  const [isGenerating, setIsGenerating] = useState(false);

  const { setCurrentProgram, setGenerating } = useProgramStore();
  const setGameDay = useCalendarStore((state) => state.setGameDay);
  const onboardingData = useProfileStore((state) => state.onboardingData);

  const handleGenerateProgram = async () => {
    setIsGenerating(true);
    setGenerating(true);

    try {
      // Simulate API call to generate program
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create mock program
      const todayISO = todayISOLocal();
      const newProgram = {
        id: `prog-${Date.now()}`,
        userId: 'user-1',
        name: `${selectedPhase} Program`,
        description: `Personalized ${selectedPhase} training program`,
        programPhase: selectedPhase,
        startDate: todayISO,
        endDate: addDaysISO(todayISO, 12 * 7),
        microcycles: generateMicrocycles(),
        primaryFocus: 'Comprehensive',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Manual program creation is a TRUE fresh slate — clear overrides
      // explicitly (setCurrentProgram no longer wipes them implicitly).
      useProgramStore.getState().clearManualOverrides();
      setCurrentProgram(newProgram);

      // Seed calendar with game dates for the new block (same pattern as onboarding).
      // Without this, the resolver has no game marks and can't compute
      // game proximity (G-1 pump, G+1 recovery, etc.).
      const selectedGameDay = onboardingData?.gameDay;
      if (selectedGameDay && selectedGameDay !== 'Varies' && newProgram.startDate && newProgram.endDate) {
        const gameDates = computeGameDatesForBlock(
          selectedGameDay,
          newProgram.startDate,
          newProgram.endDate,
        );
        gameDates.forEach((date) => setGameDay(date));
      }

      navigation.navigate('ProgramDetail');
    } catch (error) {
      console.error('Failed to generate program:', error);
    } finally {
      setIsGenerating(false);
      setGenerating(false);
    }
  };

  const generateMicrocycles = () => {
    const microcycles = [];
    const todayISO = todayISOLocal();
    for (let i = 1; i <= 12; i++) {
      const startDate = addDaysISO(todayISO, (i - 1) * 7);
      const endDate = addDaysISO(startDate, 6);

      microcycles.push({
        id: `micro-${i}`,
        programId: `prog-${Date.now()}`,
        weekNumber: i,
        startDate,
        endDate,
        miniCycleNumber: Math.ceil(i / 4),
        intensityMultiplier: 0.8 + Math.random() * 0.4,
        workouts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return microcycles;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text variant="h3" color={colors.text.primary}>
            ←
          </Text>
        </Pressable>
        <Text variant="h2" color={colors.text.primary} style={styles.title}>
          Generate Your Program
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="body" color={colors.text.secondary} style={styles.description}>
          Select the training phase that best matches your current goals and schedule.
        </Text>

        {/* Phase Selector */}
        <View style={styles.phasesContainer}>
          {PHASES.map((phase) => (
            <Pressable
              key={phase.value}
              onPress={() => setSelectedPhase(phase.value)}
              style={[
                styles.phaseCard,
                selectedPhase === phase.value && styles.phaseCardSelected,
              ]}
            >
              <Text
                variant="bodyEmphasis"
                color={
                  selectedPhase === phase.value ? colors.accent.lime : colors.text.primary
                }
                align="center"
              >
                {phase.label}
              </Text>
              <Text
                variant="caption"
                color={colors.text.tertiary}
                align="center"
                style={styles.phaseDescription}
              >
                {phase.description}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Phase Info */}
        <View style={styles.infoSection}>
          <Card>
            <Text variant="bodySmallEmphasis" color={colors.text.primary}>
              About this phase
            </Text>
            <Text
              variant="body"
              color={colors.text.secondary}
              style={styles.infoText}
            >
              {PHASE_DETAILS[selectedPhase]}
            </Text>
          </Card>
        </View>

        {/* Duration Info */}
        <View style={styles.infoSection}>
          <Card>
            <Text variant="bodySmallEmphasis" color={colors.text.primary}>
              Program Duration
            </Text>
            <Text
              variant="body"
              color={colors.text.secondary}
              style={styles.infoText}
            >
              12 weeks of carefully structured training with progressive overload and recovery weeks.
            </Text>
          </Card>
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Generate Program"
          onPress={handleGenerateProgram}
          variant="primary"
          fullWidth
          disabled={isGenerating}
          loading={isGenerating}
        />
      </View>

      {/* Loading Modal */}
      <Modal
        visible={isGenerating}
        transparent
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={colors.accent.lime}
            />
            <Text
              variant="h3"
              color={colors.text.primary}
              align="center"
              style={styles.loadingText}
            >
              Building your program...
            </Text>
            <Text
              variant="body"
              color={colors.text.secondary}
              align="center"
            >
              This usually takes about 30 seconds
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.secondary,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  title: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  description: {
    marginBottom: spacing.lg,
  },
  phasesContainer: {
    marginBottom: spacing.xl,
  },
  phaseCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderColor: colors.surface.tertiary,
    borderWidth: 1,
  },
  phaseCardSelected: {
    borderColor: colors.accent.lime,
    borderWidth: 2,
    backgroundColor: 'rgba(200, 255, 0, 0.05)',
  },
  phaseDescription: {
    marginTop: spacing.xs,
  },
  infoSection: {
    marginBottom: spacing.lg,
  },
  infoText: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 250,
  },
  loadingText: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
