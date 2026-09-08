import { HorizontalNumberPicker } from '../../components/HorizontalNumberPicker';
/**
 * ONE SETUP ANSWER, IN THE APP'S OWN POPUP.
 *
 * Sam, 2026-08-27: *"it should be like everything else in the app = just a
 * fucking pop up - it should match the style and UI of the other pop ups"*, and
 * then, on the first cut: *"You didn't match the same style as the other pop
 * ups"*. He was right — that cut dropped the full-screen SETUP PAGE's markup
 * into a `Sheet` and changed nothing else, so it wore the page's 16pt inputs,
 * its `SelectableTile` grid and its stacked page buttons inside a popup frame.
 *
 * ## WHAT "THE SAME STYLE" ACTUALLY IS
 *
 * Read off the sheets that were already right — `SeasonPhaseShiftSheet` (the
 * closest relative: it asks the same phase question), `RebuildSheet` and
 * `SessionFeedbackPanel`:
 *
 * - `SheetHeader title=<section> subtitle=<the question>`, then an optional
 *   `SheetDescription` sentence. Never a bare `<Text>` heading.
 * - Choices are BORDERED ROWS in a `gap: 8` stack with `marginBottom:
 *   spacing.md` — `#171A17` on `#343834`, 54 tall, and the selected row goes
 *   `#1C2515` on `#7FA300`. Not tiles, not a wrapped grid.
 * - A radio dot on the right of a single-choice row; a tick on a multi-choice
 *   one. Both 24pt, both the same two greys.
 * - The primary action is `Button size="lg"` with `marginTop: spacing.lg`; the
 *   way out is `variant="secondary" size="md"` with `marginTop: spacing.md`.
 * - Text entry is the feedback panel's box: `rgba(255,255,255,0.04)` on
 *   `#2A2A2A`, radius `md`, 18pt/700.
 *
 * ⚠ **THE KEYBOARD IS THE `Sheet`'S JOB, NOT THIS FILE'S.** `Sheet` rides the
 * native keyboard frame and lifts with it. That is why the answer to "the keypad
 * covers the box" was to BE one of these popups rather than to bolt a second
 * keyboard mechanism onto a page.
 *
 * WRITER: `ProfileScreen` (the Profile page's pen). READER: the athlete.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button, Sheet, SheetDescription, SheetHeader } from '../../components/ui';
import { Text } from '../../components/common/Text';
import { AppTextInput } from '../../components/keyboard/AppTextInput';
import { SelectableTile } from '../../components/common/SelectableTile';
import { DAY_SHORT } from '../home/homeScreenConstants';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import {
  MAX_MOTIVATION_GOALS,
  MOTIVATION_GOAL_OPTIONS,
  type MotivationGoal,
} from '../../rules/motivationGoals';
import type { DayOfWeek, ExperienceLevel, RoleBucket } from '../../types/domain';

/** Which single answer this popup is asking about. */
export type ProfileFieldId =
  | 'name'
  | 'role'
  | 'experience'
  | 'goals'
  | 'lfaDays'
  | 'teamDays'
  | 'gameDay';

export interface ProfileFieldSheetProps {
  field: ProfileFieldId;
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  /** Disabled Save states its own reason; null means it is available. */
  blockedReason: string | null;
  saving: boolean;
  /** The building / complete states, rendered instead of the question. */
  busyContent?: React.ReactNode;

  name: string;
  onChangeName: (value: string) => void;

  role: RoleBucket | null;
  roleOptions: readonly { id: RoleBucket; label: string }[];
  onSelectRole: (role: RoleBucket) => void;

  experience: ExperienceLevel | null;
  experienceOptions: readonly { id: ExperienceLevel; label: string }[];
  onSelectExperience: (level: ExperienceLevel) => void;

  goals: readonly MotivationGoal[];
  onToggleGoal: (goal: MotivationGoal) => void;

  weekDays: readonly DayOfWeek[];
  lfaDays: readonly DayOfWeek[];
  strengthSessions: number;
  onChangeStrengthSessions: (value: number) => void;
  onToggleLfaDay: (day: DayOfWeek) => void;
  teamDays: readonly DayOfWeek[];
  onToggleTeamDay: (day: DayOfWeek) => void;
  gameDay: DayOfWeek | null;
  onSelectGameDay: (day: DayOfWeek) => void;
}

const QUESTION: Record<ProfileFieldId, { section: string; question: string; note?: string }> = {
  name: { section: 'Player details', question: 'What should I call you?' },
  role: { section: 'Player details', question: 'What position fits you best?' },
  experience: { section: 'Player details', question: 'What’s your training experience?' },
  goals: {
    section: 'Player details',
    question: 'What are you training for?',
    note: `Pick up to ${MAX_MOTIVATION_GOALS}.`,
  },
  lfaDays: {
    section: 'Program setup',
    question: 'Strength sessions and equipment access',
    note: 'Choose your session target, then every day you can access your strength equipment. Running can use other available days.',
  },
  teamDays: { section: 'Program setup', question: 'When is team training?' },
  gameDay: { section: 'Program setup', question: 'Which day do you usually play?' },
};

/** A single-choice row: label, and a radio on the right. */
function ChoiceRow({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && { opacity: 0.72 },
      ]}
    >
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

/** A multi-choice row: same frame, a tick instead of a radio. */
function CheckRow({
  label,
  selected,
  disabled = false,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled && !selected}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: disabled && !selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        disabled && !selected && styles.choiceUnavailable,
        pressed && { opacity: 0.72 },
      ]}
    >
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={[styles.check, selected && styles.checkSelected]}>
        {selected ? <Feather name="check" size={14} color="#0C0C0C" /> : null}
      </View>
    </Pressable>
  );
}

/**
 * THE SEVEN-DAY CHIP GRID, as `SeasonPhaseShiftSheet` draws it — four then
 * three, centred, short day names, no tick glyph. Every value below is that
 * sheet's; nothing here is a second geometry.
 */
function DayChips({
  days,
  isSelected,
  onPress,
  idPrefix,
}: {
  days: readonly DayOfWeek[];
  isSelected: (day: DayOfWeek) => boolean;
  onPress: (day: DayOfWeek) => void;
  idPrefix: string;
}) {
  return (
    <View style={styles.chipGrid}>
      {days.map((day) => {
        const selected = isSelected(day);
        return (
          <SelectableTile
            key={day}
            shape="chip"
            isSelected={selected}
            hideCheckmark
            onPress={() => onPress(day)}
            style={styles.dayChip}
            testID={`${idPrefix}-${day.toLowerCase()}`}
          >
            <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
              {DAY_SHORT[day]}
            </Text>
          </SelectableTile>
        );
      })}
    </View>
  );
}

export function ProfileFieldSheet(props: ProfileFieldSheetProps) {
  const { field, visible, onClose, onSave, blockedReason, saving, busyContent } = props;
  const copy = QUESTION[field];

  const body = () => {
    switch (field) {
      case 'name':
        return (
          <AppTextInput
            style={styles.textInput}
            value={props.name}
            onChangeText={props.onChangeName}
            placeholder="Type your name..."
            placeholderTextColor={colors.text.tertiary}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => { if (!blockedReason) onSave(); }}
            maxLength={30}
            testID="profile-field-name-input"
          />
        );
      case 'role':
        return (
          <View style={styles.choices}>
            {props.roleOptions.map((option) => (
              <ChoiceRow
                key={option.id}
                label={option.label}
                selected={props.role === option.id}
                onPress={() => props.onSelectRole(option.id)}
                testID={`profile-field-role-${option.id}`}
              />
            ))}
          </View>
        );
      case 'experience':
        return (
          <View style={styles.choices}>
            {props.experienceOptions.map((option) => (
              <ChoiceRow
                key={option.id}
                label={option.label}
                selected={props.experience === option.id}
                onPress={() => props.onSelectExperience(option.id)}
                testID={`profile-field-experience-${option.id}`}
              />
            ))}
          </View>
        );
      case 'goals':
        return (
          <View style={styles.choices}>
            {MOTIVATION_GOAL_OPTIONS.map((option) => (
              <CheckRow
                key={option.id}
                label={option.label}
                selected={props.goals.includes(option.id)}
                disabled={props.goals.length >= MAX_MOTIVATION_GOALS}
                onPress={() => props.onToggleGoal(option.id)}
                testID={`profile-field-goal-${option.id}`}
              />
            ))}
          </View>
        );
      /* ⚠ **DAYS ARE CHIPS, NOT A LIST OF SEVEN ROWS** — Sam, 2026-08-27:
         *"this day view is shit … if you researched properly you'd have seen
         that"*. He is right and it was already in the app: the phase sheet asks
         these exact three questions with `SelectableTile shape="chip"` in a
         wrapping centred grid that falls four-then-three, using `DAY_SHORT`.
         Same component, same geometry, same short names. */
      case 'lfaDays':
        return (
          <>
          <HorizontalNumberPicker testID="profile-strength-session-target" value={props.strengthSessions} onChange={props.onChangeStrengthSessions} min={1} max={7} />
          <DayChips
            days={props.weekDays}
            isSelected={(day) => props.lfaDays.includes(day)}
            onPress={props.onToggleLfaDay}
            idPrefix="profile-field-lfa"
          />
          </>
        );
      case 'teamDays':
        return (
          <DayChips
            days={props.weekDays}
            isSelected={(day) => props.teamDays.includes(day)}
            onPress={props.onToggleTeamDay}
            idPrefix="profile-field-team"
          />
        );
      case 'gameDay':
        return (
          <DayChips
            days={props.weekDays}
            isSelected={(day) => props.gameDay === day}
            onPress={props.onSelectGameDay}
            idPrefix="profile-field-game"
          />
        );
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={saving ? () => {} : onClose}
      dismissable={!saving}
      testID="profile-setup-field-sheet"
    >
      {busyContent ?? (
        <>
          <SheetHeader title={copy.section} subtitle={copy.question} />
          {copy.note ? <SheetDescription>{copy.note}</SheetDescription> : null}
          {body()}
          {/* A disabled Save says why — the same rule the setup page follows. */}
          {blockedReason ? (
            <Text style={styles.blocked}>{blockedReason}</Text>
          ) : null}
          <Button
            label="Save"
            size="lg"
            disabled={Boolean(blockedReason) || saving}
            onPress={onSave}
            style={styles.primary}
            testID="profile-field-save"
          />
          <Button
            label="Cancel"
            variant="secondary"
            size="md"
            onPress={onClose}
            style={styles.secondary}
          />
        </>
      )}
    </Sheet>
  );
}

/* Every value here is read off the sheets that were already right — see the
   file header. Nothing new was invented for this popup. */
const styles = StyleSheet.create({
  choices: { gap: 8, marginBottom: spacing.md },
  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, marginBottom: spacing.sm,
  },
  dayChip: { width: '22%', minWidth: 58, alignItems: 'center' },
  dayChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  dayChipTextSelected: { color: '#D8D800', fontWeight: '700' },
  choice: {
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
  choiceSelected: {
    borderColor: '#7FA300',
    backgroundColor: '#1C2515',
  },
  choiceUnavailable: { opacity: 0.45 },
  choiceLabel: { color: '#F0F0F0', fontSize: 15, fontWeight: '700' },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#646A64',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#D8D800' },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D8D800',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#646A64',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    borderColor: '#D8D800',
    backgroundColor: '#D8D800',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  blocked: {
    color: colors.status.error,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  primary: { marginTop: spacing.lg },
  secondary: { marginTop: spacing.md },
});
