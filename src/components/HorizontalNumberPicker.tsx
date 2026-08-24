import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from './common/Text';
import { colors } from '../theme/colors';
import { numberPickerIndexFromOffset } from './horizontalNumberPickerMath';

interface HorizontalNumberPickerProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  testID: string;
  style?: StyleProp<ViewStyle>;
}

const ITEM_WIDTH = 56;

/** A centred, snapping number wheel with distance-driven scale and opacity. */
export function HorizontalNumberPicker({
  value,
  onChange,
  min,
  max,
  testID,
  style,
}: HorizontalNumberPickerProps): React.ReactElement {
  const listRef = useRef<FlatList<number>>(null);
  const scrollX = useRef(new Animated.Value((value - min) * ITEM_WIDTH)).current;
  const [viewportWidth, setViewportWidth] = useState(0);
  const values = useMemo(
    () => Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index),
    [max, min],
  );

  const boundedIndex = useCallback((index: number) => (
    Math.min(values.length - 1, Math.max(0, index))
  ), [values.length]);

  const selectIndex = useCallback((index: number, animated: boolean) => {
    if (values.length === 0) return;
    const nextIndex = boundedIndex(index);
    const nextValue = values[nextIndex];
    listRef.current?.scrollToOffset({
      offset: nextIndex * ITEM_WIDTH,
      animated,
    });
    if (nextValue !== value) onChange(nextValue);
  }, [boundedIndex, onChange, value, values]);

  const settleFromScroll = useCallback((
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    selectIndex(numberPickerIndexFromOffset(offsetX, ITEM_WIDTH, values.length), true);
  }, [selectIndex, values.length]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (viewportWidth <= 0) return;
    const index = boundedIndex(value - min);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: index * ITEM_WIDTH,
        animated: false,
      });
      scrollX.setValue(index * ITEM_WIDTH);
    });
  }, [boundedIndex, min, scrollX, value, viewportWidth]);

  const sideInset = Math.max(0, (viewportWidth - ITEM_WIDTH) / 2);

  return (
    <View
      testID={testID}
      style={[styles.container, style]}
      onLayout={handleLayout}
    >
      <Animated.FlatList
        ref={listRef}
        horizontal
        data={values}
        keyExtractor={(item) => String(item)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="center"
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: sideInset }}
        getItemLayout={(_, index) => ({
          length: ITEM_WIDTH,
          offset: ITEM_WIDTH * index,
          index,
        })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onScrollEndDrag={settleFromScroll}
        onMomentumScrollEnd={settleFromScroll}
        renderItem={({ item, index }) => {
          const inputRange = [
            (index - 2) * ITEM_WIDTH,
            (index - 1) * ITEM_WIDTH,
            index * ITEM_WIDTH,
            (index + 1) * ITEM_WIDTH,
            (index + 2) * ITEM_WIDTH,
          ];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.78, 0.9, 1.34, 0.9, 0.78],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.35, 0.62, 1, 0.62, 0.35],
            extrapolate: 'clamp',
          });

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: item === value }}
              accessibilityLabel={`${item} days per week`}
              onPress={() => selectIndex(index, true)}
              style={styles.item}
              testID={`${testID}-value-${item}`}
            >
              <Animated.View style={{ opacity, transform: [{ scale }] }}>
                <Text style={[styles.number, item === value && styles.numberSelected]}>
                  {item}
                </Text>
              </Animated.View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 78,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  item: {
    width: ITEM_WIDTH,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    minWidth: 28,
    color: colors.text.secondary,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '600',
    textAlign: 'center',
  },
  numberSelected: {
    color: colors.accent.lime,
    fontWeight: '800',
  },
});
