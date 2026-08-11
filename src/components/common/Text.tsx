import React, { createContext, useContext } from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography, type TypographyScale } from '../../theme/typography';
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

const TypographyContext = createContext<TypographyScale>(typography);

export function TypographyScope({
  scale,
  children,
}: {
  scale: TypographyScale;
  children: React.ReactNode;
}) {
  return (
    <TypographyContext.Provider value={scale}>
      {children}
    </TypographyContext.Provider>
  );
}

export const Text = ({
  variant = 'body',
  color = colors.text.primary,
  align = 'auto',
  style,
  children,
  ...props
}: TextProps) => {
  const activeTypography = useContext(TypographyContext);
  const getTypography = (): TextStyle => {
    const typo = activeTypography[variant];
    if (!typo) {
      return activeTypography.body;
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
      : activeTypography.body.fontSize;
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
