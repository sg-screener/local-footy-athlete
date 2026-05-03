import React from 'react';
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
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

export const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const planName = 'LFA Pro';
  const status = 'Active';
  const trialEndDate = '2026-04-02';
  const price = '$10/week';

  const getStatusColor = (stat: string) => {
    switch (stat) {
      case 'Active':
        return colors.status.success;
      case 'Trial':
        return colors.accent.lime;
      case 'Expired':
        return colors.status.error;
      default:
        return colors.text.secondary;
    }
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
          Subscription
        </Text>
      </View>

      {/* Subscription Status Card */}
      <Card variant="elevated" style={styles.subscriptionCard}>
        <View style={styles.planInfo}>
          <Text variant="h3" style={styles.planName}>
            {planName}
          </Text>
          <View style={styles.statusBadge}>
            <Text
              variant="caption"
              style={[styles.statusText, { color: getStatusColor(status) }]}
            >
              {status}
            </Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text variant="bodySmall" style={styles.detailLabel}>
              Trial Ends
            </Text>
            <Text variant="body" style={styles.detailValue}>
              {trialEndDate}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text variant="bodySmall" style={styles.detailLabel}>
              Price
            </Text>
            <Text variant="h4" style={styles.priceValue}>
              {price}
            </Text>
          </View>
        </View>
      </Card>

      {/* Features List */}
      <Text variant="h4" style={styles.featuresTitle}>
        Your Benefits
      </Text>

      <View style={styles.featuresList}>
        <View style={styles.featureItem}>
          <Text style={styles.featureCheckmark}>✓</Text>
          <Text variant="body" style={styles.featureText}>
            AI-Powered Training Plans
          </Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureCheckmark}>✓</Text>
          <Text variant="body" style={styles.featureText}>
            Personalized Workouts
          </Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureCheckmark}>✓</Text>
          <Text variant="body" style={styles.featureText}>
            Progress Tracking
          </Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureCheckmark}>✓</Text>
          <Text variant="body" style={styles.featureText}>
            Coach Tips & Support
          </Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureCheckmark}>✓</Text>
          <Text variant="body" style={styles.featureText}>
            Community Access
          </Text>
        </View>
      </View>

      {/* Manage Subscription Button */}
      <Button
        title="Manage Subscription"
        variant="primary"
        onPress={() => {
          // Navigate to manage subscription
          console.log('Navigate to manage subscription');
        }}
        style={styles.manageButton}
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
  subscriptionCard: {
    backgroundColor: colors.surface.secondary,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  } as ViewStyle,
  planInfo: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  planName: {
    color: colors.text.primary,
    marginBottom: spacing.sm,
  } as TextStyle,
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  } as ViewStyle,
  statusText: {
    fontWeight: '600',
  } as TextStyle,
  detailsContainer: {
    gap: spacing.md,
  } as ViewStyle,
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  detailLabel: {
    color: colors.text.secondary,
  } as TextStyle,
  detailValue: {
    color: colors.text.primary,
    fontWeight: '500',
  } as TextStyle,
  priceValue: {
    color: colors.accent.lime,
    fontWeight: '700',
  } as TextStyle,
  divider: {
    height: 1,
    backgroundColor: colors.surface.tertiary,
  } as ViewStyle,
  featuresTitle: {
    color: colors.text.primary,
    marginBottom: spacing.md,
  } as TextStyle,
  featuresList: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  } as ViewStyle,
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
  } as ViewStyle,
  featureCheckmark: {
    color: colors.status.success,
    fontSize: 18,
    fontWeight: '700',
    marginRight: spacing.md,
  } as TextStyle,
  featureText: {
    color: colors.text.primary,
    flex: 1,
  } as TextStyle,
  manageButton: {
    marginBottom: spacing.md,
  } as ViewStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
