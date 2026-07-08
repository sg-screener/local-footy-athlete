import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    question: 'How does the app build my program?',
    answer: 'It uses your setup: season phase, footy role, experience, training days, team training, game day, equipment and main focus. The resolver then places strength, running, recovery and game-week work around those constraints.',
  },
  {
    question: 'What does the AI coach actually change?',
    answer: 'It can adjust the visible program when your week changes: injury, soreness, fatigue, missed sessions, schedule changes or preferences. The chat understands what you mean, but deterministic program rules make the final changes.',
  },
  {
    question: 'What is a Coach Update?',
    answer: 'A Coach Update means an active restriction or adjustment is shaping your program. Tap Update coach when it improves, worsens or clears.',
  },
  {
    question: 'Why did my session change?',
    answer: 'A session changes when the current week, game timing or coach adjustment makes the original session a poor fit. The app tries to keep useful training in while removing or reducing the risky part.',
  },
  {
    question: 'What happens if I’m injured or sore?',
    answer: 'Tell the coach what hurts and how bad it is. The app can restrict risky exposures, keep pain-free work moving and show a Coach Update while that restriction is active.',
  },
  {
    question: 'Why doesn’t the app give me rehab exercises?',
    answer: 'This is an S&C app, not a physio. If something hurts, the coach helps you train around it and keeps safe work going. For proper rehab or diagnosis, see a physio.',
  },
  {
    question: 'Why does the week change around game day?',
    answer: 'Game day controls the week. Heavy lower work, conditioning and speed exposure are placed around the game so you can train hard without turning up flat.',
  },
  {
    question: 'Why are there no obvious progressions every week?',
    answer: 'The app is built around in-season football. Progress is managed through exposure, freshness, consistency and timing around games, not just adding weight every week.',
  },
  {
    question: 'When should I tap Update coach?',
    answer: 'Use it when an injury, soreness, fatigue, schedule issue or preference changes. Also use it when something improves, worsens or clears so the active Coach Update can change with you.',
  },
  {
    question: 'When should I see a physio?',
    answer: 'See a physio if pain is sharp, severe, worsening, lingering, affecting running or lifting, or you are unsure what it is. The app can help you train around issues, but it cannot diagnose them.',
  },
];

export default function FAQScreen() {
  const navigation = useNavigation();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text variant="body" color={colors.text.secondary}>← Back</Text>
        </TouchableOpacity>
        <Text variant="label" color={colors.accent.lime} style={styles.header}>FREQUENTLY ASKED QUESTIONS</Text>
        <Text variant="body" color={colors.text.secondary} style={styles.subtitle}>
          Practical answers about the program, coach updates and training around footy.
        </Text>

        {FAQ_DATA.map((item, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              onPress={() => toggleExpand(index)}
              style={[
                styles.faqCard,
                isExpanded && styles.faqCardExpanded,
              ]}
            >
              <View style={styles.questionRow}>
                <Text
                  variant="body"
                  color={isExpanded ? colors.accent.lime : colors.text.primary}
                  style={styles.questionText}
                >
                  {item.question}
                </Text>
                <Text
                  variant="body"
                  color={isExpanded ? colors.accent.lime : colors.text.tertiary}
                  style={styles.chevron}
                >
                  {isExpanded ? '−' : '+'}
                </Text>
              </View>
              {isExpanded && (
                <Text variant="bodySmall" color={colors.text.secondary} style={styles.answerText}>
                  {item.answer}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.footer}>
          <Text variant="caption" color={colors.text.tertiary}>
            Got more questions? Ask the coach.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  header: {
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  faqCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
  },
  faqCardExpanded: {
    borderColor: colors.accent.lime,
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  questionText: {
    flex: 1,
    fontWeight: '600',
    marginRight: spacing.md,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  answerText: {
    marginTop: spacing.md,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
});
