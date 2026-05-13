/**
 * coachBuildInfo.ts — visible build fingerprint for the coach pipeline.
 *
 * THE PROBLEM
 *
 * Phase G fixes shipped, tests went green, but live logs continued to
 * show the pre-Phase-G failure shape (legacy applying
 * set_preferred_alternative, missing pending-clarifier capture, ambiguous
 * resolution for same-canonical-family turns). The most likely cause is
 * that the running Expo bundle was older than the source on disk — Metro
 * sometimes serves a cached bundle, or the dev/preview build hadn't been
 * rebuilt since Phase G landed.
 *
 * THE FIX
 *
 * On app launch and on every CoachScreen mount we emit a single
 * `[coach-build]` log line that prints the version stamps of the
 * Phase-G-affected modules. If a turn's logs show stale module
 * fingerprints, we know it's a build issue, not a logic issue.
 *
 * BUMP RULE
 *
 *   • Bump `phaseGFingerprint` whenever ANY Phase-G-shipped file changes
 *     (clarifier resume, reference resolver, legacy filter, pending
 *     store, bike intent parser, CoachScreen pending-clarifier wiring).
 *   • Bump the per-module versions independently so the log surfaces
 *     which subsystem is the suspect.
 */
import { logger } from './logger';

/**
 * Versions of the four Phase-G-touching modules. Bump when the module
 * changes; never reuse a previous string. Surfaces in the [coach-build]
 * log so the runtime can be cross-checked against source.
 */
export const PENDING_CLARIFIER_STORE_VERSION = 'g.1.2026-05-10';
export const LEGACY_ACTION_FILTER_VERSION = 'g.1.2026-05-10';
export const REFERENCE_RESOLVER_VERSION = 'g.1.2026-05-10';
export const BIKE_INTENT_PARSER_VERSION = 'g.1.2026-05-10';
export const CLARIFIER_RESUME_VERSION = 'g.1.2026-05-10';
export const COACH_SCREEN_PENDING_WIRING_VERSION = 'g.1.2026-05-10';

/**
 * Top-level Phase-G fingerprint. Bumped on every Phase-G-affecting
 * change. The string is the literal value Sam asked us to surface in
 * runtime logs to disambiguate stale bundles.
 */
export const COACH_BUILD_INFO = {
  phaseGEnabled: true,
  phaseGFingerprint: 'phase-g.2026-05-10.audit-1',
  pendingClarifierStoreVersion: PENDING_CLARIFIER_STORE_VERSION,
  legacyActionFilterVersion: LEGACY_ACTION_FILTER_VERSION,
  referenceResolverVersion: REFERENCE_RESOLVER_VERSION,
  bikeIntentParserVersion: BIKE_INTENT_PARSER_VERSION,
  clarifierResumeVersion: CLARIFIER_RESUME_VERSION,
  coachScreenPendingWiringVersion: COACH_SCREEN_PENDING_WIRING_VERSION,
} as const;

let appLaunchLogged = false;

/**
 * Log the build fingerprint with a tag the caller specifies (so we can
 * tell `app_launch` apart from `coach_screen_mount`). Idempotent on
 * launch — repeated launch calls within the same process only log once.
 */
export function logCoachBuildFingerprint(
  callsite: 'app_launch' | 'coach_screen_mount',
): void {
  if (callsite === 'app_launch') {
    if (appLaunchLogged) return;
    appLaunchLogged = true;
  }
  logger.warn('[coach-build]', {
    callsite,
    ...COACH_BUILD_INFO,
  });
}
