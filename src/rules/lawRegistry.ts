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
 * ## THIS FILE IS GATED, AND `UNENFORCED` IS RED.
 *
 * **CORRECTED 2026-08-10.** This header used to say the file was data only and
 * that the gate over it was deliberately not built. That was true for one pass
 * and is now false. `test:law-registry`
 * (`src/__tests__/lawRegistryGateTests.ts`) is in the `test:bible` chain and
 * **FAILS while any row below reads `UNENFORCED`**.
 *
 * **Sam, 2026-08-10, verbatim:** *"WHY CAN'T YOU JUST MAKE SURE EVERY FUCKING
 * RULE IS FOLLOWED FROM RIGHT NOW"*. The answer is that we can, and treating the
 * UNENFORCED rows as a backlog with a shrinking count was the seat scheduling a
 * principle he had already ruled. **The red does not mean the app broke: it
 * means the app has never been checked against these rules, and from now that
 * counts as failing.** A rule with nothing watching it is a rule not followed.
 *
 * There is no high-water mark, no grandfathering and no dated debt. The only
 * way a row clears is a real guard, in the chain, named here.
 *
 * ## SCOPE — BATCH 1 + THE BATCH 2 AUDIT AND SWEEP
 *
 * Batch 1 was (a) the AGENTS.md laws, (b) L-C1..L-C4, (c) the laws central to
 * the 2026-08-10 passes.
 *
 * **BATCH 2 (2026-08-10, item 000(A)) AUDITED EVERY BATCH-1 ROW AGAINST ITS
 * CITED SOURCE AND FOUND THE REGISTRY WRONG ON DAY ONE.** One row carried a
 * DIFFERENT LAW than its id named (`LAW-liveness`), and **four rows cited
 * sources that do not say what the row claims** — including one on a GUARDED
 * row. Then it swept for laws with no row at all and found **thirty**: the
 * whole of Process Law L1–L10, the north star itself, and every seat law in
 * the handoffs.
 *
 * **131 named ruling docs are still NOT harvested** and none of them should be
 * read as covered. The sweep started from the seat's list and did not stop at
 * it, but it is not exhaustive and does not claim to be.
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
    // AUDITED 2026-08-10 (batch 2). The text used to end "...or an explicit
    // UNENFORCED row with a reason." Sam withdrew that clause the same day —
    // no new law may enter as UNENFORCED — and AGENTS.md no longer says it.
    law: 'No law is recorded anywhere without a registry row and a guard.',
    ruledAt: 'AGENTS.md "LAW ZERO" + "UNENFORCED IS RED"; Sam 2026-08-10',
    guard: {
      state: 'guarded',
      by: 'test:law-registry',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 on Sam\'s stop-the-line ruling. src/__tests__/lawRegistryGateTests.ts reds when a row is malformed, when a named guard is not a real script, when a chainStatus disagrees with package.json, when a guard sits outside test:bible, and — the stop cell — when ANY row reads UNENFORCED. Its liveness cell feeds each checker a fabricated bad row, including the real test:athlete-action-walker ghost the registry caught on its first read.',
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
    // AUDITED 2026-08-10: ruledAt claimed "sighting 14". The cited section says
    // "Seat-endorsed 2026-08-07 at the THIRD sighting"; 14 is this terminal's
    // running tally, not something the ruling site records. Cite the site.
    ruledAt: 'AGENTS.md "A count names the instrument\'s unit, not the domain noun" (seat-endorsed 2026-08-07)',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A lint over report-emitting suites requiring both counts wherever one is printed. The law is about how results are REPORTED, which no current gate inspects.',
      receipt: 'test:power-counting and test:row-counting are in the chain but gate DOMAIN counting rules, not this reporting law.',
    },
  },
  {
    // RENAMED FROM `LAW-anchor-smallest-declaration` BY THE 2026-08-10 AUDIT,
    // and the old id is RETIRED, never to be reused. The row carried a law the
    // cited section does not state: "smallest declaration" appears NOWHERE in
    // AGENTS.md (grep: one hit, and it is about clarifying questions). What the
    // section actually rules is below — prove the anchor was FOUND. The
    // smallest-declaration phrasing came from a boundary report, not a ruling,
    // and is now folded in as the practice the law implies rather than quoted
    // as if Sam had ruled it.
    id: 'LAW-anchor-must-be-found',
    law: 'Any assertion locating something in source by POSITION must prove every anchor was FOUND before claiming anything about their relationship.',
    ruledAt: 'AGENTS.md "The same law again — its subject is ANCHORING, not counting" (sighting 6, 2026-08-09)',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate over source-reading cells: every indexOf/slice/[\\s\\S]*? anchor must be asserted found (>= 0, non-empty) before any relational assertion — and forbid character-window regexes ({0,N}) around JSX/function bodies, which is the same law\'s practice half.',
      receipt: 'The founding case returned green with the anchor MISSING (indexOf -1 compares less than everything). Violated and repaired by hand 2026-08-10: coachTabSlice3Tests\' composer cell used a {0,200} window, was widened to 600, then re-anchored. Nothing would have caught the widening.',
    },
  },
  {
    id: 'LAW-claim-needs-a-cell',
    law: 'A sentence saying the app does or does not do X, anywhere Sam reads it, is pinned by a named cell or written OPEN-UNKNOWN.',
    ruledAt: 'AGENTS.md "A behaviour claim the owner can read is held by a CELL"; seat-ruled 2026-08-10',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 on the surface Sam actually reads. The general form is not mechanisable; the highest-value INSTANCE is: every `\u26a0` block in docs/NOW.md — the single status surface — must carry a named cell/tape/commit or say OPEN-UNKNOWN / NOT ON GLASS. **FIRST RUN: 10 blocks, FIVE bare, TWO of them written the same day by the author of this cell.** All five now carry one. A completeness-word gate was measured FIRST and REJECTED — the whole of docs/ yields two hits and both use \'exhaustive\' descriptively, and a cell that cannot fail is worse than no cell. PARTIAL by construction: it holds that a receipt is PRESENT, not that it is the right one, and it reads NOW.md only — a claim in a boundary report or in chat is not covered.',
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
      wouldTake: 'Running the flows. A crash on launch — the founding case — is only visible to a flow that RUNS, which needs the simulator binary the rig is currently blocked on. **A PARTIAL guard now exists and deliberately did NOT flip this row: `test:repo-law-guards` holds that no flow names a missing file and no flow is unreachable from every script, doc and other flow. Neither would have caught eight flows crashing for 23 days.**',
      receipt: 'Founding case: eight of eleven Maestro flows crashed for 23 days on a missing launch parameter. The 2026-08-10 partial guard measured 22 flows, ZERO broken references and ZERO orphans — and getting to that number took FOUR corrections to the scan, each one a live flow wrongly called dead. Flipping this row on those cells would be the reads-as-covered failure the registry exists to catch.',
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
    // AUDITED 2026-08-10: ruledAt cited `AGENTS.md "Test Standard"`. That
    // section says nothing about totals-or-red — grep for "totals" over
    // AGENTS.md returns ONE hit, in a different law's worked example. A row
    // citing a section that does not carry its law is exactly the misfiling
    // this audit exists to find, and it was on the registry's strongest row.
    ruledAt: 'src/__tests__/support/totalsOrRed.ts header, quoting Sam 2026-08-03: "TOTALS-OR-RED IS LAW for every suite in test:bible — exit code armed red at module top, cleared only by the printed totals line."',
    guard: {
      state: 'guarded',
      by: 'test:totals-or-red-law',
      chainStatus: 'in_chain',
      receipt: '175 suites call armTotalsOrRed()/totalsPrinted(); the law has its own chain script which DERIVES the suite list from the test:bible chain string, so a suite cannot join the chain unenrolled. THE STRONGEST ROW IN THIS REGISTRY and the shape the others should copy.',
    },
  },
  {
    id: 'LAW-inbox-order-is-content',
    law: 'An unprocessed seat order stops the terminal from ending its turn, and an order is identified by its CONTENT, never by its numbering.',
    ruledAt: 'Sam 2026-08-10 (item 000(B), the courier toll); scripts/seat-inbox-hook.sh',
    guard: {
      state: 'guarded',
      by: 'test:seat-inbox-hook',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10. The hook matched `^1\\.` only, so every order the seat wrote as `00.`/`0.`/`000.` was INVISIBLE and the turn ended silently — Sam became the message bus and typed "check inbox" himself twice that day. SIGHTING 4 of the numbering-artefact class the hook\'s own comments already named twice. Rewritten to read content; 17 cells, both directions; the six new must-block cases red when the old `^1\\.` scan is restored (mutation run 2026-08-10). The suite existed but was in NO chain — measured and enrolled in the same commit.',
    },
  },
  {
    id: 'LAW-seat-coordination',
    law: 'The seat writes orders in ## Unprocessed; terminal-owned blockers and holds live below it, never mixed in.',
    // AUDITED 2026-08-10: ruledAt cited AGENTS.md "Seat coordination laws" for
    // BOTH halves. That section states the SEAT INBOX half; the
    // "terminal-owned blockers and holds live below it" half appears only in
    // SEAT_INBOX.md's own prose (lines 495, 630) and nowhere in AGENTS.md.
    // Cited honestly rather than upgraded to a law it was never written as.
    ruledAt: 'AGENTS.md "Seat coordination laws" (SEAT INBOX half, Sam 2026-08-07); the terminal-owned-section half is convention recorded in docs/SEAT_INBOX.md only and has never been ruled into AGENTS.md',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10. Reads docs/SEAT_INBOX.md STRUCTURE: exactly one `## Unprocessed`, it is the FIRST section, and a processed section exists below it. Violated and repaired by hand on 2026-08-10 (74070cf2) before this existed. NOT guarded by test:seat-inbox-hook, which reads the queue\'s CONTENT and says nothing about the document\'s shape. THE CHECKER WAS WRONG ON ITS OWN FIRST RUN — it trimmed lines and read an INDENTED QUOTATION of the law (SEAT_INBOX.md:317) as a second queue; a heading is only a heading at column 0, and that regression now has its own cell.',
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
      state: 'guarded',
      by: 'test:athlete-move-occupied-content-loss',
      chainStatus: 'in_chain',
      receipt: 'CORRECTED 2026-08-10 BY PRICING, AND THE CORRECTION IS THE POINT OF THE REGISTRY. This row first read UNENFORCED, claiming the law had no door. It has one: `detectAthleteMoveContentLoss` (acceptedStateTransaction.ts:3338) runs on EVERY move including the absorb path, rolls back in-memory and throws `athlete_move_content_not_conserved`. The law is guarded AT SESSION IDENTITY and correctly passed the 2026-08-10 case — the surviving object was the combined day. See docs/CONSERVATION_POSTCONDITION_PRICING_2026-08-10.md. The row-level gap is NOT this law; it is LAW-attributed-content-change below.',
    },
  },
  {
    id: 'LAW-attributed-content-change',
    law: 'Content may only leave a session for a declared reason, and a change the athlete did not ask for is told to them.',
    ruledAt: 'Named 2026-08-10 by pricing the conservation order — docs/CONSERVATION_POSTCONDITION_PRICING_2026-08-10.md',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'RE-PRICED 2026-08-10 BY THE XS, AND THE ORDERED M WORK IS WITHDRAWN. Threading the canonicaliser\'s typed `actions` out through 73 call sites would NOT have caught the measured defect. What a guard would actually take is not yet known — the next probe is one line: read the destination day\'s STORED rows beside the projected ones.',
      receipt: 'THE ROW THE 2026-08-10 DEFECT ACTUALLY BELONGS TO. `power_removed` is typed and reasoned (workoutCanonicalisation.ts:526,573) with reasons like game_proximity_power_blocked:G-2, and NO athlete-facing surface reads it. BUT — MEASURED 2026-08-10, docs/POWER_REMOVAL_REASON_XS_2026-08-10.md — on the case that loses a row, NOT ONE PRODUCER FIRES: five probes (the §18 weekly budget, both canonicalisation pushes, both safety-finaliser pushes, the stack path, and a wrapper over the canonical entry itself) all counted ZERO. The row leaves WITHOUT PASSING THE CANONICAL OWNER. And the instrument that measured "8 rows in, 7 out" reads a PROJECTION, so whether the row was deleted at all is OPEN-UNKNOWN.',
    },
  },
  {
    id: 'LAW-do-not-lose-the-session',
    law: 'The Bible\'s Move rules: a session the athlete owns is never silently destroyed by a plan change.',
    // AUDITED 2026-08-10: ruledAt read "Training Bible, Move rules". THERE IS
    // NO SUCH SECTION. docs/LFA_PROGRAMMING_BIBLE.md carries move guidance as
    // prose bullets (moving game day, busy/away weeks) and no "Move rules"
    // heading exists in it. Second ghost citation found by this audit, after
    // LAW-totals-or-red's — and the first was on a GUARDED row.
    ruledAt: 'docs/LFA_PROGRAMMING_BIBLE.md move guidance (prose bullets, no "Move rules" heading); enforced in practice by docs/audits/MOVE_OCCUPIED_CONTENT_LOSS_2026-07-23.md',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Subsumed by LAW-attributed-content-change: the session survives (LAW-conservation guards that); what is unguarded is content leaving it unexplained and untold.',
      receipt: 'Receipt CORRECTED 2026-08-10: this row first claimed the same missing door as LAW-conservation, which turned out to exist. The coach\'s truth gate still cannot catch the residue: FORBIDDEN_WHEN_NO_APPLIED is a list of PHRASES, and "Done. Session moved." is TRUE — a session did move. No phrase list can see a deletion.',
    },
  },
  {
    id: 'LAW-doc-truth',
    law: 'A "built" or "fixed" claim in any doc carries a code receipt, and a doc that outlives its subject is corrected.',
    // AUDITED 2026-08-10: ruledAt said "AGENTS.md doc-truth family", implying a
    // section. AGENTS.md mentions DOC-TRUTH exactly ONCE (line 297) and in
    // passing, inside another law. The ruling site is the seat handoff.
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_UNDO_COACH_ERA.md §2 "DOC-TRUTH LAW"; referenced once in AGENTS.md but never stated there',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate that resolves doc claims to named receipts — the same shape as test:copy-rulings-binding, which already does this for copy.',
      receipt: 'grep DOC-TRUTH across src/ returns ZERO files. Violated and repaired by hand this pass: the content-loss suite header still said "M2/M3/M4 are expected to FAIL" when the suite runs 2 cells, both PASS.',
    },
  },
  {
    // ─────────────────────────────────────────────────────────────────────
    // RENAMED FROM `LAW-liveness` BY THE 2026-08-10 AUDIT. THE OLD ID IS
    // RETIRED AND MUST NEVER BE REUSED — it named one law and carried another.
    //
    // The seat caught this reading the twenty out to Sam: the row's text is the
    // GATE law, and `LAW-liveness` is the id of a DIFFERENT law — the terminal
    // one, now filed below as `LAW-terminal-is-stopped-after-a-report`, which
    // had NO ROW AT ALL. A registry that misfiles a law is worse than no
    // registry, because it reads as covered.
    //
    // AND THE CITATION WAS A GHOST TOO, which the seat did not catch and this
    // audit did: ruledAt read `AGENTS.md; memory law "A green gate is a claim"`.
    // **grep over AGENTS.md for "green gate is a claim" returns NOTHING.** The
    // law lives in this terminal's private memory index and in boundary reports
    // that cite it as ruled. Its nearest repo-side statement is L12, which is
    // adjacent but not the same claim. THIRD ghost citation of this audit.
    // ─────────────────────────────────────────────────────────────────────
    id: 'LAW-green-gate-is-a-claim',
    law: 'A green gate is a claim: a gate must be shown to fail when its subject breaks.',
    ruledAt: 'NOT STATED IN THE REPO — carried only in the terminal\'s memory index and cited as ruled by boundary reports. AGENTS.md L12 ("Verification strategy is reviewed like code") is adjacent and does not say it. NEEDS A RULING SITE.',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Standing mutation-testing in the chain, or a per-suite liveness assertion of the kind athleteActionWalkerTests already carries. FIRST, THOUGH: write the law down somewhere Sam can read it — a law with no ruling site cannot be audited against one.',
      receipt: 'One liveness check exists in the whole repo (athleteActionWalkerTests.ts:323). Mutation testing is a per-pass habit, done by hand and required by nothing. test:law-registry\'s own liveness cell is the second, added 2026-08-10.',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH 2 — THE SWEEP FOR LAWS WITH NO ROW AT ALL (2026-08-10, item 000(A)).
  //
  // Sam: *"Report the new total and the new UNENFORCED count — the number
  // moving UP here is correct and expected, and is the last time it may."*
  //
  // Every row below was ruled somewhere and had NOTHING in this file. They are
  // grouped by where they were ruled, because that is what the audit read.
  // ══════════════════════════════════════════════════════════════════════════

  // ── THE LAW THE MISFILED ID WAS SUPPOSED TO NAME ──────────────────────────
  {
    id: 'LAW-terminal-is-stopped-after-a-report',
    law: 'A terminal ENDS ITS TURN at every report and is STOPPED until someone types at it; nobody claims a terminal is "working" without a commit or mtime receipt checked at the moment of speaking.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_UNDO_COACH_ERA.md §2 "LIVENESS LAW" (Sam-forced: "why would you fucking assume any are working"); restated docs/COWORK_SEAT_HANDOFF_2026-08-09_COACH_BUILD_ERA.md §0',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'The turn-ending half is already mechanised by the stop hook (see LAW-inbox-order-is-content). The unguarded half is the RECEIPT: no "working/building" claim without a checked commit/mtime. Guardable as a repo check over boundary reports and NOW.md — a liveness claim must sit beside a commit sha or an mtime, the same shape test:copy-rulings-binding uses for copy.',
      receipt: 'THE ROW THE SEAT CAUGHT MISSING. Born from the seat telling Sam "the terminal keeps building" twice while both windows had been idle for 20 minutes. Nothing in src/ or scripts/ reads a liveness receipt.',
    },
  },

  // ── THE NORTH STAR. IT HAD NO ROW, WHICH IS THE WORST ABSENCE ON THE SHEET ─
  {
    id: 'LAW-north-star',
    law: 'Store only decisions; derive everything else. New stored state that is not an input is presumed wrong.',
    ruledAt: 'docs/NORTH_STAR.md:11; CLAUDE.md requires it read FIRST',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A ratchet over the persisted surface: enumerate every key reaching disk (the boot registry test:stored-state-writer-audit already enumerates the STORES) and red when a NEW persisted key appears without a declared input classification. The census exists; the ratchet does not.',
      receipt: 'THE APP\'S OWN NORTH STAR AND IT HAD NO ROW. Every boundary report states whether the unit moved toward or away from it — by hand, in prose, judged by the author of the change. test:stored-state-writer-audit and test:persisted-inputs-schema are in the chain and guard WRITE BOUNDARIES and SHAPE, not whether a new stored thing should exist at all.',
    },
  },

  // ── PROCESS LAW L1–L10 (docs/MASTER_PLAN_2026-07-23.md PART 1) ────────────
  // Ten laws with the same force as L11–L16, and not one of them had a row.
  // Batch 1 harvested L11–L16 from AGENTS.md and stopped where AGENTS.md
  // stopped — AGENTS.md line 433 says L1–L10 live in the master plan, which
  // nobody followed. The registry inherited its predecessor's horizon.
  {
    id: 'LAW-L1-whole-app-scope',
    law: 'The test surface is the entire app as a new athlete meets it, not the unit under change.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L1',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Nothing mechanical scopes a sweep. Closest honest guard: require the walker (test:action-walker) to reach every athlete-facing door, which is the L13 shape one axis out.',
      receipt: 'No test:* script names whole-app scope. L13 is guarded and is a different claim (accumulated state, not full surface).',
    },
  },
  {
    id: 'LAW-L2-not-covered-section',
    law: 'Every report, sweep and audit carries a NOT-COVERED section; omitting it is itself a defect.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L2',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 over all 39 docs/*BOUNDARY*.md. Distinct from LAW-not-covered-real-data-blocks, which governs what a NOT-COVERED item MEANS; this one governs whether the section exists at all. FIRST RUN FOUND TWO REAL VIOLATIONS — R53_FIXTURE_BOOT_ORDER_BOUNDARY_2026-08-06.md and V3_BOUNDARY_BANKED_2026-08-07.md — carried as a NAMED, DATED exception list with a RATCHET cell: a doc leaves the list by gaining its section and nothing may join it.',
    },
  },
  {
    id: 'LAW-L3-cold-start',
    law: 'Every device sweep and the final QA include a cold-start pass.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L3',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A Maestro flow that kills and relaunches, in the rig that runs per sweep. Blocked today by the same simulator-binary blocker as everything else needing glass.',
      receipt: 'test:quiescent-boot and test:worn-world-boot are in the chain and cover BOOT logic in-process; neither is a cold start on a device.',
    },
  },
  {
    id: 'LAW-L4-device-is-arbiter',
    law: 'The device is the arbiter — a claim about athlete-facing behaviour is settled on the phone, not in a suite.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L4',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Not mechanisable as a cell by construction — it says a cell is not the arbiter. Its honest guard is the OPEN-UNKNOWN discipline (LAW-claim-needs-a-cell) plus L10. PROPOSED RE-WORDING FOR SAM: "an athlete-facing claim not yet seen on the phone is written OPEN-UNKNOWN", which IS mechanisable.',
      receipt: 'PROCESS law. Raised as a finding rather than left quiet, per Sam 2026-08-10.',
    },
  },
  {
    id: 'LAW-L5-no-dead-affordances',
    law: 'Every visible control either works or does not ship.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L5',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A walker pass that taps every reachable control and asserts a state change or an explicit refusal — test:action-walker already walks actions; this is the SURFACE axis of the same instrument.',
      receipt: 'test:no-rebuild-affordance is in the chain and guards ONE affordance\'s absence. Nothing enumerates controls.',
    },
  },
  {
    id: 'LAW-L6-honest-actions',
    law: 'Any tap that reports or implies success must have actually succeeded.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L6',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'This is the general form of the 2026-08-10 defect ("Done. Session moved." beside a deleted row) and of LAW-attributed-content-change. ONE structural check could hold both: every success message is derived FROM the applied transaction rather than composed beside it.',
      receipt: 'test:coach-failure-copy and the coach truth gate are in the chain and read a PHRASE list, which cannot see an omission. THE COLLAPSE CANDIDATE — see LAW-attributed-content-change and LAW-do-not-lose-the-session.',
    },
  },
  {
    id: 'LAW-L7-sam-gates',
    law: 'Programming and coaching content and product semantics are Sam\'s to gate, never the terminal\'s.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L7',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'The signed-copy registry is this law\'s mechanism for WORDS and it is already gated. The unguarded half is content and semantics — guardable the same way: a locked list with provenance, which test:locked-list and test:exercise-name-lock already do for exercise names.',
      receipt: 'PARTIAL by construction: test:signed-copy-extraction, test:copy-rulings-binding, test:locked-list and test:exercise-name-lock each gate one slice of Sam\'s authority. No row claimed the law itself.',
    },
  },
  {
    id: 'LAW-L8-reporting-calibration',
    law: 'Estimates come with the previous item\'s actual, so a forecast is calibrated rather than hoped.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L8',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A repo check over boundary reports: an estimate must appear beside a measured prior. Related to Sam\'s 2026-08-10 velocity ask (NEW vs REDISCOVERY vs RE-WORK), which is the same law asking for a number.',
      receipt: 'PROCESS law, mechanisable as a doc check. Nothing reads for it.',
    },
  },
  {
    id: 'LAW-L9-checkpoint-discipline',
    law: 'Tests first; staged commits; a fresh session starts from the checkpoint file.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L9',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A repo check that docs/NOW.md moved in any commit range that touched src/ — the checkpoint half is the mechanisable one.',
      receipt: 'AGENTS.md "Seat coordination laws" states the NOW FILE rule and nothing reads it. NOW.md has drifted behind HEAD before.',
    },
  },
  {
    id: 'LAW-L10-phone-is-done',
    law: 'Sam\'s phone is the definition of done — no athlete-facing fix is finished until he has seen it.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L10',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'PROPOSED RE-WORDING FOR SAM, because the literal law is about an event outside the repo: "a boundary report may not call an athlete-facing change DONE while its device line is unseen — it says NOT ON GLASS YET." That form is a doc check and would have caught three claims this week.',
      receipt: 'PROCESS law. Raised as a finding with a re-wording rather than left quiet. The current pass carries three NOT-ON-GLASS items and says so only by the author\'s care.',
    },
  },

  // ── THE SEAT'S OWN LAWS (the handoffs). Every one had no row. ─────────────
  {
    id: 'LAW-do-as-instructed',
    law: 'When Sam gives an instruction, do it as given; push back ONCE, in one line, only if it will actually break something — then do as he said unless he changes it.',
    ruledAt: 'Sam 2026-08-10, from "why can\'t we ever be on the same page? seriously, tell me"; AGENTS.md "Seat coordination laws"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 WITH the law. Guards the only half that touches the repo: an ORDER in the inbox that re-scopes an instruction must QUOTE the words used. **Silent re-scoping is the defect; disagreeing out loud is allowed.** The measured pattern, all in one day: "it\'s a tweak" answered with why it was bigger; "delete them" answered with a banner plus a check; "every law guarded" answered with a ranked shortlist; "parity" answered with a kind-by-kind slice plan — four times an instruction came back re-shaped and each cost Sam a message to drag it back. THE CELL WAS TOO BROAD ON ITS FIRST RUN and flagged four blocks that were terminal REPORTS using "superseded" descriptively — the word, not the act — so it is scoped to orders, which is what the law says.',
    },
  },
  {
    id: 'LAW-one-plan',
    law: 'Exactly one document presents itself as the plan; every superseded plan says so in its opening lines, and no release gate sends a reader to a retired one.',
    ruledAt: 'Seat 2026-08-10 (item 1b), after Sam was told three different things were the plan; governing sequence is docs/PUBLISH_ROADMAP_2026-08-05.md',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 WITH the law, as LAW ZERO now requires of anything new. Two of three plan docs carried NO supersession marker — grep for "supersed" over V1_LAUNCH_DEFINITION returned nothing — and a retired plan that does not say so is indistinguishable from the live one. The marker must sit in the opening lines: one buried on line 40 is one nobody reads before planning from the file, and that has its own liveness probe. THE GATE FOUND A SECOND LIVE POINTER THE AUDIT MISSED — FINAL_QA_CHECKLIST.md:278, a checkbox line sending the reader to the superseded definition, beyond the one at :20 the order named.',
    },
  },
  {
    id: 'LAW-bible-first',
    law: 'No coaching question reaches Sam without grepping the Bible and the ruling docs first.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 ("well der - thats the whole point of a fkn bible")',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'THE REGISTRY ITSELF IS THE ANSWER TO THIS LAW, one axis over: Bible-first told the reader to GO LOOK; a registry with a chain gate makes looking automatic. Guardable once every Bible-answerable rule has a row — which is what the sweep is for.',
      receipt: 'AGENTS.md LAW ZERO names this law\'s failure as its own founding case (sighting 3 of law-rediscovered-instead-of-enforced). No script reads it.',
    },
  },
  {
    id: 'LAW-rule-dont-ask',
    law: 'A question reaches Sam only when no recorded law, ruling, Bible line or ledger instinct answers it; if the laws answer even partially, rule it and cite the law.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 (Sam 2026-08-06)',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Not mechanisable as written — it governs what a person sends. PROPOSED RE-WORDING FOR SAM: "a question put to Sam carries the registry rows it checked first", which makes it a doc check against this file.',
      receipt: 'PROCESS law. Raised as a finding with a re-wording, per Sam 2026-08-10.',
    },
  },
  {
    id: 'LAW-batch-rule',
    law: 'Signings are held and handed over as ONE batch; the chain toll runs once per batch, never once per sentence.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 "BATCH RULE"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'REFUTED 2026-08-10: the row said \'the sheet is already machine-readable, so this is cheap\'. **`src/rules/signedCopy.ts` HAS NO BATCH FIELD — grep for `batch:` returns ZERO.** Batch numbers live in prose in the boundary reports, so a guard would first have to put them in the sheet. Not cheap, and priced honestly rather than left looking cheap.',
      receipt: 'test:signed-copy-extraction is in the chain and gates whether strings are signed, not whether signings were batched.',
    },
  },
  {
    id: 'LAW-visible-first',
    law: 'Every unit ends athlete-visible on Sam\'s phone; a slice that ships nothing he can see is not a slice.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 (standing direction Sam ruled); docs/SHELL_REBUILD_RULING_2026-08-05.md:25',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Pairs with L16 (vertical slice) and L10. One structural check could hold all three: a unit\'s boundary report must name the screen and the athlete-visible sentence, or say NOT-VISIBLE and why.',
      receipt: 'COLLAPSE CANDIDATE with LAW-L16-vertical-slice and LAW-L10-phone-is-done. No script reads any of the three.',
    },
  },
  {
    id: 'LAW-plain-coach-english',
    law: 'Everything said to Sam is plain coach English — a report that says "L-P6 invariant" says nothing he can act on.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Not mechanisable for chat, which never touches the repo. PROPOSED RE-WORDING FOR SAM: scope it to what IS in the repo — "every ⚠ SAM line in docs/NOW.md is jargon-free", which is a vocabulary check of the kind test:generation-vocabulary already runs.',
      receipt: 'PROCESS law governing chat. Raised as a finding with a re-wording.',
    },
  },
  {
    id: 'LAW-sam-chat-simplicity',
    law: 'Every reply to Sam is three parts at most — WHAT HAPPENED / WHAT\'S NEXT / WHAT TO SEND — with no file names or commit ids in chat.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_COACH_BUILD_ERA.md §0 "SAM CHAT RULE" (Sam-forced)',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Not mechanisable — chat output never reaches the repo, so no repo check can see it. THIS IS A FINDING, NOT A ROW TO LEAVE QUIET: either Sam accepts it is guarded only by the seat\'s discipline, or it is re-worded onto a surface that IS in the repo. HIS CALL.',
      receipt: 'PROCESS law with no repo footprint at all — the only row in this registry of which that is true.',
    },
  },
  {
    id: 'LAW-judgment-ledger',
    law: 'When Sam repeats a product instinct, his recorded call is the default path — stop and take it.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 "JUDGMENT LEDGER"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A repo check that the judgment-ledger doc exists, is appended to when a strategic call is recorded, and is cited by any boundary report that overrides one.',
      receipt: 'PROCESS law. The ledger is a memory file, not a repo file — which is itself the finding: an instinct nobody can grep is an instinct that gets overruled by accident.',
    },
  },
  {
    id: 'LAW-mock-first',
    law: 'Any new surface is mocked and shown to Sam before it is built.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_UNDO_COACH_ERA.md §2 "MOCK-FIRST IS LAW"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A repo check: a commit adding a new screen/tab must be preceded by a mock artefact referenced in its unit doc. Mechanisable, and the founding case is expensive — the journal died after ten slices of surface outran design.',
      receipt: 'No script reads it. The undo toast and the coach tab both honoured it by hand.',
    },
  },
  {
    id: 'LAW-loop-check-line',
    law: 'Every seat order and boundary report OPENS with "LOOP CHECK: <shape> — sighting N — iterate or compress". No line, no valid order.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §6 "FORMAT LAW 2026-08-07" (Sam-forced)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10. Every boundary report dated on or after the FORMAT LAW (2026-08-07) must open with a LOOP CHECK line. **ITS FIRST RUN IS AN INDICTMENT OF THE LAW IT GUARDS: of 27 reports written UNDER the law, 21 CARRY NO LINE.** The law was written on 2026-08-07 with the founding sentence \'reminders don\'t execute\', and then 78% of the reports written under it ignored it — which is the registry\'s whole thesis, arriving in the law that exists to prevent exactly this. The 21 are NAMED, DATED debt with a ratchet cell; reports predating the law are out of scope. Mutation: stripping the line from COMPOUND_BUCKET_BOUNDARY_2026-08-08.md reds this cell and only it.',
    },
  },
  {
    id: 'LAW-no-completeness-claims',
    law: 'Never assert completeness about work not yet measured; status is MEASURED-DONE (cite the run), ATTRIBUTED-NOT-FIXED (cite the doc), or OPEN-UNKNOWN.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §7 (Sam-forced, third sighting)',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A vocabulary gate over reports and NOW.md forbidding "last", "final", "no more", "nothing left to find" unless beside a cited run. Same shape as the coach truth gate\'s forbidden-phrase list — and it inherits that list\'s known weakness (a phrase list cannot see an omission), so pair it with the three-bucket requirement.',
      receipt: 'COLLAPSE CANDIDATE with LAW-claim-needs-a-cell and LAW-doc-truth: all three say a claim carries a receipt or is marked unknown. One structural check over reports could hold all three.',
    },
  },
  {
    id: 'LAW-second-wall',
    law: 'When the same SHAPE of wall is hit twice, an elegant alternative goes on the table before a third attempt down the same path.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §8 "SECOND-WALL LAW" (Sam-ordered)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 AS PART OF THE LOOP-CHECK COLLAPSE — three laws, one cell, which is the answer to Sam\'s \'49 guards is 49 more things to maintain\'. The row\'s own proposed re-wording is what shipped: the LOOP CHECK line already carries `sighting N`, so a report at N>=2 must state its DISPOSITION. **CORRECTED ON ITS FIRST RUN:** the cell demanded an alternative and flagged COACH_SLICE1_BOUNDARY, whose line reads \'sighting 2 — iterate, and it paid before any code was written\'. A LOOP CHECK reports repeated WALLS (compress) and practices that PAY (iterate); the FORMAT LAW\'s own template is \'iterate or compress\'. **A cell stricter than the law it guards produces reds nobody can act on and gets turned off.** PARTIAL by construction: it holds that a disposition is STATED, not that the alternative offered is a good one.',
    },
  },
  {
    id: 'LAW-loop-audit',
    law: 'Third sighting of any repeated ruling-shape, round-trip, toll or rediscovery is a mandatory compression proposal, never a fourth silent run.',
    ruledAt: 'docs/SEAT_LOOP_AUDIT_LAW_2026-08-07.md; AGENTS.md §1b reference; Sam 2026-08-07',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10, same cell as LAW-second-wall — the two differ only in what they count (N>=2 for a repeated wall, N>=3 for a repeated ruling-shape/toll/rediscovery) and both read the number the LOOP CHECK line already carries. PARTIAL by construction: the cell holds that a disposition is stated at a repeat sighting, not that the compression proposed is the right one. Its founding case was a ruling that took NINE stops to exist.',
    },
  },
  {
    id: 'LAW-sweep-not-serial',
    law: 'Probe a class by sweeping it, not by serialising one probe at a time.',
    ruledAt: 'Referenced as "the sweep rule" in docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §6; the instrument is scripts/sweep.sh. NO RULING DOC FOUND — this law is cited by its violations and never stated.',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Write the law down first. A law whose only appearance in the repo is other laws referring to it cannot be guarded, and this audit could not find where it was ruled.',
      receipt: 'FOURTH GHOST CITATION OF THIS AUDIT, and the worst kind: §6 cites "the sweep rule" as already existing and describes its own violation of it. grep finds no statement of the rule anywhere.',
    },
  },
  {
    id: 'LAW-LR6-coach-pipeline-frozen',
    law: 'The beta coach pipeline and CoachScreen are FROZEN — no coach-pipeline work lands on them; UI-surface changes only.',
    ruledAt: 'src/navigation/AppNavigator.tsx:206 ("LR-6 HOLDS"); docs/LEGACY_RECKONING_CENSUS_2026-07-30.md; standing since 2026-07-30',
    guard: {
      state: 'guarded',
      by: 'test:coach-entry-surface',
      chainStatus: 'in_chain',
      receipt: 'REGISTERED 2026-08-10 BY THE DELETION CENSUS, AND IT IS ABOUT TO BE RETIRED — which is the point of registering it. coachEntrySurfaceContractTests section [3] asserts every pipeline symbol CoachScreen owned is still named there, so the suite\'s job is to FAIL when the frozen tree is cut. Sam ruled the cut on 2026-08-10 ("delete all the old coach shit then? obviously!!!"), which supersedes LR-6. **The row exists so the supersession is a RECORDED EVENT rather than a silent guard deletion.** grep LR-6 over this file returned ZERO before this row — a live standing rule with a chain gate and no row, which is LAW ZERO\'s blind spot from the other side: the registry finds laws with no guard, and nothing yet finds GUARDS WITH NO LAW. See docs/FROZEN_COACH_CUT_CENSUS_2026-08-10.md.',
    },
  },
  {
    id: 'LAW-census-before-retirement',
    law: 'Nothing is retired until it has been censused — you count what a deletion takes with it before deleting.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:101; practised in docs/LEGACY_RECKONING_* and the R5 deletion reckoning',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'test:legacy-census is in the chain and censuses ONE legacy surface. The law wants the shape generalised: a commit deleting a module family cites a census.',
      receipt: 'The founding save: cutting CoachScreen.tsx would have made 40 modules / 41,220 lines unreachable — 46% more than the name-scan estimate, and 8 of them not named *coach*.',
    },
  },
  {
    id: 'LAW-standing-derivation',
    law: 'When measurement finds a stored representation feeding a computation, the ruling is pre-given: derive it and retire the stored copy — no seat round-trip.',
    ruledAt: 'docs/STANDING_DERIVATION_RULING_2026-08-07.md (Sam: "why can\'t we just tell it that if it\'s always the bug?")',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'This is LAW-north-star\'s operational half; the same persisted-key ratchet would hold both. Its three STOP conditions (classification uncertain, etc.) are what a guard must not flatten.',
      receipt: 'COLLAPSE CANDIDATE with LAW-north-star. Ordered into existence after the same ruling took NINE stops to be made — the loop-audit law\'s founding case.',
    },
  },

  // ── ENVIRONMENT LAWS (AGENTS.md), each learned from a real loss ───────────
  {
    id: 'LAW-verify-branch-before-commit',
    law: 'Run `git branch --show-current` immediately before every commit — the working tree is shared and branch state is mutable by another session.',
    ruledAt: 'AGENTS.md "Environment Facts / This working tree is SHARED with concurrent sessions"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A pre-commit hook that prints the branch, or refuses when HEAD moved since the session\'s last check. MECHANISABLE AND CHEAP — this is the one process law in the file with an obvious hook shape.',
      receipt: 'Founding case 2026-07-28: ten commits of a fifteen-commit unit went to main while the session reported "branch …, unmerged" every turn. Nothing enforces the check.',
    },
  },
  {
    id: 'LAW-commit-before-mutation-testing',
    law: 'Commit before mutation-testing, and revert a mutation by copying the file back — never with `git checkout --` or `git stash`.',
    ruledAt: 'AGENTS.md "Environment Facts"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Not mechanisable as a prohibition on a shell command the terminal chooses to run. PROPOSED RE-WORDING FOR SAM: nothing — this one is honestly a habit, and its guard is that the loss it causes is now loud.',
      receipt: 'Happened twice in ONE session on 2026-07-28: a deliberate one-line mutation reverted along with an hour of unrelated wiring in the same file, invisible until a later grep.',
    },
  },
  {
    id: 'LAW-no-secrets-committed',
    law: 'API keys and Supabase/OpenAI secrets are never exposed, repeated or committed — they belong in deployed secrets only.',
    ruledAt: 'AGENTS.md "Working Style"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10. Scans src/ and scripts/ plus app.json/eas.json for four credential shapes (OpenAI-style key, real-payload JWT, AWS access key id, and a named credential assigned a long literal). Patterns are BUILT FROM PIECES rather than written whole, so the scanner does not have to exclude itself — a self-exclusion is the hole a real key would sit in. GREEN on its first run. This law had the largest gap in the registry between the cost of a violation and the cost of its guard.',
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
