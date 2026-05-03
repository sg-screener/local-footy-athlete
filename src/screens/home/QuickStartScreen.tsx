import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';

// Mock today's workout
const MOCK_TODAYS_WORKOUT = {
  id: '1',
  type: 'Lower Strength',
  focus: 'Quadriceps & Hamstrings',
  exercises: 6,
  estimatedDuration: 65,
};

export const QuickStartScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [includeWarmup, setIncludeWarmup] = useState(true);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleStartWorkout = () => {
    const workoutConfig = {
      workout: MOCK_TODAYS_WORKOUT,
      includeWarmup,
    };
    navigation.navigate('WorkoutLogger', workoutConfig);
  };

  const handleFreestyleStart = () => {
    navigation.navigate('WorkoutLogger', { quickLog: true, includeWarmup });
  };

  const hasTodaysWorkout = !!MOCK_TODAYS_WORKOUT;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        <Text variant="h2" style={{ color: colors.text.primary, flex: 1, marginLeft: spacing.md }}>
          Quick Start
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Today's Workout Card */}
        {hasTodaysWorkout ? (
          <View style={styles.section}>
            <Text
              variant="h3"
              style={{ color: colors.text.primary, marginBottom: spacing.md }}
            >
              Today's Workout
            </Text>
            <Card style={styles.workoutCard}>
              <View style={{ marginBottom: spacing.lg }}>
                <Text
                  variant="h3"
                  style={{ color: colors.text.primary, marginBottom: spacing.sm }}
                >
                  {MOCK_TODAYS_WORKOUT.type}
                </Text>
                <Text
                  variant="label"
                  style={{ color: colors.text.tertiary, marginBottom: spacing.md }}
                >
                  {MOCK_TODAYS_WORKOUT.focus}
                </Text>

                <View style={styles.workoutMeta}>
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" style={{ color: colors.text.tertiary }}>
                      Exercises
                    </Text>
                    <Text
                      variant="h4"
                      style={{ color: colors.accent.lime, marginTop: spacing.xs }}
                    >
                      {MOCK_TODAYS_WORKOUT.exercises}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text variant="caption" style={{ color: colors.text.tertiary }}>
                      Est. Time
                    </Text>
                    <Text
                      variant="h4"
                      style={{ color: colors.accent.lime, marginTop: spacing.xs }}
                    >
                      {MOCK_TODAYS_WORKOUT.estimatedDuration} min
                    </Text>
                  </View>
                </View>
              </View>

              <Button
                onPress={handleStartWorkout}
                title="Start This Workout"
                variant="primary"
              />
            </Card>
          </View>
        ) : (
          <View style={styles.section}>
            <Card style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.md }}>
              <Text
                variant="h4"
                style={{
                  color: colors.text.primary,
                  textAlign: 'center',
                  marginBottom: spacing.md,
                }}
              >
                No scheduled workout today
              </Text>
              <Text
                style={{
                  color: colors.text.secondary,
                  textAlign: 'center',
                  lineHeight: 20,
                }}
              >
                You don't have a programmed workout for today. Start a freestyle session below!
              </Text>
            </Card>
          </View>
        )}

        {/* Warm-up Toggle */}
        <View style={styles.section}>
          <Card style={styles.warmupCard}>
            <View style={styles.warmupRow}>
              <View style={{ flex: 1 }}>
                <Text
                  variant="label"
                  style={{ color: colors.text.primary, marginBottom: spacing.xs }}
                >
                  Include Warm-up?
                </Text>
                <Text
                  variant="caption"
                  style={{ color: colors.text.tertiary }}
                >
                  5-10 minutes of light cardio & mobility
                </Text>
              </View>
              <Switch
                value={includeWarmup}
                onValueChange={setIncludeWarmup}
                trackColor={{ false: colors.surface.tertiary, true: colors.accent.lime }}
                thumbColor={colors.text.primary}
              />
            </View>
          </Card>
        </View>

        {/* Freestyle Section */}
        {!hasTodaysWorkout && (
          <View style={styles.section}>
            <Text
              variant="h3"
              style={{ color: colors.text.primary, marginBottom: spacing.md }}
            >
              Or start freestyle
            </Text>
            <Pressable
              onPress={handleFreestyleStart}
              style={({ pressed }) => [styles.freestyleButton, pressed && { opacity: 0.7 }]}
            >
              <Card style={{ paddingVertical: spacing.lg }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>⚡</Text>
                  <Text
                    variant="label"
                    style={{ color: colors.accent.lime, textAlign: 'center' }}
                  >
                    Quick Log
                  </Text>
                  <Text
                    variant="caption"
                    style={{
                      color: colors.text.tertiary,
                      marginTop: spacing.xs,
                      textAlign: 'center',
                    }}
                  >
                    Log any workout on the fly
                  </Text>
                </View>
              </Card>
            </Pressable>
          </View>
        )}

        {/* Let's Go Button */}
        <View style={styles.buttonContainer}>
          <Button
            onPress={handleStartWorkout}
            title="Let's Go"
            variant="primary"
          />
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
  workoutCard: {
    paddingVertical: spacing.lg,
  },
  workoutMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  warmupCard: {
    paddingVertical: spacing.md,
  },
  warmupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  freestyleButton: {
    marginBottom: spacing.md,
  },
  buttonContainer: {
    paddingVertical: spacing.md,
  },
});
