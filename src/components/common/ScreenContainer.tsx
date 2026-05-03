import React, { ReactNode } from 'react';
import { View, ScrollView, ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface ScreenContainerProps {
  children: ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = true,
  style,
  refreshing = false,
  onRefresh,
}) => {
  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        style,
      ]}
      edges={['top', 'left', 'right']}
    >
      {scrollable ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent.lime}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.nonScrollContainer}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  } as ViewStyle,
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as ViewStyle,
  nonScrollContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  } as ViewStyle,
};
