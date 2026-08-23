import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { DATE_LINE_HEIGHT } from './SessionDateLine';
import { SESSION_STOPWATCH_COPY } from '../rules/sessionStopwatchCopy';
import {
  formatSessionStopwatchElapsed,
  sessionStopwatchElapsedMs,
} from '../rules/sessionStopwatch';
import { derivedNumericText } from '../rules/signedCopy';
import { useSessionStopwatchStore } from '../store/sessionStopwatchStore';

/**
 * R-132 (Sam, 2026-08-23): the session stopwatch, on the header's subtitle
 * line, *"keeping font the same but just saying 'Start session' its a little
 * button or something with a timer next to it that you can pause or end."*
 *
 * The font IS the subtitle's (`SessionDateLine`'s 13/500/20) — his words. The
 * component only renders and forwards taps; every timestamp comes from the
 * store, so navigating away, backgrounding or killing the app never loses the
 * count. The 1-second tick exists purely to repaint the derived elapsed text.
 */
export function SessionStopwatchControl({ workoutId, dateISO }: {
  workoutId: string;
  dateISO: string;
}) {
  const current = useSessionStopwatchStore((state) => state.current);
  const start = useSessionStopwatchStore((state) => state.start);
  const pause = useSessionStopwatchStore((state) => state.pause);
  const resume = useSessionStopwatchStore((state) => state.resume);
  const end = useSessionStopwatchStore((state) => state.end);

  const mine = current !== null && current.workoutId === workoutId;
  const running = mine && current!.pausedAtISO === null;

  // Repaint-only tick: elapsed is DERIVED from stored timestamps every second
  // while running; paused and idle states need no clock at all.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  if (!mine) {
    // R-132a (Sam: *"needs to be more obvious a button - maybe via a play
    // button"*): the app's own primary-chip look — lime pill, dark text — with
    // a play triangle. Same signed words, same 13/500 font.
    return (
      <Pressable
        onPress={() => start({ workoutId, dateISO, nowISO: new Date().toISOString() })}
        accessibilityRole="button"
        testID="session-stopwatch-start"
        hitSlop={8}
        style={styles.startPill}
      >
        <Svg width={10} height={10} viewBox="0 0 24 24" fill={colors.button.primaryText}>
          <Path d="M7 4l13 8-13 8z" />
        </Svg>
        <Text style={[styles.text, styles.startPillText]}>
          {SESSION_STOPWATCH_COPY.start}
        </Text>
      </Pressable>
    );
  }

  const elapsed = derivedNumericText(formatSessionStopwatchElapsed(
    sessionStopwatchElapsedMs(current!, new Date().toISOString()),
  ));
  return (
    <View style={styles.row} testID="session-stopwatch-running">
      <Text style={[styles.text, styles.elapsed]} testID="session-stopwatch-elapsed">
        {elapsed}
      </Text>
      <Pressable
        onPress={() => (running
          ? pause(new Date().toISOString())
          : resume(new Date().toISOString()))}
        accessibilityRole="button"
        testID="session-stopwatch-pause-resume"
        hitSlop={8}
      >
        <Text style={[styles.text, styles.action]}>
          {running ? SESSION_STOPWATCH_COPY.pause : SESSION_STOPWATCH_COPY.resume}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => end(new Date().toISOString())}
        accessibilityRole="button"
        testID="session-stopwatch-end"
        hitSlop={8}
      >
        <Text style={[styles.text, styles.action]}>
          {SESSION_STOPWATCH_COPY.end}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // THE SUBTITLE'S OWN FONT — R-132: "keeping font the same".
  text: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: DATE_LINE_HEIGHT,
  },
  elapsed: { color: colors.text.primary },
  action: { color: colors.text.accent },
  // R-132a: the primary-chip shape the app's other small buttons wear.
  startPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.button.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  startPillText: { color: colors.button.primaryText },
});
