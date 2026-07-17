import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './common/Text';

interface ExplorerRenderWitnessProps {
  testID: string;
  accessibilityLabel?: string;
}

/**
 * A retained native leaf for state that is otherwise proved by absence (for
 * example, a cleared restriction or deleted component). It is deliberately
 * tiny but remains in both the React Native hierarchy and the accessibility
 * tree, giving reload checks a deterministic semantic identity.
 */
export function ExplorerRenderWitness({
  testID,
  accessibilityLabel = testID,
}: ExplorerRenderWitnessProps) {
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      collapsable={false}
      pointerEvents="none"
      style={styles.witness}
      testID={testID}
    >
      <Text style={styles.text}>{accessibilityLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  witness: {
    width: 1,
    height: 1,
    opacity: 0.01,
    overflow: 'hidden',
  },
  text: {
    fontSize: 1,
    lineHeight: 1,
  },
});
