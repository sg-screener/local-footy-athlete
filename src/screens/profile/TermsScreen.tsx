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

export const TermsScreen: React.FC = () => {
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
          Terms of Use
        </Text>
      </View>

      <Text variant="bodySmall" style={styles.lastUpdated}>
        Last updated: {LAST_UPDATED}
      </Text>

      <Text variant="body" style={styles.sectionContent}>
        These terms explain the practical use of Local Footy Athlete during the MVP. By using the app, you agree to use it as football strength and conditioning guidance, not as medical care.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Training guidance
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        The app builds and adjusts training plans from the setup and coach updates you provide. You are responsible for training within your ability, using safe technique and stopping if something feels unsafe.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Not medical advice
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        Local Footy Athlete is an S&C app. It does not diagnose injuries, prescribe rehab or replace a physio, doctor or qualified healthcare professional. If pain is significant, worsening or unclear, get it assessed.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Coach chat
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        The coach can help you train around soreness, fatigue, missed sessions, schedule changes and practical constraints. Do not rely on the coach for emergency advice, diagnosis or treatment decisions.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Accuracy and availability
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        We aim to keep the app useful and reliable, but MVP software can have bugs, outages or imperfect outputs. Check sessions before training and contact support if something looks wrong.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Your responsibility
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        Use appropriate equipment, warm up properly, follow local coaching or club guidance, and choose loads you can control. If you are unsure whether to train, speak to a qualified professional.
      </Text>

      <Text variant="h4" style={styles.sectionTitle}>
        Changes
      </Text>
      <Text variant="body" style={styles.sectionContent}>
        These terms may be updated as the product changes. The latest version is shown in the app.
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
