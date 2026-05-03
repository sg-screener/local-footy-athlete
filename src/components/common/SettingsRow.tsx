import React from 'react';
import { Pressable, View, ViewStyle, TextStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress: () => void;
  icon: string;
  showChevron?: boolean;
  danger?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  value,
  onPress,
  icon,
  showChevron = true,
  danger = false,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.contentWrapper}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.labelValueContainer}>
          <Text
            variant="body"
            style={[
              styles.label,
              danger && styles.dangerLabel,
            ]}
          >
            {label}
          </Text>
          {value && (
            <Text
              variant="bodySmall"
              style={styles.value}
            >
              {value}
            </Text>
          )}
        </View>
      </View>
      {showChevron && (
        <Text
          variant="body"
          style={styles.chevron}
        >
          ›
        </Text>
      )}
    </Pressable>
  );
};

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
  } as ViewStyle,
  pressed: {
    opacity: 0.7,
  } as ViewStyle,
  contentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  } as ViewStyle,
  icon: {
    fontSize: 24,
  } as TextStyle,
  labelValueContainer: {
    flex: 1,
  } as ViewStyle,
  label: {
    color: colors.text.primary,
    marginBottom: spacing.xs,
  } as TextStyle,
  dangerLabel: {
    color: colors.status.error,
  } as TextStyle,
  value: {
    color: colors.text.tertiary,
  } as TextStyle,
  chevron: {
    color: colors.text.secondary,
    marginLeft: spacing.md,
    fontSize: 20,
  } as TextStyle,
};
