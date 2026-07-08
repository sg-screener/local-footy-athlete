import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/Text';
import { Button, Sheet } from '../../components/ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { HomeQuickAction } from './homeScreenConstants';
import { GuidedInjuryFlowSheet } from './GuidedInjuryFlowSheet';
import type { GuidedInjuryFlowResult } from '../../utils/guidedInjuryControl';

interface HomeQuickActionSheetProps {
  visible: boolean;
  action: HomeQuickAction | null;
  onClose: () => void;
  onOpenDayControls: () => void;
  onOpenProgramSetup: () => void;
  onApplyBusyWeekReduction: () => void;
  onApplyGuidedInjury: (result: GuidedInjuryFlowResult) => void | Promise<void>;
  onMessageCoach: (prefill: string) => void;
}

export function HomeQuickActionSheet({
  visible,
  action,
  onClose,
  onOpenDayControls,
  onOpenProgramSetup,
  onApplyBusyWeekReduction,
  onApplyGuidedInjury,
  onMessageCoach,
}: HomeQuickActionSheetProps) {
  const [needsDetail, setNeedsDetail] = useState(false);

  useEffect(() => {
    if (visible) setNeedsDetail(false);
  }, [visible, action?.id]);

  if (!action) return null;

  const messagePrefill = action.prefill || 'Coach, I need to update my program - ';
  const openCoachByChoice = () => {
    onClose();
    onMessageCoach(messagePrefill);
  };
  const openDayControls = () => {
    onClose();
    onOpenDayControls();
  };
  const reduceBusyWeek = () => {
    onClose();
    onApplyBusyWeekReduction();
  };
  const openProgramSetup = () => {
    onClose();
    onOpenProgramSetup();
  };

  const detailFallback = (
    <View>
      <Text style={styles.title}>I need a bit more detail</Text>
      <Text style={styles.body}>
        This one needs more context before we can change your program safely.
      </Text>
      <Button
        label="Message the coach"
        size="lg"
        glow={false}
        onPress={openCoachByChoice}
      />
      <Button
        label="Cancel"
        variant="ghost"
        size="md"
        glow={false}
        onPress={onClose}
        style={styles.secondaryButton}
      />
    </View>
  );

  if (action.id === 'injury') {
    return (
      <GuidedInjuryFlowSheet
        visible={visible}
        onClose={onClose}
        titlePrefix="Injury / pain"
        onComplete={async (result) => {
          await onApplyGuidedInjury(result);
          onClose();
        }}
      />
    );
  }

  if (needsDetail || action.id === 'missing_equipment') {
    return (
      <Sheet visible={visible} onClose={onClose} testID="home-quick-action-detail-sheet">
        {detailFallback}
      </Sheet>
    );
  }

  if (action.id === 'missed_session' || action.id === 'training_cancelled') {
    return (
      <Sheet visible={visible} onClose={onClose} testID="home-missed-session-sheet">
        <Text style={styles.title}>Missed a session?</Text>
        <QuickOption
          label="Move it to another day"
          sub="Use the day controls to pick the new slot"
          onPress={openDayControls}
        />
        <QuickOption
          label="Skip it"
          sub="Bin the missed session and keep the week moving"
          onPress={openDayControls}
        />
        <QuickOption
          label="Replace it with recovery"
          sub="Swap the target day to an easy recovery flow"
          onPress={openDayControls}
        />
        <QuickOption
          label="Message the coach"
          sub="Use this only if the menu does not cover it"
          onPress={openCoachByChoice}
        />
      </Sheet>
    );
  }

  if (action.id === 'busy_week') {
    return (
      <Sheet visible={visible} onClose={onClose} testID="home-busy-week-sheet">
        <Text style={styles.title}>Busy week?</Text>
        <QuickOption
          label="Reduce this week"
          sub="Adds an active schedule adjustment"
          onPress={reduceBusyWeek}
        />
        <QuickOption
          label="Pick unavailable days"
          sub="Needs the exact days before changing the plan"
          onPress={() => setNeedsDetail(true)}
        />
        <QuickOption
          label="Keep program as-is"
          onPress={onClose}
        />
        <QuickOption
          label="Message the coach"
          sub="Use this only if the menu does not cover it"
          onPress={openCoachByChoice}
        />
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} testID="home-what-changed-sheet">
      <Text style={styles.title}>What changed?</Text>
      <QuickOption
        label="Program setup"
        sub="Update phase, training days, team days or game day"
        onPress={openProgramSetup}
      />
      <QuickOption
        label="Body / injury / fatigue"
        sub="Use the guided body-status flow"
        onPress={openDayControls}
      />
      <QuickOption
        label="Equipment"
        sub="Needs the session or exercise affected"
        onPress={() => setNeedsDetail(true)}
      />
      <QuickOption
        label="Session or exercise"
        sub="Open the day/session controls"
        onPress={openDayControls}
      />
      <QuickOption
        label="Message the coach"
        sub="Use this only if the menu does not cover it"
        onPress={openCoachByChoice}
      />
    </Sheet>
  );
}

function QuickOption({
  label,
  sub,
  onPress,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.optionLabel}>{label}</Text>
      {sub ? <Text style={styles.optionSub} numberOfLines={2}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  optionSub: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  secondaryButton: {
    marginTop: spacing.sm,
  },
});
