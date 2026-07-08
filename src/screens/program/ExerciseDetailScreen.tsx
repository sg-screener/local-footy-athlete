import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import type { ProgramStackParamList } from '../../types/navigation';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';

type ExerciseDetailScreenProps = NativeStackScreenProps<ProgramStackParamList, 'ExerciseDetail'>;

// Mock exercise data
const MOCK_EXERCISE = {
  id: 'ex-1',
  name: 'Bench Press',
  description: 'The barbell bench press is a fundamental compound exercise that targets the chest, shoulders, and triceps.',
  muscleGroups: ['Chest', 'Triceps', 'Anterior Deltoids'],
  exerciseType: 'Compound' as const,
  equipmentRequired: ['Barbell', 'Bench'],
  difficultyLevel: 'Intermediate' as const,
  videoUrl: 'https://example.com/video',
  gifUrl: 'https://media.giphy.com/media/barbell-bench-press.gif',
  formNotes: 'Keep elbows at approximately 45 degrees from your body. Lower the bar to chest height, pause briefly, then press back to starting position. Maintain a slight arch in your back and keep your shoulder blades retracted.',
  createdAt: '2025-01-20T00:00:00Z',
  updatedAt: '2025-01-20T00:00:00Z',
};

const SIMILAR_EXERCISES = [
  'Dumbbell Bench Press',
  'Machine Chest Press',
  'Push-ups',
];

export default function ExerciseDetailScreen({ navigation }: ExerciseDetailScreenProps) {
  const [showImage, setShowImage] = useState(true);
  const exercise = MOCK_EXERCISE;

  useFocusEffect(
    useCallback(() => {
      // Load exercise data
    }, [])
  );

  const getMuscleGroupColor = (muscle: string) => {
    // Return lime for primary muscle
    return colors.accent.lime;
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
            {formatExerciseDisplayName(exercise.name) || exercise.name}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* GIF Display */}
        {exercise.gifUrl && showImage && (
          <View style={styles.gifContainer}>
            <Card>
              <Image
                source={{ uri: exercise.gifUrl }}
                style={styles.gif}
                resizeMode="cover"
              />
            </Card>
          </View>
        )}

        {/* Exercise Type and Difficulty */}
        <View style={styles.badgesContainer}>
          <Badge
            text={exercise.exerciseType}
            variant="accent"
            size="md"
            style={styles.badge}
          />
          <Badge
            text={exercise.difficultyLevel}
            variant="info"
            size="md"
            style={styles.badge}
          />
        </View>

        {/* Description */}
        <Card style={styles.section}>
          <Text variant="bodySmallEmphasis" color={colors.text.primary}>
            Overview
          </Text>
          <Text
            variant="body"
            color={colors.text.secondary}
            style={styles.sectionText}
          >
            {exercise.description}
          </Text>
        </Card>

        {/* Muscles Targeted */}
        <Card style={styles.section}>
          <Text variant="bodySmallEmphasis" color={colors.text.primary}>
            Muscles Targeted
          </Text>
          <View style={styles.muscleGroupsContainer}>
            {exercise.muscleGroups.map((muscle, index) => (
              <Badge
                key={index}
                text={muscle}
                variant="accent"
                size="sm"
                style={styles.muscleBadge}
              />
            ))}
          </View>
        </Card>

        {/* Equipment */}
        {exercise.equipmentRequired.length > 0 && (
          <Card style={styles.section}>
            <Text variant="bodySmallEmphasis" color={colors.text.primary}>
              Equipment Needed
            </Text>
            <View style={styles.equipmentContainer}>
              {exercise.equipmentRequired.map((equipment, index) => (
                <View key={index} style={styles.equipmentItem}>
                  <Text variant="body" color={colors.text.secondary}>
                    • {equipment}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Form Notes */}
        {exercise.formNotes && (
          <Card style={styles.section}>
            <Text variant="bodySmallEmphasis" color={colors.text.primary}>
              Form Guide
            </Text>
            <Text
              variant="body"
              color={colors.text.secondary}
              style={styles.sectionText}
            >
              {exercise.formNotes}
            </Text>
          </Card>
        )}

        {/* Tips Section */}
        <Card style={styles.section}>
          <Text variant="bodySmallEmphasis" color={colors.text.primary}>
            Pro Tips
          </Text>
          <View style={styles.tipsContainer}>
            <View style={styles.tipItem}>
              <Text variant="caption" color={colors.accent.lime} style={styles.tipBullet}>
                •
              </Text>
              <Text variant="body" color={colors.text.secondary} style={styles.tipText}>
                Keep a slight arch in your back throughout the movement
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text variant="caption" color={colors.accent.lime} style={styles.tipBullet}>
                •
              </Text>
              <Text variant="body" color={colors.text.secondary} style={styles.tipText}>
                Full range of motion maximizes chest activation
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text variant="caption" color={colors.accent.lime} style={styles.tipBullet}>
                •
              </Text>
              <Text variant="body" color={colors.text.secondary} style={styles.tipText}>
                Control the eccentric (lowering) phase for better muscle development
              </Text>
            </View>
          </View>
        </Card>

        {/* Similar Exercises */}
        <Card style={styles.section}>
          <Text variant="bodySmallEmphasis" color={colors.text.primary}>
            Similar Exercises
          </Text>
          <View style={styles.similarContainer}>
            {SIMILAR_EXERCISES.map((similar, index) => (
              <Pressable key={index} style={styles.similarItem}>
                <Text variant="body" color={colors.accent.lime}>
                  {similar}
                </Text>
                <Text variant="h4" color={colors.text.tertiary}>
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </ScrollView>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  gifContainer: {
    marginBottom: spacing.lg,
  },
  gif: {
    width: '100%',
    height: 300,
    borderRadius: borderRadius.md,
  },
  badgesContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  badge: {
    marginRight: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionText: {
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  muscleGroupsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  muscleBadge: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  equipmentContainer: {
    marginTop: spacing.sm,
  },
  equipmentItem: {
    marginBottom: spacing.sm,
  },
  tipsContainer: {
    marginTop: spacing.sm,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  tipBullet: {
    marginRight: spacing.sm,
    marginTop: spacing.xs,
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
  similarContainer: {
    marginTop: spacing.sm,
  },
  similarItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.surface.tertiary,
    borderBottomWidth: 1,
  },
});
