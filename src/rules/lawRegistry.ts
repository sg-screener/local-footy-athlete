/**
 * THE LAW REGISTRY — provenance for RULES, the way `signedCopy` gave provenance
 * to WORDS.
 *
 * ## WHY THIS FILE EXISTS, IN SAM'S WORDS
 *
 * 2026-08-10, verbatim: *"how do we make sure all the laws we have written in the
 * past are held up now? it feels like i constantly give a fix and a law or
 * whatever and then believe you will remember and you never fucking do"*
 *
 * He is right, and the seat measured it rather than answering it with a promise:
 * **375 docs, 131 named ruling/law/boundary docs, 15 audits, 692
 * RULING/LAW/"Sam ruled"/"signed" markers across 193 source files, 16 laws in
 * AGENTS.md, 328 `test:*` scripts of which 175 are in the chain — and no mapping
 * from any law to the thing that holds it.**
 *
 * The July 2026 content-conservation invariant lived in a test header and an
 * audit doc and was **rediscovered twice**, most recently on 2026-08-10 when a
 * move onto a team night was caught deleting a row while reporting *"Done.
 * Session moved."* That is a missing mechanism, not a memory failure.
 *
 * ## WHAT A ROW MEANS, AND WHY THERE ARE ONLY TWO STATES
 *
 * `guarded` names the cell/tape/gate that FAILS when the law breaks.
 * `UNENFORCED` names, in one line, what a guard would take.
 *
 * There is deliberately **no third state**. "Important, everyone knows it,
 * nobody checks it" is the state that produced this week, and a union of two
 * makes it unrepresentable. A row whose guard is not in `test:bible` is
 * **`chainStatus: 'outside_chain'`** and counts as unguarded for reporting: a
 * check nobody runs is not a check.
 *
 * ## THIS FILE IS DATA. IT IS NOT A GATE, AND THAT IS DELIBERATE.
 *
 * The seat's order for this pass: *"Answer per law with a receipt, and do not
 * write a guard yet — the first output is the honest map, because a map with
 * UNENFORCED rows on it is worth more than a guard built in the dark."*
 *
 * **The gate over this registry is NOT built.** When it is, it reds when a law
 * has neither state, when a named guard does not exist, or when a guard names a
 * script outside `test:bible`. Until then this registry is a measurement, and
 * `UNENFORCED_COUNT` below is the number Sam steers by — the same way the parity
 * census's NO column is what he picks build order from.
 *
 * ## SCOPE — BATCH 1 ONLY, AND THE REST IS NAMED RATHER THAN IMPLIED
 *
 * This is (a) the AGENTS.md laws, (b) L-C1..L-C4, (c) the laws central to the
 * 2026-08-10 passes. **131 named ruling docs are NOT harvested here** and none
 * of them should be read as covered. Batching was the order; pretending
 * otherwise would be the same failure one level up.
 */

/** What holds a law, or the honest absence of it. Exactly two shapes. */
export type LawGuard =
  | {
      readonly state: 'guarded';
      /** The npm script or named cell that FAILS when the law breaks. */
      readonly by: string;
      /** Whether that guard is reached by `npm run test:bible`. */
      readonly chainStatus: 'in_chain' | 'outside_chain';
      /** How this was verified, so the row is a receipt and not a belief. */
      readonly receipt: string;
    }
  | {
      readonly state: 'UNENFORCED';
      /** One line: what building a guard would actually take. */
      readonly wouldTake: string;
      /** How the absence was verified. */
      readonly receipt: string;
    };

export interface LawRow {
  /** Stable id. Never renumbered — rows are retired, not reused. */
  readonly id: string;
  /** The law in ONE plain-English sentence. Sam must be able to read the list. */
  readonly law: string;
  /** Where it was ruled: file, doc, Bible line, or the date Sam said it. */
  readonly ruledAt: string;
  readonly guard: LawGuard;
}

/**
 * BATCH 1. Verified 2026-08-10 by reading `package.json`'s script list, the
 * `test:bible` chain string, and grepping the suites named in each receipt.
 */
export const LAW_REGISTRY: readonly LawRow[] = [
  // ── (a) THE AGENTS.md LAWS ────────────────────────────────────────────────
  {
    id: 'LAW-0-registry',
    law: 'No law is recorded anywhere without a registry row and a guard, or an explicit UNENFORCED row with a reason.',
    ruledAt: 'AGENTS.md "LAW ZERO"; Sam 2026-08-10',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A chain gate over this file: red when a row has no state, when a named guard does not exist as a script, or when a guard is outside test:bible.',
      receipt: 'This file is data only; no test:* script reads it (grep lawRegistry over src/__tests__ returns nothing).',
    },
  },
  {
    id: 'LAW-coach-no-phrase-handlers',
    law: 'Coach bugs are fixed at the typed intent/context/executor layer, never as phrase-by-phrase special cases.',
    ruledAt: 'AGENTS.md "Coach Intelligence Rules"; CLAUDE.md',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate counting phrase-literal branches in the coach read/proposal path and failing on growth — the shape signedCopy uses for strings.',
      receipt: 'No test:* script names phrase handlers; the coach slice suites assert typed output, not the absence of phrase branching.',
    },
  },
  {
    id: 'LAW-coach-escalation',
    law: 'After the same class of coach bug twice, stop coding and produce an architecture reassessment before adding another resolver or guard.',
    ruledAt: 'AGENTS.md "Coach Architecture Escalation Rule"; CLAUDE.md',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Not mechanisable as a cell — it governs what a person does next. Its honest guard is a seat checklist item, and it should be marked PROCESS rather than left looking cell-able.',
      receipt: 'Process law; no script can observe "the same class twice".',
    },
  },
  {
    id: 'LAW-elegant-two-options',
    law: 'When asked for the most elegant solution, compare an incremental fix against an ownership redesign before coding.',
    ruledAt: 'AGENTS.md "Elegant Solution Requirement"; CLAUDE.md',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'PROCESS law. A boundary-report field ("options compared") plus a seat check is the realistic guard.',
      receipt: 'Process law; no script observes deliberation.',
    },
  },
  {
    id: 'LAW-dedup-ungates',
    law: 'De-duplicating values can silently remove the gate that watched them, so a tidy-up must prove the gate still fires.',
    ruledAt: 'AGENTS.md "De-duplication can silently un-gate the values it tidies"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Mutation-testing as a standing gate rather than a per-pass habit; nothing currently proves a gate still fires after a refactor.',
      receipt: 'No test:* script named for de-duplication or gate-liveness.',
    },
  },
  {
    id: 'LAW-count-names-instrument',
    law: 'A number names the instrument\'s unit, not the domain noun — emit occurrences AND distinct.',
    ruledAt: 'AGENTS.md "A count names the instrument\'s unit"; sighting 14',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A lint over report-emitting suites requiring both counts wherever one is printed. The law is about how results are REPORTED, which no current gate inspects.',
      receipt: 'test:power-counting and test:row-counting are in the chain but gate DOMAIN counting rules, not this reporting law.',
    },
  },
  {
    id: 'LAW-anchor-smallest-declaration',
    law: 'Anchor a source-reading cell on the smallest declaration that carries the claim, never on the region that carries the work.',
    ruledAt: 'AGENTS.md "The same law again — its subject is ANCHORING" (L12 family)',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate over source-reading cells forbidding character-window regexes ({0,N}) around JSX/function bodies.',
      receipt: 'Violated and repaired by hand this pass: coachTabSlice3Tests\' composer cell used a {0,200} window, was widened to 600, then re-anchored and the bound deleted. Nothing would have caught the widening.',
    },
  },
  {
    id: 'LAW-claim-needs-a-cell',
    law: 'A sentence saying the app does or does not do X, anywhere Sam reads it, is pinned by a named cell or written OPEN-UNKNOWN.',
    ruledAt: 'AGENTS.md "A behaviour claim the owner can read is held by a CELL"; seat-ruled 2026-08-10',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate parsing docs/NOW.md and boundary reports for behavioural sentences and requiring an adjacent cell name or OPEN-UNKNOWN marker.',
      receipt: 'grep for DOC-TRUTH and OPEN-UNKNOWN across src/ returns ZERO files. The law that this week leaned on hardest has no guard at all.',
    },
  },
  {
    id: 'LAW-not-covered-real-data-blocks',
    law: 'A NOT-COVERED item naming a shape of REAL data is a blocking gap, not a disclosure.',
    ruledAt: 'AGENTS.md "A NOT-COVERED item naming a shape of REAL data is a blocking gap"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate that reads boundary docs\' NOT-COVERED sections and fails when one names real-data shapes without an opened unit.',
      receipt: '21 suites PRINT their own NOT COVERED lines; none READS anyone else\'s. Founding case this week: the sixty-second boundary\'s own NOT-COVERED predicted the day shapes its fixtures could not hold, and nothing acted on it.',
    },
  },
  {
    id: 'LAW-instrumentation-alive',
    law: 'Instrumentation must be alive where the defects are — a dead or unrun instrument is not coverage.',
    ruledAt: 'AGENTS.md "Instrumentation must be alive where the defects are"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A staleness gate over .maestro flows and tapes: fail when a named instrument has not run against the current app.',
      receipt: 'Founding case, measured 2026-08-10: eight of eleven Maestro flows had crashed on their first command for 23 DAYS, invisible because the only flow that could launch was not the one anybody ran. test:pipeline-instrumentation exists but is NOT in test:bible.',
    },
  },
  {
    id: 'LAW-no-hand-built-fixtures',
    law: 'Hand-built state fixtures are deprecated for athlete-facing suites; reach the world by acting or by a device-exact seed.',
    ruledAt: 'AGENTS.md "Hand-built state fixtures are deprecated for athlete-facing suites"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate listing athlete-facing suites that construct Workout/program literals directly instead of using buildDevE2ESeed or a generator.',
      receipt: '14 files use buildDevE2ESeed; 27 files still mention hand-built state. Nothing distinguishes a permitted hand-build from a banned one.',
    },
  },
  {
    id: 'LAW-L11-matrix-before-phone',
    law: 'The matrix comes before the phone — a defect class gets a written matrix before device time is spent on it.',
    ruledAt: 'AGENTS.md "L11 — The matrix before the phone"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'PROCESS law; a seat checklist is its realistic guard.',
      receipt: 'Process law; no script observes ordering of work.',
    },
  },
  {
    id: 'LAW-L12-verification-reviewed',
    law: 'Verification strategy is reviewed like code — how a claim is checked is itself subject to review.',
    ruledAt: 'AGENTS.md "L12 — Verification strategy is reviewed like code"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'PROCESS law, but its ANCHORING corollary is mechanisable — see LAW-anchor-smallest-declaration.',
      receipt: 'Process law.',
    },
  },
  {
    id: 'LAW-L13-walker-accumulated',
    law: 'The walker must reach ACCUMULATED state, not a freshly-built one.',
    ruledAt: 'AGENTS.md "L13 — The walker reaches ACCUMULATED state"',
    guard: {
      state: 'guarded',
      by: 'test:action-walker',
      chainStatus: 'in_chain',
      receipt: 'athleteActionWalkerTests.ts carries an explicit liveness check ("Did THIS walk ever fail to roll a block?", :323) and depth reporting; suites print their own DEPTH (L13) line. test:action-walker and test:action-walker:deep are both in the chain (test:action-walker:extended is NOT). NOTE: this row first named `test:athlete-action-walker`, which does not exist — caught by resolving the name rather than trusting it, which is the whole point of the row.',
    },
  },
  {
    id: 'LAW-L14-domain-purity',
    law: 'Domain rules are pure — a rules module takes explicit inputs and reaches no store.',
    ruledAt: 'AGENTS.md "L14 — Domain purity"',
    guard: {
      state: 'guarded',
      by: 'test:bible (bibleConformance/expectations/importBoundaryTests.ts)',
      chainStatus: 'in_chain',
      receipt: 'importBoundaryTests asserts import boundaries; coachTabSlice1Tests additionally asserts the coach screen\'s import list by name. PARTIAL: it gates imports, not store reads reached indirectly.',
    },
  },
  {
    id: 'LAW-L15-one-write-format',
    law: 'One write format — a superseded shape survives only as a lift, never as a second live writer.',
    ruledAt: 'AGENTS.md "L15 — One write format"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate enumerating writers per stored shape and failing on a second live one.',
      receipt: 'L15 appears in 26 files as commentary only; no test:* script is named for it.',
    },
  },
  {
    id: 'LAW-L16-vertical-slice',
    law: 'Vertical slice first — ship a thin path end to end before widening it.',
    ruledAt: 'AGENTS.md "L16 — Vertical slice first"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'PROCESS law; seat checklist.',
      receipt: 'Process law.',
    },
  },
  {
    id: 'LAW-totals-or-red',
    law: 'A suite is born failing and only its own printed totals line clears it.',
    ruledAt: 'AGENTS.md "Test Standard"; Sam 2026-08-03',
    guard: {
      state: 'guarded',
      by: 'test:totals-or-red-law',
      chainStatus: 'in_chain',
      receipt: '174 suites call armTotalsOrRed()/totalsPrinted(); the law has its own chain script. THE STRONGEST ROW IN THIS REGISTRY and the shape the others should copy.',
    },
  },
  {
    id: 'LAW-seat-coordination',
    law: 'The seat writes orders in ## Unprocessed; terminal-owned blockers and holds live below it, never mixed in.',
    ruledAt: 'AGENTS.md "Seat coordination laws"; Sam 2026-08-07; amended 2026-08-10',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate over docs/SEAT_INBOX.md section structure.',
      receipt: 'Violated and repaired by hand on 2026-08-10 (commit 74070cf2) — exactly the class a structural gate would have caught.',
    },
  },

  // ── (b) THE COACH REBUILD LAWS ────────────────────────────────────────────
  {
    id: 'LAW-LC1-brain',
    law: 'The coach\'s knowledge IS the Bible plus Sam\'s recorded rules — it invents no coaching opinion of its own.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:21',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice2',
      chainStatus: 'in_chain',
      receipt: 'coachTabSlice1/2/3Tests all cite L-C1; slice 2 validates every reply against a frozen truth gate. PARTIAL: the gate is a PHRASE list, which cannot see an omission — see LAW-conservation.',
    },
  },
  {
    id: 'LAW-LC2-change-card',
    law: 'No coach mutation without the card — what changes, from what, to what and why, before the athlete\'s yes.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:32',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice3',
      chainStatus: 'in_chain',
      receipt: 'coachProposal returns action and card together or neither, so "executable without a card" is unrepresentable; slice 3 asserts the pairing and that the card composes no string of its own.',
    },
  },
  {
    id: 'LAW-LC3-nike-bar',
    law: 'Interaction quality is a gate: no control hidden behind the keyboard, no dead tap zones.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:38',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice3 section [6]',
      chainStatus: 'in_chain',
      receipt: 'SOURCE-ONLY, and the law is about GLASS. The .maestro/keyboard matrix that would measure it has NEVER EXECUTED. Treat this row as source-shape only until that flow runs.',
    },
  },
  {
    id: 'LAW-LC4-parity',
    law: 'The coach can do exactly what the athlete\'s own surfaces can do, and offers the same choices from the same owner.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:46; census docs/COACH_PARITY_CENSUS_2026-08-10.md',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice3 section [8]',
      chainStatus: 'in_chain',
      receipt: 'Added 2026-08-10 with census row 1: compares the coach\'s offered scope ids against the owner\'s list. Mutation-tested — blanking the owner read reds exactly four cells. COVERS ONE of 26 action types; the other 25 are UNENFORCED by construction.',
    },
  },

  // ── (c) THE LAWS CENTRAL TO THIS WEEK ─────────────────────────────────────
  {
    id: 'LAW-conservation',
    law: 'A pure Move or Swap conserves the multiset of athlete-owned session identities, and reporting success implies conservation.',
    ruledAt: 'src/__tests__/athleteMoveOccupiedContentLossTests.ts header; docs/audits/MOVE_OCCUPIED_CONTENT_LOSS_2026-07-23.md',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A DOOR-LEVEL post-condition: every action claiming MOVE or SWAP compares the identity multiset before and after, once, where all of them pass — and an action that cannot conserve does not report success.',
      receipt: 'THE ROW THAT PROVES THE REGISTRY IS NEEDED. test:athlete-move-occupied-content-loss IS in the chain and green — but it guards TWO PATHS, not the law. On 2026-08-10 a move onto a team night deleted a power row (8 rows in, 7 out) while reporting "Done. Session moved.", on a path no cell reaches. Rediscovered twice.',
    },
  },
  {
    id: 'LAW-do-not-lose-the-session',
    law: 'The Bible\'s Move rules: a session the athlete owns is never silently destroyed by a plan change.',
    ruledAt: 'Training Bible, Move rules',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'The same door-level post-condition as LAW-conservation — these are the domain and the invariant statement of one rule.',
      receipt: 'Same 2026-08-10 measurement. The coach\'s own truth gate CANNOT catch it: FORBIDDEN_WHEN_NO_APPLIED is a list of PHRASES, and "Done. Session moved." is TRUE — a session did move. No phrase list can see a deletion.',
    },
  },
  {
    id: 'LAW-doc-truth',
    law: 'A "built" or "fixed" claim in any doc carries a code receipt, and a doc that outlives its subject is corrected.',
    ruledAt: 'AGENTS.md doc-truth family; repeatedly cited in boundary reports',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate that resolves doc claims to named receipts — the same shape as test:copy-rulings-binding, which already does this for copy.',
      receipt: 'grep DOC-TRUTH across src/ returns ZERO files. Violated and repaired by hand this pass: the content-loss suite header still said "M2/M3/M4 are expected to FAIL" when the suite runs 2 cells, both PASS.',
    },
  },
  {
    id: 'LAW-liveness',
    law: 'A green gate is a claim: a gate must be shown to fail when its subject breaks.',
    ruledAt: 'AGENTS.md; memory law "A green gate is a claim"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Standing mutation-testing in the chain, or a per-suite liveness assertion of the kind athleteActionWalkerTests already carries.',
      receipt: 'One liveness check exists in the whole repo (athleteActionWalkerTests.ts:323). Mutation testing is a per-pass habit, done by hand this pass on four cells, and nothing requires it.',
    },
  },
];

/** Rows whose law has nothing holding it — the list Sam steers by. */
export const UNENFORCED_LAWS: readonly LawRow[] =
  LAW_REGISTRY.filter((row) => row.guard.state === 'UNENFORCED');

/**
 * A guard outside `test:bible` counts as unguarded for reporting: a check nobody
 * runs is not a check. No Batch 1 row is currently in this state, which is the
 * one piece of good news on the sheet.
 */
export const GUARDS_OUTSIDE_THE_CHAIN: readonly LawRow[] =
  LAW_REGISTRY.filter((row) =>
    row.guard.state === 'guarded' && row.guard.chainStatus === 'outside_chain');
