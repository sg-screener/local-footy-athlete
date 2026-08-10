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
 * THE SEASON-PHASE CONTROL IS NOT HERE YET, AND ITS ABSENCE IS DELIBERATE. It is
 * ruling 6's destination, and the phase-shift machine is fifteen pieces of
 * `useHomeScreen` state driving a multi-step sheet. Mounting it needs that state
 * extracted to an owner both screens can call; re-implementing it here would be
 * the exact defect the rule above forbids. **Until that lands, the phase card
 * stays on the day screen** — `LAW-removal-ships-with-its-replacement` — and this
 * screen says so rather than pretending the control is elsewhere.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../components/common/Text';
import { ActiveModifiersSection } from '../../components/ActiveModifiersSection';
import type {
  ActiveCoachNote,
  ActiveCoachNoteAction,
} from '../../utils/activeCoachNotes';
import { signedCopy } from '../../rules/signedCopy';

export interface CoachStatusScreenProps {
  readonly modifiers: readonly ActiveCoachNote[];
  readonly equipmentFactIds: ReadonlySet<string>;
  readonly onAction: (note: ActiveCoachNote, action: ActiveCoachNoteAction) => void;
  readonly onClose: () => void;
}

export default function CoachStatusScreen({
  modifiers, equipmentFactIds, onAction, onClose,
}: CoachStatusScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="coach-status-screen">
      {/* `h2`, NOT `h1`, AND THE DONE CONTROL LIVES IN THIS ROW.
          Measured on the device, not chosen from a palette: at `h1` the title
          rendered as a full-width "MY STATUS" that dwarfed the one card under
          it, and the close control — positioned absolutely at `top: 14` —
          landed ON the status bar, overlapping the battery. A detail screen
          reached from a strip is not the app's front page. */}
      <View style={styles.header}>
        <Text variant="h2">{signedCopy('coach.status.title')}</Text>
        {/* THE CLOSE CONTROL BELONGS TO THIS SCREEN, INSIDE ITS SafeAreaView.
            It was an absolutely-positioned sibling in `CoachTabScreen` and landed
            on the status bar, over the battery — a control OUTSIDE the safe area
            of the screen it closes. Owning it here means it cannot drift again. */}
        <Pressable
          onPress={onClose}
          testID="coach-status-close"
          accessibilityRole="button"
          accessibilityLabel="Done"
          hitSlop={12}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
        >
          <Text variant="body">Done</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {modifiers.length === 0 ? (
          // NOTHING SHAPING THE PROGRAM IS A FACT, NOT AN ERROR, and it gets a
          // sentence rather than an empty screen. The day screen's section
          // renders nothing when empty because it sits inside a busy screen;
          // this screen IS the subject, so silence here reads as broken.
          <Text style={styles.empty} testID="coach-status-empty">
            {signedCopy('coach.status.empty')}
          </Text>
        ) : (
          <ActiveModifiersSection
            notes={modifiers as ActiveCoachNote[]}
            equipmentFactIds={equipmentFactIds}
            onAction={onAction}
            /* SEE THE PROP'S OWN DOC. Until `handleCoachNoteAction` is lifted out
               of `useHomeScreen`, these controls cannot run — so they render
               dimmed, untappable and captioned with where the live one is,
               rather than looking ready and lying. */
            actionsNotYet
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  close: { paddingHorizontal: 8, paddingVertical: 6 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 32 },
  empty: { color: '#8A8A8A', fontSize: 14, lineHeight: 20, paddingTop: 12 },
});
