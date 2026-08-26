import React from 'react';
import { DateCalendarPicker } from '../calendar/DateCalendarPicker';
import { todayISOLocal } from '../../utils/appDate';

export interface SeasonFinishDateDraft {
  day: string;
  month: string;
  year: string;
}

export const EMPTY_SEASON_FINISH_DATE: SeasonFinishDateDraft = {
  day: '',
  month: '',
  year: '',
};

export function seasonFinishDateDraft(dateISO: string | null | undefined): SeasonFinishDateDraft {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO ?? ''));
  return match
    ? { day: String(Number(match[3])), month: String(Number(match[2])), year: match[1] }
    : { ...EMPTY_SEASON_FINISH_DATE };
}

interface Props {
  value: SeasonFinishDateDraft;
  onChange: (value: SeasonFinishDateDraft) => void;
}

/** One calendar owner for the same season-finish fact on every entry surface. */
export function SeasonFinishDateFields({ value, onChange }: Props) {
  const selectedISO = /^\d{4}-\d{1,2}-\d{1,2}$/.test(
    `${value.year}-${value.month}-${value.day}`,
  )
    ? `${value.year}-${value.month.padStart(2, '0')}-${value.day.padStart(2, '0')}`
    : null;

  return (
    <DateCalendarPicker
      maxISO={todayISOLocal()}
      initialMonthISO={selectedISO ?? todayISOLocal()}
      selectedISO={selectedISO}
      testIDPrefix="season-finish"
      onPick={(dateISO) => onChange(seasonFinishDateDraft(dateISO))}
    />
  );
}
