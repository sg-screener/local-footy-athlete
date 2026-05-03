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

const STAR_RATINGS = [1, 2, 3, 4, 5];

export const FeedbackScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0 || !feedback.trim()) {
      return;
    }

    setLoading(true);
    try {
      // Submit feedback to backend
      console.log('Feedback submitted:', {
        email: user?.email,
        rating,
        feedback,
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setRating(0);
        setFeedback('');
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <ScreenContainer>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>❤️</Text>
          </View>
          <Text variant="h3" style={styles.successTitle}>
            Thank You!
          </Text>
          <Text variant="body" style={styles.successMessage}>
            Your feedback helps us improve. We appreciate your input!
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
          Feedback
        </Text>
      </View>

      <Text variant="bodySmall" style={styles.subtitle}>
        How are we doing? We'd love to hear from you!
      </Text>

      {/* Rating Section */}
      <Text variant="label" style={styles.label}>
        How satisfied are you with LFA?
      </Text>
      <View style={styles.ratingContainer}>
        {STAR_RATINGS.map((star) => (
          <Pressable
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Text style={styles.star}>
              {star <= rating ? '⭐' : '☆'}
            </Text>
          </Pressable>
        ))}
      </View>

      {rating > 0 && (
        <Text variant="caption" style={styles.ratingLabel}>
          {rating === 1 && "We're sorry to hear that..."}
          {rating === 2 && "There's room for improvement"}
          {rating === 3 && "Thanks for the neutral feedback"}
          {rating === 4 && "Glad you're enjoying it!"}
          {rating === 5 && "We're thrilled you love it!"}
        </Text>
      )}

      {/* Feedback Textarea */}
      <Text variant="label" style={styles.label}>
        Tell us more (optional)
      </Text>
      <Input
        label=""
        value={feedback}
        onChangeText={setFeedback}
        placeholder="What could we improve? What did you love?"
        multiline
        style={styles.feedbackInput}
      />

      {/* Submit Button */}
      <Button
        title={loading ? 'Sending...' : 'Send Feedback'}
        variant="primary"
        onPress={handleSubmit}
        disabled={loading || rating === 0}
        style={styles.submitButton}
      />

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
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  } as ViewStyle,
  starButton: {
    padding: spacing.sm,
  } as ViewStyle,
  star: {
    fontSize: 36,
  } as TextStyle,
  ratingLabel: {
    color: colors.accent.lime,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  } as TextStyle,
  feedbackInput: {
    minHeight: 120,
  } as ViewStyle,
  submitButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as ViewStyle,
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
  successIcon: {
    fontSize: 60,
    marginBottom: spacing.lg,
  } as TextStyle,
  successIconText: {
    fontSize: 60,
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
