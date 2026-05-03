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
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

const LAST_UPDATED = '2026-05-03';

export const PrivacyScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text variant="h3" style={styles.backButton}>
            Back
          </Text>
        </Pressable>
        <Text variant="h2" style={styles.title}>
          Privacy Policy
        </Text>
      </View>

      <Text variant="bodySmall" style={styles.lastUpdated}>
        Last updated: {LAST_UPDATED}
      </Text>

      <Text variant="body" style={styles.sectionContent}>
        This MVP does not require you to create an account. The app uses the setup, training and coach information you enter to build and adjust your football strength and conditioning program.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Information the app uses
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        Local Footy Athlete may use your name, position, training schedule, game day, experience level, body measurements, training preferences, workout activity, calendar changes, soreness, fatigue, injury context and coach chat messages.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Coach chat and AI processing
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        Coach messages and relevant program context may be sent to backend and AI services so the app can understand your request and return a coach response. Deterministic app rules make the final visible program changes.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Health information
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        Only enter practical training context needed to adjust your week. Do not enter sensitive diagnosis details or private medical records. The app is for S&C guidance, not medical diagnosis, treatment or rehab.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Storage and use
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        Some app data is stored on your device so your profile, program and coach state can persist. Backend services may process requests needed for program generation and coach replies. We do not sell your personal data.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Third-party services
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        The MVP uses Supabase for backend functions, AI providers for coach understanding and replies, and YouTube privacy-enhanced embeds when you open exercise videos. We do not use advertising tracking.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Support and deletion requests
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        You can use Full reset in Profile to clear local app data and return to onboarding. For questions or data requests, contact support from the Profile screen.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Changes
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        We may update this policy as the MVP changes. The latest version is shown in the app.
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
  lastUpdated: {
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  } as TextStyle,
  sectionTitle: {
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  } as TextStyle,
  sectionContent: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  } as TextStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
