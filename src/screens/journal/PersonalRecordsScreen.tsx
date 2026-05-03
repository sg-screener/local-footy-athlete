import React from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';

// Mock Personal Records data
const MOCK_PERSONAL_RECORDS = {
  compound: [
    {
      id: '1',
      exercise: 'Squat',
      weight: 140,
      reps: 5,
      date: '15 Feb 2026',
    },
    {
      id: '2',
      exercise: 'Bench Press',
      weight: 100,
      reps: 5,
      date: '28 Feb 2026',
    },
    {
      id: '3',
      exercise: 'Deadlift',
      weight: 160,
      reps: 3,
      date: '22 Feb 2026',
    },
    {
      id: '4',
      exercise: 'Overhead Press',
      weight: 65,
      reps: 5,
      date: '10 Feb 2026',
    },
    {
      id: '5',
      exercise: 'Leg Press',
      weight: 210,
      reps: 8,
      date: '2 Mar 2026',
    },
  ],
  accessory: [
    {
      id: '6',
      exercise: 'Barbell Row',
      weight: 120,
      reps: 5,
      date: '25 Feb 2026',
    },
    {
      id: '7',
      exercise: 'Pull-Ups',
      weight: 20,
      reps: 8,
      date: '20 Feb 2026',
    },
    {
      id: '8',
      exercise: 'Dumbbell Curl',
      weight: 35,
      reps: 8,
      date: '18 Feb 2026',
    },
    {
      id: '9',
      exercise: 'Leg Curl',
      weight: 70,
      reps: 10,
      date: '2 Mar 2026',
    },
    {
      id: '10',
      exercise: 'Lateral Raise',
      weight: 25,
      reps: 12,
      date: '28 Feb 2026',
    },
  ],
};

const PRCard = ({ pr }: { pr: any }) => (
  <Card style={styles.prCard}>
    <View style={styles.prContent}>
      <View style={{ flex: 1 }}>
        <Text
          variant="label"
          style={{ color: colors.text.tertiary, marginBottom: spacing.sm }}
        >
          {pr.exercise}
        </Text>
        <Text
          variant="h2"
          style={{ color: colors.accent.lime, marginBottom: spacing.sm }}
        >
          {pr.weight}
        </Text>
        <Text variant="caption" style={{ color: colors.text.tertiary }}>
          {pr.reps} reps • {pr.date}
        </Text>
      </View>
      <View style={styles.trophyContainer}>
        <Text style={{ fontSize: 40 }}>🏆</Text>
      </View>
    </View>
  </Card>
);

export const PersonalRecordsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <Text variant="h2" style={{ color: colors.text.primary, flex: 1, marginLeft: spacing.md }}>
          Personal Records
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Compound Exercises */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.accent.lime, marginBottom: spacing.md }}
          >
            Compound Exercises
          </Text>
          {MOCK_PERSONAL_RECORDS.compound.map((pr) => (
            <PRCard key={pr.id} pr={pr} />
          ))}
        </View>

        {/* Accessory Exercises */}
        <View style={styles.section}>
          <Text
            variant="h3"
            style={{ color: colors.accent.lime, marginBottom: spacing.md }}
          >
            Accessory Exercises
          </Text>
          {MOCK_PERSONAL_RECORDS.accessory.map((pr) => (
            <PRCard key={pr.id} pr={pr} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.tertiary,
  },
  backButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  prCard: {
    marginBottom: spacing.md,
  },
  prContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trophyContainer: {
    marginLeft: spacing.md,
  },
});
