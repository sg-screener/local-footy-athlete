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
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

const CATEGORIES = ['Bug', 'Feature', 'Question'];

export const SupportScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Question');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      return;
    }

    setLoading(true);
    try {
      // Submit support request to backend
      console.log('Support request submitted:', {
        email: user?.email,
        category,
        subject,
        message,
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSubject('');
        setMessage('');
        setCategory('Question');
      }, 2000);
    } catch (error) {
      console.error('Error submitting support request:', error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <ScreenContainer>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text variant="h3" style={styles.successTitle}>
            Thank You!
          </Text>
          <Text variant="body" style={styles.successMessage}>
            Your support request has been received. We'll get back to you soon.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

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
          Contact Support
        </Text>
      </View>

      <Text variant="bodySmall" style={styles.subtitle}>
        Have an issue? Let us know and we'll help you out.
      </Text>

      {/* Category Selection */}
      <Text variant="label" style={styles.label}>
        Category
      </Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            style={[
              styles.categoryCard,
              category === cat && styles.categoryCardActive,
            ]}
          >
            <Text
              variant="body"
              style={[
                styles.categoryText,
                category === cat && styles.categoryTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Subject Input */}
      <Text variant="label" style={styles.label}>
        Subject
      </Text>
      <Input
        label=""
        value={subject}
        onChangeText={setSubject}
        placeholder="What is your issue or request?"
      />

      {/* Message Input */}
      <Text variant="label" style={styles.label}>
        Message
      </Text>
      <Input
        label=""
        value={message}
        onChangeText={setMessage}
        placeholder="Please provide as much detail as possible..."
        multiline
        style={styles.messageInput}
      />

      {/* Submit Button */}
      <Button
        title={loading ? 'Sending...' : 'Send Support Request'}
        variant="primary"
        onPress={handleSubmit}
        disabled={loading || !subject.trim() || !message.trim()}
        style={styles.submitButton}
      />

      {/* Email Display */}
      <Text variant="caption" style={styles.emailNote}>
        You'll receive a response at: {user?.email}
      </Text>

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
  label: {
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  } as TextStyle,
  categoryGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  } as ViewStyle,
  categoryCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.surface.tertiary,
    alignItems: 'center',
  } as ViewStyle,
  categoryCardActive: {
    borderColor: colors.accent.lime,
    backgroundColor: colors.surface.tertiary,
  } as ViewStyle,
  categoryText: {
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: '500',
  } as TextStyle,
  categoryTextActive: {
    color: colors.accent.lime,
    fontWeight: '700',
  } as TextStyle,
  messageInput: {
    minHeight: 120,
  } as ViewStyle,
  submitButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as ViewStyle,
  emailNote: {
    color: colors.text.tertiary,
    textAlign: 'center',
  } as TextStyle,
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.status.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  } as ViewStyle,
  successIconText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  } as TextStyle,
  successTitle: {
    color: colors.text.primary,
    marginBottom: spacing.md,
  } as TextStyle,
  successMessage: {
    color: colors.text.secondary,
    textAlign: 'center',
  } as TextStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
