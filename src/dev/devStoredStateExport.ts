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
 * should be deleted once both are done. `__DEV__` gating lives at the call
 * site (the DEVELOPER TOOLS section, which is already `__DEV__`-only).
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

/** One-line headline so the share sheet preview is already informative. */
export function storedStateExportHeadline(): string {
  const snapshot = captureStoredStateExport();
  return `LFA stored state — ${snapshot.profileStore.onboardingAnswerCount} answers, `
    + `snapshot ${snapshot.programStore.acceptedProfileSnapshotAnswerCount ?? 'none'}, `
    + `revision ${snapshot.programStore.acceptedRevision}`;
}
