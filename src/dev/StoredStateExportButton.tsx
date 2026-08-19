import React from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { serialiseStoredStateExport, storedStateExportHeadline } from './devStoredStateExport';

/**
 * EXPORT STORED STATE, FROM WHEREVER THE ATHLETE IS STUCK.
 *
 * Sam, 2026-07-30, locked out: after a full reset and a complete onboarding,
 * the completion guard refused with "One more answer needed" over a profile it
 * saw as empty, and "Finish that step" dropped him back to the first onboarding
 * screen. The state that explains it — and the action log that records every
 * step of the reset and every onboarding commit — was sitting on the device
 * behind a Profile tab he could not reach, because reaching Profile requires
 * finishing onboarding, which is the thing that was refusing.
 *
 * The instrument has to exist where the defect does (AGENTS.md). Last time
 * that meant "not `__DEV__`-only". This time it means "not behind the flow
 * that is broken": an export button reachable only after onboarding completes
 * is dark for every onboarding defect there will ever be.
 *
 * So this renders on the refusal screen itself and on the Welcome screen — the
 * two places a locked-out athlete can actually be — on every build.
 *
 * RENDER NEVER THROWS. Capturing the export reads several stores, and one of
 * them is in whatever state caused the refusal. A capture that throws here
 * would take down the last screen the evidence can be read from, which is the
 * opposite of the job. The headline is best-effort; the share is separate.
 */
export function StoredStateExportButton({
  label = 'Export stored state',
  testID = 'stored-state-export-button',
}: {
  label?: string;
  testID?: string;
}) {
  const [headline, setHeadline] = React.useState<string | null>(null);
  const [shareError, setShareError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      setHeadline(storedStateExportHeadline());
    } catch (error) {
      // The numbers are a convenience; the bytes are the point. Say so rather
      // than showing nothing, so a failed capture is not read as "no data".
      setHeadline(`headline unavailable (${(error as Error)?.message ?? 'unknown'})`);
    }
  }, []);

  const onPress = async () => {
    setShareError(null);
    let payload: string;
    try {
      payload = serialiseStoredStateExport();
    } catch (error) {
      setShareError(`Capture failed: ${(error as Error)?.message ?? 'unknown'}`);
      return;
    }
    try {
      await Share.share({ title: headline ?? label, message: payload });
    } catch {
      // A dismissed share sheet is not a failure worth reporting.
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        testID={testID}
        accessible
        accessibilityRole="button"
        /* R-109 (Sam, 2026-08-20): *"fix the six accessibility labels so athletes hear
           exercise names, not internal IDs."* The row is ONE accessibility leaf
           (`accessibilityRole="button"`), so its label is the whole of what a
           screen-reader user hears — and it was the test id.
           ⚠ **THE IDENTITY IS NOT LOST: `testID` still sets
           `accessibilityIdentifier`, which is what Maestro's `id:` and the
           explorer match on.** Only the SPOKEN name changes. */
        accessibilityLabel={label}
        hitSlop={12}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onPress}
      >
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {headline ? <Text style={styles.headline}>{headline}</Text> : null}
      {shareError ? <Text style={styles.error}>{shareError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  button: {
    borderWidth: 1,
    borderColor: colors.input.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  label: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  headline: {
    marginTop: spacing.xs,
    color: colors.text.tertiary,
    fontSize: 11,
    textAlign: 'center',
  },
  error: {
    marginTop: spacing.xs,
    color: colors.status.error,
    fontSize: 11,
    textAlign: 'center',
  },
});
