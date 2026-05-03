import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Text } from '../../components/common/Text';
import { SettingsRow } from '../../components/common/SettingsRow';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { useUIStore } from '../../store/uiStore';

export const PreferencesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const designVersion = useUIStore((s) => s.designVersion);
  const setDesignVersion = useUIStore((s) => s.setDesignVersion);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text variant="h3" style={styles.backButton}>
            ← Back
          </Text>
        </Pressable>
        <Text variant="h2" style={styles.title}>
          Preferences
        </Text>
      </View>

      {/* Settings Rows */}
      <SettingsRow
        icon="⚙️"
        label="Training Preferences"
        onPress={() => navigation.navigate('TrainingPreferences')}
      />
      <SettingsRow
        icon="🏋️"
        label="Equipment Settings"
        onPress={() => navigation.navigate('EquipmentSettings')}
      />
      <SettingsRow
        icon="🎯"
        label="Goal Settings"
        onPress={() => navigation.navigate('GoalSettings')}
      />

      {/* ─── Experimental (runtime design-version toggle) ─── */}
      <View style={styles.experimentalBlock}>
        <Text style={styles.experimentalLabel}>EXPERIMENTAL</Text>
        <Text style={styles.experimentalHint}>
          Preview the new Home screen design. You can switch back at any time.
        </Text>

        <View style={styles.segment}>
          {(['classic', 'v2'] as const).map((key) => {
            const active = designVersion === key;
            return (
              <Pressable
                key={key}
                onPress={() => setDesignVersion(key)}
                style={[styles.segmentOption, active && styles.segmentOptionActive]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {key === 'classic' ? 'Classic' : 'New (V2)'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.spacer} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  backButton: {
    color: colors.accent.lime,
    marginBottom: spacing.md,
  } as TextStyle,
  title: {
    color: colors.text.primary,
  } as TextStyle,
  spacer: {
    height: spacing.xl,
  } as ViewStyle,
  experimentalBlock: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
  } as ViewStyle,
  experimentalLabel: {
    color: '#C8FF00',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: spacing.xs,
  } as TextStyle,
  experimentalHint: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  } as TextStyle,
  segment: {
    flexDirection: 'row',
    backgroundColor: '#0C0C0C',
    borderRadius: borderRadius.md,
    padding: 4,
    gap: 4,
  } as ViewStyle,
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  } as ViewStyle,
  segmentOptionActive: {
    backgroundColor: '#C8FF00',
  } as ViewStyle,
  segmentText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
  segmentTextActive: {
    color: '#0C0C0C',
    fontWeight: '700',
  } as TextStyle,
});
