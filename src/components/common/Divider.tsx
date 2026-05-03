import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface DividerProps {
  color?: string;
  spacing?: number;
  style?: ViewStyle;
}

export const Divider = ({
  color = colors.surface.tertiary,
  spacing: customSpacing = spacing.md,
  style,
}: DividerProps) => {
  const dividerStyle: ViewStyle = {
    height: 1,
    backgroundColor: color,
    marginVertical: customSpacing,
  };

  return <View style={[styles.divider, dividerStyle, style]} />;
};

const styles = StyleSheet.create({
  divider: {
    width: '100%',
  },
});
