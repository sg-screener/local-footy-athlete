export const SETUP_REBUILD_PROGRESS_INTERVAL_MS = 15000;

export const SETUP_REBUILD_PROGRESS_MESSAGES = [
  'Updating your setup...',
  'Rebuilding your week from the new availability...',
  'Checking the new plan respects your training days...',
  'Almost done - finalising your updated program...',
  "This is taking longer than expected, but I'm still working on it...",
] as const;

export function setupRebuildProgressMessageForTick(tick: number): string {
  const safeTick = Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
  const index = Math.min(safeTick, SETUP_REBUILD_PROGRESS_MESSAGES.length - 1);
  return SETUP_REBUILD_PROGRESS_MESSAGES[index];
}

export function setupRebuildProgressMessageForElapsedMs(elapsedMs: number): string {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const tick = Math.floor(safeElapsed / SETUP_REBUILD_PROGRESS_INTERVAL_MS);
  return setupRebuildProgressMessageForTick(tick);
}
