import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../common/Text';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { appDateNow } from '../../utils/appDate';
import {
  cancelJournalReminderProof,
  fireJournalReminderIn,
  previewWeeklyFireDate,
  type ProofFireResult,
  type WeeklyFirePreview,
} from '../../services/journalReminderProof';

/**
 * SAM'S PROOF PANEL — dev only, and the gate is at the CALLER.
 *
 * Ordered 2026-08-09: a way for Sam, never an athlete, to see the journal
 * reminder actually fire on his own device.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY IT LIVES IN `components/dev/` AND IS DOUBLE-GATED THERE.
 *
 * `ScheduleDebugPanel` set this convention and `signedCopyExtractionTests`
 * already asserts it: the component is `__DEV__`-gated at BOTH its `require`
 * site and its render site, so the module is never bundled into a production
 * build and its strings are excluded from the copy sheet by the
 * `components/dev/` OFF_SHEET prefix. **That exclusion is only honest while the
 * double gate holds**, so the assertion was widened this commit to cover every
 * file under `components/dev/` rather than the one it was written for.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE GATE CHOICE, STATED BECAUSE THE ORDER ASKED FOR IT.
 *
 * The test the order set: REACHABLE in the build Sam actually installs,
 * UNREACHABLE in anything an athlete could hold. `__DEV__` passes both — but
 * only because of a fact worth naming rather than assuming: **Sam has to
 * rebuild with pods for `expo-notifications` to exist at all, and
 * `npx expo run:ios` produces a Debug build where `__DEV__` is true.** An
 * athlete's build is Release, where this file is not bundled.
 *
 * SO THERE IS NO CONFLICT, AND ONE CONDITION. If Sam builds with
 * `--configuration Release`, or installs through TestFlight, **this panel will
 * not be there** — and its absence will look identical to it being broken. The
 * boundary report gives the one command that guarantees it appears.
 *
 * A `__DEV__` DIAGNOSTIC IS NORMALLY THE WRONG ANSWER IN THIS REPO
 * (AGENTS.md, "instrumentation must be alive where the defects are" — three
 * device round trips paid for exactly that mistake). It is right here because
 * of what it is: not a diagnostic watching for a defect on a build somebody
 * else is running, but a bench instrument for the one person doing the
 * rebuilding. Nothing an athlete does can produce the evidence it collects.
 */
export function JournalReminderProofPanel() {
  const [preview, setPreview] = useState<WeeklyFirePreview | null>(null);
  const [fired, setFired] = useState<ProofFireResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    work().finally(() => setBusy(false));
  };

  return (
    <View style={styles.panel} testID="journal-reminder-proof-panel">
      <Text variant="bodySmallEmphasis" style={styles.heading}>
        DEV — journal reminder proof
      </Text>

      {/*
        THE WEEKDAY CHECK IS FIRST, DELIBERATELY. It is the one that proves the
        flagged unknown, it needs no permission, and it answers instantly — so
        the useful result is not behind a two-minute wait.
      */}
      <TouchableOpacity
        style={styles.button}
        disabled={busy}
        testID="journal-reminder-proof-weekday"
        accessibilityRole="button"
        onPress={() => run(async () => {
          setPreview(await previewWeeklyFireDate(appDateNow()));
        })}
      >
        <Text variant="bodySmall" style={styles.buttonText}>
          1. Check the weekday conversion
        </Text>
      </TouchableOpacity>

      {preview ? (
        <View style={styles.result} testID="journal-reminder-proof-weekday-result">
          {preview.error !== null ? (
            <Text variant="caption" style={styles.bad}>{`error: ${preview.error}`}</Text>
          ) : (
            <>
              <Text
                variant="bodySmallEmphasis"
                style={preview.landsOnMonday ? styles.good : styles.bad}
              >
                {preview.landsOnMonday
                  ? `PASS — the OS says ${preview.weekday}`
                  : `FAIL — the OS says ${preview.weekday}, not Monday`}
              </Text>
              <Text variant="caption" style={styles.faint}>
                {`OS next fire: ${preview.nextFire?.toString() ?? '—'}`}
              </Text>
              <Text variant="caption" style={styles.faint}>
                {`our rule predicted: ${preview.predicted.toString()}`}
              </Text>
            </>
          )}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        disabled={busy}
        testID="journal-reminder-proof-fire"
        accessibilityRole="button"
        onPress={() => run(async () => {
          setFired(await fireJournalReminderIn(120, appDateNow()));
        })}
      >
        <Text variant="bodySmall" style={styles.buttonText}>
          2. Fire the real reminder in 2 minutes
        </Text>
      </TouchableOpacity>

      {fired ? (
        <View style={styles.result} testID="journal-reminder-proof-fire-result">
          {fired.scheduled ? (
            <>
              <Text variant="bodySmallEmphasis" style={styles.good}>
                {`scheduled — watch for it at ${fired.expectedAt?.toLocaleTimeString() ?? '—'}`}
              </Text>
              <Text variant="caption" style={styles.faint}>
                Background the app. Tapping it should open the Journal tab.
              </Text>
            </>
          ) : (
            <Text variant="caption" style={styles.bad}>{`not scheduled: ${fired.error}`}</Text>
          )}
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        disabled={busy}
        testID="journal-reminder-proof-cancel"
        accessibilityRole="button"
        onPress={() => run(async () => {
          await cancelJournalReminderProof();
          setFired(null);
        })}
      >
        <Text variant="bodySmall" style={styles.buttonText}>
          3. Cancel a pending proof
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderColor: colors.text.accent,
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  heading: { color: colors.text.accent },
  button: {
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  buttonText: { color: colors.text.primary },
  result: { gap: spacing.xs },
  good: { color: colors.status.success },
  bad: { color: colors.status.warning },
  faint: { color: colors.text.tertiary },
});
