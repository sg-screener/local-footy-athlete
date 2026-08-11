import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { safeTextLineHeight } from '../../theme/textLineBox';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'bodyEmphasis'
  | 'bodySmall'
  | 'bodySmallEmphasis'
  | 'caption'
  | 'captionEmphasis'
  | 'label'
  | 'labelSmall'
  | 'overline'
  | 'button'
  | 'buttonSmall';

export type TextAlign = 'auto' | 'left' | 'right' | 'center' | 'justify';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextAlign;
  style?: StyleProp<TextStyle>;
}

export const Text = ({
  variant = 'body',
  color = colors.text.primary,
  align = 'auto',
  style,
  children,
  ...props
}: TextProps) => {
  const getTypography = (): TextStyle => {
    const typo = typography[variant];
    if (!typo) {
      return typography.body;
    }

    return {
      fontSize: typo.fontSize,
      fontFamily: typo.fontFamily,
      fontWeight: typo.fontWeight as any,
      lineHeight: typo.lineHeight,
      letterSpacing: typo.letterSpacing,
      textTransform: (typo as any).textTransform as any,
    };
  };

  const textStyles: TextStyle = {
    color,
    textAlign: align,
    ...getTypography(),
  };
  const callerStyle = StyleSheet.flatten(style) ?? {};
  const effectiveFontSize = typeof callerStyle.fontSize === 'number'
    ? callerStyle.fontSize
    : typeof textStyles.fontSize === 'number'
      ? textStyles.fontSize
      : typography.body.fontSize;
  const requestedLineHeight = typeof callerStyle.lineHeight === 'number'
    ? callerStyle.lineHeight
    : typeof textStyles.lineHeight === 'number'
      ? textStyles.lineHeight
      : undefined;
  const resolvedLineBox: TextStyle = {
    lineHeight: safeTextLineHeight(effectiveFontSize, requestedLineHeight),
  };

  return (
    <RNText
      {...props}
      style={[styles.default, textStyles, style, resolvedLineBox]}
      allowFontScaling={false}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  default: {
    color: colors.text.primary,
  },
});
