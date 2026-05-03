import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Linking,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

const APP_VERSION = '1.0.0';
const WEBSITE_URL = 'https://localfootyathlete.com';

export const AboutScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const handleOpenWebsite = () => {
    Linking.openURL(WEBSITE_URL).catch((err) =>
      console.error('Failed to open website:', err)
    );
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
          About
        </Text>
      </View>

      {/* Logo Section */}
      <View style={styles.logoSection}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>LFA</Text>
        </View>
      </View>

      {/* App Name and Version */}
      <Text variant="h3" style={styles.appName}>
        Local Footy Athlete
      </Text>
      <Text variant="body" style={styles.version}>
        Version {APP_VERSION}
      </Text>

      {/* Tagline */}
      <Text variant="bodyEmphasis" style={styles.tagline}>
        AI-Powered S&C for Local Footy Athletes
      </Text>

      {/* Description */}
      <Text variant="body" style={styles.description}>
        Local Footy Athlete is your personal AI-powered strength and conditioning coach, designed specifically for local Australian rules football players. Get personalized training plans, track your progress, and improve your game performance.
      </Text>

      {/* Built By Section */}
      <View style={styles.builtBySection}>
        <Text variant="label" style={styles.builtByLabel}>
          Built with ❤️ by
        </Text>
        <Text variant="body" style={styles.builtByText}>
          The LFA Team
        </Text>
      </View>

      {/* Website Button */}
      <Button
        title="Visit Our Website"
        variant="primary"
        onPress={handleOpenWebsite}
        style={styles.websiteButton}
      />

      {/* Contact Section */}
      <View style={styles.contactSection}>
        <Text variant="label" style={styles.contactLabel}>
          Questions or Feedback?
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Support')}
          style={styles.contactLink}
        >
          <Text variant="body" style={styles.contactText}>
            Contact Support →
          </Text>
        </Pressable>
      </View>

      {/* Legal Links */}
      <View style={styles.legalLinksContainer}>
        <Pressable
          onPress={() => navigation.navigate('Privacy')}
          style={styles.legalLink}
        >
          <Text variant="bodySmall" style={styles.legalLinkText}>
            Privacy Policy
          </Text>
        </Pressable>
        <Text variant="bodySmall" style={styles.separator}>
          •
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Terms')}
          style={styles.legalLink}
        >
          <Text variant="bodySmall" style={styles.legalLinkText}>
            Terms of Service
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
  logoSection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  } as ViewStyle,
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent.lime,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  logoText: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.surface.primary,
  } as TextStyle,
  appName: {
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  } as TextStyle,
  version: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  } as TextStyle,
  tagline: {
    color: colors.accent.lime,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  } as TextStyle,
  description: {
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  } as TextStyle,
  builtBySection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
  } as ViewStyle,
  builtByLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  } as TextStyle,
  builtByText: {
    color: colors.text.primary,
    fontWeight: '600',
  } as TextStyle,
  websiteButton: {
    marginVertical: spacing.lg,
  } as ViewStyle,
  contactSection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  } as ViewStyle,
  contactLabel: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
  } as TextStyle,
  contactLink: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  } as ViewStyle,
  contactText: {
    color: colors.accent.lime,
    fontWeight: '500',
  } as TextStyle,
  legalLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  } as ViewStyle,
  legalLink: {
    paddingHorizontal: spacing.sm,
  } as ViewStyle,
  legalLinkText: {
    color: colors.text.tertiary,
  } as TextStyle,
  separator: {
    color: colors.text.tertiary,
  } as TextStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
});
