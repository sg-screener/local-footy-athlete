/**
 * THE LEGACY RECKONING CENSUS — pre-law surface, declared, ratcheting down.
 *
 * SAM'S RULING (2026-07-30, docs/LEGACY_RECKONING_CENSUS_2026-07-30.md). The
 * profile-wipe saga cost five device round trips because the store predated
 * every law it was eventually judged by: nobody owned the write, nobody could
 * name the writer, and the record could not correct itself. The ruling is to
 * stop waiting for pre-law code to break — map it, and schedule its reckonings.
 *
 * WHY THIS FILE EXISTS. 24 units of pre-law surface across the stores, the coach
 * pipeline, the generation engine and the gates. A gate that failed on all of
 * them the day it landed would be switched off by the first person it blocked —
 * the precise failure the provenance inventory predicted for any all-at-once
 * gate, and the reason both the readiness census and the load-ratio work grew
 * one cluster at a time.
 *
 * So the debt is DECLARED rather than banned, and the gate ratchets in four
 * directions:
 *
 *   1. a unit's actual detector count must equal its declared count, so a new
 *      violation fails until someone classifies it;
 *   2. total debt may never exceed LEGACY_DEBT_BASELINE, so it only shrinks;
 *   3. LEGACY_DEBT_BASELINE must equal the current total, so paying debt down
 *      tightens the ratchet instead of leaving re-spendable slack;
 *   4. LEGACY_DEBT_BASELINE may never exceed LEGACY_DEBT_FOUNDING_BASELINE.
 *
 * THE FOURTH IS THE ONE THAT MATTERS, and it is the one the readiness census
 * does not have. Directions 2 and 3 are circular on their own: a newcomer can
 * raise a declared count and the baseline together and stay green. The founding
 * baseline is frozen at the number the census landed with, so accommodating new
 * surface means exceeding a constant whose name carries its own date. Old
 * surface may be DECLARED; new surface may only be FIXED.
 *
 * WHAT IT DOES NOT DO. It pays nothing. Every unit still needs its ruling and
 * its build. And it holds only what a mechanical detector can count: the rest
 * are `tracked_only` and must say WHY, so the census never reads as more
 * enforcement than it has. Four of twenty-four units are ratcheted. That number
 * is honest, not aspirational, and it is meant to rise as detectors are found —
 * by adding a detector to an existing unit, never by admitting a new one.
 *
 * A CENSUS MUST BE ABLE TO DIE. When a unit's detector reaches zero the entry is
 * deleted and the baseline drops to match. A list that keeps naming problems it
 * has already fixed rots into the `LOAD_RULING_PENDING` shape from the other
 * side, where the contents stop describing reality but still read as a
 * considered position.
 */

export const LEGACY_RECKONING_RULING = {
  ruledOn: '2026-07-30',
  where: 'docs/LEGACY_RECKONING_CENSUS_2026-07-30.md',
  quote:
    'Old surface may be declared; new surface may only be fixed.',
} as const;

/**
 * The law book, by id. Every unit must name the laws it will land under, and
 * every name must resolve here — a unit pointing at a law nobody wrote is a
 * unit whose acceptance criteria are undefined.
 *
 * The prose for each lives in the census document; this is the index the gate
 * checks against.
 */
export const LEGACY_LAW_IDS = [
  // Ownership
  'L-A1', 'L-A2', 'L-A3', 'L-A4', 'L-A5', 'L-A6', 'L-A7', 'L-A8',
  // Derivation
  'L-B1', 'L-B2', 'L-B3', 'L-B4', 'L-B5', 'L-B6',
  // Honesty
  'L-C1', 'L-C2', 'L-C3', 'L-C4',
  // Instrumentation
  'L-D1', 'L-D2', 'L-D3',
  // Gates and process
  'L-E1', 'L-E2', 'L-E3', 'L-E4',
] as const;

export type LegacyLawId = (typeof LEGACY_LAW_IDS)[number];

/* ────────────────────────────────────────────────────────────────────────────
 * The persisted-store ownership registry (LR-2)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface PersistedStoreOwnership {
  /** Path relative to `src/`. */
  readonly file: string;
  /** The zustand persist key, so a rename is visible here too. */
  readonly persistKey: string;
  /**
   * The single door every athlete-facing write goes through, or `null`.
   *
   * Non-null means ALL THREE: one door, typed refusals, and the writer named on
   * the tape. Partial ownership is `null` with the caveat recorded — that is
   * why `programStore` is unowned here while its accepted state is owned. The
   * raw write primitive is what LR-1 exists for.
   */
  readonly owner: string | null;
  /** Does a write here reach the athlete action log? */
  readonly taped: boolean;
  readonly caveat?: string;
}

/**
 * Deliberately declared HERE and not as a tag in each store file, so a store
 * the registry has never heard of counts as unowned by default. That is the
 * property that makes a new persisted store fail the gate instead of joining it.
 */
export const PERSISTED_STORE_OWNERSHIP: readonly PersistedStoreOwnership[] = [
  {
    file: 'store/profileStore.ts',
    persistKey: 'profile-store',
    owner: 'applyProfileOnboardingWrite',
    taped: true,
  },
  {
    file: 'store/programStore.ts',
    persistKey: 'program-store',
    owner: 'applyProgramOverrideSliceWrite',
    taped: true,
    caveat: 'LR-1 PAID 2026-08-03 (store-armour recipe, the last store). The raw '
      + '`setManualOverride` primitive is RETIRED: the override slice has one door with '
      + 'two typed refusals, every write names its writer on the tape applied or refused, '
      + 'and the erasures that are legal declare a named act. Accepted state stays owned '
      + 'by commitAcceptedStateTransaction — the door owns the DECISION, the transaction '
      + 'owns the PUBLICATION. CAVEAT, measured not assumed: no walked athlete tap door '
      + 'writes `dateOverrides` any more (adds/swaps land in weekScopedOverlays, deletions '
      + 'in userRemovalConstraints) — the surviving writers are the coach pipeline, the '
      + "lighter-day transaction and LR-3's residuals. "
      + 'RULED (Sam, 2026-08-03, Stage B stage 0): `dateOverrides` is a STORED-OUTPUT '
      + 'surface, not a decision ledger — the old "athlete\'s decision surface" name was '
      + 'wrong and the measurement says so '
      + '(docs/STAGE_B_STAGE0_DATEOVERRIDES_IDENTITY_2026-08-03.md). Retirement is by '
      + 'ownership lane: Stage B retires the two athlete routes (occupied-day stack adds, '
      + 'no-template swaps — paying LR-3) and the lighter-day trim, and unifies the '
      + 'live/accepted resolver precedence to ONE ordering with ONE owner in the same '
      + 'motion; the coach writers stay declared under the LR-6 STOP and retire with the '
      + 'coach units.',
  },
  {
    file: 'store/calendarStore.ts',
    persistKey: 'calendar-storage',
    owner: 'applyCalendarMarkedDaysWrite',
    taped: true,
    caveat: 'Armoured 2026-08-03 (store-armour recipe). The COMPATIBILITY-ONLY '
      + 'writers still exist but now terminate in the one door; retiring them is '
      + "LR-2's remainder, not a write-ownership gap.",
  },
  {
    file: 'store/readinessStore.ts',
    persistKey: 'readiness-store',
    owner: 'applyReadinessSignalsWrite',
    taped: true,
    caveat: 'Armoured 2026-08-03 (store-armour recipe). Every product writer '
      + 'projects the accepted canonical context and runs under a named reset '
      + 'act — the refusal guards the bare-wipe class; retiring the mirror '
      + "itself is LR-2's remainder, not a write-ownership gap.",
  },
  {
    file: 'store/coachUpdatesStore.ts',
    persistKey: 'coach-updates',
    owner: 'applyCoachUpdatesWrite',
    taped: true,
    caveat: 'Armoured 2026-08-03 (store-armour recipe), under the LR-6 STOP as '
      + 'store-ownership work: the mirror publish, rollback restore and '
      + 'constraint-transaction commits became named writers under named reset '
      + 'acts, behaviour identical. The refusal guards the bare-wipe class.',
  },
  {
    file: 'store/coachMutationHistoryStore.ts',
    persistKey: 'coach-mutation-history-store',
    owner: 'applyCoachMutationHistoryWrite',
    taped: true,
    caveat: 'AGENTS.md requires mutation history for follow-up target resolution — '
      + 'which is why losing `entries` silently was Tier-1 debt. Armoured 2026-08-03 '
      + '(store-armour fleet); store-ownership work only (LR-6): what the executor '
      + 'records and the undo engine reverts is unchanged.',
  },
  {
    file: 'store/coachPreferencesStore.ts',
    persistKey: 'coach-preferences-store',
    owner: 'applyCoachModalityPrefsWrite',
    taped: true,
    caveat: 'Armoured 2026-08-03 (store-armour fleet). Store-ownership work only '
      + '(LR-6): the door owns HOW the map is written; what any coach path decides '
      + 'is unchanged.',
  },
  {
    file: 'store/athletePreferencesStore.ts',
    persistKey: 'athlete-preferences-store',
    owner: 'applyAthletePrefsWrite',
    taped: true,
  },
  {
    file: 'store/coachStore.ts',
    persistKey: 'coach-store',
    owner: 'applyCoachStoreWrite',
    taped: true,
    caveat: 'Armoured 2026-08-03 (store-armour fleet, wave 2a). Store-ownership '
      + 'work only (LR-6): the door owns HOW the chat history is written; what '
      + 'any coach path says or decides is unchanged. `activeConversation` rides '
      + 'through the door but is presentation, never material.',
  },
  {
    file: 'store/coachMemoryStore.ts',
    persistKey: 'coach-memory-store',
    owner: 'applyCoachMemoryWrite',
    taped: true,
    caveat: 'Armoured 2026-08-03 (store-armour fleet, wave 2a). Store-ownership '
      + 'work only (LR-6): the door owns HOW the notes are written; what the '
      + 'pipeline decides to remember is unchanged. Removing the last note is a '
      + 'named erasure, not the wipe (recipe lesson 11).',
  },
  // store/uiStore.ts and store/authStore.ts RETIRED WHOLE 2026-08-03 (Sam's
  // §6 ruling, PARKED_QUESTIONS_2026-08-01): both persisted only never-written
  // defaults — no reachable screen ever wrote either store, verified back to
  // the initial MVP commit — which is stored non-decisions under the north
  // star. Their entries leave WITH their files, so the registry stays the
  // truth: a store this list has never heard of still counts as unowned by
  // default, which is the property that makes a rebuilt auth/ui store fail
  // the gate until it re-registers here, armoured (STORE_ARMOUR_RECIPE §5).
  // The boot-time envelope removal lives in appHydrationGate
  // (RETIRED_STORE_PERSIST_KEYS), pinned by onboardingReliabilityTests D1b.
];

/* ────────────────────────────────────────────────────────────────────────────
 * Detectors
 *
 * Each matches ONE idiom. Deliberately not parsers — the readiness census's
 * lesson, and the reason each is pinned from both sides by
 * `legacyReckoningCensusTests` block [7]. A detector nobody checked counts
 * whatever its regex happened to match.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Strip block comments, line comments and trailing comments. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*');
    })
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n');
}

/**
 * LR-1 — reaching the program store's raw write primitive.
 *
 * The idiom is a PROPERTY ACCESS: `.setManualOverride`. That is what every real
 * call site looks like, including the capture form
 * (`const setManualOverride = useProgramStore.getState().setManualOverride`)
 * where the bare left-hand binding is a local name rather than a second reach
 * for the door. A parameter of the same name in an injection seam is a
 * declaration, not a reference, and is not counted.
 */
export function rawProgramWriteRefs(source: string, _file?: string): number {
  return [...code(source).matchAll(/\.setManualOverride\b/g)].length;
}

/**
 * LR-4 — reading the compatibility mirror as a decision input.
 *
 * DECLARED LIMIT: this sees a single-expression read only. A two-step read
 * (`const p = useProfileStore.getState();` then `p.onboardingData`) is
 * invisible to it, so LR-4's number is a FLOOR, not a total. Pinned as a known
 * hole in block [7] rather than left as a silent one. Widening this into a
 * parser is not the fix; migrating the readers is.
 */
export function mirrorDecisionReads(source: string, _file?: string): number {
  return [...code(source).matchAll(/useProfileStore[^;\n]{0,60}?\bonboardingData\b/g)].length;
}

/** LR-3 — call sites of the legacy §18 override writer, excluding its own definition. */
export function legacyOverrideWriterRefs(source: string, _file?: string): number {
  return [...code(source).matchAll(/(?<!function\s)\bapplyCoachRevisionDateOverrides\s*\(/g)]
    .length;
}

/** Is this file a persisted zustand store? */
function isPersistedStoreFile(source: string, file?: string): boolean {
  if (!file || !file.startsWith('store/')) return false;
  return /\bpersist\s*\(/.test(code(source));
}

/**
 * LR-2 — a persisted store with no single write owner.
 *
 * A store the registry has never heard of has no owner by definition, so a new
 * persisted store raises the count and turns the gate red.
 */
export function unownedPersistedStores(source: string, file?: string): number {
  if (!isPersistedStoreFile(source, file)) return 0;
  const declared = PERSISTED_STORE_OWNERSHIP.find((s) => s.file === file);
  return declared && declared.owner !== null ? 0 : 1;
}

export const DETECTORS = {
  rawProgramWriteRefs,
  unownedPersistedStores,
  legacyOverrideWriterRefs,
  mirrorDecisionReads,
} as const;

export type LegacyDetectorId = keyof typeof DETECTORS;

/**
 * Files a detector must not count, because they are the thing being measured
 * rather than a consumer of it.
 */
export function detectorScopeExempts(id: LegacyDetectorId): readonly string[] {
  switch (id) {
    case 'rawProgramWriteRefs':
      // The store that DEFINES the primitive, and the census that counts it.
      return ['store/programStore.ts', 'data/legacyReckoningCensus.ts'];
    case 'mirrorDecisionReads':
      // The store itself, the one consolidated context owner LR-4 migrates
      // readers onto, and the accepted-profile projection that is the correct
      // source. Counting these would be counting the destination as the problem.
      return [
        'store/profileStore.ts',
        'utils/liveAthleteContext.ts',
        'rules/acceptedProfileProjection.ts',
        'data/legacyReckoningCensus.ts',
      ];
    case 'legacyOverrideWriterRefs':
      return ['data/legacyReckoningCensus.ts'];
    case 'unownedPersistedStores':
      return ['data/legacyReckoningCensus.ts'];
    default:
      return ['data/legacyReckoningCensus.ts'];
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * The census
 * ──────────────────────────────────────────────────────────────────────────── */

export type LegacyBlastRadius =
  /** The athlete loses answers they gave. */
  | 'athlete_answers'
  /** The athlete loses accepted content — a week they had. */
  | 'accepted_content'
  /** The athlete sees a wrong, silent or unreachable week. */
  | 'visible_week'
  /** The app tells the athlete something untrue. */
  | 'honesty'
  /** A law is stated but nothing proves it. */
  | 'gates';

export type LegacyUnitStatus =
  /** Ranked and waiting. */
  | 'scheduled'
  /** Being built right now, elsewhere — listed so it is not double-scheduled. */
  | 'in_flight'
  /** Blocks other work until a reassessment is written and approved. */
  | 'stop'
  /**
   * Paid off. The entry STAYS, holding its detector at zero forever.
   *
   * A classification census deletes a solved entry so the list cannot read as
   * approval. A retirement census must not: deleting the entry deletes the
   * detector, and the surface it retired can then come back unobserved. What is
   * left of a paid unit is the ban that keeps it paid.
   */
  | 'retired';

export interface LegacyUnit {
  readonly id: string;
  readonly title: string;
  readonly tier: 1 | 2 | 3;
  readonly laws: readonly LegacyLawId[];
  readonly blastRadius: LegacyBlastRadius;
  /** What proves this is real. A file:line, or the document that found it. */
  readonly founding: string;
  readonly size: 'S' | 'M' | 'L' | 'XL';
  readonly status: LegacyUnitStatus;
  /** Sam's sequencing, where he ruled one. */
  readonly sequence?: string;
  /** The detector holding this unit's line, or `null` for tracked-only. */
  readonly detector: LegacyDetectorId | null;
  /** Required when `detector` is set. */
  readonly declared?: number;
  /**
   * What this unit measured on census day, 2026-07-30. Required when `detector`
   * is set, and it NEVER rises.
   *
   * The per-unit ceiling exists because a single global one is not enough: debt
   * paid on one unit would otherwise fund a new violation on another, and the
   * whole suite would stay green while admitting surface that did not exist when
   * the census landed. That was demonstrated, not theorised — see direction 4a.
   * Slack retires where it was earned.
   */
  readonly foundingCount?: number;
  /** Required when `detector` is `null`. */
  readonly whyNotDetectable?: string;
}

/**
 * Sam ruled this on 2026-07-30. LR-1 and LR-2 are one unit in two entries; the
 * gate asserts the two strings stay identical so the ruling cannot drift apart.
 */
const LR1_LR2_SEQUENCE =
  'Sam, 2026-07-30: LR-1 and LR-2 run together as the next major unit — after the '
  + 'G-1 branch merges, before Stage B. The stores get one door and the full tape '
  + 'before the engine builds on them.';

export const LEGACY_UNIT_CENSUS: readonly LegacyUnit[] = [
  /* ── Tier 1 — the athlete loses answers or accepted content ── */
  {
    id: 'LR-1',
    title: 'One door to the program store',
    tier: 1,
    laws: ['L-A2', 'L-A1', 'L-A8', 'L-D1'],
    blastRadius: 'accepted_content',
    founding: 'programStore.ts:1629 describes itself as a "Raw storage primitive"; '
      + '27 references across 13 files, including a screen (PlanChangeSheet.tsx:261) '
      + 'and a dev seed. This is the profile store\'s shape on 2026-07-28 — the day '
      + 'before the fix — with thirteen writers instead of two.',
    size: 'L',
    // PAID 2026-08-03. The entry STAYS and its detector holds zero forever —
    // what is left of a paid unit is the ban that keeps it paid.
    status: 'retired',
    sequence: LR1_LR2_SEQUENCE,
    detector: 'rawProgramWriteRefs',
    declared: 0,
    foundingCount: 27,
  },
  {
    id: 'LR-2',
    title: 'The persisted stores get write owners (= Master Plan 5D.1)',
    tier: 1,
    laws: ['L-A2', 'L-D1', 'L-E2'],
    blastRadius: 'athlete_answers',
    founding: 'Eleven of twelve persisted stores have no single write owner and nine '
      + 'reach no tape. calendarStore marks six writers COMPATIBILITY-ONLY in their own '
      + 'JSDoc and has three live callers. Two hand-maintained registries '
      + '(appHydrationGate\'s 12 handles, resetCoach\'s 22 clears) must agree about this '
      + 'set and nothing checks that they do.',
    size: 'L',
    // PAID 2026-08-03: eleven stores armoured or retired across the fleet, and
    // programStore — the last one, and the one holding the visible week — took
    // its door with LR-1. Eleven to none.
    status: 'retired',
    sequence: LR1_LR2_SEQUENCE,
    detector: 'unownedPersistedStores',
    declared: 0,
    foundingCount: 11,
  },
  {
    id: 'LR-3',
    title: 'The §18 residuals leave the legacy override writer',
    tier: 1,
    laws: ['L-A1', 'L-A2', 'L-A3', 'L-C1'],
    blastRadius: 'accepted_content',
    founding: 'FOUNDING (2026-07-30, line receipts long drifted): four producer defer '
      + 'sites plus coachTurnController.ts calling applyCoachRevisionDateOverrides '
      + 'directly. Tracked in the §18 retirement ledger since 2026-07-22. CORRECTED BY '
      + 'MEASUREMENT (Stage B stage 1, 2026-08-03): the occupied-day stack add had '
      + 'already come home to the typed path, and no_template_for_category was a no-op '
      + 'double refusal; the one real athlete residual was the active-removal re-add '
      + '(restoration), whose un-pinning only the legacy writer knew how to do.',
    size: 'M',
    status: 'scheduled',
    sequence: 'ATHLETE SHARE PAID (Stage B stage 1, 2026-08-03): the re-add restoration '
      + 'is typed (stageAthleteSessionAdditionTransaction flips the bin to '
      + "restored/'explicit_re_add' in the staged proposal), the defer-sets and both "
      + 'planChangeProducer call sites are deleted, and no athlete surface reaches the '
      + 'legacy writer. The two coachTurnController call sites remain: coach-owned, '
      + "retire with the coach units under LR-6's boundary. See "
      + 'docs/STAGE_B_STAGE0_DATEOVERRIDES_IDENTITY_2026-08-03.md §4 Option C.',
    detector: 'legacyOverrideWriterRefs',
    declared: 2,
    foundingCount: 4,
  },
  {
    id: 'LR-4',
    title: 'Mirror readers migrate to the accepted snapshot',
    tier: 1,
    laws: ['L-A4', 'L-A1'],
    blastRadius: 'athlete_answers',
    founding: '74 single-expression live-profile reads across 34 files feed decisions '
      + 'rather than displays — the reader half of the defect whose publication half '
      + 'closed on 2026-07-29. liveAthleteContext is the consolidated owner and has two '
      + 'callers. NOTE: 11 of the 13 reads inside acceptedStateTransaction.ts are '
      + 'decision-feeding, not reconciliation, which is why that file is not exempt.',
    size: 'M',
    status: 'scheduled',
    detector: 'mirrorDecisionReads',
    declared: 72,
    foundingCount: 74,
  },
  {
    id: 'LR-5',
    title: 'Failure-state sweep (= Master Plan 5D.2)',
    tier: 1,
    laws: ['L-C1', 'L-C4', 'L-A8'],
    blastRadius: 'accepted_content',
    founding: 'The season-phase skew: a phase shift whose profile write landed and whose '
      + 'rebuild failed, leaving the two disagreeing with nothing to disclose it.',
    size: 'L',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'The subject is what survives a transaction killed mid-flight. '
      + 'That is a property of an execution, not a shape in the source — it is found by '
      + 'fault injection, which is the unit itself.',
  },

  /* ── Tier 2 — a wrong, silent or unreachable week ── */
  {
    id: 'LR-6',
    title: 'The coach request has eight representations — the escalation reassessment',
    tier: 2,
    laws: ['L-A1', 'L-B3'],
    blastRadius: 'visible_week',
    founding: 'CoachIntentPayload -> CoachMutateOperation -> ProgramEditDraftAction -> '
      + 'CoachRevisionIntent -> CoachResolvedTarget -> CoachPlanChangeKind, plus the LLM '
      + "tool-call JSON and the tap door's PlanChange, across 49 modules. "
      + 'coachIntentDispatcher.ts:104 still names its fallback "the legacy /coach-chat". '
      + 'Six of the nine suites that crash silently on load are in this cluster.',
    size: 'XL',
    status: 'stop',
    sequence: 'Sam, 2026-07-30: a standing STOP. No coach-pipeline work of any kind — no '
      + 'new resolver, guard, fallback, compatibility branch, phrase handler or finaliser '
      + 'patch — before this reassessment is written and approved. CLAUDE.md\'s seven '
      + 'questions are the form it takes. '
      + 'RATIFIED BOUNDARY (Sam, 2026-08-03, on LR-1): routing a coach caller through an '
      + 'owned store door — NAME AT THE DOOR, identical call, identical context, identical '
      + 'transaction — is STORE-OWNERSHIP work and is NOT held by this STOP. What is held '
      + 'is changing what a coach path DECIDES. The test is behaviour: if the coach path '
      + 'would produce a different write, it is LR-6 work and it stops.',
    detector: null,
    whyNotDetectable: 'Counting exported type names would count vocabulary, not '
      + 'representations, and would go green on a rename. The finding is an architectural '
      + 'reading; the reassessment is what discharges it.',
  },
  {
    id: 'LR-7',
    title: 'The G+1 derived-filler storage form',
    tier: 2,
    laws: ['L-A3', 'L-A8'],
    blastRadius: 'visible_week',
    founding: 'planChangeProducer.ts:1508 refuses a move onto a resolver-owned filler '
      + 'because "it is regenerated every render, so a real session moved onto its day is '
      + 'silently overwritten". That refusal is a containment; sessionResolver.ts\'s '
      + 'priority ladder is what it contains.',
    size: 'M',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'The question is whether derived fillers are stored or derived — a '
      + 'design decision with no single idiom. The containment it produced is one refusal '
      + 'branch, and counting that would count the fix, not the defect.',
  },
  {
    id: 'LR-8',
    title: 'skipConstraintProjection — a fact recorded that changes nothing',
    tier: 2,
    laws: ['L-A8', 'L-C2', 'L-C1'],
    blastRadius: 'honesty',
    founding: 'temporarySourceFactTransaction.ts:527,708 pass skipConstraintProjection '
      + 'unconditionally, so Busy week / Away days / Missing equipment durably record a '
      + 'fact and never re-validate the materialised week. Tracked NO-OP-DEAD as G7/G8/G9 '
      + 'in the dead-affordance inventory.',
    size: 'M',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'Two call sites of a boolean. A count of two that can only ever be '
      + 'two or zero is a checklist item, not a ratchet — and the fix is a behaviour '
      + 'change (rebuild, or stop recording), not a deletion.',
  },
  {
    id: 'LR-9',
    title: 'DELOAD_LAW row classification reads the authored structure (= 5D.4)',
    tier: 2,
    laws: ['L-A5'],
    blastRadius: 'visible_week',
    founding: 'isConditioningExerciseRow decides conditioning from a regex over the '
      + 'exercise name while conditioningBlock.options[].exerciseIds names the rows '
      + 'outright. "3 x 8min zone 2 Rower" does not match \\brow\\b, so the accessory trim '
      + 'deletes the only row. g1LandingAskFlowTests 26 asserts the classifier still '
      + 'empties that template and goes RED when this lands — that is the signal to delete '
      + 'the containment, not a regression.',
    size: 'M',
    status: 'scheduled',
    sequence: 'The regex is NOT to be widened. Adding the missing words makes the next '
      + 'unmatched name a silent defect instead of a loud one.',
    detector: null,
    whyNotDetectable: 'A single classifier function. Its defect is what it consults, not '
      + 'how many times it is called.',
  },
  {
    id: 'LR-10',
    title: 'Deletion doors stop writing schedule facts',
    tier: 2,
    laws: ['L-A7', 'L-A1'],
    blastRadius: 'visible_week',
    founding: 'LOCKED_DAY_DIAGNOSIS_2026-07-30.md §3, read from Sam\'s device.',
    size: 'S',
    status: 'in_flight',
    sequence: 'Being built in the concurrent lane as this census landed '
      + '(deletionCalendarOwnershipTests + userRemovalConstraints). Listed so it is not '
      + 'double-scheduled.',
    detector: null,
    whyNotDetectable: 'In flight — a detector would be counting a defect that is being '
      + 'removed while the count is taken.',
  },
  {
    id: 'LR-11',
    title: 'Add-optional onto the typed transaction',
    tier: 2,
    laws: ['L-A2', 'L-C1'],
    blastRadius: 'accepted_content',
    founding: 'PlanChangeSheet.tsx:261 — the last athlete door that reaches the store by '
      + 'injecting setManualOverride from a screen.',
    size: 'S',
    status: 'scheduled',
    sequence: 'Subsumed by LR-1 if LR-1 lands first; cheap to do alone if it does not.',
    detector: null,
    whyNotDetectable: 'Its one call site is already counted by LR-1\'s detector. Giving it '
      + 'a second detector would double-count the same reference and corrupt the baseline.',
  },
  {
    id: 'LR-12',
    title: 'coachingEngine.ts — 8,229 lines, pre-law',
    tier: 2,
    laws: ['L-A1', 'L-B1', 'L-B5'],
    blastRadius: 'visible_week',
    founding: 'Created 2026-05-04, still the largest file in the repo. Its readiness edges '
      + 'were paid to zero and the weekly-dose unit deleted 280 lines; nothing else about '
      + 'it is owned.',
    size: 'XL',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'Line count is not a law violation. It must be decomposed into owned '
      + 'units before anything about it can be counted honestly.',
  },
  // LR-27 ("One body-part vocabulary, every door") PAID AND DELETED 2026-08-03.
  // Tracked-only units die the ordinary way when their work lands (the rule two
  // screens down, and [3] in the gate). Sam ruled the divergence table on
  // 2026-08-02 (PARKED_QUESTIONS_2026-08-01 §5: the owner's sheet wins every
  // row; shin ADDED -> calf; quadricep typo corrected) and all four doors
  // converged onto `data/injuryRegions.ts`. What holds the line now is not this
  // census: `test:injury-routing-divergence` stays in `test:bible`, asks every
  // door behaviourally, pins each at ZERO divergence from the owner, and pins
  // the retired literals gone — so the surface cannot return unobserved.
  {
    id: 'LR-13',
    title: 'The visible week has one projection',
    tier: 2,
    laws: ['L-A8', 'L-A1'],
    blastRadius: 'visible_week',
    founding: 'visibleProgramProjection, visibleProgramReadModel and weeklyPlanDisplay all '
      + 'answer "what does the athlete see", plus per-screen derivation in useHomeScreen '
      + '(2,235 lines) and DayWorkoutScreenV2 (3,723 lines).',
    size: 'M',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'Three modules with different exports and no shared idiom. The '
      + 'duplication is semantic, and a name-based count would go green on a merge that '
      + 'changed nothing.',
  },

  /* ── Tier 3 — honesty, vocabulary and the gates ── */
  {
    id: 'LR-14',
    title: 'Nine silent suites and 49 red ones',
    tier: 3,
    laws: ['L-E3', 'L-D3'],
    blastRadius: 'gates',
    founding: 'NON_BIBLE_TEST_ROT_SWEEP_2026-07-29.md: 155 non-bible suites run — 97 pass, '
      + '49 assert_fail, 9 LOAD_CRASH reporting nothing at all. profileResetUITests '
      + 'asserted nothing for weeks and nothing noticed.',
    size: 'M',
    status: 'scheduled',
    sequence: 'Sam, 2026-07-30: runs in parallel with LR-1 + LR-2. No design needed.',
    detector: null,
    whyNotDetectable: 'A suite that reports nothing is found by RUNNING it, not by reading '
      + 'it. The sweep\'s static precursor — test files resolving fixture paths that no '
      + 'longer exist — predicted only three of the nine and belongs to this unit as a '
      + 'recurring check, not to this gate as a count.',
  },
  {
    id: 'LR-15',
    title: 'The vocabulary lock crosses the network boundary',
    tier: 3,
    laws: ['L-B6', 'L-A1'],
    blastRadius: 'visible_week',
    founding: 'hardcodedExerciseNameLockTests sweeps src/ only. '
      + 'supabase/functions/coach-chat/index.ts carries 39 lines of canonical '
      + 'exercise-name literals outside it, and injuryClarificationGuard.ts:13 states '
      + 'outright that the edge function "carries an embedded mirror" of it.',
    size: 'M',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'The surface is under supabase/, outside the src/ tree every '
      + 'detector here walks. Extending the existing name lock to that root is the unit; '
      + 'a second detector here would duplicate it.',
  },
  {
    id: 'LR-16',
    title: 'Raw error.message reaching a native Alert',
    tier: 3,
    laws: ['L-C3'],
    blastRadius: 'honesty',
    founding: 'reversibleAdjustmentTransaction.ts:423,523,1015,1039 fall back to raw error '
      + 'text, which reaches useHomeScreen.ts:1683\'s Alert unmodified. The parallel '
      + 'injuryEpisodeTransaction was hardened; this module was missed.',
    size: 'S',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'The idiom is byte-identical whether it reaches an Alert or a log '
      + 'line — 13 files use it and most are correct. A detector would count 24 sites and '
      + 'demand the 20 legitimate ones be "fixed", which is how a gate teaches people to '
      + 'switch it off.',
  },
  {
    id: 'LR-17',
    title: 'Dev/E2E seams write product state through owners',
    tier: 3,
    laws: ['L-A2'],
    blastRadius: 'accepted_content',
    founding: 'defaultDevE2ESeedCoordinator.ts:303 writes through the raw primitive; its '
      + 'profile calls already land on the one door and are therefore taped and refusable.',
    size: 'S',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'Its one call site is already counted by LR-1\'s detector.',
  },
  {
    id: 'LR-18',
    title: 'workoutLogStore is in-memory',
    tier: 3,
    laws: ['L-C1', 'L-C2'],
    blastRadius: 'honesty',
    founding: 'workoutLogStore.ts has no persist(...), so logged sets do not survive a '
      + 'relaunch. Four readers. Either a real data-loss defect or dead code.',
    size: 'S',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'Diagnosis first, then a ruling. Whether an absent persist() is a '
      + 'defect depends on whether the surface that feeds it is meant to exist.',
  },
  {
    id: 'LR-19',
    title: 'Position feeds identity',
    tier: 3,
    laws: ['L-A5'],
    blastRadius: 'visible_week',
    founding: 'Row order standing in for role. Queued from the power-row redesign and '
      + 'named in MASTER_PLAN PART 3 as a known instance of Sam\'s standing class.',
    size: 'M',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'Carried from the power-row reassessment without independent '
      + 're-derivation in this census. Needs its own founding read before a detector '
      + 'could be designed.',
  },
  {
    id: 'LR-20',
    title: 'Role-vocabulary collapse',
    tier: 3,
    laws: ['L-A1', 'L-B6'],
    blastRadius: 'visible_week',
    founding: 'The second unit queued from the power-row redesign.',
    size: 'M',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'Same as LR-19 — carried from its originating report, not '
      + 're-derived here.',
  },
  {
    id: 'LR-21',
    title: 'InjuryTag vs the injury-matrix region vocabulary',
    tier: 3,
    laws: ['L-A1', 'L-B6'],
    blastRadius: 'visible_week',
    founding: 'Two 13-region vocabularies — exercisePools.ts:35\'s InjuryTag union and the '
      + 'injury matrix\'s authored regions — with no gate holding them equal, beside 1,937 '
      + 'authored cells that assume they are.',
    size: 'S',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'The defect is a disagreement between two lists, so the check is an '
      + 'equality assertion in the unit itself, not a count of anything.',
  },
  {
    id: 'LR-22',
    title: 'Producer fixtures',
    tier: 3,
    laws: ['L-D3', 'L-E3'],
    blastRadius: 'gates',
    founding: 'test:plan-change-producer is assert_fail on main (rot sweep line 137). Its '
      + 'fixtures predate move-scoping and G-1 ownership.',
    size: 'S',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'A red suite is found by running it — LR-14 is the unit that does '
      + 'that systematically; this is its largest single instance.',
  },
  {
    id: 'LR-23',
    title: 'Coach clarifier and context stores are in-memory',
    tier: 3,
    laws: ['L-B3', 'L-C1'],
    blastRadius: 'honesty',
    founding: 'pendingCoachClarifierStore and coachContextStateStore have no persist(...), '
      + 'so a clarifier spent across a relaunch and coach context rebuilt from nothing are '
      + 'both silent.',
    size: 'S',
    status: 'scheduled',
    detector: null,
    whyNotDetectable: 'Diagnosis first, as with LR-18.',
  },
  {
    id: 'LR-24',
    title: 'Action-log coverage completion (= 5D.3 remainder)',
    tier: 3,
    laws: ['L-D1', 'L-D2'],
    blastRadius: 'gates',
    founding: 'The tape covers the transaction owners and the profile store. It does not '
      + 'cover the eleven unowned stores or the raw program-write primitive.',
    size: 'S',
    status: 'scheduled',
    sequence: 'Lands WITH LR-1 and LR-2, not before. A tape over a store with no write '
      + 'owner records writes it cannot attribute.',
    detector: null,
    whyNotDetectable: 'Its subject is the tape coverage of LR-1 and LR-2\'s surfaces, '
      + 'which those units\' detectors already count. A third count of the same '
      + 'references would corrupt the baseline.',
  },
  {
    id: 'LR-25',
    title: 'The plan-change producer\'s legacy tail — deleted ahead of its ruling',
    tier: 2,
    laws: ['L-A1', 'L-C1'],
    blastRadius: 'accepted_content',
    founding: 'Stage B stage 1 Task A (2026-08-04) removed BOTH '
      + 'applyCoachRevisionDateOverrides call sites from planChangeProducer, not only '
      + 'the two athlete routes Sam\'s Option C ruling named. The reachability was '
      + 'verified — the six athlete-owned kinds return from the typed branch above it; '
      + 'shutdown_week has no product constructor at all; clear_days is constructed '
      + '(useHomeScreen) but only as payload METADATA on a set_schedule_modifier '
      + 'action, whose non-durable case refuses outright and whose durable lane never '
      + 'calls applyPlanChange; move_team_night is durable-door owned and its refusal '
      + 'sentence is byte-identical because both codes collapse through '
      + 'athleteSafeRefusal. Behaviour delta: the tape\'s internalResultCode and '
      + 'firstFailingBoundary for a tail refusal.',
    size: 'S',
    status: 'scheduled',
    sequence: 'RECORDED, NOT RULED (Sam, 2026-08-04): "out of scope tonight — own unit, '
      + 'own ruling. Record it in the census, don\'t smuggle it in." The deletion is '
      + 'currently PRESENT in the stage 1 branch commit 0221d4d and is separable: '
      + 'restoring the tail is mechanical, and the restoration capability plus the '
      + 'defer-set deletion (what Option C actually ordered) stand without it. Sam '
      + 'rules whether it stays, reverts, or lands as its own unit.',
    detector: null,
    whyNotDetectable: 'Its subject is the ABSENCE of the two call sites LR-3 already '
      + 'counts. LR-3\'s declared count fell 4 -> 2 in the same commit, so a second '
      + 'detector over the same references would double-count the same payment.',
  },
  {
    id: 'LR-26',
    title: 'The reversible-adjustment ledger stores workout snapshots it never reads back',
    tier: 2,
    laws: ['L-A1'],
    blastRadius: 'accepted_content',
    founding: 'Measured 2026-08-04 (Stage B stage 1, scratch probe): a bin -> re-add '
      + 'cycle grows reversibleAdjustmentLedger by ~227 KB — two adjustments at ~113 KB '
      + 'each, because displacedOriginalState.ownedDays carries full before/after '
      + 'Workouts including beforeDateOverride/afterDateOverride '
      + '(acceptedStateTransaction.ts:1386-1401). Uncapped: 20 cycles ~ 4.9 MB of store '
      + 'state. It is what exhausted a 12 GB heap when the walker\'s shrinker replayed '
      + 'a deep walk 200 times.',
    size: 'M',
    status: 'scheduled',
    sequence: 'RULED (Sam, 2026-08-04): capping or compressing the snapshot is REJECTED '
      + '— both accept the premise that the snapshot belongs there, and it does not. '
      + 'Full workout snapshots are stored OUTPUT sitting inside a decision record, and '
      + 'nothing reads them back. The north star answer is DELETE the snapshot, keep '
      + 'the decision, and re-derive the restored state at read. Not implemented '
      + '2026-08-04; own unit.',
    detector: null,
    whyNotDetectable: 'Its subject is the SIZE and reachability of a field, not the '
      + 'presence of a symbol. A detector counting displacedOriginalState references '
      + 'would count the restore machinery that legitimately reads the decision, and '
      + 'go green the moment the field was renamed.',
  },
];

/**
 * The sum of every declared count: 0 + 0 + 4 + 72.
 *
 * Direction 3 keeps this equal to the live total, so paying debt down tightens
 * the ratchet rather than leaving slack somebody can spend later. LR-4 paid
 * down 74 → 72 when a retired week-overlay writer's clear-adjustment path was
 * deleted entirely (HOME_SCREEN_REDESIGN ruling 1, 2026-07-31): its two
 * `useProfileStore` single-expression reads (one in the reversible-adjustment
 * transaction store, one in the Explorer production bindings' now-excluded
 * action case) went with it. LR-2 paid down 11 → 9 with the store-armour
 * recipe's two proving applications (prefs + calendar, 2026-08-03), 9 → 7
 * when the readiness and coach-updates stores took their doors in the fleet
 * phase, 7 -> 5 when the coach-preferences and coach-mutation-history
 * stores took theirs, 5 -> 3 with the coach chat + coach memory pair
 * (wave 2a) and the auth + ui tail, landing at 1: `programStore` alone
 * remains, and it is LR-1's, not LR-2's (2026-08-03). The auth + ui shells
 * then RETIRED WHOLE (Sam's §6 ruling, 2026-08-03) — no counter moves,
 * because both were already owned; a deleted store is simply no longer a
 * persisted store the detector can see.
 *
 * Then LR-1 and LR-2 PAID TOGETHER, 2026-08-03, as Sam's sequencing ruled they
 * would: the program store's raw `setManualOverride` primitive is retired and
 * its twenty-seven references route through one named door, so LR-1 goes 27 ->
 * 0 and LR-2's last count — the program store itself — goes 1 -> 0. Baseline
 * 104 -> 76. Every persisted store in this app now has a write owner.
 */
export const LEGACY_DEBT_BASELINE = 74;

/**
 * Frozen 2026-07-30 at the number the census landed with. DIRECTION 4.
 *
 * This is what makes the ratchet non-circular. Directions 2 and 3 both compare
 * the total against LEGACY_DEBT_BASELINE, so raising both together would keep
 * the gate green — exactly how a newcomer declares a fresh violation into a
 * census instead of fixing it. Against this number that move is red.
 *
 * It must equal the sum of the per-unit `foundingCount`s, so it cannot be
 * edited on its own to create headroom nothing accounts for.
 *
 * Raising it is a RULING, not an edit. If a genuine pre-law surface was missed
 * by the founding sweep, say so in the census document, get it ruled, and raise
 * the unit's founding count and this total together — with the sweep that
 * missed it named.
 */
export const LEGACY_DEBT_FOUNDING_BASELINE = 116;

/**
 * The census was founded with 24 units, and holds 25 by RULING. DIRECTION 4c.
 *
 * Per-unit ceilings stop debt migrating between existing units; this stops a
 * newcomer manufacturing headroom by adding one more. The census may SHRINK as units
 * are paid off and deleted — that is required, so it can die — but it may not grow
 * without a ruling.
 *
 * 24 -> 25 on 2026-07-30, and the ruling is quoted on the LR-27 entry above: Sam queued
 * the body-part vocabulary collapse as its own census unit while ruling the injury
 * "Other" path. The gate's own instruction is what this follows — "name the sweep that
 * missed it and get it ruled, do not file it in quietly" — and the sweep that missed it
 * is the founding sweep, which counted stores and writers rather than asking two phrase
 * maps the same word.
 *
 * 25 -> 27 on 2026-08-04, both by RULING, both during Stage B stage 1. Sam:
 *
 *   LR-25 — "Legacy tail deletion: out of scope tonight. Own unit, own ruling.
 *   Record it in the census, don't smuggle it in."
 *   LR-26 — "Cap and compress both accept the premise that the snapshot belongs
 *   there. It doesn't … The north star answer is DELETE the snapshot, keep the
 *   decision, re-derive at read. Record it as a ruled unit."
 *
 * THE SWEEP THAT MISSED THEM, named as the gate demands — and they are missed
 * differently, which matters:
 *
 *   LR-25 was not missed at all. It is a surface this repo CREATED on 2026-08-04,
 *   when Task A deleted more of the producer than Option C ordered. A census entry
 *   for a change made hours earlier is not debt discovered; it is scope declared so
 *   it cannot ride along inside another unit's payment. If Sam rules the deletion
 *   in, the entry retires with it.
 *
 *   LR-26 WAS missed, by the same blind spot as LR-27: the founding sweep counted
 *   STORES AND WRITERS — shapes present in the source — and never asked what a
 *   legitimately-owned store puts INSIDE a record it owns. A decision ledger is a
 *   correct thing to have; a decision ledger carrying full workout snapshots nobody
 *   reads back is stored output wearing a decision's name, and no detector built to
 *   count writers could see it. It took a heap exhaustion to surface.
 */
export const LEGACY_CENSUS_FOUNDING_UNIT_COUNT = 27;

/**
 * WHAT DIRECTION 4 IS NOT, stated so nobody over-trusts it.
 *
 * No constant in a file makes an edit impossible; every number here is editable.
 * What the three clauses do is remove every route that looks like ordinary
 * bookkeeping and leave only routes that read as a lie in a diff: lowering a
 * `foundingCount` (which records a measurement), raising a constant whose name
 * carries its founding date, or adding a twenty-fifth unit to a list that says
 * it was founded with twenty-four.
 *
 * The genuinely stronger form is to compare against the value committed in git
 * rather than the value in the file — history is the one input an editor cannot
 * set. That was considered and not built: it would make the gate depend on git
 * being present and on a non-shallow clone, which is a real cost for a tripwire
 * that is already loud. If the raise-both move is ever actually attempted, that
 * is the escalation.
 */
export const DIRECTION_4_IS_A_TRIPWIRE_NOT_A_PROOF = true;
