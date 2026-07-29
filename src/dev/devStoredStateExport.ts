import { useProfileStore } from '../store/profileStore';
import { useProgramStore } from '../store/programStore';
import { recentProfileMirrorRefusals } from '../rules/profileMirrorNarrowing';

/**
 * DEV-ONLY: the athlete's stored state, as bytes, for a one-tap share.
 *
 * Sam asked for this (2026-07-30) for a specific reason: the profile-mirror
 * wipe was diagnosed against a RECONSTRUCTION of his device, because nobody
 * could see the real thing. The reconstruction turned out to be right, but the
 * one question it could not answer — where his impoverished accepted snapshot
 * came from — is exactly the question the real bytes settle. Same spirit as the
 * tap counters: stop inferring device state, read it.
 *
 * TEMPORARY by intent. It exists to answer the snapshot-provenance question and
 * to seed the harness fixture from reality rather than from my best guess; it
 * should be deleted once both are done.
 *
 * DELIBERATELY REACHABLE IN RELEASE (Sam, 2026-07-30). It first shipped inside
 * the `__DEV__`-only developer-tools section, which does not render on a Release
 * build — so on the one device that actually carries the wiped profile, the
 * instrument for reading it was invisible. Requiring Metro or a debug build to
 * inspect a Release-only state is the same mistake as testing the mirror with
 * fixtures that leave it inert: the diagnostic has to exist where the defect
 * does. Its call site sits beside the tap counters and is removed with them.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: interpret. It dumps the two stores and the
 * mirror's refusal log verbatim. A summariser here would be one more layer
 * between the device and the diagnosis, which is the thing that went wrong.
 */
export interface StoredStateExport {
  capturedAt: string;
  profileStore: {
    isOnboardingComplete: boolean;
    onboardingData: unknown;
    onboardingAnswerCount: number;
  };
  programStore: {
    hasProgram: boolean;
    programId: string | null;
    microcycleCount: number;
    acceptedRevision: number;
    lastTransaction: string | null;
    acceptedProfileSnapshot: unknown;
    /** The number that made the wipe obvious: 2 keys where 29 were expected. */
    acceptedProfileSnapshotAnswerCount: number | null;
    markedDays: unknown;
    userRemovalConstraintCount: number;
    dateOverrideDates: string[];
    weekScopedOverlayWeeks: string[];
  };
  profileMirrorRefusals: unknown;
}

export function captureStoredStateExport(): StoredStateExport {
  const profile = useProfileStore.getState();
  const program = useProgramStore.getState();
  const context = program.acceptedMaterialContext;
  const snapshot = context?.acceptedProfileSnapshot?.onboardingData ?? null;
  return {
    capturedAt: new Date().toISOString(),
    profileStore: {
      isOnboardingComplete: profile.isOnboardingComplete,
      onboardingData: profile.onboardingData,
      onboardingAnswerCount: Object.keys(profile.onboardingData ?? {}).length,
    },
    programStore: {
      hasProgram: !!program.currentProgram,
      programId: program.currentProgram?.id ?? null,
      microcycleCount: program.currentProgram?.microcycles.length ?? 0,
      acceptedRevision: context?.revision ?? 0,
      lastTransaction: context?.lastTransaction ?? null,
      acceptedProfileSnapshot: context?.acceptedProfileSnapshot ?? null,
      acceptedProfileSnapshotAnswerCount: snapshot
        ? Object.keys(snapshot as Record<string, unknown>).length
        : null,
      markedDays: context?.markedDays ?? {},
      userRemovalConstraintCount: program.userRemovalConstraints?.length ?? 0,
      dateOverrideDates: Object.keys(program.dateOverrides ?? {}).sort(),
      weekScopedOverlayWeeks: Object.keys(program.weekScopedOverlays ?? {}).sort(),
    },
    profileMirrorRefusals: recentProfileMirrorRefusals(),
  };
}

/** Pretty JSON, ready for a share sheet or a paste into a bug report. */
export function serialiseStoredStateExport(): string {
  return JSON.stringify(captureStoredStateExport(), null, 2);
}

/**
 * One line, readable on the device without sharing anything.
 *
 * These three numbers answer the question on their own. A healthy device shows
 * `answers` and `snapshot` both in the high twenties. `answers 2` is the wipe.
 * `answers 2` with a healthy `snapshot` means the real profile survived in the
 * accepted snapshot and recovery is a read rather than a re-onboard — which is
 * the difference between a five-minute fix and doing onboarding again.
 */
export function storedStateExportHeadline(): string {
  const snapshot = captureStoredStateExport();
  return `answers ${snapshot.profileStore.onboardingAnswerCount}`
    + ` · snapshot ${snapshot.programStore.acceptedProfileSnapshotAnswerCount ?? 'none'}`
    + ` · revision ${snapshot.programStore.acceptedRevision}`
    + ` · mirror refusals ${(snapshot.profileMirrorRefusals as unknown[]).length}`;
}
