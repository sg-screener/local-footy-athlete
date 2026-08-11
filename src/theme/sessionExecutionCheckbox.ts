import type { TextStyle, ViewStyle } from 'react-native';
import { colors } from './colors';

/** One checkbox shape for every row in the live session checklist. */
export const sessionExecutionCheckbox: ViewStyle = {
  width: 22,
  height: 22,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: '#666666',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

export const sessionExecutionCheckboxChecked: ViewStyle = {
  borderColor: colors.accent.lime,
  backgroundColor: 'rgba(200,255,0,0.12)',
};

export const sessionExecutionCheckmark: TextStyle = {
  color: colors.accent.lime,
  fontSize: 13,
  fontWeight: '900',
};
