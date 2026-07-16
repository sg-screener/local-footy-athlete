export const DEV_E2E_SEED_IDS = [
  'standard-in-season-week',
  'stacked-team-training-upper-pull',
  'lower-body-deletion',
  'one-set-strength',
  'fixture-move',
  'injury-case',
  'equipment-restriction-case',
  'feedback-progression-case',
  'multi-reload-fixture-chain',
  'repeat-week-phase-transition',
  'coach-production-replay',
] as const;

export type DevE2ESeedId = (typeof DEV_E2E_SEED_IDS)[number];

export const DEV_E2E_DATE_ANCHORS: Record<DevE2ESeedId, string> = {
  'standard-in-season-week': '2026-07-13',
  'stacked-team-training-upper-pull': '2026-07-13',
  'lower-body-deletion': '2026-07-13',
  'one-set-strength': '2026-07-13',
  'fixture-move': '2026-07-13',
  'injury-case': '2026-07-13',
  'equipment-restriction-case': '2026-07-13',
  'feedback-progression-case': '2026-07-13',
  'multi-reload-fixture-chain': '2026-07-13',
  'repeat-week-phase-transition': '2026-07-13',
  'coach-production-replay': '2026-07-13',
};

export function isDevE2ESeedId(value: string): value is DevE2ESeedId {
  return DEV_E2E_SEED_IDS.includes(value as DevE2ESeedId);
}
