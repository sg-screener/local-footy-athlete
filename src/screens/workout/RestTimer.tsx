import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';

interface RestTimerProps {
  initialTime: number;
  prescribed: number;
  onComplete: () => void;
}

export const RestTimer = ({ initialTime, prescribed, onComplete }: RestTimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(true);
  const [progress] = useState(new Animated.Value(1));

  // Timer interval
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, onComplete]);

  // Animate progress
  useEffect(() => {
    Animated.timing(progress, {
      toValue: timeRemaining / initialTime,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [timeRemaining, initialTime, progress]);

  const handleToggle = () => {
    setIsRunning(!isRunning);
  };

  const handleSkip = () => {
    setTimeRemaining(0);
    setIsRunning(false);
    onComplete();
  };

  const progressPercentage = Math.round((timeRemaining / initialTime) * 100);

  return (
    <Card style={styles.container}>
      <View style={styles.content}>
        <Text variant="labelSmall" color={colors.text.secondary} style={styles.label}>
          REST TIME
        </Text>

        {/* Circular progress display */}
        <View style={styles.circleContainer}>
          <View style={styles.circle}>
            <View
              style={[
                styles.circleProgress,
                {
                  backgroundColor: getTimerColor(timeRemaining, prescribed),
                },
              ]}
            />
            <View style={styles.circleContent}>
              <Text variant="h2" color={colors.accent.lime} style={styles.timeDisplay}>
                {formatSeconds(timeRemaining)}
              </Text>
              <Text variant="caption" color={colors.text.secondary}>
                {progressPercentage}%
              </Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Text variant="caption" color={colors.text.secondary}>
              Prescribed
            </Text>
            <Text variant="body" color={colors.text.primary}>
              {formatSeconds(prescribed)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text variant="caption" color={colors.text.secondary}>
              Elapsed
            </Text>
            <Text variant="body" color={colors.accent.lime}>
              {formatSeconds(initialTime - timeRemaining)}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable
            onPress={handleToggle}
            style={({ pressed }) => [
              styles.controlButton,
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text color={colors.button.primaryText} style={styles.controlButtonText}>
              {isRunning ? '⏸ Pause' : '▶ Resume'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [
              styles.controlButton,
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text color={colors.text.primary} style={styles.controlButtonText}>
              Skip
            </Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
};

function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTimerColor(remaining: number, prescribed: number): string {
  const percentage = remaining / prescribed;
  if (percentage > 0.7) return colors.accent.lime;
  if (percentage > 0.3) return colors.secondary.main;
  return colors.status.error;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  label: {
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  circleContainer: {
    marginVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.surface.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: `${colors.accent.lime}30`,
    overflow: 'hidden',
  },
  circleProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 80,
    opacity: 0.2,
  },
  circleContent: {
    alignItems: 'center',
    zIndex: 10,
  },
  timeDisplay: {
    fontVariant: ['tabular-nums'],
  },
  infoSection: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginVertical: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${colors.text.secondary}20`,
    width: '100%',
    justifyContent: 'center',
  },
  infoItem: {
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  controlButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.accent.lime,
  },
  secondaryButton: {
    backgroundColor: `${colors.accent.lime}20`,
    borderWidth: 1.5,
    borderColor: colors.accent.lime,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  controlButtonText: {
    fontWeight: '600',
    fontSize: typography.button.fontSize,
  },
});
