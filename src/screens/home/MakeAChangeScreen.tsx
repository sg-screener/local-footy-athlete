import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing, borderRadius, dimensions } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { SelectableTile } from '../../components/common';
import { useProfileStore } from '../../store';
import type { HomeStackParamList } from '../../types/navigation';
import { submitChange, ChangeType, ChangeDetails } from '../../services/api/programModificationService';

type MakeAChangeScreenProps = NativeStackScreenProps<HomeStackParamList, 'MakeAChange'>;

interface ChangeOption {
  type: ChangeType;
  title: string;
  subtitle: string;
  emoji: string;
}

const CHANGE_OPTIONS: ChangeOption[] = [
  {
    type: 'Injury',
    title: 'Injury',
    subtitle: 'Report an injury or pain',
    emoji: '🤕',
  },
  {
    type: 'Game Day Changed',
    title: 'Game Day Changed',
    subtitle: 'Your game day moved',
    emoji: '🏐',
  },
  {
    type: 'Change Training Days',
    title: 'Change Training Days',
    subtitle: 'Reschedule your workouts',
    emoji: '📅',
  },
  {
    type: 'Bye Week',
    title: 'Bye Week',
    subtitle: 'You have a bye this week',
    emoji: '🏖️',
  },
  {
    type: 'Season Over',
    title: 'Season Over',
    subtitle: 'Season ended - shift to Off-season mode',
    emoji: '🏁',
  },
  {
    type: 'Something Else',
    title: 'Something Else',
    subtitle: 'Describe any other change',
    emoji: '💬',
  },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MakeAChangeScreen({ navigation }: MakeAChangeScreenProps) {
  const onboardingData = useProfileStore((state) => state.onboardingData);

  // State management
  const [selectedOption, setSelectedOption] = useState<ChangeType | null>(null);
  const [injuryDescription, setInjuryDescription] = useState('');
  const [injurySeverity, setInjurySeverity] = useState<'Minor niggle' | 'Can train around it' | 'Need to rest it' | 'Seeing physio'>('Minor niggle');
  const [selectedGameDay, setSelectedGameDay] = useState(0);
  const [selectedTrainingDays, setSelectedTrainingDays] = useState<number[]>([]);
  const [otherDescription, setOtherDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [coachResponse, setCoachResponse] = useState('');

  const handleSelectOption = (option: ChangeType) => {
    setSelectedOption(option);
  };

  const handleToggleTrainingDay = (dayIndex: number) => {
    setSelectedTrainingDays((prev) => {
      if (prev.includes(dayIndex)) {
        return prev.filter((d) => d !== dayIndex);
      } else {
        return [...prev, dayIndex].sort((a, b) => a - b);
      }
    });
  };

  const handleSubmit = async () => {
    if (!selectedOption) return;

    setLoading(true);
    try {
      const changeDetails: ChangeDetails = {
        type: selectedOption,
      };

      switch (selectedOption) {
        case 'Injury':
          changeDetails.injuryDescription = injuryDescription;
          changeDetails.injurySeverity = injurySeverity;
          break;
        case 'Game Day Changed':
          changeDetails.newGameDay = selectedGameDay;
          break;
        case 'Change Training Days':
          changeDetails.newTrainingDays = selectedTrainingDays;
          break;
        case 'Something Else':
          changeDetails.description = otherDescription;
          break;
      }

      const response = await submitChange('user-default', changeDetails);

      if (response.success) {
        // Set a hardcoded AI coach response for now
        const responses: Record<ChangeType, string> = {
          'Injury': 'Got it - I\'ve noted your injury. I\'ll modify your program to focus on rehabilitation and training around the affected area. Let\'s get you back to 100%.',
          'Game Day Changed': 'Perfect! I\'ve updated your game day. I\'ll adjust your training intensity in the week leading up to the new game date.',
          'Change Training Days': 'Noted! I\'ve rescheduled your training days. Your program is now aligned with your availability.',
          'Bye Week': 'Great - you\'ve got a bye week coming up. I\'m putting this week on recovery mode. Use this time to build back strength and resilience.',
          'Season Over': 'Season\'s done! We\'re shifting to Off-season mode now. This is prime time to build strength and iron out any weaknesses.',
          'Something Else': 'I\'ve recorded your update. Let me review this and adjust your program accordingly.',
        };

        setCoachResponse(responses[selectedOption]);

        // Show success state for 2 seconds, then navigate back
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        setCoachResponse('Sorry, something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting change:', error);
      setCoachResponse('Error submitting your change. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (selectedOption) {
      setSelectedOption(null);
      setInjuryDescription('');
      setInjurySeverity('Minor niggle');
      setSelectedGameDay(0);
      setSelectedTrainingDays([]);
      setOtherDescription('');
      setCoachResponse('');
    } else {
      navigation.goBack();
    }
  };

  // Show coach response
  if (coachResponse) {
    return (
      <View style={styles.container}>
        <View style={styles.responseContainer}>
          <View style={styles.coachResponseContent}>
            <Text variant="h3" style={styles.coachTitle}>
              Coach Says 🤖
            </Text>
            <Text variant="body" color={colors.text.primary} style={styles.coachMessage}>
              {coachResponse}
            </Text>
            <View style={styles.responseFooter}>
              <Text variant="bodySmall" color={colors.text.secondary} align="center">
                Redirecting to home...
              </Text>
              <ActivityIndicator color={colors.accent.lime} size="small" style={styles.spinner} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Show option selection or details form
  if (!selectedOption) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.optionsContainer}>
          <View style={styles.header}>
            <Text variant="h2" style={styles.title}>
              What's Changed?
            </Text>
            <Text variant="body" color={colors.text.secondary} style={styles.subtitle}>
              Tell me about any changes affecting your training
            </Text>
          </View>

          <View style={styles.optionsGrid}>
            {CHANGE_OPTIONS.map((option) => (
              <Pressable
                key={option.type}
                style={({ pressed }) => [
                  styles.optionCard,
                  pressed && styles.optionCardPressed,
                ]}
                onPress={() => handleSelectOption(option.type)}
              >
                <Card>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionEmoji}>{option.emoji}</Text>
                    <Text variant="h4" color={colors.text.primary} style={styles.optionTitle}>
                      {option.title}
                    </Text>
                    <Text variant="bodySmall" color={colors.text.secondary} style={styles.optionSubtitle}>
                      {option.subtitle}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>

          <View style={styles.footer} />
        </ScrollView>
      </View>
    );
  }

  // Show details form based on selected option
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.formContainer}>
        <View style={styles.formHeader}>
          <Pressable onPress={handleCancel}>
            <Text variant="body" color={colors.accent.lime}>
              ← Back
            </Text>
          </Pressable>
          <Text variant="h3" color={colors.text.primary} style={styles.formTitle}>
            {CHANGE_OPTIONS.find((o) => o.type === selectedOption)?.title}
          </Text>
          <View style={styles.spacer} />
        </View>

        {/* Injury Form */}
        {selectedOption === 'Injury' && (
          <View style={styles.formContent}>
            <Input
              label="What's injured?"
              placeholder="e.g., Left knee, Right shoulder..."
              value={injuryDescription}
              onChangeText={setInjuryDescription}
            />

            <View style={styles.severityContainer}>
              <Text variant="label" color={colors.text.primary} style={styles.labelText}>
                How Severe?
              </Text>
              {/*
               * Severity list migrated to SelectableTile (card shape) so the
               * single-select vocabulary matches every other picker in the
               * app. Previous design used a filled lime background, which
               * clashed with the tinted-fill + lime-border pattern used
               * everywhere else.
               */}
              {(['Minor niggle', 'Can train around it', 'Need to rest it', 'Seeing physio'] as const).map(
                (severity) => (
                  <SelectableTile
                    key={severity}
                    isSelected={injurySeverity === severity}
                    onPress={() => setInjurySeverity(severity)}
                    style={styles.severityOption}
                  >
                    <Text
                      variant="body"
                      color={colors.text.primary}
                      style={styles.severityOptionText}
                    >
                      {severity}
                    </Text>
                  </SelectableTile>
                )
              )}
            </View>
          </View>
        )}

        {/* Game Day Changed Form */}
        {selectedOption === 'Game Day Changed' && (
          <View style={styles.formContent}>
            <Text variant="label" color={colors.text.primary} style={styles.labelText}>
              New Game Day
            </Text>
            {/*
             * Day picker uses SelectableTile chip shape with hideCheckmark
             * — the 7-wide grid of 3-letter labels is too dense for a
             * corner badge. Lime border + tinted fill still read cleanly.
             */}
            <View style={styles.daysGrid}>
              {DAYS.map((day, index) => {
                const active = selectedGameDay === index;
                return (
                  <SelectableTile
                    key={day}
                    shape="chip"
                    isSelected={active}
                    hideCheckmark
                    onPress={() => setSelectedGameDay(index)}
                    style={styles.dayOption}
                  >
                    <Text
                      variant="label"
                      color={active ? colors.accent.lime : colors.text.primary}
                      align="center"
                    >
                      {day.slice(0, 3)}
                    </Text>
                  </SelectableTile>
                );
              })}
            </View>
          </View>
        )}

        {/* Change Training Days Form */}
        {selectedOption === 'Change Training Days' && (
          <View style={styles.formContent}>
            <Text variant="label" color={colors.text.primary} style={styles.labelText}>
              Select Training Days
            </Text>
            <View style={styles.daysGrid}>
              {DAYS.map((day, index) => {
                const active = selectedTrainingDays.includes(index);
                return (
                  <SelectableTile
                    key={day}
                    shape="chip"
                    isSelected={active}
                    hideCheckmark
                    onPress={() => handleToggleTrainingDay(index)}
                    style={styles.dayOption}
                  >
                    <Text
                      variant="label"
                      color={active ? colors.accent.lime : colors.text.primary}
                      align="center"
                    >
                      {day.slice(0, 3)}
                    </Text>
                  </SelectableTile>
                );
              })}
            </View>
            {selectedTrainingDays.length > 0 && (
              <Text variant="bodySmall" color={colors.text.secondary} style={styles.selectedDaysText}>
                Selected: {selectedTrainingDays.map((d) => DAYS[d]).join(', ')}
              </Text>
            )}
          </View>
        )}

        {/* Bye Week Form */}
        {selectedOption === 'Bye Week' && (
          <View style={styles.formContent}>
            <Card style={styles.confirmCard}>
              <View style={styles.confirmContent}>
                <Text variant="h3" color={colors.accent.lime} style={styles.confirmTitle}>
                  This week is a bye - got it! 🏖️
                </Text>
                <Text variant="body" color={colors.text.secondary} style={styles.confirmText}>
                  I'll switch your program to recovery mode. Use this time to rest up and prepare for your next game.
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Season Over Form */}
        {selectedOption === 'Season Over' && (
          <View style={styles.formContent}>
            <Card style={styles.confirmCard}>
              <View style={styles.confirmContent}>
                <Text variant="h3" color={colors.accent.lime} style={styles.confirmTitle}>
                  Season's done - shifting to Off-season mode 🏁
                </Text>
                <Text variant="body" color={colors.text.secondary} style={styles.confirmText}>
                  Time to build strength and address weaknesses. Let's make you even more dominant next season.
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* Something Else Form */}
        {selectedOption === 'Something Else' && (
          <View style={styles.formContent}>
            <Input
              label="What's changed?"
              placeholder="Describe your situation..."
              value={otherDescription}
              onChangeText={setOtherDescription}
              multiline
            />
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title="Cancel"
            onPress={handleCancel}
            variant="secondary"
            fullWidth
          />
          <Button
            title="Submit Change"
            onPress={handleSubmit}
            variant="primary"
            fullWidth
            loading={loading}
            disabled={
              loading ||
              (selectedOption === 'Injury' && !injuryDescription) ||
              (selectedOption === 'Change Training Days' && selectedTrainingDays.length === 0) ||
              (selectedOption === 'Something Else' && !otherDescription)
            }
          />
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },

  // Options view
  optionsContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.accent.lime,
    marginBottom: spacing.md,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  optionsGrid: {
    gap: spacing.md,
  },
  optionCard: {
    marginBottom: spacing.sm,
  },
  optionCardPressed: {
    opacity: 0.7,
  },
  optionContent: {
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  optionEmoji: {
    fontSize: 40,
  },
  optionTitle: {
    marginTop: spacing.sm,
  },
  optionSubtitle: {
    textAlign: 'center',
  },

  // Form view
  formContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  formTitle: {
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: 50,
  },
  formContent: {
    marginBottom: spacing.xl,
    gap: spacing.lg,
  },
  labelText: {
    marginBottom: spacing.md,
  },

  // Severity options — layout only; SelectableTile owns the selected look.
  severityContainer: {
    gap: spacing.md,
  },
  severityOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityOptionText: {
    // Headroom for the shared corner checkmark badge.
    paddingRight: 18,
    textAlign: 'center',
  },

  // Days grid — layout only; SelectableTile chip owns the selected look.
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  dayOption: {
    flex: 1,
    minWidth: '13%',
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDaysText: {
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Confirm card
  confirmCard: {
    backgroundColor: `${colors.accent.lime}15`,
    borderColor: colors.accent.lime,
    borderWidth: 1,
  },
  confirmContent: {
    gap: spacing.md,
  },
  confirmTitle: {
    marginBottom: spacing.sm,
  },
  confirmText: {
    lineHeight: 24,
  },

  // Buttons
  buttonContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  // Response view
  responseContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  coachResponseContent: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    borderColor: colors.accent.lime,
    borderWidth: 2,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  coachTitle: {
    color: colors.accent.lime,
    marginBottom: spacing.md,
  },
  coachMessage: {
    textAlign: 'center',
    lineHeight: 24,
  },
  responseFooter: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  spinner: {
    marginTop: spacing.sm,
  },

  footer: {
    height: spacing.xl,
  },
});
