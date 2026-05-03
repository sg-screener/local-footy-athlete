import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, dimensions } from '../../theme/spacing';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  imageUrl?: string;
  style?: ViewStyle;
}

export const Avatar = ({
  name,
  size = 'md',
  imageUrl,
  style,
}: AvatarProps) => {
  const getSize = () => {
    switch (size) {
      case 'sm':
        return dimensions.avatar.xs;
      case 'md':
        return dimensions.avatar.sm;
      case 'lg':
        return dimensions.avatar.md;
      default:
        return dimensions.avatar.sm;
    }
  };

  const getInitials = () => {
    return name
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const getFontSize = () => {
    const s = getSize();
    if (s <= 32) return 12;
    if (s <= 48) return 16;
    if (s <= 64) return 20;
    return 24;
  };

  const avatarSize = getSize();

  const containerStyle: ViewStyle = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarSize / 2,
    backgroundColor: colors.accent.lime,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  };

  return (
    <View style={[styles.avatar, containerStyle, style]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      ) : (
        <Text
          variant="label"
          color={colors.button.primaryText}
          align="center"
          style={{
            fontSize: getFontSize(),
            fontWeight: '700',
          }}
        >
          {getInitials()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {},
});
