/**
 * THE SEASON-PHASE SHIFT SHEET — moved to where its surface already is.
 *
 * SEAT_INBOX item 15, the last of the queue: *"The surface is on the Coach tab
 * (`CoachTabScreen.tsx:479`); the implementation never followed, so
 * `src/components/SeasonPhaseShiftSheet.tsx` is a permanent six-line re-export
 * of a component still inside `HomeScreenV2.tsx`."*
 *
 * ## WHY A RE-EXPORT WAS THE WRONG RESTING STATE
 *
 * The bridge was correct WHILE the move was happening — its own comment says
 * so: *"re-exporting during the move keeps every athlete-visible word in its
 * established signed-copy location instead of duplicating the sheet."* The
 * defect is that the move never finished, so a screen the athlete reaches from
 * COACH had its implementation, its styles and its back chevron living inside
 * the PROGRAM screen's 4000-line file, reachable only through a one-line
 * indirection that explained itself as temporary.
 *
 * A file that says "during the move" and never stops saying it is a file that
 * has stopped being read.
 *
 * ## WHAT MOVED, AND WHAT DID NOT CHANGE
 *
 * The props, `BackChevron` (defined in the block and used nowhere else), the
 * component, and the twenty style rules it referenced — byte for byte. **No
 * copy changed, no id changed, no colour or spacing value changed.** Every
 * athlete-visible word still comes from where it came from; this is a move, and
 * a move that restyled would break the merge rule while looking like a move.
 *
 * `BuildingState` comes from `components/RebuildSheet`, where it went on
 * 2026-08-12 when Coach / My Status gained its own rebuild.
 */

import React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from './common/Text';
import { SelectableTile } from './common';
import { Button, Sheet, SheetDescription, SheetHeader } from './ui';
import { BuildingState } from './RebuildSheet';
import { borderRadius, spacing } from '../theme/spacing';
import {
  DAY_SHORT,
  PHASE_SHIFT_MESSAGES,
  WEEK_DAYS,
  type PhaseShiftStep,
} from '../screens/home/homeScreenConstants';
import { signedCopy } from '../rules/signedCopy';
import type { DayOfWeek, SeasonPhase } from '../types/domain';

interface PhaseShiftSheetProps {
  visible: boolean;
  step: PhaseShiftStep;
  currentPhase: SeasonPhase;
  targetPhase: SeasonPhase;
  isRebuilding: boolean;
  error: string | null;
  canRetry: boolean;
  msgIdx: number;
  msgOpacity: Animated.Value;
  pendingPreferredDays: DayOfWeek[];
  pendingTeamDays: DayOfWeek[];
  pendingGameDay: DayOfWeek | null;
  /** False until the athlete names a day or says they have no usual one. */
  gameAnchorAnswered: boolean;
  onClose: () => void;
  onBack: () => void;
  onTogglePendingPreferredDay: (d: DayOfWeek) => void;
  onTogglePendingTeamDay: (d: DayOfWeek) => void;
  onSetPendingGameDay: (d: DayOfWeek) => void;
  onAnswerNoUsualGameDay: () => void;
  onSelectTargetPhase: (phase: SeasonPhase) => void;
  onAdvance: () => void;
}

/**
 * Muted back chevron — top-left of the modal. Only shown on steps where
 * "back" has a meaningful target (i.e. not on `confirm` or `building`).
 * Intentionally small, unstyled, and chromeless to avoid wizard-like heft.
 */
function BackChevron({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [styles.backChevron, pressed && { opacity: 0.6 }]}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
        stroke="#8A8A8A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 18l-6-6 6-6" />
      </Svg>
    </Pressable>
  );
}

export function SeasonPhaseShiftSheet({
  visible, step, currentPhase, targetPhase, isRebuilding, error, canRetry, msgIdx, msgOpacity,
  pendingPreferredDays, pendingTeamDays, pendingGameDay, gameAnchorAnswered,
  onClose, onBack,
  onTogglePendingPreferredDay, onTogglePendingTeamDay, onSetPendingGameDay,
  onAnswerNoUsualGameDay, onSelectTargetPhase, onAdvance,
}: PhaseShiftSheetProps) {
  const building = step === 'building' || isRebuilding;
  // Back is meaningful on every interactive step except the first. Hide on
  // `confirm` (no previous step) and `building` (irreversible) to keep the
  // chrome honest — never show a control that would no-op.
  const showBack = !building && step !== 'confirm';
  // Availability minimum: reuse onboarding's "at least 1 day" baseline.
  // Stricter caps (e.g. enforcing `trainingDaysPerWeek`) would punish
  // athletes who legitimately need to drop a day mid-season — the engine
  // copes fine with a reduced set.
  const availabilityValid = pendingPreferredDays.length >= 1;

  return (
    <Sheet visible={visible} onClose={onClose} dismissable={!isRebuilding}>
      {showBack && <BackChevron onPress={onBack} />}
      {building ? (
        <BuildingState
          title={`Shifting to ${targetPhase}…`}
          msgIdx={msgIdx}
          msgOpacity={msgOpacity}
          messages={PHASE_SHIFT_MESSAGES}
        />
      ) : step === 'confirm' ? (
        <>
          <SheetHeader title="Season phase" subtitle={signedCopy('phase.review.title')} />
          <SheetDescription>
            {signedCopy('phase.review.body')}
          </SheetDescription>
          <View style={styles.phaseOptions}>
            {(['In-season', 'Pre-season', 'Off-season'] as const).map((phase) => {
              const selected = targetPhase === phase;
              return (
                <Pressable
                  key={phase}
                  onPress={() => onSelectTargetPhase(phase)}
                  testID={`season-phase-option-${phase.toLowerCase()}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={phase}
                  style={({ pressed }) => [
                    styles.phaseOption,
                    selected && styles.phaseOptionSelected,
                    pressed && { opacity: 0.72 },
                  ]}
                >
                  <Text style={styles.phaseOptionLabel}>{phase}</Text>
                  <View style={[styles.phaseRadio, selected && styles.phaseRadioSelected]}>
                    {selected ? <View style={styles.phaseRadioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {targetPhase !== currentPhase ? (
            <View style={styles.noteBlock}>
              <Text style={styles.notePreserved}>✓ Game days are preserved</Text>
              <Text style={styles.noteWiped}>✗ Any custom exercise swaps will be lost</Text>
              <Text style={styles.notePreserved}>✓ Phase updated to {targetPhase}</Text>
            </View>
          ) : null}
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : signedCopy('phase.review.confirm')}
              size="lg"
              disabled={targetPhase === currentPhase}
              onPress={onAdvance}
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
      ) : step === 'availability' ? (
        // Availability re-confirmation. See useHomeScreen for why we always
        // re-ask instead of reusing onboarding data.
        <>
          <SheetHeader title="Availability" subtitle="What days can you train?" />
          <SheetDescription>
            We'll plan your {targetPhase.toLowerCase()} week around these days. Update them if your schedule has changed.
          </SheetDescription>
          <View style={styles.chipGrid}>
            {WEEK_DAYS.map((day) => {
              const selected = pendingPreferredDays.includes(day);
              return (
                <SelectableTile
                  key={day}
                  shape="chip"
                  isSelected={selected}
                  hideCheckmark
                  onPress={() => onTogglePendingPreferredDay(day)}
                  style={styles.dayChip}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {DAY_SHORT[day]}
                  </Text>
                </SelectableTile>
              );
            })}
          </View>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={
                error
                  ? 'Try again'
                  : targetPhase === 'Off-season'
                  ? `Shift to ${targetPhase}`
                  : 'Continue'
              }
              size="lg"
              disabled={!availabilityValid}
              onPress={onAdvance}
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
      ) : step === 'teamDays' ? (
        <>
          <SheetHeader title="Team training" subtitle="Which days does your team train?" />
          <SheetDescription>
            We'll keep heavy lower-body and sprint work off these days.
          </SheetDescription>
          <View style={styles.chipGrid}>
            {WEEK_DAYS.map((day) => {
              const selected = pendingTeamDays.includes(day);
              return (
                <SelectableTile
                  key={day}
                  shape="chip"
                  isSelected={selected}
                  hideCheckmark
                  onPress={() => onTogglePendingTeamDay(day)}
                  style={styles.dayChip}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {DAY_SHORT[day]}
                  </Text>
                </SelectableTile>
              );
            })}
          </View>
          <Text style={styles.helperText}>Leave blank if you don't have team training this phase.</Text>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : targetPhase === 'In-season' ? 'Continue' : `Shift to ${targetPhase}`}
              size="lg"
              onPress={onAdvance}
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
      ) : (
        <>
          <SheetHeader title="Game day" subtitle="Which day do you usually play?" />
          <SheetDescription>
            We'll anchor weekly scheduling around it, with arms the day before and recovery after.
          </SheetDescription>
          <View style={styles.chipGrid}>
            {WEEK_DAYS.map((day) => {
              const selected = pendingGameDay === day;
              return (
                <SelectableTile
                  key={day}
                  shape="chip"
                  isSelected={selected}
                  hideCheckmark
                  onPress={() => onSetPendingGameDay(day)}
                  style={styles.dayChip}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {DAY_SHORT[day]}
                  </Text>
                </SelectableTile>
              );
            })}
          </View>
          {/* "No usual game day" is an ANSWER, not the absence of one. Without
              it the only way past this step was to name a day, so an athlete
              whose fixtures move week to week was stuck behind a disabled
              button — and every other caller that left the field empty had
              its stored anchor silently wiped instead. */}
          <SelectableTile
            shape="chip"
            isSelected={gameAnchorAnswered && pendingGameDay === null}
            hideCheckmark
            onPress={onAnswerNoUsualGameDay}
            style={styles.noGameDayTile}
          >
            <Text style={[
              styles.dayChipText,
              gameAnchorAnswered && pendingGameDay === null && styles.dayChipTextSelected,
            ]}>
              I don't have a usual game day
            </Text>
          </SelectableTile>
          {error && <Text style={styles.sheetError}>{error}</Text>}
          {(!error || canRetry) && (
            <Button
              label={error ? 'Try again' : `Shift to ${targetPhase}`}
              size="lg"
              disabled={!gameAnchorAnswered}
              onPress={onAdvance}
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

// MOVED WITH THE COMPONENT, BYTE-IDENTICAL — see the header.
const styles = StyleSheet.create({
  backChevron: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    padding: 4,
    zIndex: 2,
  },
  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, marginBottom: spacing.sm,
  },
  dayChip: {
    width: '22%', minWidth: 58, alignItems: 'center',
  },
  dayChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  dayChipTextSelected: { color: '#C8FF00', fontWeight: '700' },
  // Full-width so it reads as a peer of the day row rather than an eighth day.
  noGameDayTile: {
    alignSelf: 'stretch', alignItems: 'center', marginBottom: spacing.md,
  },
  helperText: {
    color: '#757575', fontSize: 12, textAlign: 'center', marginBottom: spacing.md,
  },
  noteBlock: {
    gap: 6, backgroundColor: '#1A1A1A', borderRadius: borderRadius.lg,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: spacing.md,
  },
  notePreserved: { color: '#C8FF00', fontSize: 13, fontWeight: '600' },
  noteWiped: { color: '#FF9AA2', fontSize: 13, fontWeight: '500' },
  phaseOption: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#343834',
    backgroundColor: '#171A17',
  },
  phaseOptionLabel: { color: '#F0F0F0', fontSize: 15, fontWeight: '700' },
  phaseRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#646A64',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseOptionSelected: {
    borderColor: '#7FA300',
    backgroundColor: '#1C2515',
  },
  phaseOptions: { gap: 8, marginBottom: spacing.md },
  phaseRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C8FF00',
  },
  phaseRadioSelected: { borderColor: '#C8FF00', borderWidth: 3 },
  sheetBody: {
    color: '#B0B0B0', fontSize: 14, lineHeight: 20, textAlign: 'center',
    marginBottom: spacing.md, paddingHorizontal: spacing.sm,
  },
  sheetError: { color: '#F44336', fontSize: 13, textAlign: 'center', marginBottom: spacing.sm },
  sheetTitle: {
    fontSize: 19, fontWeight: '700', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 6,
  },
});
