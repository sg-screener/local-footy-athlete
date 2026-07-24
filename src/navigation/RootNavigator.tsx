import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { retryAppHydration } from '../store/appHydrationGate';
import AppNavigator from './AppNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import { useInitializeApp } from '../hooks/useInitializeApp';
import { useProfileStore } from '../store/profileStore';
import { Loading } from '../components/common/Loading';
import { logger } from '../utils/logger';
import { navigationRef } from './navigationRef';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent.lime,
    background: colors.surface.primary,
    card: colors.surface.secondary,
    text: colors.text.primary,
    border: colors.input.border,
    notification: colors.status.error,
  },
};

export default function RootNavigator() {
  const { isReady, hydration } = useInitializeApp();
  const isOnboardingComplete = useProfileStore((state) => state.isOnboardingComplete);

  React.useEffect(() => {
    logger.info(
      `[navigation-state] isOnboardingComplete ${isOnboardingComplete ? 'true' : 'false'} hydration ${hydration.status}`,
    );
  }, [isOnboardingComplete, hydration.status]);

  if (!isReady) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: colors.surface.primary,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Loading />
      </View>
    );
  }

  // Storage that never answered. Entering onboarding here would let the athlete
  // type answers that cannot be saved — the exact failure this branch exists to
  // prevent. Say so, and offer a retry.
  if (hydration.status === 'failed') {
    return (
      <View style={styles.bootError}>
        <Text style={styles.bootErrorTitle}>Couldn't load your saved data</Text>
        <Text style={styles.bootErrorBody}>
          Your training data is still on this device, but the app couldn't read it
          just now. Tap below to try again.
        </Text>
        <Pressable style={styles.bootErrorButton} onPress={() => { void retryAppHydration(); }}>
          <Text style={styles.bootErrorButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={navigationTheme}
      ref={navigationRef}
      onReady={() => logger.info('[navigation-container] onReady')}
    >
      {isOnboardingComplete ? <AppNavigator /> : <OnboardingNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bootError: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  bootErrorTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  bootErrorBody: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
  },
  bootErrorButton: {
    backgroundColor: colors.accent.lime,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  bootErrorButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
  },
});
