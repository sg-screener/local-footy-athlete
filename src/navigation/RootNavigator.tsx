import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { View } from 'react-native';
import { colors } from '../theme/colors';
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
  const { isReady } = useInitializeApp();
  const isOnboardingComplete = useProfileStore((state) => state.isOnboardingComplete);

  React.useEffect(() => {
    logger.info(
      `[navigation-state] isOnboardingComplete ${isOnboardingComplete ? 'true' : 'false'} isReady ${isReady ? 'true' : 'false'}`,
    );
  }, [isOnboardingComplete, isReady]);

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
