/**
 * SessionFeedbackPanel — Post-session feedback capture.
 *
 * Three sections: Feeling (4 chips) + Soreness (4 chips) +
 * Completion (3 chips) + optional notes + Save button.
 *
 * Save button appears only when all 3 required fields are selected.
 * On save: persists feedback, calls onSave() so the parent can navigate away.
 *
 * Feedback feeds into the progression context on subsequent sessions
 * via feelingToRPE(), soreness-based adaptation, and deriveCompletionQuality().
 *
 * ## V2 presentation
 * Wrapped in a V2 `Card` with a darker-raised surface so it reads as a
 * distinct post-session moment. Heading steps up to a bolder scale with a
 * small uppercase eyebrow ("SESSION COMPLETE"). Chip rows use the same
 * semantic colours as Classic but with softer fill/border treatment that
 * matches the rest of the V2 design language (rounded `lg` radius, subtle
 * selected glow). Save button uses the V2 primary `Button` with built-in
 * accent glow so the "ship it" moment feels earned.
 *
 * Logic + prop contract are unchanged; Classic and V2 DayWorkout layers
 * both render this without modification.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  type TextStyle,
} from 'react-native';
import { Text } from './common/Text';
import { Card, Button, SectionLabel } from './ui';
import { colors } from '../theme/colors';
import { spacing, borderRadius } from '../theme/spacing';
import {
  useProgramStore,
  type FeedbackFeeling,
  type FeedbackCompletion,
  type FeedbackSoreness,
  type SessionFeedback,
} from '../store/programStore';

interface Props {
  /** ISO date string 'YYYY-MM-DD' for the session */
  date: string;
  /** Called after feedback is saved. Parent uses this to navigate back. */
  onSave?: () => void;
}

// ─── Feeling options (4 choices — maps to existing backend keys) ───

const FEELING_OPTIONS: { key: FeedbackFeeling; label: string; color: string }[] = [
  { key: 'easy',      label: 'Easy',      color: '#81C784' },
  { key: 'good',      label: 'Solid',     color: '#C8FF00' },
  { key: 'hard',      label: 'Hard',      color: '#FFB74D' },
  { key: 'very_hard', label: 'Very Hard', color: '#EF5350' },
];

// ─── Soreness options ───

const SORENESS_OPTIONS: { key: FeedbackSoreness; label: string; color: string }[] = [
  { key: 'none',     label: 'None',     color: '#81C784' },
  { key: 'mild',     label: 'Mild',     color: '#C8FF00' },
  { key: 'moderate', label: 'Moderate', color: '#FFB74D' },
  { key: 'high',     label: 'High',     color: '#EF5350' },
];

// ─── Completion options ───

const COMPLETION_OPTIONS: { key: FeedbackCompletion; label: string }[] = [
  { key: 'full',    label: 'Fully' },
  { key: 'partial', label: 'Partially' },
  { key: 'skipped', label: 'Skipped' },
];

export const SessionFeedbackPanel: React.FC<Props> = ({ date, onSave }) => {
  const existing = useProgramStore((s: any) => s.sessionFeedback[date]);
  const setSessionFeedback = useProgramStore((s: any) => s.setSessionFeedback);

  const [feeling, setFeeling] = useState<FeedbackFeeling | null>(existing?.feeling ?? null);
  const [soreness, setSoreness] = useState<FeedbackSoreness | null>(existing?.soreness ?? null);
  const [completion, setCompletion] = useState<FeedbackCompletion | null>(existing?.completion ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!existing?.notes);

  // Re-sync local state when navigating to a different date
  useEffect(() => {
    setFeeling(existing?.feeling ?? null);
    setSoreness(existing?.soreness ?? null);
    setCompletion(existing?.completion ?? null);
    setNotes(existing?.notes ?? '');
    setShowNotes(!!existing?.notes);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = !!(feeling && soreness && completion);

  const handleSave = useCallback(() => {
    if (!feeling || !soreness || !completion) return;
    const feedback: SessionFeedback = {
      dateStr: date,
      feeling,
      completion,
      soreness,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    setSessionFeedback(date, feedback);
    onSave?.();
  }, [feeling, soreness, completion, notes, date, setSessionFeedback, onSave]);

  return (
    <Card tone="raised" padding="lg" radius="xl" style={styles.panel}>
      <Text style={styles.eyebrow}>SESSION COMPLETE</Text>
      <Text style={styles.heading}>Session feedback</Text>
      <Text style={styles.subheading}>
        A quick check-in — this tunes your next session.
      </Text>

      {/* Feeling row */}
      <SectionLabel style={styles.section}>
        How did the session feel?
      </SectionLabel>
      <View style={styles.row}>
        {FEELING_OPTIONS.map((opt) => (
          <FeedbackChip
            key={opt.key}
            label={opt.label}
            selected={feeling === opt.key}
            selectedColor={opt.color}
            onPress={() => setFeeling(opt.key)}
          />
        ))}
      </View>

      {/* Soreness row */}
      <SectionLabel style={styles.section}>How sore are you?</SectionLabel>
      <View style={styles.row}>
        {SORENESS_OPTIONS.map((opt) => (
          <FeedbackChip
            key={opt.key}
            label={opt.label}
            selected={soreness === opt.key}
            selectedColor={opt.color}
            onPress={() => setSoreness(opt.key)}
          />
        ))}
      </View>

      {/*
       * Completion row uses the same <FeedbackChip /> primitive as the two
       * rows above so unselected chrome is byte-identical across all three
       * groups. The only difference is the selected accent: rating chips
       * carry semantic colour (green=easy, red=very_hard) so colour
       * encodes meaning; completion is a peer-options group with no
       * semantic colour ladder, so it uses the standard lime accent.
       */}
      <SectionLabel style={styles.section}>Did you complete it?</SectionLabel>
      <View style={styles.row}>
        {COMPLETION_OPTIONS.map((opt) => (
          <FeedbackChip
            key={opt.key}
            label={opt.label}
            selected={completion === opt.key}
            selectedColor={colors.accent.lime}
            onPress={() => setCompletion(opt.key)}
          />
        ))}
      </View>

      {/* Notes toggle + input */}
      {!showNotes ? (
        <Pressable
          onPress={() => setShowNotes(true)}
          style={styles.notesToggle}
          accessibilityRole="button"
        >
          <Text style={styles.notesToggleText}>+ Add a note</Text>
        </Pressable>
      ) : (
        <TextInput
          style={styles.notesInput}
          placeholder="Anything to note? (optional)"
          placeholderTextColor={colors.text.tertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={200}
          returnKeyType="done"
          blurOnSubmit
        />
      )}

      {/* Save button — only when all 3 required fields selected */}
      {canSave && (
        <View style={styles.saveRow}>
          <Button
            label="Save & Finish"
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      )}
    </Card>
  );
};

/* ── FeedbackChip ────────────────────────────────────────────────────────
 *
 * Single source of truth for every option chip in this panel. All three
 * groups (feeling, soreness, completion) render through this component so
 * the unselected look — translucent fill + thin dark border — is byte
 * identical across rows. Selected state takes a colour from the caller:
 * semantic ladder colour for rating rows, lime for the completion row.
 *
 * Kept local to this file because it's a one-off recipe for this panel;
 * the global selection primitive (<SelectableTile />) renders against the
 * page surface, but here the parent is a raised Card and we need a
 * lighter, translucent chip to read as elevated above it.
 */
interface FeedbackChipProps {
  label: string;
  selected: boolean;
  selectedColor: string;
  onPress: () => void;
}

const FeedbackChip: React.FC<FeedbackChipProps> = ({
  label,
  selected,
  selectedColor,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    style={[
      styles.chip,
      selected && {
        backgroundColor: selectedColor + '22',
        borderColor: selectedColor,
      },
    ]}
  >
    <Text
      style={[
        styles.chipText,
        selected && { color: selectedColor, fontWeight: '700' },
      ] as unknown as TextStyle}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  panel: {
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heading: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  subheading: {
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 18,
  },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  notesToggle: {
    marginTop: spacing.md,
    paddingVertical: 6,
  },
  notesToggleText: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '600',
  },
  notesInput: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 13,
    padding: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveRow: {
    marginTop: spacing.lg,
  },
});
