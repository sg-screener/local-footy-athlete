import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from './Text';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export const Header = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  style,
}: HeaderProps) => {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface.secondary,
          borderBottomColor: colors.surface.tertiary,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          {showBack && (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [
                styles.backButton,
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                variant="h3"
                color={colors.accent.lime}
                style={styles.backIcon}
              >
                ←
              </Text>
            </Pressable>
          )}

          <View style={styles.titleSection}>
            <Text
              variant="h2"
              color={colors.text.primary}
              numberOfLines={1}
            >
              {title}
            </Text>

            {subtitle && (
              <Text
                variant="bodySmall"
                color={colors.text.secondary}
                numberOfLines={1}
                style={styles.subtitle}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {rightAction && (
          <View style={styles.rightSection}>
            {rightAction}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
  },
  backIcon: {
    fontSize: 28,
  },
  titleSection: {
    flex: 1,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
});
