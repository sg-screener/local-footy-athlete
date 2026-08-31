/**
 * SessionFeedbackPanel — Post-session feedback capture.
 *
 * Completion-first flow. The answer to "Did you complete it?" determines
 * which follow-up questions are valid for this session.
 *
 * Save button appears only when the required fields for the selected
 * completion state are answered.
 * On save: persists feedback, calls onSave() so the parent can navigate away.
 *
 * Feedback feeds into the progression context on subsequent sessions
 * via feelingToRPE(), soreness-based adaptation, and deriveCompletionQuality().
 *
 * ## PRESENTATION — ONE SHELL, THREE FORMS (Sam, 2026-08-22)
 * Every form in this file is a plain body inside a `Sheet`: the sheet draws the
 * header (a small label naming what is being logged, over the one question all
 * three ask) and the body draws the questions. **No form wraps itself in a
 * Card and no form titles itself** — the game and session forms did both, which
 * put their questions 48pt from the screen edge against club training's 24 and
 * gave two of the three a grey sub-line the other never had.
 * Chip rows keep the softer fill/border treatment; the save button is the V2
 * primary `Button`, the same size and the same word on all three, on screen
 * from the start and greyed until the answers are in.
 *
 * Prop contract is unchanged; Classic and V2 DayWorkout layers both render
 * this without modification.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  type TextStyle,
} from 'react-native';
import { Text } from './common/Text';
import { Button, SectionLabel } from './ui';
import { stableTestIdToken } from '../utils/stableTestId';
import { colors } from '../theme/colors';
import { EffortSlider } from './EffortSlider';
import { spacing, borderRadius } from '../theme/spacing';
import type { Workout } from '../types/domain';
import {
  useProgramStore,
  type FeedbackFeeling,
  type FeedbackCompletion,
  type FeedbackSoreness,
  type SessionFeedback,
} from '../store/programStore';
import {
  EXPECTATION_OPTIONS,
  EXPECTATION_REASON_OPTIONS,
  FEEDBACK_FORM_SECTION_LABELS,
  GAME_FEEL_OPTIONS,
  PARTIAL_REASON_OPTIONS,
  SKIP_REASON_OPTIONS,
  buildSessionFeedbackPayload,
  canSaveFeedbackDraft,
  completionMapFromFeedback,
  componentReasonsFromFeedback,
  deriveAggregateCompletion,
  getVisibleFeedbackSections,
  isSessionEffortRating,
  sanitizeComponentReasons,
  sanitizeFeedbackDraftForCompletion,
  sanitizeFeedbackDraftForComponents,
  type ComponentFeedbackReasonState,
  type FeedbackFormDraft,
  type FeedbackFormSectionId,
} from '../utils/sessionFeedbackForm';
import {
  getConditioningLoggingConfig,
  type ConditioningLogField,
  type ConditioningLogMode,
  type ConditioningPerformanceLog,
} from '../utils/conditioningLogging';
import {
  componentQuestionLabel,
  componentPartialReasonLabel,
  componentSkipReasonLabel,
  getSessionComponents,
  type SessionComponent,
} from '../utils/sessionComponents';
import { buildStrengthPerformanceLogs, collectLoggedStrengthSets, buildLastSetFeedbackInputs } from '../utils/strengthLogging';
import { LastSetRirQuestion } from './LastSetRirQuestion';
import type { LastSetEstimateInput } from '../rules/estimatedOneRepMax';
import { useWorkoutLogStore } from '../store/workoutLogStore';
import { useProfileStore } from '../store/profileStore';
import { measuredMinutesFor } from '../store/sessionStopwatchStore';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  sessionOutcomeRecordableRefusal,
} from '../store/sessionOutcomeTransaction';
import type { SessionOutcomeTransactionReceipt } from '../types/sessionOutcome';
import { registerAthleteActionUIOutcome } from '../dev/e2e/athleteActionUIObservation';
import { explorerTestId } from '../utils/stableTestId';
import { isTeamTrainingSession } from '../utils/teamTraining';
import {
  TEAM_NIGHT_SIZE_OPTIONS,
  TEAM_TRAINING_FEEDBACK_COPY,
  type TeamNightSize,
} from '../rules/teamNightSize';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import {
  expectationAsksWhy,
  type GameSessionOutcome,
  type FeedbackExpectation,
  type FeedbackExpectationReason,
  type FeedbackGameFeel,
  type TeamTrainingSessionOutcome,
} from '../types/sessionOutcome';
import { AppTextInput } from '../components/keyboard/AppTextInput';
import { logger } from '../utils/logger';
import {
  deriveSessionExecutionCompletion,
  type SessionExecutionSummary,
} from '../utils/sessionExecutionChecklist';
import { GAME_FEEDBACK_COPY } from '../rules/gameFeedback';
import { signedCopy } from '../rules/signedCopy';
import { STRENGTH_FEEDBACK_COPY } from '../rules/strengthSessionFeedback';
import { parseSessionDurationMinutes } from '../rules/sessionDuration';
import {
  clubTrainingFeedbackDecision,
  clubTrainingSaveBlockCopy,
} from '../rules/clubTrainingFeedbackDecision';

interface Props {
  /** ISO date string 'YYYY-MM-DD' for the session */
  date: string;
  /** Resolved workout for deciding whether richer conditioning logging is useful. */
  workout?: Workout | null;
  /** Live checklist result. When present, completion is derived rather than asked. */
  executionSummary?: SessionExecutionSummary;
  /** Called after feedback is saved. Parent uses this to navigate back. */
  onSave?: (receipt: SessionOutcomeTransactionReceipt) => void;
}

// ─── Feeling options (4 choices — maps to existing backend keys) ───

const FEELING_OPTIONS: { key: FeedbackFeeling; label: string; color: string }[] = [
  { key: 'easy',      label: 'Easy',      color: '#81C784' },
  { key: 'good',      label: 'Solid',     color: '#C8FF00' },
  { key: 'hard',      label: 'Hard',      color: '#FFB74D' },
  { key: 'very_hard', label: 'Very Hard', color: '#EF5350' },
];

// ─── Soreness options ───

const SORENESS_OPTIONS: { key: FeedbackSoreness; label: string; color: string }[] = [
  { key: 'none',     label: 'None',     color: '#81C784' },
  { key: 'mild',     label: 'Mild',     color: '#C8FF00' },
  { key: 'moderate', label: 'Moderate', color: '#FFB74D' },
  { key: 'high',     label: 'High',     color: '#EF5350' },
];

// ─── Completion options ───

const COMPLETION_OPTIONS: { key: FeedbackCompletion; label: string }[] = [
  { key: 'full',    label: 'Fully' },
  { key: 'partial', label: 'Partially' },
  { key: 'skipped', label: 'Skipped' },
];

const MODE_OPTIONS: { key: ConditioningLogMode; label: string }[] = [
  { key: 'run', label: 'Run' },
  { key: 'bike', label: 'Bike' },
  { key: 'assault_bike', label: 'Assault' },
  { key: 'rower', label: 'Rower' },
  { key: 'ski', label: 'Ski' },
  { key: 'swim', label: 'Swim' },
  { key: 'mixed', label: 'Mixed' },
  { key: 'other', label: 'Other' },
];

function textFromNumber(value: number | undefined): string {
  return value === undefined || value === null ? '' : String(value);
}

function parseNumberField(value: string): number | undefined {
  const cleaned = value.trim().replace(',', '.');
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseIntegerField(value: string): number | undefined {
  const parsed = parseNumberField(value);
  if (parsed === undefined) return undefined;
  return Math.round(parsed);
}

function parseRpe(value: string): number | undefined {
  const parsed = parseNumberField(value);
  if (parsed === undefined) return undefined;
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

function draftFromExistingFeedback(
  existing: SessionFeedback | null | undefined,
  components: SessionComponent[],
): FeedbackFormDraft {
  const componentCompletions = completionMapFromFeedback(existing, components);
  const componentReasons = componentReasonsFromFeedback(existing, components);
  if (components.length > 0) {
    return sanitizeFeedbackDraftForComponents(
      {
        completion: deriveAggregateCompletion(
          components,
          componentCompletions,
          existing?.completion ?? null,
        ),
        componentCompletions,
        componentReasons,
        feeling: existing?.feeling ?? null,
        soreness: existing?.soreness ?? null,
        partialReason: existing?.partialReason ?? null,
        skipReason: existing?.skipReason ?? null,
      },
      components,
    );
  }

  return sanitizeFeedbackDraftForCompletion(
    {
      completion: existing?.completion ?? null,
      componentCompletions,
      componentReasons,
      feeling: existing?.feeling ?? null,
      soreness: existing?.soreness ?? null,
      partialReason: existing?.partialReason ?? null,
      skipReason: existing?.skipReason ?? null,
    },
    existing?.completion ?? null,
  );
}

/**
 * One entry component, two presentations, one save transaction.
 * Games and practice matches are both classified as `game` by the existing
 * taxonomy and therefore cannot drift into separate feedback pathways.
 */
export const SessionFeedbackPanel: React.FC<Props> = (props) => {
  const isGame = classifyDaySessions(props.workout)
    .some((unit) => unit.category === 'game');
  return isGame
    ? <GameSessionFeedbackPanel {...props} />
    : <TrainingSessionFeedbackPanel {...props} />;
};

/**
 * CLUB TRAINING IS ITS OWN FORM — Sam, 2026-08-21: *"Add a 'log training'
 * button on the day view next to the 'team training' ... which takes you to the
 * feedback page for club training - remove the club training from the other
 * view ... so it is two separate feedback forms"*.
 *
 * ## WHY IT IS A SEPARATE FORM AND NOT A SEPARATE FACT
 *
 * Sam, on the same message: *"two forms saved together to be calculated in the
 * one place"*. So this writes `teamTraining` onto the SAME day record the gym
 * form writes, through the SAME transaction door. `journalLoad.teamTrainingSRPE`
 * keeps reading it exactly where it always has — no new fact, no new reader, no
 * second load path to keep in step.
 *
 * ## THE THREE QUESTIONS, AND WHY ONLY THREE
 *
 * Load is `effort x minutes` for every session type in this app — strength
 * (`strengthSRPE`), team training (`teamTrainingSRPE`) and games (`gameSRPE`)
 * all land in the same unit. Nothing downstream reads anything else about club
 * training. So the form asks what was done, how long, and how hard, and stops.
 *
 * ⚠ **IT PRESERVES THE GYM'S OWN ANSWERS RATHER THAN CLAIMING THEM.**
 * `GameSessionFeedbackPanel` above can write `completion: 'full'` because on a
 * game day the game IS the session. A club night is not: Tuesday is "Strength +
 * Team Training", one record with two halves. Writing `'full'` from here would
 * mark a gym session the athlete may not have done. The existing record is
 * spread first and only the club half is set, so logging club training before
 * the gym leaves the gym exactly as it was — and `'partial'` is the honest
 * completion for a record that now says one half happened.
 */
export const ClubTrainingFeedbackPanel: React.FC<Props> = ({ date, workout, onSave }) => {
  const existing = useProgramStore((state: any) => state.sessionFeedback[date]) as
    | SessionFeedback
    | undefined;
  const initial = existing?.teamTraining;
  const [completion, setCompletion] = useState<FeedbackCompletion | null>(
    initial ? 'full' : null,
  );
  const [minutes, setMinutes] = useState(
    initial ? String(initial.durationMinutes) : '',
  );
  const [effort, setEffort] = useState<number | null>(
    isSessionEffortRating(initial?.effort) ? initial!.effort : null,
  );
  const [saveRefusal, setSaveRefusal] = useState<string | null>(null);

  useEffect(() => {
    const team = existing?.teamTraining;
    setCompletion(team ? 'full' : null);
    setMinutes(team ? String(team.durationMinutes) : '');
    setEffort(isSessionEffortRating(team?.effort) ? team!.effort : null);
    setSaveRefusal(null);
  }, [date, existing]);

  const duration = parseSessionDurationMinutes(minutes);
  const attended = completion === 'full' || completion === 'partial';
  const recordableRefusal = sessionOutcomeRecordableRefusal(date);
  /* THE ENABLE RULE HAS ONE OWNER AND A DISABLED SAVE SAYS WHY. Launch audit
     2026-08-25, finding #9: the minutes box shows a placeholder "90" styled
     like a value, so the form looked complete while Save sat dead saying
     nothing. The decision (including the skip-needs-no-numbers rule this
     comment used to state inline) lives in
     `rules/clubTrainingFeedbackDecision`, beside its athlete-facing reasons,
     so the condition and its explanation cannot drift apart. */
  const decision = clubTrainingFeedbackDecision({
    completion,
    minutesText: minutes,
    effort,
    recordableRefusal,
  });
  const canSave = decision.canSave;

  const handleSave = useCallback(async () => {
    if (!canSave || completion === null) return;
    setSaveRefusal(null);
    try {
      /**
       * ⚠ **THE SESSION COMPLETION IS FANNED OUT TO EVERY COMPONENT WHEN THE
       * RECORD CARRIES NO PER-COMPONENT ANSWERS** — `sessionOutcomeTransaction`
       * falls back to `target.components.map(... completion: feedback.completion)`.
       *
       * MEASURED ON SAM'S PHONE, 2026-08-21, and it is the defect he reported:
       * logging only club training wrote `partial` onto the STRENGTH and
       * MOBILITY components too. Their icons turned amber — *"the logos changed
       * from the grey to amber"* — and the day read as finished, so he
       * *"couldn't then log the gym session"*.
       *
       * So this save names its ONE component. Everything already recorded for
       * the other components is carried through untouched, and the gym halves
       * of a first-time save stay UNANSWERED rather than being claimed.
       */
      const teamComponent = getSessionComponents(workout ?? null)
        .find((component) => component.kind === 'team_training');
      const feedback: SessionFeedback = {
        ...(existing ?? {}),
        dateStr: date,
        completion: existing?.completion ?? completion,
        components: [
          ...(existing?.components ?? []).filter(
            (entry: { componentId: string }) => entry.componentId !== teamComponent?.id,
          ),
          ...(teamComponent
            ? [{
              componentId: teamComponent.id,
              kind: teamComponent.kind,
              label: teamComponent.label,
              completion,
              partialReason: null,
              skipReason: null,
            }]
            : []),
        ],
        ...(attended && duration.valid && isSessionEffortRating(effort)
          ? { teamTraining: { durationMinutes: duration.totalMinutes, effort } }
          : { teamTraining: undefined }),
      } as SessionFeedback;
      const result = await commitSessionOutcomeTransaction(
        createRecordSessionOutcomeIntentFromFeedback({
          date,
          feedback,
          workout,
          source: {
            entryPoint: 'tap',
            surface: 'club_training_feedback_panel',
          },
        }),
      );
      if (!result.ok) {
        setSaveRefusal('reason' in result
          ? result.reason
          : "Something went wrong saving that. Nothing was recorded — please try again.");
        return;
      }
      onSave?.(result.receipt);
    } catch (error) {
      logger.error('[ClubTrainingFeedbackPanel] the save threw', { date, error });
      setSaveRefusal("Something went wrong saving that. Nothing was recorded — please try again.");
    }
  }, [attended, canSave, completion, date, duration.totalMinutes, duration.valid,
    effort, existing, onSave, workout]);

  return (
    <View testID="club-training-feedback-panel">
      <SectionLabel style={styles.section}>
        {signedCopy('session.club_training.completion_question')}
      </SectionLabel>
      <View style={styles.row}>
        {COMPLETION_OPTIONS.map((opt) => (
          <FeedbackChip
            key={opt.key}
            testID={`club-training-completion-${opt.key}`}
            label={opt.label}
            selected={completion === opt.key}
            selectedColor={colors.accent.lime}
            onPress={() => setCompletion(completion === opt.key ? null : opt.key)}
          />
        ))}
      </View>

      {attended ? (
        <>
          <SectionLabel style={styles.section}>
            {TEAM_TRAINING_FEEDBACK_COPY.durationQuestion}
          </SectionLabel>
          <View style={styles.gameDurationRow}>
            <View style={styles.gameDurationField}>
              <Text style={styles.metricLabel}>{GAME_FEEDBACK_COPY.minutes}</Text>
              <AppTextInput
                testID="club-training-feedback-minutes"
                style={styles.gameDurationInput}
                value={minutes}
                onChangeText={setMinutes}
                placeholder="90"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          <SectionLabel style={styles.section}>
            {TEAM_TRAINING_FEEDBACK_COPY.effortQuestion}
          </SectionLabel>
          <Text style={styles.rpeHint}>{TEAM_TRAINING_FEEDBACK_COPY.effortHint}</Text>
          <EffortSlider
            testID="club-training-feedback-effort-grid"
            value={effort}
            onChange={setEffort}
          />
        </>
      ) : null}

      {saveRefusal ? <Text style={styles.inputError}>{saveRefusal}</Text> : null}
      {recordableRefusal ? <Text style={styles.inputError}>{recordableRefusal.message}</Text> : null}
      {completion !== null && !canSave && decision.blockedBy[0] !== 'not_recordable' ? (
        <Text testID="club-training-blocked-reason" style={styles.inputError}>
          {clubTrainingSaveBlockCopy(decision.blockedBy[0])}
        </Text>
      ) : null}

      {/* The button that set the pattern, now wearing the shared label and the
          shared size. It was 48pt tall and said "Save" while the other two were
          56 and said two other things. */}
      <View style={styles.saveRow}>
        <Button
          label={signedCopy('feedback.save_action')}
          testID="club-training-feedback-save"
          disabled={!canSave}
          onPress={handleSave}
          variant="primary"
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
};

/**
 * ⚠ **EXPORTED 2026-08-22 SO THE PROGRAM SCREEN CAN POP IT UP.** Sam: *"Fix the
 * game feedback form - it now takes you inside a session view that doesn't need
 * to be there - it should just be a pop up like it is for team training"*.
 *
 * The Program screen mounts THIS panel rather than `SessionFeedbackPanel`,
 * which chooses between the game and training presentations by classifying the
 * workout it is handed. **A fixture may carry no workout at all** — the old
 * route had a branch for exactly that case — and an unclassifiable day would
 * fall to the TRAINING form, which is the wrong questions on a match day. The
 * day view already knows it is a game; naming the panel says so, instead of
 * asking a shared dispatcher to re-derive it from data that may be missing.
 */
export const GameSessionFeedbackPanel: React.FC<Props> = ({ date, workout, onSave }) => {
  const existing = useProgramStore((state: any) => state.sessionFeedback[date]) as
    | SessionFeedback
    | undefined;
  const initialGame = existing?.game;
  const [playedWholeGame, setPlayedWholeGame] = useState<boolean | null>(
    initialGame?.playedWholeGame ?? null,
  );
  const [minutes, setMinutes] = useState(
    initialGame ? String(initialGame.timeOnGroundMinutes) : '',
  );
  const [bodyRpe, setBodyRpe] = useState<number | null>(initialGame?.bodyRpe ?? null);
  const [gameFeel, setGameFeel] = useState<FeedbackGameFeel | null>(
    initialGame?.feel ?? existing?.gameFeel ?? null,
  );
  const [saveRefusal, setSaveRefusal] = useState<string | null>(null);

  useEffect(() => {
    const game = existing?.game;
    setPlayedWholeGame(game?.playedWholeGame ?? null);
    setMinutes(game ? String(game.timeOnGroundMinutes) : '');
    setBodyRpe(game?.bodyRpe ?? null);
    setGameFeel(game?.feel ?? existing?.gameFeel ?? null);
    setSaveRefusal(null);
  }, [date, existing]);

  const gameDuration = parseSessionDurationMinutes(minutes);
  const validDuration = gameDuration.valid;
  const timeOnGroundMinutes = gameDuration.totalMinutes;
  const recordableRefusal = sessionOutcomeRecordableRefusal(date);
  const canSave = playedWholeGame !== null
    && validDuration
    && bodyRpe !== null
    && gameFeel !== null
    && !recordableRefusal;

  const handleSave = useCallback(async () => {
    if (!canSave || playedWholeGame === null || bodyRpe === null || gameFeel === null) return;
    setSaveRefusal(null);
    const game: GameSessionOutcome = {
      playedWholeGame,
      timeOnGroundMinutes,
      bodyRpe,
      feel: gameFeel,
    };
    try {
      const feedback: SessionFeedback = {
        ...(existing ?? {}),
        dateStr: date,
        completion: existing?.completion ?? 'full',
        game,
      };
      const result = await commitSessionOutcomeTransaction(
        createRecordSessionOutcomeIntentFromFeedback({
          date,
          feedback,
          workout,
          source: {
            entryPoint: 'tap',
            surface: 'game_feedback_panel',
          },
        }),
      );
      if (!result.ok) {
        setSaveRefusal('reason' in result
          ? result.reason
          : "Something went wrong saving that. Nothing was recorded — please try again.");
        return;
      }
      const traceId = result.receipt.source.traceId;
      if (traceId) {
        registerAthleteActionUIOutcome({
          traceId,
          observationId: `game-feedback-render:${traceId}`,
          domainReturn: {
            transactionId: result.receipt.transactionId,
            sessionIdentity: result.receipt.sessionIdentity,
            componentIds: result.receipt.componentIds,
          },
          controlId: explorerTestId.feedbackReceipt(result.receipt.transactionId),
        });
      }
      onSave?.(result.receipt);
    } catch (error) {
      logger.error('[GameSessionFeedbackPanel] the save threw', { date, error });
      setSaveRefusal("Something went wrong saving that. Nothing was recorded — please try again.");
    }
  }, [
    bodyRpe,
    canSave,
    date,
    existing,
    gameFeel,
    onSave,
    playedWholeGame,
    timeOnGroundMinutes,
    workout,
  ]);

  return (
    /* ── ONE SHELL FOR ALL THREE FEEDBACK FORMS — Sam, 2026-08-22 ──
       *"can you make sure that the team training feedback, game feedback, and
       programmed session feedback pop ups are all the same style, fonts, and
       generally consistent"*.
       THE CARD IS GONE. This form drew a raised, rounded Card INSIDE the sheet
       — a box in a box — so its questions started 48pt from the screen edge
       while club training's started at 24. The club form is the shape all three
       take now: a plain body on the sheet's own surface, with the sheet's
       header above it. Same for the heading: it is `SheetHeader`'s job on every
       one of the three, so the form no longer titles itself. */
    <View testID="game-feedback-panel">
      <SectionLabel style={styles.section}>{GAME_FEEDBACK_COPY.wholeQuestion}</SectionLabel>
      <View style={styles.row}>
        <FeedbackChip
          testID="game-feedback-whole-yes"
          label={GAME_FEEDBACK_COPY.wholeYes}
          selected={playedWholeGame === true}
          selectedColor={colors.accent.lime}
          onPress={() => setPlayedWholeGame(true)}
        />
        <FeedbackChip
          testID="game-feedback-whole-no"
          label={GAME_FEEDBACK_COPY.wholeNo}
          selected={playedWholeGame === false}
          selectedColor={colors.accent.lime}
          onPress={() => setPlayedWholeGame(false)}
        />
      </View>

      <SectionLabel style={styles.section}>{GAME_FEEDBACK_COPY.durationQuestion}</SectionLabel>
      <View style={styles.gameDurationRow}>
        <View style={styles.gameDurationField}>
          <Text style={styles.metricLabel}>{GAME_FEEDBACK_COPY.minutes}</Text>
          <AppTextInput
            testID="game-feedback-minutes"
            style={styles.gameDurationInput}
            value={minutes}
            onChangeText={setMinutes}
            placeholder="80"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numeric"
            maxLength={3}
          />
        </View>
      </View>

      <SectionLabel style={styles.section}>{GAME_FEEDBACK_COPY.rpeQuestion}</SectionLabel>
      <Text style={styles.rpeHint}>{GAME_FEEDBACK_COPY.rpeHint}</Text>
      <EffortSlider
        testID="game-feedback-rpe-grid"
        value={bodyRpe}
        onChange={setBodyRpe}
      />

      <SectionLabel style={styles.section}>{GAME_FEEDBACK_COPY.feelQuestion}</SectionLabel>
      {/* ── FIVE ON ONE LINE — Sam, 2026-08-22: *"how did you feel buttons
          should fit on 1 line"*. They wrapped, so "Heavy" sat alone on a second
          row and read like a different question's answer.
          `fillRow` IS NOT NEW — the chip has always had it and nothing used it:
          each chip takes an equal fifth of the row, the row stops wrapping, and
          the label shrinks a fraction rather than truncating. "Normal" is the
          word that decides the width, and at five chips on a 402pt screen it
          needs about 0.85 of its size. */}
      <View style={[styles.row, styles.feelRow]}>
        {[...GAME_FEEL_OPTIONS].reverse().map((option) => (
          <FeedbackChip
            key={option.key}
            testID={`game-feedback-feel-${option.key}`}
            label={option.label}
            selected={gameFeel === option.key}
            selectedColor={colors.accent.lime}
            onPress={() => setGameFeel(option.key)}
            fillRow
          />
        ))}
      </View>

      {saveRefusal ? (
        <View style={styles.saveRefusalRow} testID="game-feedback-save-refusal">
          <Text style={styles.saveRefusalText}>{saveRefusal}</Text>
        </View>
      ) : null}
      {recordableRefusal ? (
        <View style={styles.saveRefusalRow} testID="game-feedback-not-yet">
          <Text style={styles.saveRefusalText}>{recordableRefusal.message}</Text>
        </View>
      ) : null}
      {/* ── ONE SAVE BUTTON, ALWAYS ON SCREEN — Sam, 2026-08-22 ──
          He chose the club form's behaviour for all three: the button is there
          from the start and greyed until the answers are in, rather than
          appearing out of nowhere when the last question is answered. It cannot
          be pressed while `canSave` is false, so the door is still never
          offered an act it would refuse — and the refusal above says why. */}
      <View style={styles.saveRow}>
        <Button
          label={signedCopy('feedback.save_action')}
          testID={explorerTestId.feedbackSave(workout?.id ?? date)}
          onPress={handleSave}
          disabled={!canSave}
          variant="primary"
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
};

const TrainingSessionFeedbackPanel: React.FC<Props> = ({
  date,
  workout,
  executionSummary,
  onSave,
}) => {
  const existing = useProgramStore((s: any) => s.sessionFeedback[date]) as
    | SessionFeedback
    | undefined;
  const weightOverrides = useProgramStore((s: any) => s.weightOverrides[date]);
  const bodyWeightKg = useProfileStore((s) => s.onboardingData?.weightKg);
  const trackedLiftChoices = useProfileStore((s) => s.trackedLiftChoices);
  const loggedSets = useWorkoutLogStore((s) => s.loggedSets);
  const activeLoggedWorkout = useWorkoutLogStore((s) => s.activeWorkout);
  const [lastSetDrafts, setLastSetDrafts] = useState<Record<string, LastSetEstimateInput>>({});
  const conditioningConfig = useMemo(
    () => getConditioningLoggingConfig(workout),
    [workout],
  );
  /**
   * ⚠ **THE GYM FORM'S COMPONENTS ARE THE GYM'S — CLUB TRAINING IS FILTERED
   * OUT** (Sam, 2026-08-21/22).
   *
   * `getSessionComponents` still returns `team_training` for a club night, and
   * it must: the club form itself uses that entry to name what it is writing.
   * But this form asking *"Did you complete team training?"* is the very thing
   * the split removed, and worse — the gym save would then write a completion
   * for a component the athlete answered in the OTHER form, overwriting it.
   *
   * Filtered HERE rather than in the owner, because the owner is right: the
   * component exists. What changed is who asks about it.
   */
  const sessionComponents = useMemo(
    () => getSessionComponents(workout).filter(
      (component) => component.kind !== 'team_training',
    ),
    [workout],
  );
  const existingDraft = draftFromExistingFeedback(existing, sessionComponents);

  const [feeling, setFeeling] = useState<FeedbackFeeling | null>(existingDraft.feeling);
  const [soreness, setSoreness] = useState<FeedbackSoreness | null>(existingDraft.soreness);
  const [completion, setCompletion] = useState<FeedbackCompletion | null>(existingDraft.completion);
  const [componentCompletions, setComponentCompletions] = useState<
    Record<string, FeedbackCompletion | null>
  >(existingDraft.componentCompletions ?? {});
  const [componentReasons, setComponentReasons] = useState<
    Record<string, ComponentFeedbackReasonState>
  >(existingDraft.componentReasons ?? {});
  const [teamNightSize, setTeamNightSize] = useState<TeamNightSize | null>(
    existing?.teamNightSize ?? null,
  );
  const [gameFeel, setGameFeel] = useState<FeedbackGameFeel | null>(
    existing?.gameFeel ?? null,
  );
  const [expectation, setExpectation] = useState<FeedbackExpectation | null>(
    existing?.expectation ?? null,
  );
  const [expectationReason, setExpectationReason] = useState<FeedbackExpectationReason | null>(
    existing?.expectationReason ?? null,
  );
  const [partialReason, setPartialReason] = useState(existingDraft.partialReason);
  const [skipReason, setSkipReason] = useState(existingDraft.skipReason);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!existing?.notes);
  const [conditioningMode, setConditioningMode] = useState<ConditioningLogMode | null>(
    existing?.conditioning?.mode ?? conditioningConfig.suggestedMode ?? null,
  );
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(
    textFromNumber(existing?.conditioning?.totalTimeMinutes),
  );
  const [distanceMeters, setDistanceMeters] = useState(
    textFromNumber(existing?.conditioning?.distanceMeters),
  );
  const [calories, setCalories] = useState(textFromNumber(existing?.conditioning?.calories));
  const [roundsCompleted, setRoundsCompleted] = useState(
    textFromNumber(existing?.conditioning?.roundsCompleted),
  );
  const [intervalsCompleted, setIntervalsCompleted] = useState(
    textFromNumber(existing?.conditioning?.intervalsCompleted),
  );
  const [bestInterval, setBestInterval] = useState(existing?.conditioning?.bestInterval ?? '');
  const [averagePace, setAveragePace] = useState(existing?.conditioning?.averagePace ?? '');
  const [conditioningRpe, setConditioningRpe] = useState(
    textFromNumber(existing?.conditioning?.rpe),
  );
  const [sessionRpe, setSessionRpe] = useState<number | null>(
    isSessionEffortRating(existing?.difficulty) ? existing.difficulty : null,
  );
  // THE STRENGTH SESSION'S ACTUAL DURATION (seat item 18, Sam's option (a)).
  // Seeded from what was stored, so re-opening a logged session shows the
  // athlete their own answer rather than an empty box.
  //
  // R-132 (Sam, 2026-08-23): when nothing is stored yet and the athlete TIMED
  // the session with the header stopwatch, the measured minutes seed the box —
  // *"makes putting in the feed back form very easy"*. The stored answer
  // always outranks the measurement; the athlete can still edit either.
  const stopwatchMinutes = useMemo(
    () => workout ? measuredMinutesFor({
      workoutId: workout.id,
      dateISO: date,
      nowISO: new Date().toISOString(),
    }) : null,
    [date, workout?.id],
  );
  const seededMinutes = existing?.actualMinutes ?? stopwatchMinutes;
  const [strengthMinutes, setStrengthMinutes] = useState(
    seededMinutes ? String(seededMinutes) : '',
  );

  // Re-sync local state when navigating to a different date
  useEffect(() => {
    const nextDraft = draftFromExistingFeedback(existing, sessionComponents);
    const conditioning = existing?.conditioning;
    setFeeling(nextDraft.feeling);
    setSoreness(nextDraft.soreness);
    setCompletion(nextDraft.completion);
    setComponentCompletions(nextDraft.componentCompletions ?? {});
    setComponentReasons(nextDraft.componentReasons ?? {});
    setTeamNightSize(existing?.teamNightSize ?? null);
    setGameFeel(existing?.gameFeel ?? null);
    setExpectation(existing?.expectation ?? null);
    setExpectationReason(existing?.expectationReason ?? null);
    setPartialReason(nextDraft.partialReason);
    setSkipReason(nextDraft.skipReason);
    setNotes(existing?.notes ?? '');
    setShowNotes(!!existing?.notes);
    setConditioningMode(conditioning?.mode ?? conditioningConfig.suggestedMode ?? null);
    setTotalTimeMinutes(textFromNumber(conditioning?.totalTimeMinutes));
    setDistanceMeters(textFromNumber(conditioning?.distanceMeters));
    setCalories(textFromNumber(conditioning?.calories));
    setRoundsCompleted(textFromNumber(conditioning?.roundsCompleted));
    setIntervalsCompleted(textFromNumber(conditioning?.intervalsCompleted));
    setBestInterval(conditioning?.bestInterval ?? '');
    setAveragePace(conditioning?.averagePace ?? '');
    setConditioningRpe(textFromNumber(conditioning?.rpe));
    setSessionRpe(isSessionEffortRating(existing?.difficulty) ? existing.difficulty : null);
    setStrengthMinutes(seededMinutes ? String(seededMinutes) : '');
  }, [date, existing, sessionComponents, conditioningConfig.suggestedMode, seededMinutes]);

  const feedbackDraft: FeedbackFormDraft = {
    completion,
    componentCompletions,
    componentReasons,
    teamNightSize,
    gameFeel,
    expectation,
    expectationReason,
    feeling,
    soreness,
    partialReason,
    skipReason,
  };
  const activeComponents = executionSummary?.components ?? sessionComponents;
  const activeComponentCompletions = executionSummary?.componentCompletions ?? componentCompletions;
  const activeCompletion = executionSummary
    ? deriveSessionExecutionCompletion(executionSummary)
    : deriveAggregateCompletion(
        activeComponents,
        activeComponentCompletions,
        completion,
      );
  const sessionRpeValue = sessionRpe ?? undefined;
  const isTeamNight = useMemo(() => isTeamTrainingSession(workout), [workout]);
  const teamTrainingCompletion = executionSummary?.sections
    .find((section) => section.sectionId === 'team_training')?.completion
    ?? activeComponentCompletions.team_training
    ?? null;
  const teamTrainingWasPerformed = isTeamNight && (
    teamTrainingCompletion === 'full' || teamTrainingCompletion === 'partial'
  );
  // THE SAME PARSER THE OTHER TWO USE — not a second design, per the order.
  const strengthDuration = parseSessionDurationMinutes(strengthMinutes);
  const strengthAnswered = strengthMinutes.trim() !== '';
  // OPTIONAL, AND THAT IS THE RULING'S OWN SHAPE. A session missing the answer
  // is UNMEASURED (Sam chose (a) over (b)), so a blank must not block the save —
  // blocking would strand an athlete who simply did not time their session.
  const strengthActualMinutes = strengthAnswered && strengthDuration.valid
    ? strengthDuration.totalMinutes
    : undefined;
  const baseDraftIsComplete = executionSummary
    ? activeCompletion !== null &&
      (activeCompletion === 'skipped' || isSessionEffortRating(sessionRpeValue))
    : canSaveFeedbackDraft({ ...feedbackDraft, completion: activeCompletion });
  /**
   * ⚠ **THE GYM FORM NO LONGER WAITS ON CLUB TRAINING, AND THAT WAS A LIVE BUG.**
   *
   * This read `&& (!teamTrainingWasPerformed || teamTrainingOutcome !== undefined)`,
   * so on a club night the gym feedback COULD NOT BE SAVED AT ALL until the
   * club duration and effort were both filled in. An athlete who lifted in the
   * morning and had not been to training yet was simply stuck.
   *
   * Splitting the forms is what removes it: each door now saves what it asked.
   */
  const draftIsComplete = baseDraftIsComplete;
  // THE DOOR'S OWN RULE, ASKED — never re-implemented here (finding 4). A
  // control offered for an act its door will refuse is a dead control, and the
  // athlete taps it and nothing happens.
  const recordableRefusal = sessionOutcomeRecordableRefusal(date);
  const canSave = draftIsComplete && !recordableRefusal;
  // A refusal the athlete must be TOLD about. `null` until a save is refused;
  // the door's authored sentence, never a second one written here.
  const [saveRefusal, setSaveRefusal] = useState<string | null>(null);
  const hasComponentFlow = sessionComponents.length > 0;
  const conditioningComponentCompletion = activeComponentCompletions.conditioning ?? completion;
  const strengthComponentCompletion = activeComponentCompletions.strength ?? activeCompletion;
  const lastSetInputs = buildLastSetFeedbackInputs({
    date, workout, choices: trackedLiftChoices,
    loggedSets: activeLoggedWorkout?.id === workout?.id
      ? collectLoggedStrengthSets(workout, loggedSets, activeLoggedWorkout?.id) : undefined,
    executionItems: executionSummary?.items,
    completion: strengthComponentCompletion,
    bodyWeightKg, existing: existing?.strength, weightOverrides,
  }).map((input) => lastSetDrafts[input.workoutExerciseId]?.setId === input.setId
    ? lastSetDrafts[input.workoutExerciseId] : input);
  const conditioningWasPerformed =
    conditioningComponentCompletion === 'full' ||
    conditioningComponentCompletion === 'partial';
  // DERIVED, not a new prop. The panel already resolves the workout, and
  // `isTeamTrainingSession` is the app's existing owner of "is this a team night" — a
  // second answer threaded down from a caller is exactly the two-owners shape the repo
  // keeps paying for.
  // THE SAME MOVE FOR "IS THIS A GAME", AND IT NEEDED SAYING OUT LOUD: the app
  // has FOUR spellings of that predicate today (`coachCommandRouter:1326`,
  // `scheduleDebug:379`, `weekStructureValidator:127`,
  // `projectVisibleWeek:137`) and no owner. `classifyDaySessions` IS the owner —
  // its own header says detection has one home — so this asks it rather than
  // adding a fifth `workoutType === 'Game'`.
  const isGameDay = useMemo(
    () => classifyDaySessions(workout).some((unit) => unit.category === 'game'),
    [workout],
  );
  const visibleSections = useMemo(
    () => getVisibleFeedbackSections(activeCompletion, {
      includeConditioningPerformance:
        conditioningConfig.level === 'trackable' && conditioningWasPerformed,
      isTeamTrainingDay: isTeamNight,
      isGameDay,
      expectation,
    }),
    [activeCompletion, conditioningConfig.level, conditioningWasPerformed, isTeamNight,
      isGameDay, expectation],
  );
  const hasSection = useCallback(
    (id: FeedbackFormSectionId) => visibleSections.some((section) => section.id === id),
    [visibleSections],
  );
  const showConditioningPerformance = hasSection('conditioning');

  const resetConditioningFields = useCallback(() => {
    setConditioningMode(conditioningConfig.suggestedMode ?? null);
    setTotalTimeMinutes('');
    setDistanceMeters('');
    setCalories('');
    setRoundsCompleted('');
    setIntervalsCompleted('');
    setBestInterval('');
    setAveragePace('');
    setConditioningRpe('');
  }, [conditioningConfig.suggestedMode]);

  const handleCompletionChange = useCallback((nextCompletion: FeedbackCompletion) => {
    const nextDraft = sanitizeFeedbackDraftForCompletion(
      {
        completion,
        componentCompletions,
        componentReasons,
        feeling,
        soreness,
        partialReason,
        skipReason,
      },
      nextCompletion,
    );
    setCompletion(nextDraft.completion);
    setFeeling(nextDraft.feeling);
    setSoreness(nextDraft.soreness);
    setPartialReason(nextDraft.partialReason);
    setSkipReason(nextDraft.skipReason);
    if (nextCompletion === 'skipped') {
      resetConditioningFields();
    }
  }, [
    completion,
    componentCompletions,
    componentReasons,
    feeling,
    soreness,
    partialReason,
    skipReason,
    resetConditioningFields,
  ]);

  const handleComponentCompletionChange = useCallback((
    componentId: string,
    nextCompletion: FeedbackCompletion,
  ) => {
    const nextComponentCompletions = {
      ...componentCompletions,
      [componentId]: nextCompletion,
    };
    const nextDraft = sanitizeFeedbackDraftForComponents(
      {
        completion: deriveAggregateCompletion(
          sessionComponents,
          nextComponentCompletions,
          completion,
        ),
        componentCompletions: nextComponentCompletions,
        componentReasons,
        feeling,
        soreness,
        partialReason,
        skipReason,
      },
      sessionComponents,
    );

    setComponentCompletions(nextDraft.componentCompletions ?? {});
    setComponentReasons(nextDraft.componentReasons ?? {});
    setCompletion(nextDraft.completion);
    setFeeling(nextDraft.feeling);
    setSoreness(nextDraft.soreness);
    setPartialReason(nextDraft.partialReason);
    setSkipReason(nextDraft.skipReason);

    const nextConditioningCompletion =
      nextDraft.componentCompletions?.conditioning ?? nextDraft.completion;
    if (
      nextDraft.completion === 'skipped' ||
      (componentId === 'conditioning' && nextConditioningCompletion === 'skipped')
    ) {
      resetConditioningFields();
    }
  }, [
    componentCompletions,
    componentReasons,
    sessionComponents,
    completion,
    feeling,
    soreness,
    partialReason,
    skipReason,
    resetConditioningFields,
  ]);

  const setComponentReason = useCallback((
    componentId: string,
    reason: ComponentFeedbackReasonState,
  ) => {
    const nextReasons = sanitizeComponentReasons(
      {
        ...componentReasons,
        [componentId]: reason,
      },
      activeComponentCompletions,
      sessionComponents,
    );
    setComponentReasons(nextReasons);
  }, [componentReasons, activeComponentCompletions, sessionComponents]);

  const handleComponentPartialReasonChange = useCallback((
    componentId: string,
    nextReason: NonNullable<ComponentFeedbackReasonState['partialReason']>,
  ) => {
    setComponentReason(componentId, {
      partialReason: nextReason,
      skipReason: null,
    });
  }, [setComponentReason]);

  const handleComponentSkipReasonChange = useCallback((
    componentId: string,
    nextReason: NonNullable<ComponentFeedbackReasonState['skipReason']>,
  ) => {
    setComponentReason(componentId, {
      partialReason: null,
      skipReason: nextReason,
    });
  }, [setComponentReason]);

  const buildConditioningLog = useCallback((): ConditioningPerformanceLog | undefined => {
    if (!showConditioningPerformance) return undefined;

    const log: ConditioningPerformanceLog = {
      sessionName: conditioningConfig.title,
    };
    if (conditioningMode) log.mode = conditioningMode;

    const parsedTime = parseNumberField(totalTimeMinutes);
    const parsedDistance = parseNumberField(distanceMeters);
    const parsedCalories = parseNumberField(calories);
    const parsedRounds = parseIntegerField(roundsCompleted);
    const parsedIntervals = parseIntegerField(intervalsCompleted);
    const parsedRpe = parseRpe(conditioningRpe);

    if (parsedTime !== undefined) log.totalTimeMinutes = parsedTime;
    if (parsedDistance !== undefined) log.distanceMeters = parsedDistance;
    if (parsedCalories !== undefined) log.calories = parsedCalories;
    if (parsedRounds !== undefined) log.roundsCompleted = parsedRounds;
    if (parsedIntervals !== undefined) log.intervalsCompleted = parsedIntervals;
    if (bestInterval.trim()) log.bestInterval = bestInterval.trim();
    if (averagePace.trim()) log.averagePace = averagePace.trim();
    if (parsedRpe !== undefined) log.rpe = parsedRpe;

    return Object.keys(log).length > 1 ? log : undefined;
  }, [
    showConditioningPerformance,
    conditioningConfig.title,
    conditioningMode,
    totalTimeMinutes,
    distanceMeters,
    calories,
    roundsCompleted,
    intervalsCompleted,
    bestInterval,
    averagePace,
    conditioningRpe,
  ]);

  const handleSave = useCallback(async () => {
    if (!canSave || !activeCompletion) return;
    setSaveRefusal(null);
    try {
    const conditioning = buildConditioningLog();
    const conditioningRpeValue = conditioning?.rpe;
    const strengthCompletion =
      strengthComponentCompletion === 'full' || strengthComponentCompletion === 'partial'
        ? strengthComponentCompletion
        : null;
    const logState = useWorkoutLogStore.getState();
    const loggedStrengthSets = collectLoggedStrengthSets(
      workout,
      logState.loggedSets,
      logState.activeWorkout?.id,
    );
    const strength = !strengthCompletion
      ? []
      : buildStrengthPerformanceLogs(
          workout,
          weightOverrides,
          strengthCompletion,
          loggedStrengthSets,
          { bodyWeightKg, lastSetInputs },
        );
    const feedback = buildSessionFeedbackPayload({
      dateStr: date,
      completion: activeCompletion,
      componentCompletions: activeComponentCompletions,
      componentReasons,
      components: activeComponents,
      // Only ever sent on a team night. `isTeamNight` is the same flag that decides
      // whether the question was ASKED, so the app cannot store an answer to a question
      // it did not put on the screen.
      teamNightSize: isTeamNight ? teamNightSize : null,
      // THE SAME GUARD, FOR THE SAME REASON. `isGameDay` is the flag that decided
      // whether the question was ASKED, so it is the flag that decides whether the
      // answer is SENT — the app cannot store a body-feel rating for a session it
      // never asked about.
      gameFeel: isGameDay ? gameFeel : null,
      expectation,
      // A REASON WITHOUT ITS EXPECTATION IS AN ANSWER TO NO QUESTION. The draft
      // gate refuses the half-answered pair; this stops a stale reason riding
      // along after the athlete taps back to "as expected".
      expectationReason: expectationAsksWhy(expectation) ? expectationReason : null,
      feeling,
      soreness,
      partialReason,
      skipReason,
      notes,
      difficulty: executionSummary ? sessionRpeValue : conditioningRpeValue,
      // Only sent on the strength (checklist) path — the flag that decides
      // whether the question is ASKED decides whether the answer is SENT.
      actualMinutes: executionSummary ? strengthActualMinutes : undefined,
      executionItems: executionSummary?.items,
      /**
       * ⚠ **CARRIED FORWARD, NOT RE-COLLECTED — AND OMITTING IT WOULD HAVE
       * ERASED IT.** The feedback payload is rebuilt from scratch on every
       * save, so with the club questions gone from this form, passing the
       * (now always empty) local state would drop a club answer the athlete
       * had already logged the moment they saved their gym session.
       *
       * `ClubTrainingFeedbackPanel` owns collecting it; this form's job is to
       * hand the stored value straight back so one door cannot silently undo
       * the other. Both write the same record — Sam: *"two forms saved
       * together to be calculated in the one place"*.
       */
      teamTraining: existing?.teamTraining,
      conditioning,
      strength,
    });
    if (!feedback) {
      // NOT a bare return. The draft passed its own gate and still produced no
      // payload, which is a defect in this panel, not an athlete mistake — but
      // the athlete is the one holding the phone, so they get told.
      setSaveRefusal("Something went wrong saving that. Nothing was recorded — please try again.");
      return;
    }
    const result = await commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date,
        feedback,
        workout,
        source: {
          entryPoint: 'tap',
          surface: 'session_feedback_panel',
        },
      }),
    );
    if (!result.ok) {
      // THE REFUSAL IS THE DOOR'S TO WORD. Every code it can answer reaches the
      // athlete now; the future-session one is gated out above, and the rest —
      // which no gate can predict — say what happened instead of nothing.
      // `in` rather than the discriminant: this scope's narrowing does not
      // survive the compile scope's settings, and a cast would hide a real
      // shape change in the door's result.
      const reason = 'reason' in result ? result.reason : null;
      setSaveRefusal(reason
        || "Something went wrong saving that. Nothing was recorded — please try again.");
      return;
    }
    const traceId = result.receipt.source.traceId;
    if (traceId) {
      registerAthleteActionUIOutcome({
        traceId,
        observationId: `session-feedback-render:${traceId}`,
        domainReturn: {
          transactionId: result.receipt.transactionId,
          sessionIdentity: result.receipt.sessionIdentity,
          componentIds: result.receipt.componentIds,
        },
        controlId: explorerTestId.feedbackReceipt(result.receipt.transactionId),
      });
    }
    onSave?.(result.receipt);
    } catch (error) {
      // AN UNGUARDED `await` IN AN onPress IS A DEAD BUTTON. A throw anywhere in
      // the chain above used to become an unhandled rejection and the tap simply
      // did nothing — the same silence that hid the armour wrappers' crash
      // (2026-08-03). It is an answer now.
      logger.error('[SessionFeedbackPanel] the save threw', { date, error });
      setSaveRefusal("Something went wrong saving that. Nothing was recorded — please try again.");
    }
  }, [
    canSave,
    activeCompletion,
    componentCompletions,
    activeComponentCompletions,
    componentReasons,
    sessionComponents,
    activeComponents,
    feeling,
    soreness,
    strengthComponentCompletion,
    partialReason,
    skipReason,
    buildConditioningLog,
    workout,
    weightOverrides,
    bodyWeightKg,
    lastSetInputs,
    notes,
    date,
    onSave,
    executionSummary,
    sessionRpeValue,
    /* `teamTrainingOutcome` left this list with the questions it came from. The
       save now reads `existing?.teamTraining`, and `existing` is already a
       dependency above. */
  ]);

  const renderComponentReasonGroup = useCallback((component: SessionComponent) => {
    const componentCompletion = componentCompletions[component.id];
    const reason = componentReasons[component.id];

    if (componentCompletion === 'partial') {
      return (
        <View>
          <SectionLabel style={styles.componentReasonSection}>
            {componentPartialReasonLabel(component)}
          </SectionLabel>
          <View style={styles.row}>
            {PARTIAL_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-${stableTestIdToken(component.id)}-partial-reason-${opt.key}`}
                label={opt.label}
                selected={reason?.partialReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => handleComponentPartialReasonChange(component.id, opt.key)}
              />
            ))}
          </View>
        </View>
      );
    }

    if (componentCompletion === 'skipped') {
      return (
        <View>
          <SectionLabel style={styles.componentReasonSection}>
            {componentSkipReasonLabel(component)}
          </SectionLabel>
          <View style={styles.row}>
            {SKIP_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-${stableTestIdToken(component.id)}-skip-reason-${opt.key}`}
                label={opt.label}
                selected={reason?.skipReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => handleComponentSkipReasonChange(component.id, opt.key)}
              />
            ))}
          </View>
        </View>
      );
    }

    return null;
  }, [
    componentCompletions,
    componentReasons,
    handleComponentPartialReasonChange,
    handleComponentSkipReasonChange,
  ]);

  return (
    /* THE SAME SHELL AS THE OTHER TWO (Sam, 2026-08-22) — see the note on the
       game panel above. This form's own eyebrow, heading and grey sub-line are
       gone: three lines of chrome the club form never had, and the last of them
       was the "subtitle under 'log session'" Sam had already removed once, from
       the sheet header, while the panel kept drawing its own copy. */
    <View testID="session-feedback-panel">
      {executionSummary ? (
        <>
          <View style={styles.checklistSummary} testID="session-feedback-checklist-summary">
            <Text style={styles.checklistSummaryTitle}>
              {activeCompletion === 'full'
                ? 'Everything completed'
                : activeCompletion === 'partial'
                  ? 'Part of the session completed'
                  : 'No session items completed'}
            </Text>
            {executionSummary.sections.map((section) => (
              <View key={section.sectionId} style={styles.checklistSummaryRow}>
                <Text style={styles.checklistSummaryLabel}>{section.label}</Text>
                <Text style={styles.checklistSummaryValue}>
                  {/* SAM, 2026-08-22: *"next to those words should be the
                      number of exercises I did ... Mobility / Warm-up
                      Partially 3/4"*. The word came from the raw completion
                      value with `textTransform: 'capitalize'` doing the work,
                      which gave "Partial" rather than the "Partially" the
                      athlete taps three lines further up. It reads the SAME
                      `COMPLETION_OPTIONS` labels that door uses, so the review
                      and the answer cannot word the same state differently. */}
                  {COMPLETION_OPTIONS.find((option) => option.key === section.completion)?.label
                    ?? section.completion}
                  {` ${section.completedCount}/${section.totalCount}`}
                </Text>
              </View>
            ))}
          </View>
          {activeCompletion !== 'skipped' ? (
            <>
              <SectionLabel style={styles.section}>How hard was the session?</SectionLabel>
              <Text style={styles.rpeHint}>1 = very easy · 10 = very hard</Text>
              <EffortSlider
                testID="session-feedback-rpe-grid"
                value={sessionRpe}
                onChange={setSessionRpe}
              />
              <SectionLabel style={styles.section}>
                {STRENGTH_FEEDBACK_COPY.durationQuestion}
              </SectionLabel>
              <View style={styles.gameDurationRow}>
                <View style={styles.gameDurationField}>
                  <Text style={styles.metricLabel}>{GAME_FEEDBACK_COPY.minutes}</Text>
                  <AppTextInput
                    testID="strength-feedback-minutes"
                    style={styles.gameDurationInput}
                    value={strengthMinutes}
                    onChangeText={setStrengthMinutes}
                    placeholder="60"
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
              </View>
              {lastSetInputs.map((input) => <LastSetRirQuestion key={input.setId} input={input}
                onChange={(next) => setLastSetDrafts((drafts) => ({ ...drafts, [next.workoutExerciseId]: next }))} />)}
            </>
          ) : null}
        </>
      ) : (
        <>

      {/*
       * Completion row uses the same <FeedbackChip /> primitive as the
       * follow-up rows so unselected chrome stays byte-identical across
       * groups. The only difference is the selected accent: rating chips
       * carry semantic colour (green=easy, red=very_hard) so colour
       * encodes meaning; completion is a peer-options group with no
       * semantic colour ladder, so it uses the standard lime accent.
       */}
      {hasComponentFlow ? (
        sessionComponents.map((component) => (
          <View key={component.id}>
            <SectionLabel style={styles.section}>
              {componentQuestionLabel(component, sessionComponents.length)}
            </SectionLabel>
            <View style={styles.row}>
              {COMPLETION_OPTIONS.map((opt) => (
                <FeedbackChip
                  key={opt.key}
                  testID={`feedback-${stableTestIdToken(component.id)}-completion-${opt.key}`}
                  label={opt.label}
                  selected={componentCompletions[component.id] === opt.key}
                  selectedColor={colors.accent.lime}
                  onPress={() => handleComponentCompletionChange(component.id, opt.key)}
                />
              ))}
            </View>
            {renderComponentReasonGroup(component)}
          </View>
        ))
      ) : (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.completion}
          </SectionLabel>
          <View style={styles.row}>
            {COMPLETION_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-completion-${opt.key}`}
                label={opt.label}
                selected={completion === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => handleCompletionChange(opt.key)}
              />
            ))}
          </View>
        </>
      )}

      {!hasComponentFlow && hasSection('partialReason') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.partialReason}
          </SectionLabel>
          <View style={styles.row}>
            {PARTIAL_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-partial-reason-${opt.key}`}
                label={opt.label}
                selected={partialReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => setPartialReason(opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {!hasComponentFlow && hasSection('skipReason') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.skipReason}
          </SectionLabel>
          <View style={styles.row}>
            {SKIP_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-skip-reason-${opt.key}`}
                label={opt.label}
                selected={skipReason === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => setSkipReason(opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('teamNightSize') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.teamNightSize}
          </SectionLabel>
          <View style={styles.row}>
            {TEAM_NIGHT_SIZE_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-team-night-size-${opt.key}`}
                label={opt.label}
                selected={teamNightSize === opt.key}
                selectedColor={opt.color}
                onPress={() => setTeamNightSize(teamNightSize === opt.key ? null : opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('gameFeel') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.gameFeel}
          </SectionLabel>
          <View style={styles.row}>
            {GAME_FEEL_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-game-feel-${opt.key}`}
                label={opt.label}
                selectedColor={colors.accent.lime}
                selected={gameFeel === opt.key}
                onPress={() => setGameFeel(gameFeel === opt.key ? null : opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('expectation') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.expectation}
          </SectionLabel>
          <View style={styles.row}>
            {EXPECTATION_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-expectation-${opt.key}`}
                label={opt.label}
                selectedColor={colors.accent.lime}
                selected={expectation === opt.key}
                onPress={() => {
                  const next = expectation === opt.key ? null : opt.key;
                  setExpectation(next);
                  // TAPPING BACK CLEARS THE WHY. Leaving a stale reason behind
                  // would let "as expected" carry "because of soreness" in the
                  // draft — the payload drops it, but a form that shows one
                  // answer and sends another is the surface half of the same
                  // defect.
                  if (!expectationAsksWhy(next)) setExpectationReason(null);
                }}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('expectationReason') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.expectationReason}
          </SectionLabel>
          <View style={styles.row}>
            {EXPECTATION_REASON_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-expectation-reason-${opt.key}`}
                label={opt.label}
                selectedColor={colors.accent.lime}
                selected={expectationReason === opt.key}
                onPress={() => setExpectationReason(
                  expectationReason === opt.key ? null : opt.key,
                )}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('feeling') ? (
        <>
          <SectionLabel style={styles.section}>
            {activeCompletion === 'partial'
              ? FEEDBACK_FORM_SECTION_LABELS.partialFeeling
              : FEEDBACK_FORM_SECTION_LABELS.feeling}
          </SectionLabel>
          <View style={styles.row}>
            {FEELING_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-feeling-${opt.key}`}
                label={opt.label}
                selected={feeling === opt.key}
                selectedColor={opt.color}
                onPress={() => setFeeling(opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {hasSection('soreness') ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.soreness}
          </SectionLabel>
          <View style={styles.row}>
            {SORENESS_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-soreness-${opt.key}`}
                label={opt.label}
                selected={soreness === opt.key}
                selectedColor={opt.color}
                onPress={() => setSoreness(opt.key)}
              />
            ))}
          </View>
        </>
      ) : null}

      {showConditioningPerformance ? (
        <>
          <SectionLabel style={styles.section}>
            {FEEDBACK_FORM_SECTION_LABELS.conditioning}
          </SectionLabel>
          <View style={styles.row}>
            {MODE_OPTIONS.map((opt) => (
              <FeedbackChip
                key={opt.key}
                testID={`feedback-conditioning-mode-${opt.key}`}
                label={opt.label}
                selected={conditioningMode === opt.key}
                selectedColor={colors.accent.lime}
                onPress={() => setConditioningMode(opt.key)}
              />
            ))}
          </View>
          <View style={styles.metricGrid}>
            <ConditioningMetricInput
              field="totalTimeMinutes"
              label="Time (min)"
              value={totalTimeMinutes}
              onChangeText={setTotalTimeMinutes}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="distanceMeters"
              label="Distance (m)"
              value={distanceMeters}
              onChangeText={setDistanceMeters}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="calories"
              label="Calories"
              value={calories}
              onChangeText={setCalories}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="roundsCompleted"
              label="Rounds"
              value={roundsCompleted}
              onChangeText={setRoundsCompleted}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="intervalsCompleted"
              label="Intervals"
              value={intervalsCompleted}
              onChangeText={setIntervalsCompleted}
              fields={conditioningConfig.fields}
            />
            <ConditioningMetricInput
              field="rpe"
              label="RPE"
              value={conditioningRpe}
              onChangeText={setConditioningRpe}
              fields={conditioningConfig.fields}
            />
          </View>
          {conditioningConfig.fields.includes('bestInterval') ? (
            <AppTextInput
              style={styles.singleLineInput}
              placeholder="Best interval (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={bestInterval}
              onChangeText={setBestInterval}
              maxLength={40}
              returnKeyType="done"
            />
          ) : null}
          {conditioningConfig.fields.includes('averagePace') ? (
            <AppTextInput
              style={styles.singleLineInput}
              placeholder="Average pace / split (optional)"
              placeholderTextColor={colors.text.tertiary}
              value={averagePace}
              onChangeText={setAveragePace}
              maxLength={40}
              returnKeyType="done"
            />
          ) : null}
        </>
      ) : null}
        </>
      )}

      {/* CLUB TRAINING'S TWO QUESTIONS MOVED OUT (Sam, 2026-08-21: *"remove the
          club training from the other view ... so it is two separate feedback
          forms"*). They live in `ClubTrainingFeedbackPanel`, reached from the
          day card's own "Log training" button, and they write the SAME
          `teamTraining` fact through the same door — so the load calculation
          did not move with them. */}

      {/* Notes toggle + input */}
      {hasSection('notes') ? (
        !showNotes ? (
          <Pressable
            onPress={() => setShowNotes(true)}
            style={styles.notesToggle}
            accessibilityRole="button"
          >
            <Text style={styles.notesToggleText}>+ Add a note</Text>
          </Pressable>
        ) : (
          <AppTextInput
            style={styles.notesInput}
            placeholder="Anything to note? (optional)"
            placeholderTextColor={colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={200}
            returnKeyType="done"
            blurOnSubmit
          />
        )
      ) : null}

      {/* A refused save says so. Silence here was finding 4. */}
      {saveRefusal && (
        <View style={styles.saveRefusalRow} testID="session-feedback-save-refusal">
          <Text style={styles.saveRefusalText}>{saveRefusal}</Text>
        </View>
      )}

      {/* THE CONTROL IS NOT OFFERED FOR AN ACT THE DOOR WILL REFUSE, and the
          athlete is told why rather than left with a button that does nothing. */}
      {draftIsComplete && recordableRefusal && (
        <View style={styles.saveRefusalRow} testID="session-feedback-not-yet">
          <Text style={styles.saveRefusalText}>{recordableRefusal.message}</Text>
        </View>
      )}

      {/* THE SAME BUTTON THE OTHER TWO FORMS DRAW — always on screen, greyed
          until the answers this path needs are in. See the game panel's note. */}
      <View style={styles.saveRow}>
        <Button
          label={signedCopy('feedback.save_action')}
          testID={explorerTestId.feedbackSave(workout?.id ?? date)}
          onPress={handleSave}
          disabled={!canSave}
          variant="primary"
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
};

/* ── FeedbackChip ────────────────────────────────────────────────────────
 *
 * Single source of truth for every option chip in this panel. Rating,
 * completion, and reason groups render through this component so
 * the unselected look — translucent fill + thin dark border — is byte
 * identical across rows. Selected state takes a colour from the caller:
 * semantic ladder colour for rating rows, lime for the completion row.
 *
 * Kept local to this file because it's a one-off recipe for this panel;
 * the global selection primitive (<SelectableTile />) renders against the
 * page surface, and this chip's translucent fill was drawn to read as elevated
 * above the raised Card these forms used to sit in. The Card went (2026-08-22);
 * the chip reads the same against the sheet's own surface, so the recipe stayed
 * — a look that survives its stated reason is worth saying so about.
 */
interface FeedbackChipProps {
  testID?: string;
  label: string;
  selected: boolean;
  selectedColor: string;
  onPress: () => void;
  fillRow?: boolean;
}

const FeedbackChip: React.FC<FeedbackChipProps> = ({
  testID,
  label,
  selected,
  selectedColor,
  onPress,
  fillRow = false,
}) => (
  <Pressable
    onPress={onPress}
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    style={[
      styles.chip,
      fillRow && styles.chipFill,
      selected && {
        backgroundColor: selectedColor + '22',
        borderColor: selectedColor,
      },
    ]}
  >
    <Text
      style={[
        styles.chipText,
        selected && { color: selectedColor, fontWeight: '700' },
      ] as unknown as TextStyle}
      /* A ROW-FILLING CHIP HAS A FIXED SHARE OF THE ROW, so its label must fit
         that share rather than set it. One line, shrink-to-fit, never a
         hyphenated break — the same treatment the change-hub chips get for the
         same reason. Left alone for an ordinary chip, which sizes to its word. */
      numberOfLines={fillRow ? 1 : undefined}
      adjustsFontSizeToFit={fillRow}
      minimumFontScale={fillRow ? 0.8 : undefined}
    >
      {label}
    </Text>
  </Pressable>
);

interface ConditioningMetricInputProps {
  field: ConditioningLogField;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  fields: ConditioningLogField[];
}

function ConditioningMetricInput({
  field,
  label,
  value,
  onChangeText,
  fields,
}: ConditioningMetricInputProps) {
  if (!fields.includes(field)) return null;
  return (
    <View style={styles.metricInputWrap}>
      <Text style={styles.metricLabel}>{label}</Text>
      <AppTextInput
        style={styles.metricInput}
        placeholder="-"
        placeholderTextColor={colors.text.tertiary}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        maxLength={8}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* ── NO `panel`, `eyebrow`, `heading` OR `subheading` ANY MORE ──
     Sam, 2026-08-22 put the three feedback forms in one shell: the sheet draws
     the header, so a form no longer titles itself, and no form draws a Card of
     its own inside the sheet. The four styles those two elements used went with
     them rather than waiting in the file for a fifth form to re-inherit the
     shape this change removed. */
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  checklistSummary: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.tertiary,
    gap: 6,
  },
  checklistSummaryTitle: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  checklistSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  checklistSummaryLabel: {
    flex: 1,
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  checklistSummaryValue: {
    color: colors.text.tertiary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  rpeHint: {
    color: colors.text.tertiary,
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  rpeGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  componentReasonSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  gameDurationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gameDurationField: {
    flex: 1,
  },
  gameDurationInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  gameRpeGrid: {
    flexDirection: 'row',
    gap: 7,
  },
  inputError: {
    color: colors.status.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  metricInputWrap: {
    flexBasis: '31%',
    minWidth: 88,
    flexGrow: 1,
  },
  metricLabel: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 5,
  },
  metricInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  singleLineInput: {
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 13,
    padding: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  chipFill: {
    flex: 1,
    alignItems: 'center',
    /* The chip's own 14 is for a chip that hugs its word. A fifth of the row is
       56pt on a 402pt screen and 28 of those cannot be padding. */
    paddingHorizontal: 4,
  },
  /* Five answers, one line (Sam, 2026-08-22). `flexWrap` is the whole of it —
     the shared `row` wraps, which is right for every other chip group on this
     form, so the feel row says otherwise for itself rather than changing them. */
  feelRow: {
    flexWrap: 'nowrap',
    gap: 6,
  },
  chipText: {
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  notesToggle: {
    marginTop: spacing.md,
    paddingVertical: 6,
  },
  notesToggleText: {
    color: colors.accent.lime,
    fontSize: 12,
    fontWeight: '600',
  },
  notesInput: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: colors.text.primary,
    fontSize: 13,
    padding: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveRow: {
    marginTop: spacing.lg,
  },
  saveRefusalRow: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,122,133,0.12)',
  },
  saveRefusalText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
});
