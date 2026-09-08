import { useMemo } from 'react';
import { useProgramStore } from '../../store/programStore';
import { buildProgressLoadHistory } from '../../rules/progressLoadHistory';
import { todayISOLocal } from '../../utils/appDate';

export function useProgressLoadHistory() {
  const feedback = useProgramStore(state => state.sessionFeedback);
  const asOfDateISO = todayISOLocal();
  const weeks = useMemo(() => buildProgressLoadHistory(Object.entries(feedback ?? {}).map(([date, record]) => ({
    ...record, date, strength: record.strength ?? [], conditioning: record.conditioning ?? null,
  })), asOfDateISO), [feedback, asOfDateISO]);
  return { weeks, asOfDateISO };
}
