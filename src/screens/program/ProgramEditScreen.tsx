import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { useProgramStore } from '../../store/programStore';
import type { ProgramStackParamList } from '../../types/navigation';

type ProgramEditScreenProps = NativeStackScreenProps<ProgramStackParamList, 'ProgramEdit'>;

export default function ProgramEditScreen({ navigation }: ProgramEditScreenProps) {
  const currentProgram = useProgramStore((state) => state.currentProgram);
  const [programName, setProgramName] = useState(currentProgram?.name || '');

  const handleSave = () => {
    if (currentProgram) {
      useProgramStore.getState().setCurrentProgram({
        ...currentProgram,
        name: programName,
      });
      navigation.goBack();
    }
  };

  const handleDeactivate = () => {
    if (currentProgram) {
      useProgramStore.getState().setCurrentProgram({
        ...currentProgram,
        isActive: false,
      });
      navigation.navigate('ProgramList');
    }
  };

  if (!currentProgram) {
    return (
      <SafeAreaView style={styles.container}>
        <Text variant="body" color={colors.text.secondary}>
          No program selected
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text variant="h3" color={colors.text.primary}>
            ←
          </Text>
        </Pressable>
        <Text variant="h2" color={colors.text.primary} style={styles.title}>
          Edit Program
        </Text>
        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text variant="bodyEmphasis" color={colors.accent.lime}>
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Program Name Section */}
        <View style={styles.section}>
          <Text
            variant="h3"
            color={colors.text.primary}
            style={styles.sectionTitle}
          >
            Program Details
          </Text>

          <View style={styles.formGroup}>
            <Text variant="label" color={colors.text.secondary}>
              Program Name
            </Text>
            <Input
              value={programName}
              onChangeText={setProgramName}
              placeholder="Enter program name"
              style={styles.input}
            />
          </View>

          {/* Phase Display */}
          <View style={styles.formGroup}>
            <Text variant="label" color={colors.text.secondary}>
              Phase
            </Text>
            <Card>
              <Text variant="body" color={colors.text.primary}>
                {currentProgram.programPhase}
              </Text>
              <Text
                variant="caption"
                color={colors.text.tertiary}
                style={styles.readOnlyNote}
              >
                Phase cannot be changed. Create a new program to select a different phase.
              </Text>
            </Card>
          </View>

          {/* Start Date Display */}
          <View style={styles.formGroup}>
            <Text variant="label" color={colors.text.secondary}>
              Start Date
            </Text>
            <Card>
              <Text variant="body" color={colors.text.primary}>
                {new Date(currentProgram.startDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text
                variant="caption"
                color={colors.text.tertiary}
                style={styles.readOnlyNote}
              >
                Start date cannot be changed once program is created.
              </Text>
            </Card>
          </View>

          {/* End Date Display */}
          <View style={styles.formGroup}>
            <Text variant="label" color={colors.text.secondary}>
              End Date
            </Text>
            <Card>
              <Text variant="body" color={colors.text.primary}>
                {new Date(currentProgram.endDate).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </Card>
          </View>

          {/* Total Duration */}
          <View style={styles.formGroup}>
            <Text variant="label" color={colors.text.secondary}>
              Total Duration
            </Text>
            <Card>
              <Text variant="body" color={colors.text.primary}>
                {currentProgram.microcycles.length} weeks
              </Text>
            </Card>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <View style={styles.dangerZoneHeader}>
            <Text variant="h3" color={colors.status.error}>
              Danger Zone
            </Text>
          </View>

          <Card style={styles.dangerCard}>
            <Text variant="body" color={colors.text.secondary} style={styles.dangerText}>
              Deactivating a program will remove it from your active programs but keep all
              historical data. You can reactivate it later.
            </Text>

            <Button
              title="Deactivate Program"
              onPress={handleDeactivate}
              variant="danger"
              fullWidth
              style={styles.dangerButton}
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.secondary,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  title: {
    flex: 1,
  },
  saveButton: {
    padding: spacing.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  input: {
    marginTop: spacing.sm,
  },
  readOnlyNote: {
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  dangerZone: {
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  dangerZoneHeader: {
    marginBottom: spacing.lg,
  },
  dangerCard: {
    borderColor: colors.status.error,
    borderWidth: 1,
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
  },
  dangerText: {
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  dangerButton: {
    marginTop: spacing.md,
  },
});
