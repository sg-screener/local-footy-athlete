import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { colors } from '../theme/colors';
import AppNavigator from './AppNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import { useInitializeApp } from '../hooks/useInitializeApp';
import { useProfileStore } from '../store/profileStore';
import { Loading } from '../components/common/Loading';
import { View } from 'react-native';

// Custom dark theme for navigation
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

/**
 * Root navigator — conditionally renders onboarding or main app.
 *
 * IMPORTANT: This is NOT a nested native stack.  It just switches which
 * navigator is mounted inside a single NavigationContainer.  Nesting two
 * native stacks caused Android to lose height constraints on inner screens,
 * which broke ScrollView everywhere in the onboarding flow.
 */
export default function RootNavigator() {
  const { isReady } = useInitializeApp();
  const isOnboardingComplete = useProfileStore(
    (state) => state.isOnboardingComplete,
  );

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface.primary,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Loading />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isOnboardingComplete ? <AppNavigator /> : <OnboardingNavigator />}
    </NavigationContainer>
  );
}
