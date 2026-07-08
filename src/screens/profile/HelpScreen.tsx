import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Text } from '../../components/common/Text';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: '1',
    question: 'How do I get started with LFA?',
    answer:
      'Simply create an account with your email, set up your profile with your footy role and training preferences, and our AI coach will begin creating personalized workouts for you based on your goals and available equipment.',
  },
  {
    id: '2',
    question: 'Can I customize my training plan?',
    answer:
      'Absolutely! You can adjust your training preferences, equipment access, and goals anytime in your settings. The app will generate new workouts tailored to your preferences.',
  },
  {
    id: '3',
    question: 'What equipment do I need?',
    answer:
      'LFA works with various equipment setups from full gym access to bodyweight only. Tell us what equipment you have available, and we\'ll create workouts you can actually do.',
  },
  {
    id: '4',
    question: 'How often should I train?',
    answer:
      'We recommend 3-5 sessions per week for optimal results. You can set your preferred number of training days, and the app will schedule workouts accordingly.',
  },
  {
    id: '5',
    question: 'How do I track my progress?',
    answer:
      'You can log your completed workouts, track weights and reps, record your body metrics, and view your progress over time in the progress dashboard.',
  },
  {
    id: '6',
    question: 'What if I get injured?',
    answer:
      'Use the Injury Management feature to log injuries. Our AI will modify your training plan to avoid exercises that might aggravate your injury while keeping you active and building strength.',
  },
];

export const HelpScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text variant="h3" style={styles.backButton}>
            ← Back
          </Text>
        </Pressable>
        <Text variant="h2" style={styles.title}>
          Help & FAQ
        </Text>
      </View>

      <Text variant="body" style={styles.subtitle}>
        Find answers to common questions
      </Text>

      {/* FAQ Accordion */}
      <View style={styles.faqContainer}>
        {FAQ_ITEMS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => toggleExpanded(item.id)}
            style={[
              styles.faqItem,
              expandedId === item.id && styles.faqItemExpanded,
            ]}
          >
            <View style={styles.faqHeader}>
              <Text
                variant="body"
                style={[
                  styles.question,
                  expandedId === item.id && styles.questionExpanded,
                ]}
              >
                {item.question}
              </Text>
              <Text
                style={[
                  styles.chevron,
                  expandedId === item.id && styles.chevronExpanded,
                ]}
              >
                ▼
              </Text>
            </View>

            {expandedId === item.id && (
              <Text variant="body" style={styles.answer}>
                {item.answer}
              </Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* Contact Support */}
      <View style={styles.supportSection}>
        <Text variant="body" style={styles.supportText}>
          Didn't find what you're looking for?
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Support')}
          style={styles.contactButton}
        >
          <Text variant="bodyEmphasis" style={styles.contactButtonText}>
            Contact Support →
          </Text>
        </Pressable>
      </View>

      <View style={styles.spacer} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  backButton: {
    color: colors.accent.lime,
    marginBottom: spacing.md,
  } as TextStyle,
  title: {
    color: colors.text.primary,
  } as TextStyle,
  subtitle: {
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  } as TextStyle,
  faqContainer: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  } as ViewStyle,
  faqItem: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.surface.tertiary,
  } as ViewStyle,
  faqItemExpanded: {
    backgroundColor: colors.surface.tertiary,
    borderColor: colors.accent.lime,
  } as ViewStyle,
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  } as ViewStyle,
  question: {
    color: colors.text.primary,
    flex: 1,
    fontWeight: '500',
    marginRight: spacing.md,
  } as TextStyle,
  questionExpanded: {
    color: colors.accent.lime,
  } as TextStyle,
  chevron: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: spacing.sm,
  } as TextStyle,
  chevronExpanded: {
    color: colors.accent.lime,
  } as TextStyle,
  answer: {
    color: colors.text.secondary,
    marginTop: spacing.md,
    lineHeight: 22,
  } as TextStyle,
  supportSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  } as ViewStyle,
  supportText: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
  } as TextStyle,
  contactButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  contactButtonText: {
    color: colors.accent.lime,
  } as TextStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
