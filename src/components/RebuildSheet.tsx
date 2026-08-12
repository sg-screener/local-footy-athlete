/**
 * "BUILDING YOUR PROGRAM…" — ONE PROGRESS SURFACE, EVERY SCREEN THAT CAN CAUSE
 * A REBUILD.
 *
 * MOVED OUT OF `HomeScreenV2` 2026-08-12 (SEAT_INBOX item 8), and the move was
 * forced by measurement rather than tidiness. My Status now owns the modifier
 * controls, and a census of `clearActiveProgramModifier` shows four modifier
 * families whose clear returns `rebuildRequired: true`. Regenerating a program
 * takes seconds. Without this sheet on the Coach tab the athlete would tap
 * "Clear adjustment", watch nothing happen, and tap again — a control that
 * works but says nothing while it works, which is the dead-affordance law's own
 * territory.
 *
 * NOTHING CHANGED IN THE MOVE. Every string, colour and spacing value is
 * byte-identical to the version that lived in `HomeScreenV2`; the merge's
 * governing rule forbids this unit touching a token, and a move that restyled
 * would break it while looking like a move.
 *
 * `BuildingState` is exported because `HomeScreenV2`'s phase-shift sheet is its
 * second reader. Two copies of a spinner and a rotating sentence would be two
 * places to disagree about what the app says while it thinks.
 */

import React from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { Text } from './common/Text';
import { Button, Sheet } from './ui';
import { borderRadius, spacing } from '../theme/spacing';
import { REBUILD_MESSAGES } from '../screens/home/homeScreenConstants';

export interface BuildingStateProps {
  title: string;
  msgIdx: number;
  msgOpacity: Animated.Value;
  messages: string[];
}

export function BuildingState({ title, msgIdx, msgOpacity, messages }: BuildingStateProps) {
  return (
    <View style={styles.building}>
      <ActivityIndicator size="large" color="#C8FF00" style={styles.buildingSpinner} />
      <Text style={styles.sheetTitle}>{title}</Text>
      <Text style={styles.sheetSubtext}>This can take up to 1 minute</Text>
      <Animated.View style={{ opacity: msgOpacity }}>
        <Text style={styles.buildingMsg}>{messages[msgIdx]}</Text>
      </Animated.View>
    </View>
  );
}

export interface RebuildSheetProps {
  visible: boolean;
  onClose: () => void;
  isRebuilding: boolean;
  error: string | null;
  canRetry: boolean;
  msgIdx: number;
  msgOpacity: Animated.Value;
  onConfirm: () => void;
}

export function RebuildSheet({
  visible, onClose, isRebuilding, error, canRetry, msgIdx, msgOpacity, onConfirm,
}: RebuildSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} dismissable={!isRebuilding}>
      {isRebuilding ? (
        <BuildingState
          title="Building your program…"
          msgIdx={msgIdx}
          msgOpacity={msgOpacity}
          messages={REBUILD_MESSAGES}
        />
      ) : (
        <>
          <Text style={styles.sheetTitle}>Rebuild this week?</Text>
          <Text style={styles.sheetBody}>
            Fresh exercise content will be generated from your current profile.
          </Text>
          <View style={styles.noteBlock}>
            <Text style={styles.notePreserved}>✓ Game days and logged workouts are preserved</Text>
            <Text style={styles.noteWiped}>✗ Any custom exercise swaps will be lost</Text>
          </View>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : 'Rebuild week'}
              size="lg"
              onPress={onConfirm}
            />
          )}
          <Button
            label={error && !canRetry ? 'Close' : 'Cancel'}
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ marginTop: spacing.md }}
          />
        </>
      )}
    </Sheet>
  );
}

// MOVED WITH THE COMPONENTS, BYTE-IDENTICAL.
const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: 19, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 6,
  },
  sheetBody: {
    color: '#B0B0B0', fontSize: 14, lineHeight: 20, textAlign: 'center',
    marginBottom: spacing.md, paddingHorizontal: spacing.sm,
  },
  sheetSubtext: { color: '#757575', fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
  sheetError: { color: '#F44336', fontSize: 13, textAlign: 'center', marginBottom: spacing.sm },
  noteBlock: {
    gap: 6, backgroundColor: '#1A1A1A', borderRadius: borderRadius.lg,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: spacing.md,
  },
  notePreserved: { color: '#C8FF00', fontSize: 13, fontWeight: '600' },
  noteWiped: { color: '#FF9AA2', fontSize: 13, fontWeight: '500' },
  building: {
    alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md,
  },
  buildingSpinner: { marginBottom: spacing.md },
  buildingMsg: {
    color: '#C8FF00', fontSize: 14, fontWeight: '500',
    textAlign: 'center', minHeight: 20, letterSpacing: 0.2,
  },
});
