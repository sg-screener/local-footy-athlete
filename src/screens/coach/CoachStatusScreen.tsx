/**
 * "MY STATUS" — WHAT IS CURRENTLY SHAPING THE ATHLETE'S PROGRAM, AND THE
 * CONTROLS THAT CHANGE IT.
 *
 * Rulings 4 and 9 of the UI merge. **This is the old coach-notes block
 * re-homed, not a new feature** — the seat's own words — and the merge plan's
 * binding rule is the one this file exists to obey:
 *
 *   > **"My status" MOUNTS THE EXISTING DOORS. It does not build new ones.**
 *
 * SO EVERY CONTROL HERE IS THE SAME CONTROL, NOT A COPY OF IT. The list is
 * `<ActiveModifiersSection>`, the component `HomeScreenV2` renders — extracted,
 * not reimplemented — and its actions run through the handler the caller passes,
 * which is `handleCoachNoteAction`, the one the day screen has always called.
 * **A second door here would be a second representation of a decision that
 * already has one.**
 *
 * WHY IT IS A SCREEN AND NOT A PANEL ON THE CONVERSATION. `CoachTabScreen` is a
 * ScrollView that PINS TO BOTTOM on new content: anything inside it is
 * unreachable after three exchanges, and a door the athlete cannot find is not a
 * door. Her prototype's strip is a doorway that opens a status screen, so the
 * strip stays fixed under the header and the detail lives here.
 * docs/UI_MERGE_SLICE3_PLAN_2026-08-10.md.
 *
 * THE SEASON-PHASE CONTROL LIVES HERE. Its existing atomic flow was extracted
 * intact from `useHomeScreen`; Program's old card leaves in the same checkpoint.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../components/common/Text';
import { ActiveModifiersSection } from '../../components/ActiveModifiersSection';
import type {
  ActiveCoachNote,
  ActiveCoachNoteAction,
} from '../../utils/activeCoachNotes';
import { signedCopy } from '../../rules/signedCopy';
import type { SeasonPhase } from '../../types/domain';

export interface CoachStatusScreenProps {
  readonly modifiers: readonly ActiveCoachNote[];
  readonly equipmentFactIds: ReadonlySet<string>;
  readonly currentPhase: SeasonPhase;
  readonly onReviewPhase: () => void;
  readonly onAction: (note: ActiveCoachNote, action: ActiveCoachNoteAction) => void;
  readonly onClose: () => void;
}

export default function CoachStatusScreen({
  modifiers, equipmentFactIds, currentPhase, onReviewPhase, onAction, onClose,
}: CoachStatusScreenProps) {
  const [expandedModifierId, setExpandedModifierId] = useState<string | null>(null);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="coach-status-screen">
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          testID="coach-status-close"
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
            stroke="#B5B5B5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </Pressable>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [styles.phaseRow, pressed && { opacity: 0.72 }]}
          onPress={onReviewPhase}
          testID="coach-status-season-phase"
          accessibilityRole="button"
          accessibilityLabel={`Season phase ${currentPhase}. Review`}
        >
          <View style={styles.phaseText}>
            <Text style={styles.eyebrow}>SEASON PHASE</Text>
            <Text style={styles.phaseValue}>{currentPhase}</Text>
          </View>
          <Text style={styles.review}>REVIEW</Text>
          <Chevron />
        </Pressable>

        <View style={styles.modifierHeader}>
          <Text style={styles.eyebrow}>ACTIVE MODIFIERS</Text>
          <Text style={styles.modifierCount}>{`${modifiers.length} ACTIVE`}</Text>
        </View>

        <View testID="program-active-coach-notes">
          {modifiers.length === 0 ? (
            <Text style={styles.empty} testID="coach-status-empty">
              {signedCopy('modifiers.strip.none')}
            </Text>
          ) : modifiers.map((note) => {
            const expanded = expandedModifierId === note.id;
            return (
              <View key={note.id} style={styles.modifierBlock}>
                <Pressable
                  style={({ pressed }) => [styles.modifierRow, pressed && { opacity: 0.72 }]}
                  onPress={() => setExpandedModifierId(expanded ? null : note.id)}
                  testID={`coach-status-modifier-${note.constraintId}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={note.title}
                >
                  <View style={styles.dot} />
                  <View style={styles.modifierText}>
                    <Text style={styles.modifierTitle}>{note.title}</Text>
                    <Text style={styles.modifierBody} numberOfLines={expanded ? undefined : 1}>
                      {note.body}
                    </Text>
                  </View>
                  <Chevron open={expanded} />
                </Pressable>
                {expanded ? (
                  <ActiveModifiersSection
                    notes={[note] as ActiveCoachNote[]}
                    equipmentFactIds={equipmentFactIds}
                    onAction={onAction}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chevron({ open = false }: { open?: boolean }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#A5A5A5"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={open ? styles.chevronOpen : undefined}
    >
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

/* `LIVE_ACTION_KINDS` RETIRED 2026-08-12 (SEAT_INBOX item 8 (a)).
 *
 * It read `['dismiss_note']` — one live control out of eight — and its comment
 * said each kind *"joins this list as it is freed"*. They are all freed, so the
 * list is the whole vocabulary, and a list that says "everything" is a list
 * saying nothing.
 *
 * What replaced it is not a longer list but a different KIND of check:
 * `coachNoteActionRoute` in `useCoachNoteActions` is total over the eight kinds
 * and `test:my-status-modifiers` proves it, so a ninth kind arriving without a
 * door reds on the day it arrives rather than the day someone remembers this
 * screen exists. */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 32 },
  phaseRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#303030',
  },
  phaseText: { flex: 1, gap: 5 },
  eyebrow: { color: '#8D918D', fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2 },
  phaseValue: { color: '#F4F4F4', fontSize: 22, lineHeight: 27, fontWeight: '700' },
  review: { color: '#A5A5A5', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  modifierHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#303030',
  },
  modifierCount: { color: '#8D918D', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  modifierBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#303030' },
  modifierRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C8FF00' },
  modifierText: { flex: 1, minWidth: 0, gap: 3 },
  modifierTitle: { color: '#F2F2F2', fontSize: 15, lineHeight: 19, fontWeight: '700' },
  modifierBody: { color: '#888C88', fontSize: 13, lineHeight: 17 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  empty: { color: '#8A8A8A', fontSize: 14, lineHeight: 20, paddingVertical: 22 },
});
