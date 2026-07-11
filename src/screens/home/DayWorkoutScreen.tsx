import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';
import { Text } from '../../components/common/Text';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StaleOverrideBanner } from '../../components/StaleOverrideBanner';
import ExerciseVideoModal from '../../components/ExerciseVideoModal';
import { SessionFeedbackPanel } from '../../components/SessionFeedbackPanel';
import { SessionCompleteMoment } from '../../components/SessionCompleteMoment';
import { PowerPrimerSection } from '../../components/PowerPrimerSection';
import { TrunkSupportSection } from '../../components/TrunkSupportSection';
import type { DesignVersion } from '../../store/uiStore';
import DayWorkoutScreenV2 from './DayWorkoutScreenV2';
import { useDayWorkout } from './useDayWorkout';
import {
  buildCueText,
  cleanNotes,
  formatRest,
  inferRecoveryPrescriptionType,
  formatRecoveryPrescription,
  buildStrengthLabels,
  groupStrengthExercises,
  formatConditioningRowPrescription,
} from './dayWorkoutHelpers';
import { formatExerciseDisplayName } from '../../utils/exerciseDisplay';
import type { RecoveryAddonBlock } from '../../types/domain';

// ── Design-version flag ──
// Hardcoded to 'v2' so the app opens directly into the redesigned DayWorkout
// during the V2 rollout. Flip to 'classic' to swap back.
//
// Parallels the flag in HomeScreen.tsx — both screens share a rollout state.
const DESIGN_VERSION: DesignVersion = 'v2';

function displayExerciseName(name: string | null | undefined, fallback = 'Exercise'): string {
  return formatExerciseDisplayName(name) || fallback;
}

/**
 * Thin routing wrapper — V2 and Classic share `useDayWorkout`, so they stay
 * in lockstep on logic while allowing independent visual iteration. Named
 * export preserved for AppNavigator + screens/home/index.ts.
 */
export const DayWorkoutScreen = () => {
  if (DESIGN_VERSION === 'v2') {
    return <DayWorkoutScreenV2 />;
  }
  return <DayWorkoutScreenClassic />;
};

/**
 * DayWorkoutScreenClassic — presentation-only Classic render layer.
 *
 * All state and handlers come from `useDayWorkout`. This file owns only JSX
 * and styles — logic lives in the shared hook so Classic and V2 stay aligned.
 */
function DayWorkoutScreenClassic() {
  const {
    date,
    workout,
    staleWarning,
    selectedExercise,
    setSelectedExercise,
    expandedCues,
    toggleCue,
    isFinished,
    justSaved,
    editingWeightId,
    editingWeightText,
    setEditingWeightText,
    formatWeight,
    incrementWeight,
    decrementWeight,
    startEditingWeight,
    commitWeightEdit,
    handleBack,
    handleFinishWorkout,
    handleFeedbackSaved,
    handleScrollBeginDrag,
    handleReviewStale,
    exerciseCount,
    isTeamOnly,
    isRecovery,
    isConditioning,
    isCombinedDay,
    hasTeamTraining,
    strengthExercises,
    supportExercises,
    conditioningExercises,
    conditioningOptions,
    conditioningRowCount,
  } = useDayWorkout();

  if (!workout) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
          </Pressable>
          <Text variant="h3" style={{ color: colors.text.primary, marginLeft: spacing.md }}>
            Workout Not Found
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <Text variant="body" color={colors.text.secondary} align="center">
            This workout could not be found. Go back and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render helper — keeps main and flush sub-blocks using identical row
  // markup so the only differences are title + description at the card level.
  const renderConditioningRow = (
    exercise: (typeof strengthExercises)[number],
    idx: number,
  ) => {
    const name = exercise.exercise?.name || `Phase ${idx + 1}`;
    const displayName = displayExerciseName(name, `Phase ${idx + 1}`);
    const notes = exercise.notes || '';
    const prescription = formatConditioningRowPrescription(exercise);
    return (
      <View key={exercise.id} style={styles.conditioningExercise}>
        <View style={styles.conditioningBullet} />
        <View style={{ flex: 1 }}>
          <Text style={styles.conditioningExerciseName}>{displayName}</Text>
          {prescription ? (
            <Text style={styles.conditioningPrescription}>{prescription}</Text>
          ) : null}
          {notes ? (
            <Text style={styles.conditioningExerciseNotes}>{cleanNotes(notes)}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Back arrow — own row */}
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={{ fontSize: 24, color: colors.text.primary }}>←</Text>
        </Pressable>
        {/*
         * Content stack — flush left-aligned.
         *
         * Pro-mode parity with V2: no weekday eyebrow, one-line subtitle
         * that merges exercise count with session type ("6 exercises ·
         * Strength"), and a softened Why link so it reads as a secondary
         * affordance rather than an accent button.
         */}
        <View style={styles.headerContent}>
          <Text variant="h2" color={colors.text.primary} style={styles.headerTitle}>
            {workout.name}
          </Text>
          {(() => {
            // Team-only days never show an exercise count — the session
            // happens at training, not in the app. Recovery and
            // conditioning use descriptive layouts, not exercise lists.
            const count = isTeamOnly
              ? 0
              : isCombinedDay
              ? strengthExercises.length
              : isConditioning || isRecovery
              ? 0
              : exerciseCount;
            const typeText = isRecovery
              ? 'Recovery'
              : isCombinedDay
              ? `${workout.workoutType} + Conditioning`
              : workout.workoutType;
            const countFragment =
              count > 0 ? `${count} exercise${count !== 1 ? 's' : ''}` : '';
            const combined = [countFragment, workout.powerBlock?.title, typeText]
              .filter(Boolean)
              .join(' · ');
            if (!combined) return null;
            return (
              <View style={styles.subtitleRow}>
                <Text style={styles.subtitleText} numberOfLines={1}>
                  {combined}
                </Text>
              </View>
            );
          })()}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={handleScrollBeginDrag}
      >
        {/* Stale override warning */}
        {staleWarning && (
          <StaleOverrideBanner
            warning={staleWarning}
            onReview={handleReviewStale}
          />
        )}

        {/* Coach-authored notes — surfaced prominently above the
            description so injury-driven adjustments (e.g. "no sprinting")
            are obvious the moment the athlete opens the day. */}
        {workout.coachNotes && workout.coachNotes.length > 0 ? (
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: '#C8FF00',
              paddingLeft: spacing.md,
              paddingVertical: spacing.sm,
              marginBottom: spacing.lg,
              backgroundColor: 'rgba(200, 255, 0, 0.06)',
            }}
          >
            <Text
              variant="caption"
              color={colors.text.secondary}
              style={{ fontWeight: '600', marginBottom: 4, letterSpacing: 0.5 }}
            >
              COACH NOTES
            </Text>
            {workout.coachNotes.map((note, i) => (
              <Text
                key={i}
                variant="bodySmall"
                color={colors.text.primary}
                style={{ marginTop: i === 0 ? 0 : 2 }}
              >
                • {note}
              </Text>
            ))}
          </View>
        ) : null}

        {workout.description ? (
          <Text variant="bodySmall" color={colors.text.secondary} style={{ marginBottom: spacing.lg }}>
            {workout.description}
          </Text>
        ) : null}

        {/* Typed pre-lift power work stays visible and separate from strength. */}
        <PowerPrimerSection block={workout.powerBlock} />

        {isConditioning ? (
          /* ─── Conditioning layout: session phases as descriptive blocks ─── */
          <View style={styles.section}>
            {conditioningExercises.map((exercise) => {
              const phaseName = exercise.exercise?.name || 'Phase';
              const phaseDisplayName = displayExerciseName(phaseName, 'Phase');
              const description = exercise.notes || exercise.exercise?.description || '';
              const restFormatted = formatRest(exercise.restSeconds, 'recovery');

              return (
                <View key={exercise.id} style={styles.conditioningPhase}>
                  <Text style={styles.conditioningPhaseName}>{phaseDisplayName}</Text>
                  {description ? (
                    <Text style={styles.conditioningDescription}>{description}</Text>
                  ) : null}
                  {restFormatted ? (
                    <Text style={styles.conditioningRest}>{restFormatted}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : isRecovery ? (
          /* ─── Recovery layout: structured exercises with prescriptions + play buttons ─── */
          <View style={styles.section}>
            {(workout.exercises ?? []).map((exercise, index) => {
              const exerciseName = exercise.exercise?.name || `Exercise ${index + 1}`;
              const exerciseDisplayName = displayExerciseName(exerciseName, `Exercise ${index + 1}`);
              const pType = inferRecoveryPrescriptionType(exercise, exerciseName);
              const displayNotes = cleanNotes(exercise.notes);
              const prescriptionLabel = formatRecoveryPrescription(exercise, pType);

              // Sets/rounds prefix
              const setsPrefix = exercise.prescribedSets > 1
                ? `${exercise.prescribedSets} × `
                : '';

              // Rest formatting
              const restFormatted = formatRest(exercise.restSeconds, 'rest');

              return (
                <Card key={exercise.id} style={styles.exerciseCard}>
                  {/* Exercise name + play button */}
                  <Pressable
                    style={styles.exerciseNameRow}
                    onPress={() => setSelectedExercise(exerciseName)}
                  >
                    <Text style={styles.recoveryIndex}>{index + 1}.</Text>
                    <Text style={styles.exerciseName} numberOfLines={2}>{exerciseDisplayName}</Text>
                    <View style={styles.playButton}>
                      <Text style={styles.playIcon}>▶</Text>
                    </View>
                  </Pressable>

                  {/* Prescription row */}
                  <View style={styles.recoveryPrescriptionRow}>
                    <Text style={styles.recoveryPrescription}>
                      {setsPrefix}{prescriptionLabel}
                    </Text>
                    {restFormatted ? (
                      <Text style={styles.recoveryRest}>{restFormatted}</Text>
                    ) : null}
                  </View>

                  {/* Session notes (primary) */}
                  {displayNotes ? (
                    <Text style={styles.exerciseNotes}>{displayNotes}</Text>
                  ) : null}
                  {/* Coaching cue (secondary, collapsible) */}
                  {(() => {
                    const cueText = buildCueText(exerciseName);
                    if (!cueText) return null;
                    const isExpanded = displayNotes ? expandedCues[exercise.id] : true;
                    // No notes → show cue directly; has notes → collapsible
                    if (!displayNotes) {
                      return <Text style={styles.coachingCue}>{cueText}</Text>;
                    }
                    return (
                      <View style={styles.cueToggleContainer}>
                        <Pressable
                          onPress={() => toggleCue(exercise.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                          style={styles.cueToggleRow}
                        >
                          <Text style={styles.cueToggleText}>
                            {isExpanded ? '▾ Form cues' : '▸ Form cues'}
                          </Text>
                        </Pressable>
                        {isExpanded ? (
                          <Text style={styles.coachingCueCollapsible}>{cueText}</Text>
                        ) : null}
                      </View>
                    );
                  })()}
                </Card>
              );
            })}
          </View>
        ) : (
          /* ─── Strength layout: numbered exercises with weight controls ─── */
          <View style={styles.section}>
            {(isCombinedDay || hasTeamTraining) && strengthExercises.length > 0 && (
              <Text style={styles.sectionHeader}>STRENGTH</Text>
            )}
            {(() => {
              const labels = buildStrengthLabels(strengthExercises);
              const groups = groupStrengthExercises(strengthExercises);

              // Render helper for a single exercise card
              const renderExerciseCard = (idx: number, isGrouped: boolean, isLastInGroup: boolean) => {
                const exercise = strengthExercises[idx];
                const label = labels[idx];
                const exerciseName = exercise.exercise?.name || `Exercise ${idx + 1}`;
                const exerciseDisplayName = displayExerciseName(exerciseName, `Exercise ${idx + 1}`);
                const displayNotes = cleanNotes(exercise.notes);
                const cardStyle = {
                  ...styles.exerciseCard,
                  ...(isGrouped && !isLastInGroup ? styles.exerciseCardGrouped : null),
                  ...(isGrouped && isLastInGroup ? styles.exerciseCardGroupedLast : null),
                };
                return (
                  <Card
                    key={exercise.id}
                    style={cardStyle}
                  >
                    {/* Row 1: Exercise name + play button */}
                    <Pressable
                      style={styles.exerciseNameRow}
                      onPress={() => setSelectedExercise(exerciseName)}
                    >
                      <Text style={styles.exerciseNumber}>{label}.</Text>
                      <Text style={styles.exerciseName} numberOfLines={2}>
                        {exerciseDisplayName}
                      </Text>
                      <View style={styles.playButton}>
                        <Text style={styles.playIcon}>▶</Text>
                      </View>
                    </Pressable>

                    {/* Row 2: Two-column stats — Sets × Reps + Weight */}
                    <View style={styles.statsRow}>
                      <View style={styles.statsCol}>
                        <Text style={styles.statsLabel}>Sets × Reps</Text>
                        <Text style={styles.statsValue}>
                          {exercise.prescribedSets} × {exercise.prescribedRepsMin === exercise.prescribedRepsMax
                            ? exercise.prescribedRepsMin
                            : `${exercise.prescribedRepsMin}-${exercise.prescribedRepsMax}`}
                        </Text>
                      </View>

                      <View style={styles.statsCol}>
                        <Text style={styles.statsLabel}>Weight</Text>
                        <View style={styles.weightControl}>
                          <Pressable
                            onPress={() => decrementWeight(exercise)}
                            style={styles.weightBtnLeft}
                            hitSlop={{ top: 8, bottom: 8, left: 8 }}
                          >
                            <Text style={styles.weightBtnText}>−</Text>
                          </Pressable>
                          {editingWeightId === exercise.exerciseId ? (
                            <TextInput
                              style={styles.weightInput}
                              value={editingWeightText}
                              onChangeText={setEditingWeightText}
                              onBlur={commitWeightEdit}
                              onSubmitEditing={commitWeightEdit}
                              placeholder="BW"
                              placeholderTextColor={colors.text.tertiary}
                              keyboardType="decimal-pad"
                              autoFocus
                              selectTextOnFocus
                              returnKeyType="done"
                            />
                          ) : (
                            <Pressable
                              onPress={() => startEditingWeight(exercise)}
                              style={styles.weightValueCenter}
                            >
                              <Text style={styles.weightValueText}>
                                {formatWeight(exercise)}
                              </Text>
                            </Pressable>
                          )}
                          <Pressable
                            onPress={() => incrementWeight(exercise)}
                            style={styles.weightBtnRight}
                            hitSlop={{ top: 8, bottom: 8, right: 8 }}
                          >
                            <Text style={styles.weightBtnText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    {/* Row 3: Notes + rest hint (primary) */}
                    {(displayNotes || exercise.restSeconds >= 90) ? (
                      <View style={styles.secondaryRow}>
                        {displayNotes ? (
                          <Text style={styles.exerciseNotes}>{displayNotes}</Text>
                        ) : null}
                        {exercise.restSeconds >= 90 ? (
                          <Text style={styles.restHint}>
                            {formatRest(exercise.restSeconds, 'rest')}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    {/* Coaching cue (secondary, collapsible) */}
                    {(() => {
                      const cueText = buildCueText(exerciseName);
                      if (!cueText) return null;
                      const isExpanded = displayNotes ? expandedCues[exercise.id] : true;
                      // No notes → show cue directly; has notes → collapsible
                      if (!displayNotes) {
                        return <Text style={styles.coachingCue}>{cueText}</Text>;
                      }
                      return (
                        <View style={styles.cueToggleContainer}>
                          <Pressable
                            onPress={() => toggleCue(exercise.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                            style={styles.cueToggleRow}
                          >
                            <Text style={styles.cueToggleText}>
                              {isExpanded ? '▾ Form cues' : '▸ Form cues'}
                            </Text>
                          </Pressable>
                          {isExpanded ? (
                            <Text style={styles.coachingCueCollapsible}>{cueText}</Text>
                          ) : null}
                        </View>
                      );
                    })()}
                  </Card>
                );
              };

              // Render grouped and ungrouped exercises
              return groups.map((group) => {
                // Standalone exercise — no wrapper needed
                if (!group.groupId || group.indices.length < 2) {
                  return group.indices.map((idx) =>
                    renderExerciseCard(idx, false, true)
                  );
                }
                // Paired/grouped exercises — wrap in a visual container
                return (
                  <View key={`group-${group.groupId}`} style={styles.pairGroupContainer}>
                    {group.indices.map((idx, i) =>
                      renderExerciseCard(idx, true, i === group.indices.length - 1)
                    )}
                  </View>
                );
              });
            })()}

            {/*
              ─── Combined day: conditioning section ───

              Rendered strictly from `workout.conditioningBlock` (single
              source of truth). The block carries one intent and one or
              more training-equivalent options. When there is exactly one
              option, it renders as a single prescription. When there are
              multiple, they render under a "Choose one:" header so the
              athlete picks one — never "do both".
            */}
            {isCombinedDay && conditioningOptions.length > 0 && conditioningRowCount > 0 && (
              <>
                <View style={styles.conditioningDivider} />
                <Text style={styles.sectionHeader}>CONDITIONING</Text>

                {conditioningOptions.length > 1 && (
                  <Text style={styles.chooseOneLabel}>Choose one:</Text>
                )}

                {conditioningOptions.map((opt, optIdx) => (
                  <Card
                    key={`cond-opt-${optIdx}`}
                    style={styles.conditioningBlock}
                  >
                    <Text style={styles.conditioningBlockTitle}>{opt.title}</Text>
                    {opt.description ? (
                      <Text style={styles.conditioningBlockDescription}>
                        {opt.description}
                      </Text>
                    ) : null}
                    {opt.rows.map((exercise, idx) =>
                      renderConditioningRow(exercise, idx),
                    )}
                  </Card>
                ))}
              </>
            )}

            {hasTeamTraining ? (
              <View style={styles.teamTrainingSection}>
                <Text style={styles.sectionHeader}>TEAM TRAINING</Text>
                <Card style={styles.teamTrainingCard}>
                  <Text style={styles.teamTrainingTitle}>
                    Club/team field session.
                  </Text>
                  <Text style={styles.teamTrainingBody}>
                    We'll account for the load in your week.
                  </Text>
                </Card>
              </View>
            ) : null}
          </View>
        )}

        <TrunkSupportSection rows={supportExercises} />

        <RecoveryAddonSection addons={workout.recoveryAddons ?? []} />

        {/* Post-finish: feedback panel, or "Session logged" success moment. */}
        {isFinished && date ? (
          justSaved ? (
            <SessionCompleteMoment date={date} />
          ) : (
            <SessionFeedbackPanel date={date} workout={workout} onSave={handleFeedbackSaved} />
          )
        ) : null}

        {/* Finish CTA — hidden once finished (feedback panel takes over).
            Labelled "Finish Session" to match DayWorkoutScreenV2's wording
            and keep individual-workout CTA language consistent across the
            Classic/V2 variants. */}
        {!isFinished && (
          <View style={styles.buttonContainer}>
            <Button
              onPress={handleFinishWorkout}
              title="Finish Session"
              variant="primary"
              fullWidth
            />
          </View>
        )}
      </ScrollView>

      {/* Exercise Demo Video Modal */}
      <ExerciseVideoModal
        visible={!!selectedExercise}
        exerciseName={selectedExercise || ''}
        onClose={() => setSelectedExercise(null)}
      />
    </SafeAreaView>
  );
}

interface RecoveryAddonSectionProps {
  addons: RecoveryAddonBlock[];
}
function RecoveryAddonSection({ addons }: RecoveryAddonSectionProps) {
  if (addons.length === 0) return null;

  return (
    <View style={styles.recoveryAddonSection}>
      <Text style={styles.sectionHeader}>OPTIONAL RECOVERY ADD-ON</Text>
      {addons.map((addon) => (
        <Card key={addon.id} style={styles.recoveryAddonCard}>
          <View style={styles.recoveryAddonHeader}>
            <View style={styles.recoveryAddonTitleWrap}>
              <Text style={styles.recoveryAddonEyebrow}>{addon.label}</Text>
              <Text style={styles.recoveryAddonTitle}>{addon.durationMinutes} min support work</Text>
            </View>
            <Text style={styles.recoveryAddonPill}>Optional</Text>
          </View>
          {addon.placementNote ? (
            <Text style={styles.recoveryAddonMeta}>{addon.placementNote}</Text>
          ) : null}
          <View style={styles.recoveryAddonExercises}>
            {addon.exercises.map((exercise) => (
              <View key={exercise.id} style={styles.recoveryAddonExercise}>
                <Text style={styles.recoveryAddonExerciseName}>{exercise.name}</Text>
                <Text style={styles.recoveryAddonPrescription}>{exercise.prescription}</Text>
                {exercise.notes ? (
                  <Text style={styles.recoveryAddonNotes}>{exercise.notes}</Text>
                ) : null}
              </View>
            ))}
          </View>
          <Text style={styles.recoveryAddonSkip}>Skip with no penalty if it adds fatigue.</Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.primary,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.tertiary,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    marginBottom: 6,
  },
  headerContent: {
    // no marginLeft — flush with header paddingHorizontal
  },
  headerTitle: {
    // Pro mode: no eyebrow above the title, so no top margin needed.
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 12,
  },
  subtitleText: {
    flex: 1,
    color: colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  exerciseCard: {
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 5,
  },
  exerciseNumber: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '800',
    minWidth: 20,
  },
  exerciseName: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  playButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(200, 255, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  playIcon: {
    color: '#0C0C0C',
    fontSize: 9,
    marginLeft: 1,
  },
  // ─── Fixed 3-column stats grid ───
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statsCol: {
    flex: 1,
  },
  // ─── Paired / superset group wrapper ───
  pairGroupContainer: {
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.25)',
    backgroundColor: 'rgba(200, 255, 0, 0.03)',
    borderRadius: borderRadius.lg + 2,
    padding: 6,
    marginBottom: spacing.sm,
    marginTop: 2,
  },
  exerciseCardGrouped: {
    marginBottom: 4,       // tighter gap between paired cards
  },
  exerciseCardGroupedLast: {
    marginBottom: 0,       // no extra margin on last card — container padding handles it
  },
  secondaryRow: {
    marginTop: 6,
  },
  restHint: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statsLabel: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statsValue: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseNotes: {
    marginTop: 6,
    color: '#9A9A9A',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  coachingCue: {
    marginTop: 6,
    color: '#777777',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
  },
  cueToggleContainer: {
    marginTop: 10,
  },
  cueToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cueToggleText: {
    color: '#5A5A5A',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  coachingCueCollapsible: {
    marginTop: 3,
    marginLeft: 2,
    color: '#777777',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
  },
  // ─── Unified weight control: [ − ] [ value ] [ + ] ───
  weightControl: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.25)',
    backgroundColor: 'rgba(200, 255, 0, 0.04)',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  weightBtnLeft: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(200, 255, 0, 0.15)',
  },
  weightBtnRight: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(200, 255, 0, 0.15)',
  },
  weightBtnText: {
    color: colors.accent.lime,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  weightValueCenter: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  weightValueText: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
  },
  weightInput: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 50,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingVertical: spacing.md,
  },
  // ─── Conditioning session layout ───
  conditioningPhase: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  conditioningPhaseName: {
    color: colors.accent.lime,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  conditioningDescription: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  conditioningRest: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  // ─── Recovery session layout ───
  recoveryIndex: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '800',
    minWidth: 16,
  },
  recoveryPrescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  recoveryPrescription: {
    color: colors.accent.lime,
    fontSize: 14,
    fontWeight: '700',
  },
  recoveryRest: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  recoveryAddonSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  recoveryAddonCard: {
    backgroundColor: 'rgba(200, 255, 0, 0.05)',
    borderColor: 'rgba(200, 255, 0, 0.18)',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  recoveryAddonHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  recoveryAddonTitleWrap: {
    flex: 1,
    gap: 2,
  },
  recoveryAddonEyebrow: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  recoveryAddonTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  recoveryAddonPill: {
    color: colors.accent.lime,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  recoveryAddonMeta: {
    color: colors.text.secondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  recoveryAddonExercises: {
    gap: spacing.sm,
  },
  recoveryAddonExercise: {
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 2,
  },
  recoveryAddonExerciseName: {
    color: colors.text.primary,
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 18,
  },
  recoveryAddonPrescription: {
    color: colors.accent.lime,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  recoveryAddonNotes: {
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  recoveryAddonSkip: {
    color: colors.text.tertiary,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  // ── Combined S+C day styles ──
  sectionHeader: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  conditioningDivider: {
    height: 1,
    backgroundColor: colors.surface.tertiary,
    marginVertical: spacing.lg,
  },
  conditioningBlock: {
    backgroundColor: `${colors.intensity.moderate}10`,
    borderColor: `${colors.intensity.moderate}30`,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  chooseOneLabel: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  conditioningBlockTitle: {
    color: colors.intensity.moderate,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  conditioningBlockDescription: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  teamTrainingSection: {
    marginTop: spacing.xl,
  },
  teamTrainingCard: {
    backgroundColor: 'rgba(200, 255, 0, 0.06)',
    borderColor: 'rgba(200, 255, 0, 0.18)',
    borderWidth: 1,
  },
  teamTrainingTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  teamTrainingBody: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  conditioningExercise: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  conditioningBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.intensity.moderate,
    marginTop: 5,
    flexShrink: 0,
  },
  conditioningExerciseName: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  conditioningPrescription: {
    color: colors.intensity.moderate,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  conditioningExerciseNotes: {
    color: colors.text.tertiary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
});
