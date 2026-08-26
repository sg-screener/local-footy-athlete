/**
 * MY STATUS — a Program-stack destination reached directly from Day or Week.
 *
 * The visible status content and every modifier action keep their established
 * owners. This screen only owns the route-level composition that used to live
 * inside CoachTabScreen, where a Coach parameter and an absolute overlay made
 * Program's doorway change tabs before it could show the page.
 */

import React from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProgramStackParamList } from '../../navigation/AppNavigator';
import { useActiveModifiers } from '../../hooks/useActiveModifiers';
import { useSeasonPhaseControl } from '../../hooks/useSeasonPhaseControl';
import { useProgramRebuild } from '../../hooks/useProgramRebuild';
import { useRebuildNotice } from '../../hooks/useRebuildNotice';
import { CoachNoteSheet } from '../../components/CoachNoteSheet';
import { RebuildSheet } from '../../components/RebuildSheet';
import { SeasonPhaseShiftSheet } from '../../components/SeasonPhaseShiftSheet';
import { GuidedInjuryFlowSheet } from './GuidedInjuryFlowSheet';
import CoachStatusScreen from '../coach/CoachStatusScreen';
import { useCoachNoteActions } from '../coach/useCoachNoteActions';

type Props = NativeStackScreenProps<ProgramStackParamList, 'MyStatus'>;

export default function MyStatusScreen({ navigation }: Props) {
  const { modifiers, equipmentFactIds } = useActiveModifiers();
  const rebuild = useProgramRebuild();
  const rebuildNotice = useRebuildNotice();
  const phaseControl = useSeasonPhaseControl();
  const coachNoteActions = useCoachNoteActions({
    screen: 'my_status',
    notes: modifiers,
    onResult: rebuild.handleProgramControlResult,
    notifyRefusal: Alert.alert,
  });

  return (
    <>
      <CoachStatusScreen
        modifiers={modifiers}
        equipmentFactIds={equipmentFactIds}
        currentPhase={phaseControl.currentPhase}
        onReviewPhase={() => phaseControl.open()}
        onAction={coachNoteActions.onAction}
        onClose={() => navigation.goBack()}
      />
      <CoachNoteSheet
        state={coachNoteActions.sheet}
        equipmentFactIds={equipmentFactIds}
        onClose={coachNoteActions.closeSheet}
        onConfirmClear={coachNoteActions.confirmClear}
        onUpdateStatus={coachNoteActions.updateStatus}
        onChangeExclusionScope={coachNoteActions.changeExclusionScope}
      />
      <GuidedInjuryFlowSheet
        visible={coachNoteActions.injuryNote !== null}
        onClose={coachNoteActions.closeInjuryFlow}
        initial={coachNoteActions.injuryInitial}
        episodeId={coachNoteActions.injuryNote?.injuryEpisodeId}
        titlePrefix="Injury"
        onComplete={async (result) => {
          await coachNoteActions.applyGuidedInjury(
            result,
            coachNoteActions.injuryConstraint?.id ?? coachNoteActions.injuryNote?.constraintId,
          );
          coachNoteActions.closeInjuryFlow();
        }}
      />
      <RebuildSheet
        visible={rebuild.rebuildModalVisible}
        onClose={rebuild.handleCancelRebuild}
        isRebuilding={rebuildNotice.isRebuilding}
        error={rebuildNotice.rebuildError}
        canRetry={rebuildNotice.rebuildErrorCanRetry}
        msgIdx={rebuildNotice.rebuildMsgIdx}
        msgOpacity={rebuildNotice.rebuildMsgOpacity}
        onConfirm={rebuild.handleConfirmRebuild}
      />
      <SeasonPhaseShiftSheet
        visible={phaseControl.visible}
        step={phaseControl.step}
        currentPhase={phaseControl.currentPhase}
        targetPhase={phaseControl.targetPhase}
        isRebuilding={phaseControl.isRebuilding}
        error={phaseControl.error}
        canRetry={phaseControl.canRetry}
        msgIdx={phaseControl.msgIdx}
        msgOpacity={phaseControl.msgOpacity}
        pendingPreferredDays={phaseControl.pendingPreferredDays}
        pendingTeamDays={phaseControl.pendingTeamDays}
        pendingGameDay={phaseControl.pendingGameDay}
        gameAnchorAnswered={phaseControl.gameAnchorAnswered}
        pendingSeasonFinishDate={phaseControl.pendingSeasonFinishDate}
        seasonFinishAttempted={phaseControl.seasonFinishAttempted}
        onClose={phaseControl.close}
        onBack={phaseControl.back}
        onTogglePendingPreferredDay={phaseControl.togglePreferredDay}
        onTogglePendingTeamDay={phaseControl.toggleTeamDay}
        onSetPendingGameDay={phaseControl.answerGameDay}
        onAnswerNoUsualGameDay={phaseControl.answerNoGameDay}
        onChangeSeasonFinishDate={phaseControl.setPendingSeasonFinishDate}
        onAnswerSeasonFinishNotSure={phaseControl.answerSeasonFinishNotSure}
        onSelectTargetPhase={phaseControl.selectTargetPhase}
        onAdvance={() => { void phaseControl.advance(); }}
      />
    </>
  );
}
