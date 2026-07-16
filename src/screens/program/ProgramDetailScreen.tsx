import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  FlatList,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useProgramStore } from '../../store/programStore';
import type { ProgramStackParamList } from '../../types/navigation';
import { todayISOLocal } from '../../utils/appDate';

type ProgramDetailScreenProps = NativeStackScreenProps<ProgramStackParamList, 'ProgramDetail'>;

// Mock data
const MOCK_PROGRAM = {
  id: 'prog-1',
  userId: 'user-1',
  name: 'Strength & Power Block',
  description: 'Building raw strength and explosive power',
  programPhase: 'Base-Building' as const,
  startDate: '2025-01-20',
  endDate: '2025-04-20',
  microcycles: [
    {
      id: 'micro-1',
      programId: 'prog-1',
      weekNumber: 1,
      startDate: '2025-01-20',
      endDate: '2025-01-26',
      miniCycleNumber: 1,
      intensityMultiplier: 0.8,
      workouts: [],
      createdAt: '2025-01-20T00:00:00Z',
      updatedAt: '2025-01-20T00:00:00Z',
    },
    {
      id: 'micro-2',
      programId: 'prog-1',
      weekNumber: 2,
      startDate: '2025-01-27',
      endDate: '2025-02-02',
      miniCycleNumber: 1,
      intensityMultiplier: 0.9,
      workouts: [],
      createdAt: '2025-01-27T00:00:00Z',
      updatedAt: '2025-01-27T00:00:00Z',
    },
    {
      id: 'micro-3',
      programId: 'prog-1',
      weekNumber: 3,
      startDate: '2025-02-03',
      endDate: '2025-02-09',
      miniCycleNumber: 1,
      intensityMultiplier: 1.0,
      workouts: [],
      createdAt: '2025-02-03T00:00:00Z',
      updatedAt: '2025-02-03T00:00:00Z',
    },
    {
      id: 'micro-4',
      programId: 'prog-1',
      weekNumber: 4,
      startDate: '2025-02-10',
      endDate: '2025-02-16',
      miniCycleNumber: 2,
      intensityMultiplier: 0.85,
      workouts: [],
      createdAt: '2025-02-10T00:00:00Z',
      updatedAt: '2025-02-10T00:00:00Z',
    },
  ],
  primaryFocus: 'Strength',
  isActive: true,
  createdAt: '2025-01-20T00:00:00Z',
  updatedAt: '2025-01-20T00:00:00Z',
};

export default function ProgramDetailScreen() {
  const navigation = useNavigation<any>();
  const currentProgram = useProgramStore((state) => state.currentProgram) || MOCK_PROGRAM;

  useFocusEffect(
    useCallback(() => {
      // Load microcycle data
    }, [])
  );

  const handleEditProgram = () => {
    navigation.navigate('ProgramEdit');
  };

  const handleMicrocycleTap = (microcycleId: string) => {
    const microcycle = currentProgram.microcycles.find((m) => m.id === microcycleId);
    if (microcycle) {
      useProgramStore.getState().setCurrentMicrocycle(microcycle);
      navigation.navigate('MicrocycleDetail');
    }
  };

  const getIntensityLevel = (multiplier: number): string => {
    if (multiplier < 0.8) return 'Low';
    if (multiplier < 0.95) return 'Moderate';
    if (multiplier <= 1.0) return 'High';
    return 'Maximal';
  };

  const getCurrentWeek = () => {
    const startDate = new Date(currentProgram.startDate);
    const today = new Date(`${todayISOLocal()}T12:00:00`);
    const weeksElapsed = Math.floor(
      (today.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return Math.max(1, weeksElapsed + 1);
  };

  const renderMicrocycleCard = ({ item }: { item: typeof MOCK_PROGRAM.microcycles[0] }) => {
    const isCompleted = item.weekNumber < getCurrentWeek();

    return (
      <Card
        onPress={() => handleMicrocycleTap(item.id)}
        style={styles.microcycleCard}
      >
        <View style={styles.cardContent}>
          <View style={styles.weekInfo}>
            <Text variant="h4" color={colors.text.primary}>
              Week {item.weekNumber}
            </Text>
            <View style={styles.badges}>
              <Badge
                text={getIntensityLevel(item.intensityMultiplier)}
                variant="info"
                size="sm"
                style={styles.badgeSpacing}
              />
              <Badge
                text={`${item.workouts.length} workouts`}
                variant="accent"
                size="sm"
              />
            </View>
          </View>

          {isCompleted && (
            <Badge
              text="✓ Completed"
              variant="success"
              size="sm"
            />
          )}
        </View>

        <View style={styles.dateInfo}>
          <Text variant="caption" color={colors.text.tertiary}>
            {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
          </Text>
        </View>
      </Card>
    );
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
        <View style={styles.headerTitle}>
          <Text variant="h2" color={colors.text.primary}>
            {currentProgram.name}
          </Text>
          <View style={styles.headerBadges}>
            <Badge
              text={currentProgram.programPhase}
              variant="accent"
              size="md"
            />
          </View>
        </View>
        <Pressable onPress={handleEditProgram} style={styles.editButton}>
          <Text variant="body" color={colors.accent.lime}>
            Edit
          </Text>
        </Pressable>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text variant="caption" color={colors.text.tertiary}>
            Total Weeks
          </Text>
          <Text variant="h4" color={colors.text.primary}>
            {currentProgram.microcycles.length}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="caption" color={colors.text.tertiary}>
            Workouts/Week
          </Text>
          <Text variant="h4" color={colors.text.primary}>
            4-5
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="caption" color={colors.text.tertiary}>
            Current Week
          </Text>
          <Text variant="h4" color={colors.accent.lime}>
            {getCurrentWeek()}
          </Text>
        </View>
      </View>

      {/* Date Range */}
      <View style={styles.dateRange}>
        <Text variant="caption" color={colors.text.secondary} align="center">
          {new Date(currentProgram.startDate).toLocaleDateString()} - {new Date(currentProgram.endDate).toLocaleDateString()}
        </Text>
      </View>

      {/* Microcycles Section */}
      <View style={styles.sectionHeader}>
        <Text variant="h3" color={colors.text.primary}>
          Microcycles
        </Text>
      </View>

      <FlatList
        data={currentProgram.microcycles}
        keyExtractor={(item) => item.id}
        renderItem={renderMicrocycleCard}
        scrollEnabled={false}
        contentContainerStyle={styles.microcyclesList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
  headerTitle: {
    flex: 1,
  },
  headerBadges: {
    marginTop: spacing.sm,
  },
  editButton: {
    padding: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.surface.tertiary,
  },
  dateRange: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  microcyclesList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  microcycleCard: {
    marginBottom: spacing.md,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  weekInfo: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  badgeSpacing: {
    marginRight: spacing.sm,
  },
  dateInfo: {
    marginTop: spacing.sm,
  },
  separator: {
    height: spacing.md,
  },
});
