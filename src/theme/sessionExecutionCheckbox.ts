import type { TextStyle, ViewStyle } from 'react-native';
import { colors } from './colors';

/** One checkbox shape for every row in the live session checklist. */
export const sessionExecutionCheckbox: ViewStyle = {
  width: 18,
  height: 18,
  borderRadius: 5,
  borderWidth: 1,
  borderColor: '#666666',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export const sessionExecutionCheckboxChecked: ViewStyle = {
  borderColor: colors.accent.lime,
  backgroundColor: 'rgba(216,216,0,0.12)',
};

export const sessionExecutionCheckmark: TextStyle = {
  color: colors.accent.lime,
  fontSize: 11,
  fontWeight: '900',
};
