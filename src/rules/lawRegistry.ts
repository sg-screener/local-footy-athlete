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
 * move onto a team night was caught **losing a row between the source day and
 * the drawn day** while reporting *"Done. Session moved."* That is a missing
 * mechanism, not a memory failure.
 *
 * **CORRECTED 2026-08-10:** this used to say the move was *"caught DELETING a
 * row"*. Not established. Five probes over every producer that can remove power
 * work counted ZERO on that run, and *"8 rows in, 7 out"* was counting the
 * PROJECTION, not storage — a count whose unit was never stated, which is
 * `LAW-count-names-instrument`'s founding case. The loss is real and
 * destination-dependent; the deletion is OPEN-UNKNOWN.
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
      /** The npm script, named cell, or NAMED PERSON that fails when the law breaks. */
      readonly by: string;
      /** Whether that guard is reached by `npm run test:bible`. */
      readonly chainStatus: 'in_chain' | 'outside_chain' | 'human';
      /** How this was verified, so the row is a receipt and not a belief. */
      readonly receipt: string;
      /**
       * THE NAMED HUMAN INSTRUMENT — Sam's ruling, 2026-08-10.
       *
       * Some laws have their SUBJECT outside the repo. `LAW-sam-chat-simplicity`
       * governs the shape of a chat reply, and chat never reaches a file, so no
       * script can ever see it. The row could have said `UNENFORCED` forever, or
       * "held by discipline" — **and "held by discipline" is the loophole Sam
       * banned this morning**, because it is `UNENFORCED` wearing a nicer word.
       *
       * So the guard is a PERSON, named: **Sam is the instrument, and him having
       * to pull the seat up on it IS the red.** Still two states, never a third
       * — the row is `guarded`, by a guard that happens not to be a script.
       *
       * **THIS IS NOT A GENERAL ESCAPE HATCH AND THE GATE ENFORCES THAT.** It is
       * allowed ONLY where the subject of the law is the conversation itself
       * (`HUMAN_GUARDABLE_LAW_IDS` below, one id today). Any other law reaching
       * for it is a re-wording failure, and `test:law-registry` reds on it.
       */
      readonly humanGuard?: 'Sam';
    }
  | {
      readonly state: 'UNENFORCED';
      /** One line: what building a guard would actually take. */
      readonly wouldTake: string;
      /** How the absence was verified. */
      readonly receipt: string;
    };

/**
 * THE ONLY LAWS A NAMED PERSON MAY GUARD.
 *
 * Sam, 2026-08-10: *"use this shape ONLY where the subject of the law is the
 * conversation itself — it is not a general escape hatch, and any other law
 * reaching for it is a re-wording failure."*
 *
 * One id, and adding a second is a decision somebody has to defend in this list
 * rather than a habit that spreads through the file. `test:law-registry` reds
 * when a row outside this set carries `humanGuard`.
 */
export const HUMAN_GUARDABLE_LAW_IDS: readonly string[] = ['LAW-sam-chat-simplicity'];

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
    // WIDENED 2026-08-10 ON SAM'S STANDING RULING. It read "WHEN ASKED for the
    // most elegant solution..." — his words: *"EVERYTHING SHOULD BE DONE IN THE
    // MOST ELEGANT WAY."* The trigger clause is deleted and the SUBJECT widens
    // from code to the work. Founding case: the seat applied this law to code
    // all week and never to the process, which is how a dead simulator rig sat
    // unnoticed since 18 July and a 176-suite chain kept being paid in full for
    // one-line changes.
    law: 'Compare an incremental fix against an ownership redesign before coding — ALWAYS, not only when asked, and for PROCESS and instruments as well as code.',
    ruledAt: 'AGENTS.md "Elegant Solution Requirement"; CLAUDE.md; widened by Sam 2026-08-10',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A boundary-report field ("options compared") checked by test:repo-law-guards, the same shape as the LOOP CHECK cell already in that suite. NOT BUILT IN THIS PASS AND NOT CLAIMED: widening a law is not guarding it, and a row that flipped to `guarded` on the strength of an edit to its sentence would be the exact "reads as covered" failure this registry exists to stop.',
      receipt: 'Process law; no script observes deliberation. The widening changed the SUBJECT, not the guard — the row is still honestly red.',
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
    // SCOPE LINE ADDED 2026-08-10 — the other half of the apparent clash with
    // LAW-sam-chat-simplicity. The INTENT is "every claim carries its status".
    // A token satisfies that for a script; plain words satisfy it for Sam. The
    // TOKEN requirement is repo-scoped; the plain-language requirement is his.
    law: 'A sentence saying the app does or does not do X is pinned by a named cell, or its status is stated — as the token OPEN-UNKNOWN / NOT ON GLASS in the REPO, and in PLAIN WORDS wherever Sam reads it.',
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
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'GUARDED 2026-08-10, AND THE ROW SAT UNENFORCED UNTIL THE RIG ACTUALLY RAN — which is the law describing its own history. FOUNDING CASE: eight Maestro flows crashed on launch for 23 DAYS while every source-reading cell stayed green, because there is nothing wrong with a flow that does not run. A BLOCKED INSTRUMENT DOES NOT HIDE ZERO DEFECTS, IT HIDES AN UNKNOWN NUMBER: run one found THREE, each invisible until the one before it was fixed; run two found SIX more in the same staircase; NINE from an instrument carried as "dead, cost unknown" since 18 July. WHAT FINALLY ENFORCES IT: docs/GOLDEN_FLOW_RUN_RECEIPT.md, read by a cell that reds when a golden flow is missing from the table or when the newest recorded run is more than 7 DAYS old — seven because the founding case was 23, so the alarm fires three times over before that number is reachable again. The receipt also carries NOT RUN rows on purpose: five of ten flows have run, and a receipt that recorded only successes would make the rig look alive while half of it was dark, which is precisely this law\'s failure mode. WHAT IT CANNOT DO, STATED NOT IMPLIED: it cannot prove the receipt is HONEST — a row edited without a run defeats it, exactly as a LOOP CHECK line can be typed without the thinking. That is the same trust every process law here runs on, and the alternative is what left 23 days invisible. Two narrower cells hold beside it and neither would have caught the nine: test:repo-law-guards (no flow names a missing file, none is unreachable) and test:maestro-element-contract (every id a flow taps is a name product source can emit), which prints its own two limits.',
    },
  },
  {
    id: 'LAW-no-hand-built-fixtures',
    law: 'Hand-built state fixtures are deprecated for athlete-facing suites; reach the world by acting or by a device-exact seed.',
    ruledAt: 'AGENTS.md "Hand-built state fixtures are deprecated for athlete-facing suites"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'FOUNDING CASE, ADDED 2026-08-10 AND IT IS THE ROT SAM NAMED: every practice week in this repo was built from a profile THE APP WOULD HAVE REFUSED FROM A REAL PERSON — `DEV_E2E_STANDARD_PROFILE` carried no `twoKmTimeTrial`, a required always-visible onboarding answer, so every seeded world was an impossible athlete. No instrument could see it because none had ever got far enough in: the completeness gate lives on a screen no seeded run had ever reached. CENSUS, COUNTED NOT ESTIMATED: 21 of 332 test scripts consumed that profile (transitive import closure, so helper-reached suites are included; the list is in docs/TWO_KM_LEAD_AND_SEED_CENSUS_2026-08-10.md). AND THE OBVIOUS FOLLOW-UP WAS RUN AND REFUTED: generating with and without the field produces an IDENTICAL week — 4 conditioning-carrying workouts and 4 strength-and-conditioning days in both arms — so their green was never WRONG downstream; what it never covered was the completeness gate itself. The first version of that probe read ZERO in both arms and would have "refuted" from an instrument incapable of any other answer; the verdict stands on the corrected one only. ORIGINALLY GUARDED ON SAM\'S SECOND ASKING, and it should not have taken two: this row sat UNENFORCED and that is EXACTLY HOW THE ELEVEN SEEDS ROTTED — correct when written, drifted with nobody watching. His words: "I don\'t want to get 2 weeks down the line and realise that a fucking weekly template optimised for that and that alone - its happened before and if it happens again i\'ll fucking kill myself". TWO OF THE THREE CONDITIONS ARE HELD: no test world is built from a literal (measured — devE2ESeedRegistry.ts goes through generateProgramLocally and holds ZERO workout literals), and the world set RATCHETS — coverage may rise, never fall, so a world cannot be dropped to make a suite green. THE THIRD IS NOT HELD AND THIS ROW SAYS SO: the DRIFT check (does a world still match what the generator produces for that profile TODAY?) is the condition that would have caught the eleven the day they went stale. It needs a generator run per profile and ships with the first run-through, per the order\'s own sequencing — one flow is not green yet.',
    },
  },
  {
    id: 'LAW-L11-matrix-before-phone',
    law: 'The matrix comes before the phone — a defect class gets a written matrix before device time is spent on it.',
    ruledAt: 'AGENTS.md "L11 — The matrix before the phone"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A run-through over a MATRIX of worlds, gated per athlete-visible slice. NOT AFFORDABILITY-BLOCKED ANY MORE — see the receipt.',
      receipt: 'MEASURED 2026-08-10, and the measurement changes this row from unimplementable to merely unbuilt: a Maestro run costs 20-26s wall clock on an already-built simulator (3 runs), and the launch+marker half now completes in 11s. A matrix of ten worlds is under four minutes. THIS LAW WAS UNIMPLEMENTABLE FOR AS LONG AS EVERYONE BELIEVED THE INSTRUMENT COST FORTY MINUTES — the belief was never measured, and the rig had been carried as dead since 18 July without being re-run after its cause was fixed. Still UNENFORCED because no run-through completes yet: everything past the deep-link seed fails, and a matrix over an instrument that has never finished one pass is the 116-green-cells mistake. docs/MAESTRO_RIG_MEASURED_2026-08-10.md',
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
    id: 'LAW-test-worlds-are-generated-or-real',
    law: 'A test world is either GENERATED by the app\'s own generator from a profile, or a REAL DEVICE EXPORT. Never hand-authored.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, from Sam: "I don\'t want to use a practice week if it\'s not the most elegant way to ensure that all future builds actually help the app instead of just optimising for this one tiny week"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED, and the order\'s own premise is PARTLY REFUTED by the measurement: the order said the existing seeds "are hand-authored" and they are NOT — devE2ESeedRegistry.ts builds every world through generateProgramLocally(profile, …) and contains ZERO workouts/microcycles/exercises literals. So the cell PINS a property the repo already has rather than fixing a defect. WHAT HAS DRIFTED IS A DIFFERENT THING AND IS NOT FIXED HERE: Mixed days projecting a single strength part, no seed row with a power role, equipment-restriction-case failing to install — that is drift between a generated world and its PROJECTION, and calling it hand-authoring would have sent the fix at the wrong layer. Liveness both directions, including a comment describing the forbidden shape.',
    },
  },
  {
    id: 'LAW-seed-channel-is-first-class',
    law: 'A test-harness input arrives on its own named, validated, fail-closed channel — never smuggled as a second meaning on an existing field.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, Sam overruling a cheaper plan: "i dont care if it has to do 1 rebuild for 40 minutes - i care about the best solution long term"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED — the first draft of this row entered UNENFORCED and that was a DEFECT caught in the same pass: it broke LAW ZERO (no law enters unguarded from 2026-08-10) and pushed the unguarded count 36 -> 37, the one direction Sam ruled it may never move. WHAT THE CELL HOLDS: the key exists under its own name, the value is validated against a declared shape, a malformed value FAILS CLOSED rather than degrading to "no seed", and the metro-url key carries no seed meaning. RE-AIMED 2026-08-10 EVENING, PROPERTY UNCHANGED: fail-closed used to be spelled `fatalError` and is now a typed refusal plus a stop, because Sam ruled a dev diagnostic may not kill the app (see LAW-diagnostic-refuses-never-crashes). The cell now asserts the malformed branch RECORDS a refusal AND RETURNS — and a new liveness probe covers the failure mode the re-aim created, a refusal that carries on and seeds nothing quietly. WHAT IT DOES NOT HOLD, STATED NOT IMPLIED: it cannot prove the refusal FIRES — that needs a simulator launch with a bad value. IT NEEDS A NATIVE REBUILD BEFORE IT RUNS AT ALL — asked of Sam plainly, with the cost stated.',
    },
  },
  {
    id: 'LAW-removal-ships-with-its-replacement',
    law: 'A removal ships the same day its replacement does, never before.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, generalising Sam\'s binding line on the UI merge: "without destroying what i have now"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE IS A CALL THAT WENT RIGHT, which is why it became a rule rather than a fix: ruling 6 removes the season-phase box from the day screen, its new home on the coach page does not exist yet, and the box was LEFT IN PLACE — deleting it would have left Sam with no way to change season phase at all. WHAT THE CELL HOLDS: the UI merge plan\'s own REMOVAL LEDGER is parsed and every row must name where the behaviour went; an empty destination cell, a "TBD" or a dash reds, and so does the ledger section going missing. Liveness both directions including the placeholder case, because "TBD" is the shape this defect actually takes. WHAT IT DOES NOT HOLD, STATED NOT IMPLIED: it reads the PLAN, not the diff — it cannot see a removal that never got a ledger row at all, and it cannot prove the destination named is where the behaviour truly went. It catches the removal that has nowhere to land, which is the half that has actually bitten.',
    },
  },
  {
    id: 'LAW-week-list-one-card-shape',
    law: 'The week list uses her one card shape and visual hierarchy for all seven days; it starts fully collapsed while today is independently highlighted, Rest and Game Day are shorter status cards with vertically centred titles, its chevron opens the whole flat session with no nested accordions, and a real active-modifier list puts its compact line above the week.',
    ruledAt: 'docs/UI_PROTOTYPE_DIVERGENCE_2026-08-11.md "RESOLVED AND BUILT — 2026-08-11" + "SAM EYE PASS 2" + "SAM EYE PASS 3" + "SAM EYE PASS 4" + "SAM EYE PASS 5"',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline + .maestro/golden/standard-program-week.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE: slice 5 was reported as taking her weekly structure, but the selected/today coordinate still switched into the old hero card and carried Start Session plus the change door. EYE PASSES 2–5 CAUGHT THE GUARD WAS TOO SHALLOW: 18pt dates, badges with a hidden 24pt line box, an invented GAME badge, a zero-modifier visual world, nested component accordions, today starting open, and Rest/Game inheriting an empty training tier all still differed materially from the prototype. WHAT THE CELLS HOLD NOW: all seven rows call one WeekDayCardHeader selected by SCREEN SHAPE; date and compact badge proportions are pinned; Game Day adds no second badge; entering Week clears template-local expansion while Card highlight independently reads day.isToday; Rest and Game Day share one compact decision that shortens outer and inner spacing, centres their title block and omits the empty category reservation; the one DayTimeline call chooses interactive Today versus flat Week; the flat branch renders every section and numbered row with no inner interaction; the shared modifier component selects the compact lime week treatment. WHAT THE TAPE HOLDS: it creates one equipment modifier through the athlete door, enters Week, proves no timeline is visible before any day tap, compares collapsed card heads, opens Wednesday once into flat rows, then reaches and captures the compact Rest/Game states together. FIRST-RUN FINDINGS WERE NOT FIXED QUIETLY: off-screen assertion order, TODAY wrapping, XCUITest losing its UI, inherited badge line-height, an acted Monday left open, a guessed accessory id where the projection carried strength, the selected/open collision, and the absent compact status decision were each reported and the full tape rerun after correction. WHAT IT DOES NOT HOLD: Week → open → Today → Week again on a device, today itself being Rest or Game on a device, a multi-section flat session on the final coordinate, the two-modifier plural on a device, prior/next-week Completed treatment, the deferred team-training badge, Sam\'s physical iPhone.',
    },
  },
  {
    id: 'LAW-coach-status-is-a-real-destination',
    law: 'Program opens My Status itself; Coach keeps that Renee-shaped doorway at zero; My Status owns season-phase review and Program carries no phase card.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "it should open the status.... not just the coaches tab - and it should always be there"; then, with Renee references: "when you tap my status from hers you can see that the season phase is also there too... which will help us remove it from the day and weekly screens". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice3 + .maestro/golden/coach-my-status.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO), EXPANDED WITH THE NEXT EYE PASS. FOUNDING CASE: the status overlay existed, but Program only changed tabs, Coach deleted its doorway at zero, and the phase machine remained trapped in Program behind a status screen reported as built. WHAT THE CHAIN CELL HOLDS: Program and Coach address one navigation-owned status coordinate; Coach alone keeps the zero-state doorway; the compact Coach header and status hierarchy carry Renee\'s named structure; My Status mounts the extracted phase controller and its atomic transaction while reachable Home mounts neither phase card nor phase sheet. WHAT THE DEVICE FLOW HOLDS: zero-state Coach opens status and shows phase; a real equipment modifier is created through the athlete door; Program opens populated status directly; the collapsed modifier expands to the existing controls. WHAT IT DOES NOT HOLD: the still-unwired modifier actions, Sam\'s physical iPhone.',
    },
  },
  {
    id: 'LAW-week-navigation-belongs-to-week',
    law: 'The accepted new Program template renders no week-date navigation on Today; Week renders one compact previous/range/next row directly below the Day/Week toggle, and changing or returning weeks leaves every session collapsed.',
    ruledAt: 'docs/UI_PROTOTYPE_DIVERGENCE_2026-08-11.md "SAM EYE PASS 6 — WEEK NAVIGATION BELONGS TO WEEK"',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline + .maestro/golden/standard-program-week.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE: the accepted day template had no week browsing, but the implementation mounted a large previous/range/next bar before the shape toggle so both Today and Week inherited it. WHAT THE CELLS HOLD: the navigator is ordered after the toggle and before Week content, mounts only when !dayFirst, preserves previous/current/next stable doors, contains neither IconButton nor Badge, and pins its small plain proportions. The new template has one local expandedWeekIdx; Today reads todayIdx directly; previous, next, this-week and shape-toggle handlers all clear local expansion rather than borrowing the shared day/picker selection. WHAT THE TAPE HOLDS: all four navigator ids are absent on the default Today shape and present after Week is selected; previous and next each move to an adjacent week, expose the existing return door, return to this week, and leave day-timeline absent before one explicit card tap opens it. FIRST-RUN FINDINGS: the source cell red on the old shared bar; a stripped comment was corrected to a proved live region anchor; XCUITest lost its hierarchy before the first assertion; the first complete adjacent-week route found Monday reopening on return, superseding Eye Pass 4\'s no-second-owner conclusion. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone, the old/classic template, adjacent-week Completed styling, the deferred team-training badge.',
    },
  },
  {
    id: 'LAW-day-timeline-icon-is-marker',
    law: 'On the accepted new Today card, each component icon is its one timeline marker: no separate dot or connector rail; the main headline does not repeat the icon; headings, counts, badge and session action use the compact hierarchy Sam accepted from Renee\'s card.',
    ruledAt: 'docs/UI_PROTOTYPE_DIVERGENCE_2026-08-11.md "SAM EYE PASS 7 — THE SESSION ICON IS THE MARKER"',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline + .maestro/golden/day-card-dropdowns.yaml + .maestro/golden/standard-program-week.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE: the interactive day timeline drew a hollow node and connector rail, then a typed component icon beside them, so one component had two markers and its oversized heading/count started a full column too far right. WHAT THE CELL HOLDS: the interactive branch contains no timelineRail, timelineNode or timelineConnector; one timelineIconMarker wraps RowIcon and receives saved completion colour; the day headline region contains no duplicate RowIcon; the category badge is compact; eyebrow, main title, component heading, count, divider and Start Session sizes are pinned. The flat Week branch remains separately guarded and contains no interactive furniture. WHAT THE TAPES HOLD: the standard route renders and captures the collapsed icon-led Today card before traversing Week; the dropdown route taps strength open, observes all exercise rows plus the same Program/Start door, captures it, and taps it closed. FIRST-RUN FINDING: the new cell failed immediately on timelineRail in the old branch and went green only after the marker layer was deleted. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone, spoken VoiceOver order, exceptionally long translated headings, the old/classic template.',
    },
  },
  {
    id: 'LAW-one-name-two-meanings',
    law: 'A name that covers more than one thing is measured apart BEFORE it is worked on — per strand, never per label.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat: "four sightings in one day is not a coincidence — give the class a name and a row… a name that covers more than one thing is measured apart BEFORE it is worked on, and the measurement is per strand, not per label"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUR SIGHTINGS IN ONE DAY, which is what made it a class rather than an anecdote: (1) the `source` label meaning both "a person did this" and "which door"; (2) the day name meaning both "what this day is" and "what survived a move"; (3) a count meaning both rows-on-screen and rows-stored; (4) the replay latch meaning both "we are replaying, disk is truth" and "we are installing, disk is not yet truth"; (5) the witness validation point meaning both "did the install write this" and "is the world like this now"; and (6) THE SHARPEST, WHICH WAS NOT IN THE CODE AT ALL: the word "knot" — one terminal\'s own shorthand — meant "one piece of surgery" and was several strands, and it cost a decision NOT TO START; and (7) `useHomeScreen` meaning both "the day screen\'s state" and "the app\'s rebuild owner" — measured apart in docs/REBUILD_NOTICE_OWNERSHIP_2026-08-10.md BEFORE any code moved, which is the whole discipline, and the measurement paid: the two paths that drive the notice turned out to drive THE SAME FOUR PIECES OF STATE, so one ownership move closed two rulings instead of one. Measuring it strand by strand found one already loose (`handleDismissCoachNote` is `useCallback(fn, [])` over a module-level function; it was never tangled, only behind the tangle). WHAT THE CELL HOLDS: this row must enumerate its sightings, and the count may only grow — the same ratchet every debt list here carries, so a fifth instance cannot be absorbed silently. WHAT IT CANNOT DO, STATED PLAINLY: no script can look at a NAME and know it covers two things. This is a process law and its real enforcement is the LOOP CHECK line — `LAW-second-wall` already requires an alternative on the table at sighting 2, and this class is what an alternative most often turns out to be. The row exists so the shape has somewhere to be counted.',
    },
  },
  {
    id: 'LAW-never-disable-a-set-for-part-of-it',
    law: 'Never disable a whole set because part of it is blocked. Per control, per strand — and the notice retires itself as each is freed.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat: "dimming every button and sending Sam elsewhere for something he could do right there is the same fault mirrored… never disable a set because part of it is blocked"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE, AND IT WAS THIS TERMINAL\'S OWN CORRECTION BEING CORRECTED: the coach status screen dimmed EVERY modifier control and captioned them "Change this on your program screen for now", because the actions needed an ownership extraction. That was right for most of them and WRONG for `dismiss_note`, which works — so the screen was telling the athlete to go elsewhere for something they could do right there. THE DEAD-AFFORDANCE LAW MIRRORED: a control that looks live but is not, and a control that looks dead but works, are the same defect pointing opposite ways. WHAT THE CELL HOLDS: `ActiveModifiersSection`\'s not-yet flag is resolved PER ACTION against a list of live kinds, not per screen; the caption renders only on notes that still hold an inert action; and the disabled prop reads the per-action value. So freeing a strand lights it up and retires its own notice with no further edit. WHAT IT DOES NOT HOLD: it is scoped to the founding surface. A new screen inventing its own whole-set disable is not caught, and naming that is honest rather than pretending the cell is general.',
    },
  },
  {
    id: 'LAW-flows-photograph-what-they-touch',
    law: 'A flow proves presence, never layout. Every state a flow reaches is photographed, because only an eye catches a layout defect.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat: "the two layout bugs you found by eye are a finding, not a footnote… neither visible to any assertion… if the answer is \'only an eye\', then the screenshots are load-bearing and the flows must photograph every state they touch"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). TWO FOUNDING CASES IN ONE PASS, both real, both shipped past a GREEN flow: the coach status screen\'s close control rendered ON the status bar over the battery icon (it was an absolutely-positioned sibling outside the safe area of the screen it closed), and its title rendered at front-page size, swamping the one card beneath it. THE FLOW ASSERTING THAT SCREEN WAS GREEN THROUGH BOTH. That is not a gap in the assertions — it is the honest limit of the instrument: `assertVisible` answers "is this in the tree", and every layout defect is a question about WHERE, which no id can carry. WHAT THE CELL HOLDS: every flow under .maestro/golden that reaches a distinct surface takes at least one screenshot, and a flow that navigates to N surfaces without photographing any of them reds. WHAT IT CANNOT DO, AND THIS IS THE POINT OF THE ROW: it cannot check the PHOTOGRAPH. The screenshots are load-bearing and Sam\'s eye is the instrument that reads them — so the law is about making sure the evidence EXISTS to be looked at, and the boundary report must name which shots a reader should open. A rule that pretended a script could see the battery-icon overlap would be the vacuous-green defect wearing a new hat.',
    },
  },
  {
    id: 'LAW-no-silent-blank-screen',
    law: 'A blank screen must be impossible to reach silently. Whatever refused says what it was and offers a way out.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, Sam via the seat after losing time to a blank screen twice in one day: "a white screen must be impossible to reach silently"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE, REPRODUCED ON THE DEVICE AND FIXED THE SAME PASS: in __DEV__ the navigator mounts only after prepareDevE2EAppLaunch() resolves; it returned a bare `false` on any failure and App.tsx simply returned, so the app rendered a root with NOTHING in it — no error, no red box, no text, forever. A Maestro run leaves a dev clock receipt behind; the next PLAIN launch (the way Sam opens the app) reads a receipt with no matching checkpoint, restoreDevE2EClockBeforeHydration throws "clock receipt has no active checkpoint", and that is the white screen he hit at 19:22 after his rebuild. THE DIAGNOSIS WAS ISOLATED BY EXPERIMENT, NOT GUESSED: the SAME binary and the SAME world render fine under the harness launch and white under a plain one, which refuted both offered leads (a Metro URL mismatch — Metro answers on BOTH addresses — and the new native refusal path, which logs nothing on a plain launch). WHAT THE CELL HOLDS: App.tsx renders a named refusal surface, shows the REASON, and offers a one-tap clear; and the barrier is not read as a bare boolean again, which is the shape that made the reason unable to travel. Liveness probes all four directions including the exact pre-fix shape. WHAT THE CELL CANNOT DO, AND IT IS THE IMPORTANT HALF: every source-reading cell in this chain passed while the white screen was happening — there is nothing wrong with code that did not run. The real instrument is .maestro/golden/dev-launch-refusal-speaks.yaml, which seeds through the harness and then launches WITHOUT it, and is GREEN on the device.',
    },
  },
  {
    id: 'LAW-diagnostic-refuses-never-crashes',
    law: 'A development diagnostic refuses loudly and lets the app boot. It may never kill the process.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, Sam via the seat after the third crash of one shape in a day: "A DEV DIAGNOSTIC MUST NOT BE ABLE TO KILL THE APP… A crash is the least debuggable possible signal: it destroys the process before anything can report why."',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). CENSUS, MEASURED NOT ESTIMATED: DevE2ELaunchDiagnostic.swift held TEN hard fatalErrors on the launch path, every one reachable from didFinishLaunchingWithOptions — before a line of JavaScript, so nothing could report the reason and it had to be reconstructed from ~/Library/Logs/DiagnosticReports each time. THREE OF THE TEN EACH COST A DEBUGGING CYCLE: the missing launch purpose (read as "the rig is dead" for 23 days), the resolved-bundle trap behind the reload flows, and the metro url — which fired at 18:56:45 on 2026-08-10 because THIS TERMINAL ran `maestro test` without the runner, so the app was handed the literal string ${E2E_METRO_URL}. Every one of the three was an input mistake OUTSIDE the app. The count is now ZERO. WHAT THE CELLS HOLD: no fatalError/precondition/assertionFailure survives in ios/LocalFootyAthlete (comment-stripped, so a comment naming the ban is not the ban being broken); the Swift side exports launchRefusalCodes over the constants bridge measured to reach JS; devE2EEntry publishes them as e2e-explorer-launch-error-<code>, through the EXISTING channel rather than a second representation; and it publishes BEFORE the hydration that would otherwise raise a consequential marker first. Liveness both directions, including the comment false-positive and a refusal being misread as a crash. WHAT IT DOES NOT HOLD: no refusal has ever FIRED on a device under this change — it is native code and NEEDS THE REBUILD Sam already owes before it runs at all.',
    },
  },
  {
    id: 'LAW-hot-file-budget',
    law: 'A file re-read at every stop has a stated size budget, and going over it is a failure.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat relaying Sam\'s /usage: "126M tokens IN, 5k out, $68.95 for 1h43m… THEN GUARD BOTH, because this will grow back within a day otherwise"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE IS A BILL, NOT A SMELL: almost all of that 126M input was READING, and the two files re-read at every terminal stop were SEAT_INBOX.md at 353KB and NOW.md at 53KB. Both carried a line at the top saying what they were for — "the review seat writes here; terminal reads at every stop" and "overwrite at every checkpoint (pointer, not history)" — and both had quietly become history. Same shape as every other rot here: correct when written, nobody watching it drift. THE TRIM IS NOT THE FIX, THE ALARM IS: NOW.md went 53KB -> ~4KB and the inbox 353KB -> 43KB, and either would grow back within a day. BUDGETS AND WHY, since the order asked: NOW.md 24KB (a pointer whose job is links, ~6x its post-trim size), SEAT_INBOX.md 96KB (orders are longer and several are live at once, but it is a quarter of what the file reached). WHAT THE CELL HOLDS: both files exist, both are non-empty (a budget over a missing or empty file is a green that means nothing), and neither is over. Liveness probes the 53KB case, an inside-budget case, and the inclusive boundary. WHEN IT REDS THE ANSWER IS TO ARCHIVE VERBATIM TO A DATED FILE — never to delete, and never to raise the budget to match the file.',
    },
  },
  {
    id: 'LAW-durable-write-is-never-silent',
    law: 'A durable write that is dropped leaves a record naming the store and counting the drops. Storage may refuse; it may never refuse quietly.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat: "DO NOT LOSE ITEM 6 — THE SEEDED WORLD IS NOT DURABLE… it must not become a NOT-COVERED line that survives three passes"',
    guard: {
      state: 'guarded',
      by: 'test:durable-write-silence',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE, MEASURED: a seeded world ended with FOUR game days in memory and ONE on disk. `asyncStorageDurable` drops every durable write while the ledger replay latch is held — "THE BOOT DOES NOT WRITE", R1.3, deliberate — and the dev-E2E seed installs THROUGH that window, so three of the athlete\'s fixtures never reached storage and NOTHING RECORDED IT. Turning the harness\'s "calendar-storage did not converge" into that sentence took a hand-read of the simulator\'s AsyncStorage and a walk through three modules. WHAT THE CELL HOLDS: the latch still drops (asserted FIRST, so a future change that let the boot write again cannot pass by emptying the counter); every drop names its store; repeat drops on ONE store are counted rather than collapsed to a boolean — the founding case was three drops on one key; and liveness both ways, so a write made outside the latch is never recorded as dropped. WHAT IT DOES NOT HOLD, STATED NOT IMPLIED: it does NOT claim the drop is correct. Where the boundary between "boot may not write" and "an install must" belongs is an OWNERSHIP question, priced separately and deliberately unanswered — the stop-patching rule says name it rather than reach into boot. Six flows stay red behind that question.',
    },
  },
  {
    id: 'LAW-permission-is-granted-once',
    law: 'A permission recorded in the seat inbox stands until Sam withdraws it. Re-asking is a defect; the fix for a refused operation is to read the file and retry, never to ask again.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10 (seat, against LAW-seat-coordination): "asking twice for a permission already granted is the courier toll in a new coat"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED. FOUNDING CASE IS THIS TERMINAL, TWICE IN A ROW: Sam ruled two file operations, the tool refused them once, and instead of retrying the terminal put them back to him as blocked-on-Sam items in TWO consecutive reports. Both operations succeeded on the retry that should have happened immediately. The cell holds the checkable form — a blocked-on-Sam item is a DECISION, DEVICE TIME or a THING ONLY HE HAS, never a request for permission. Liveness both directions: a permission re-ask is caught, a genuine decision is not.',
    },
  },
  {
    id: 'LAW-sam-is-not-the-wire',
    law: 'Sam is never the relay. The seat reads the repo; what he is asked for is decisions, device testing, and things only he has — nothing else.',
    ruledAt: 'AGENTS.md "Seat coordination laws"; docs/SEAT_INBOX.md 2026-08-10 (Sam ruled the whole three-part process fix)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED. FOUNDING CASE: Sam spent 2026-08-10 pasting the seat\'s orders to the terminal and the terminal\'s reports back to the seat — he typed "check inbox" five times in one session. Seat→terminal was fixed by the hook reading by content (f168b48b); terminal→seat is fixed by the seat READING the repo, which it already has mounted. The cell holds the checkable half: no item in a blocked-on-Sam section may ask him to relay, paste, forward or route anything. Written into AGENTS.md as well as here BECAUSE IT MAKES THE SEAT SMALLER and is therefore the law most likely to be quietly dropped.',
    },
  },
  {
    id: 'LAW-label-names-the-door',
    law: 'A diagnostic label must distinguish the things a diagnosis needs to tell apart, and it is DERIVED from the one field that already knows — never passed in beside it as a second opinion.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, from Sam: "well shouldn\'t it be labelled differently to prevent this issue from happening again? so we can diagnose whether the issue happened via tap or coach?" — LAW-count-names-instrument widened from numbers to labels by his question.',
    guard: {
      state: 'guarded',
      by: 'test:diagnostic-label-names-the-door',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED. 20 cells. FOUNDING CASE: `source: "tap"` was emitted by both the Program tab sheet and the coach change card because it was derived from `initiatedBy` (which answers "was a human involved?"), so the seat read Sam\'s `lastTransaction: "tap:move_session:..."` and told him his coach move came through the Program tab — wrong, and it cost a full pass. Cells hold the derivation, the CONTROL in the same run (the two doors must DIFFER, asserted as a difference), the summary/log agreement, and a regression cell banning the exact expression that caused it. NOT a general ban on reading `initiatedBy`: `sourceActor` is a different axis and correctly ignores the door.',
    },
  },
  {
    id: 'LAW-repair-names-its-kind',
    law: 'An event reporting that a repair ran names WHICH repair, and a violation list reported after selection says that it is post-selection.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10 ("Measure that, do not assume it") — raised by Sam\'s coach export showing gatewayStatus "repaired" four times with rejectionCodes [].',
    guard: {
      state: 'guarded',
      by: 'test:diagnostic-label-names-the-door',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED, in the same suite as its sibling because it is the same disease. MEASURED: none of the four `repair_candidate_selected` emitters recorded `repair.kind`, while the gateway result carries typed kinds — the log was throwing them away, which is where "measure it, do not assume it" ran out of road on Sam\'s export. `rejectionCodes: []` beside four repairs is not a contradiction: the list is the SELECTED candidate\'s evaluation, i.e. AFTER repair, and nothing at the field said so.',
    },
  },
  {
    id: 'LAW-unreadable-world-resets-clean',
    law: 'A stored world the current code cannot read is RESET CLEAN and the athlete is told once, in plain words — never migrated, never silently served by an older set of rules.',
    ruledAt: 'docs/SEAT_INBOX.md item 1(c) 2026-08-10 (Sam: "kill it"), scoped verbatim: "an unreadable stored world resets and the athlete is told once, in plain words. No migration, no fallback, no second attempt to salvage."',
    guard: {
      state: 'guarded',
      by: 'test:unreadable-world-reset',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED, in the same commit as the law — no UNENFORCED window. 73 cells: readable passes through; seven unreadable shapes reset with a reason; ABSENT is a first run and tells nobody (the trap: an empty device must not be told its training was destroyed); the telling is derived from the fact, never counted; the door contains no migration/fallback/salvage word; the sentence is in the signed sheet and carries no jargon; and the deleted migration is structurally proven gone WITH the unrelated generator-recovery ruling that rode inside it proven surviving.',
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
      receipt: 'BUILT 2026-08-10. The hook matched `^1\\.` only, so every order the seat wrote as `00.`/`0.`/`000.` was INVISIBLE and the turn ended silently — Sam became the message bus and typed "check inbox" himself twice that day. SIGHTING 4 of the numbering-artefact class the hook\'s own comments already named twice. Rewritten to read content; **21 cells**, both directions; the six new must-block cases red when the old `^1\\.` scan is restored (mutation run 2026-08-10). The suite existed but was in NO chain — measured and enrolled in the same commit. **AND THE HOOK\'S OWN PROMISED EXIT DID NOT EXIST:** its block reason has always ended \'or a genuine STOP report is committed\' and NOTHING EVER LOOKED FOR ONE, so a terminal that committed a real stop was blocked exactly as hard as one that had done nothing. Same defect class as the numbering artefact — the reason text promising a mechanism the logic did not implement. Implemented narrowly: HEAD\'s subject must begin `docs(stop):`. Mutations: removing the exit reds 1 cell, widening it to any commit reds 3.',
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
      state: 'guarded',
      by: 'test:athlete-move-occupied-content-loss',
      chainStatus: 'in_chain',
      receipt: 'BOUND TO LAW-conservation\'s EXISTING GUARD 2026-08-11 because this row\'s subject is the athlete-owned SESSION identity, not every exercise row inside its projection. The suite runs the real move transaction and asserts both safe refusal at an occupied G-1 destination and a chained double-move in which the moved session identity survives exactly once and success is reported honestly. FIRST BINDING RUN: 2/2 invariants green. DISTINCTION KEPT RED: LAW-attributed-content-change separately governs exercise content leaving a surviving session without a declared reason or athlete-visible explanation; this guard does not claim that property.',
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
      state: 'guarded',
      by: 'test:persisted-inputs-schema',
      chainStatus: 'in_chain',
      receipt: 'BOUND TO THE EXISTING DISK-LEVEL GUARD 2026-08-11. The suite generates a fresh install, flushes real storage writes, enumerates every dotted key that actually reaches disk, and requires each one to be classified as profile / fact / decision / result or carried on a dated shrink-only debt list. It is two-directional: an undeclared stored key reds, and a declaration whose key no longer exists reds so it cannot pre-bless a later reintroduction. FIRST BINDING RUN: 12 storage envelopes, 27 persisted keys; 12 declared inputs and 16 carried debt entries (13 coach-era, 2 transient, 1 unregistered); 8/8 cells green. WHAT IT DOES NOT CLAIM: the 16 debts are not inputs and remain red distance to the north-star property; the guard prevents silent growth and does not itself decide that a newly proposed classification is legitimate.',
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
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'RE-WORDED ONTO THE DOC SURFACE AND GUARDED, Sam 2026-08-10. He ruled the re-wording himself: "nothing may be written as done/working for an athlete-visible behaviour without a device or simulator receipt". The literal law says a CELL is not the arbiter, so no cell could hold it; the doc form is what the law actually protects and it is checkable today. Held with LAW-L10-phone-is-done by one section — the two are the same rule from either end.',
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
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'RE-WORDED AND GUARDED, Sam 2026-08-10, with LAW-L4-device-is-arbiter — one section holds both. A Sam-facing block in docs/NOW.md that claims an athlete-visible thing is done/fixed/working must carry a device or simulator receipt, or say NOT ON GLASS / UNSEEN. Its founding case is this week: three claims carried NOT-ON-GLASS only by the author\'s care.',
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
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'RE-WORDED AND GUARDED, Sam 2026-08-10: "any question put to Sam carries a receipt that the Bible and ruling docs were searched first". The surface is the STOP reports\' blocked-on-Sam sections, which is where questions actually reach him. A blocking item with no cited doc, Bible line, registry id or verified-marker reds.',
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
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'RE-WORDED AND GUARDED, Sam 2026-08-10, and his re-wording is better than the seat\'s: "it is APP WORDING, and wording already has a register" — signedCopy.ts. So the check is a jargon list over the athlete-facing SIGNED strings, not over chat. Every word the athlete reads already passes through one register; this makes that register refuse engineering vocabulary.',
    },
  },
  {
    id: 'LAW-sam-chat-simplicity',
    // RE-SCOPED 2026-08-10. It governed the SEAT's replies; Sam's process ruling
    // removed the seat from the relay, so the terminal now writes straight to
    // him. The row widens to ANYTHING anyone writes for Sam to read.
    // SCOPE LINE ADDED 2026-08-10, resolving an apparent clash with
    // LAW-claim-needs-a-cell. They were never for the same reader: this row is
    // SAM-SCOPED, that one is REPO-SCOPED. Plain words carry a claim's status
    // for a human exactly as a token does for a script, so neither weakens.
    law: 'SAM-SCOPED. Anything written for Sam to read is three parts at most — WHAT HAPPENED / WHAT\'S NEXT / WHAT TO SEND — with no jargon, file names, commit ids or test names, and status said in PLAIN WORDS ("not proven yet", "not seen on your phone") rather than in tags. The depth moves to the repo docs; it does not disappear.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_COACH_BUILD_ERA.md §0 "SAM CHAT RULE" (Sam-forced); CLAUDE.md "HOW TO WRITE TO SAM"; re-scoped 2026-08-10',
    guard: {
      state: 'guarded',
      by: 'Sam',
      chainStatus: 'human',
      humanGuard: 'Sam',
      receipt: 'TWO FOUNDING CASES, RECORDED SO THE ROW IS NOT READ AS THEORETICAL — both Sam, 2026-08-10, both the red firing: "what the fuck is this? i don\'t even know what some of that shit is", and "what do you even mean?" over the law list. THE NAMED HUMAN INSTRUMENT — Sam ruled this shape into existence 2026-08-10 for this row and, he said, for this row ONLY. Chat never reaches the repo, so no script can ever see it; "held by discipline" was the honest description and it is also the loophole he banned the same morning, being UNENFORCED wearing a nicer word. So: HE is the guard, named, and him having to pull the seat up on it IS the red. Two states preserved — guarded, by a guard that is not a script. The gate refuses this shape for any id outside HUMAN_GUARDABLE_LAW_IDS, so it cannot spread.',
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
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'GUARDED WITHOUT RE-WORDING, Sam 2026-08-10: "git proves this one outright." WHAT THE CELL HOLDS, STATED EXACTLY: no committed script, tape or tool in this repo reverts a file with `git checkout --` or `git stash` — the two mechanisms whose founding case lost an hour of unrelated wiring twice in one session on 2026-07-28. WHAT IT DOES NOT HOLD: a human typing either at a prompt. That half is loud rather than checked, and the row says so instead of implying the cell is wider than it is.',
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
