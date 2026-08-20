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

  const callerStyle = StyleSheet.flatten(style) ?? {};

  /* ⚠ **`fontFamily: 'System'` CANNOT CARRY AN ITALIC ON iOS — MEASURED, NOT
   * ASSUMED (Sam, 2026-08-20, R-116).**
   *
   * Three identical strings were rendered side by side on the simulator with
   * the same `fontSize: 15, fontWeight: '600', fontStyle: 'italic'`:
   *
   * ```
   *   1  raw <RNText>                          -> ITALIC
   *   2  raw <RNText> + fontFamily: 'System'   -> UPRIGHT
   *   3  this component                        -> UPRIGHT
   * ```
   *
   * Line 2 is the whole diagnosis: the family alone kills it. This component
   * was NOT overwriting `fontStyle` (the caller's style is applied after the
   * variant's, and always has been) and the calling screen was NOT failing to
   * pass it. `'System'` is resolved to a concrete face before the italic trait
   * is applied, and the resolved face has no italic under that name.
   *
   * ⚠ **THE REPAIR IS THE NARROWEST ONE THAT IS CORRECT, AND IT TOUCHES NO
   * UPRIGHT TEXT.** The app-wide family is NOT removed or changed — Sam:
   * *"Do not remove or change the app-wide font family merely on suspicion."*
   * The variant's `fontFamily` is dropped for EXACTLY the text that asks for
   * italic and names no family of its own. Everything else — every heading,
   * label, button and body string in the app — keeps `'System'` byte for byte,
   * because the condition below is false for all of it.
   *
   * Omitting the family is what makes it work: React Native then uses the
   * platform default face, which italicises. It is the same typeface the app
   * already renders; nothing new is introduced. */
  const typography = getTypography();
  const wantsItalic = callerStyle.fontStyle === 'italic';
  if (wantsItalic && typography.fontFamily === 'System' && !callerStyle.fontFamily) {
    delete typography.fontFamily;
  }

  const textStyles: TextStyle = {
    color,
    textAlign: align,
    ...typography,
  };
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
