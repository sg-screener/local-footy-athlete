import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  FlatList,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useProgramStore } from '../../store/programStore';
import type { ProgramStackParamList } from '../../types/navigation';

type ProgramListScreenProps = NativeStackScreenProps<ProgramStackParamList, 'ProgramList'>;

// Mock data for testing
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
  ],
  primaryFocus: 'Strength',
  isActive: true,
  createdAt: '2025-01-20T00:00:00Z',
  updatedAt: '2025-01-20T00:00:00Z',
};

export default function ProgramListScreen({ navigation }: ProgramListScreenProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const currentProgram = useProgramStore((state) => state.currentProgram) || MOCK_PROGRAM;

  useFocusEffect(
    useCallback(() => {
      // Load program data
    }, [])
  );

  const handleCreateProgram = () => {
    navigation.navigate('ProgramCreate');
  };

  const handleViewProgram = () => {
    if (currentProgram) {
      navigation.navigate('ProgramDetail', { programId: currentProgram.id });
    }
  };

  const handleGenerateProgram = () => {
    navigation.navigate('ProgramCreate');
  };

  const getWeeksCompleted = (program: typeof MOCK_PROGRAM) => {
    const startDate = new Date(program.startDate);
    const today = new Date();
    const weeksElapsed = Math.floor(
      (today.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return Math.max(1, weeksElapsed + 1);
  };

  const renderActiveTab = () => {
    if (!currentProgram) {
      return (
        <View style={styles.emptyContainer}>
          <Text variant="h3" color={colors.text.primary} align="center">
            No active program
          </Text>
          <Text
            variant="body"
            color={colors.text.secondary}
            align="center"
            style={styles.emptyText}
          >
            Generate a personalized training program to get started
          </Text>
          <Button
            title="Generate Program"
            onPress={handleGenerateProgram}
            variant="primary"
            fullWidth
          />
        </View>
      );
    }

    return (
      <View style={styles.programContainer}>
        <Card>
          <View style={styles.cardHeader}>
            <View>
              <Text variant="h3" color={colors.text.primary}>
                {currentProgram.name}
              </Text>
              <Badge
                text={currentProgram.programPhase}
                variant="accent"
                size="md"
                style={styles.phaseBadge}
              />
            </View>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text variant="caption" color={colors.text.tertiary}>
                Start Date
              </Text>
              <Text variant="body" color={colors.text.primary}>
                {new Date(currentProgram.startDate).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant="caption" color={colors.text.tertiary}>
                Weeks Completed
              </Text>
              <Text variant="body" color={colors.text.primary}>
                {getWeeksCompleted(currentProgram)}
              </Text>
            </View>
          </View>

          <Button
            title="View Program"
            onPress={handleViewProgram}
            variant="secondary"
            fullWidth
            style={styles.viewButton}
          />
        </Card>
      </View>
    );
  };

  const renderPastTab = () => {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="body" color={colors.text.secondary} align="center">
          No past programs yet
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="h2" color={colors.text.primary}>
          Programs
        </Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab('active')}
          style={styles.tabButton}
        >
          <Text
            variant="body"
            color={activeTab === 'active' ? colors.text.primary : colors.text.secondary}
            align="center"
          >
            Active
          </Text>
          {activeTab === 'active' && <View style={styles.tabUnderline} />}
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('past')}
          style={styles.tabButton}
        >
          <Text
            variant="body"
            color={activeTab === 'past' ? colors.text.primary : colors.text.secondary}
            align="center"
          >
            Past
          </Text>
          {activeTab === 'past' && <View style={styles.tabUnderline} />}
        </Pressable>
      </View>

      {/* Tab Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'active' ? renderActiveTab() : renderPastTab()}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={handleCreateProgram}
        style={styles.fab}
      >
        <Text variant="h2" color={colors.button.primaryText} align="center">
          +
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomColor: colors.surface.tertiary,
    borderBottomWidth: 1,
    backgroundColor: colors.surface.primary,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    position: 'relative',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent.lime,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  programContainer: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  phaseBadge: {
    marginTop: spacing.sm,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.surface.tertiary,
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  infoItem: {
    flex: 1,
  },
  viewButton: {
    marginTop: spacing.md,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    marginVertical: spacing.md,
    marginHorizontal: spacing.lg,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent.lime,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
