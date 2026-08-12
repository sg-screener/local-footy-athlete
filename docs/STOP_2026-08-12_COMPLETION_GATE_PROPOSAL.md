# STOP — THE COMPLETION GATE, PROPOSED. THREE OF THE COMMANDS THE ORDER IMPLIES ARE ALREADY RED

**2026-08-12. HEAD `cf4eb374`, branch `main`.** Inbox item 0b, which says:
*"Show the proposed file list and which existing command each check calls
BEFORE writing anything."* **Nothing has been written. This is that list.**

---

## §1 THE BLOCKER, AND IT DECIDES THE WHOLE DESIGN

**A completion gate that calls a RED command blocks every completion forever.**
So the first thing measured was whether each candidate passes today:

| command | today | |
|---|---|---|
| `npm run typecheck` | **RED** | the raw config; 459 errors across `src` |
| `npm run test:compile` | **GREEN** | the RATCHET over the same errors |
| `npm run test:qa` | **RED** | 84 failures, pre-existing (stale `isTeamDay` flag) |
| `npm run test:law-registry` | **RED** | 32 UNENFORCED — *deliberate*, Sam's stop-the-line |
| `npm run test:rules-kernel` | **GREEN** | |
| `npm run test:repo-law-guards` | **GREEN** | 35 cells |

**The order's mapping names two of the red ones.** *"TypeScript changed →
typecheck"* is red, and *"generation, repair, scheduling or coaching rules
changed → the full scenario suite"* is `test:qa`, also red. **Built literally,
this gate would refuse every completion in the repo from its first run.**

## §2 WHAT I PROPOSE INSTEAD — same intent, green instruments

**`test:compile` IS the typecheck answer, not a substitute for it.**
`scripts/typecheck-gate.js` checks all of `src` across three scopes and enforces
a ratchet against a checked-in baseline: *"a file may improve, but it may never
get worse, and a file with no baseline entry may have no errors at all."* That
is precisely what a completion gate wants — it fails on NEW drift and ignores
the documented backlog. `npm run typecheck` is the weak config the ratchet was
built to replace.

| what changed | command(s) | why |
|---|---|---|
| any `.ts` / `.tsx` | `npm run test:compile` | the ratchet; green, fails on new drift |
| `src/rules/**`, `src/store/**` | **+** `npm run test:repo-law-guards` | green, fast, catches law + doc-budget drift |
| `src/rules/section18*`, `src/utils/coachingEngine.ts`, `src/rules/derivedWeekContract.ts`, `src/utils/fixtureMinimalReplan.ts` | **+** `npm run test:rules-kernel` | green; the kernel the order's "scenario suite" is really protecting |
| `docs/**`, `*.md`, images, `.claude/**` | **nothing** | the order's explicit *"must NOT run the expensive suite"* |

**Every command already exists in `package.json`. Nothing is invented.**

## §3 THE FILES — two, which is the constraint's maximum, and one already exists

1. **`.claude/hooks/completion-gate.sh`** — NEW. Reads the changed-file list,
   selects commands by the table above, runs them, and **exits 2 with the
   failing command's name and tail** so the reason is fed back.
2. **`.claude/settings.json`** — EDITED, not new. It already holds the `Stop`
   hook; this adds a `TaskCompleted` entry beside it.

**No new registry. No new doc beyond this stop report. No worktree.**

## §4 THE ONE DECISION I WILL NOT TAKE ALONE

**Does the gate use the green proxies in §2, or does someone fix `typecheck` and
`test:qa` first so the order can be built literally?**

They are different bets:

- **§2 as proposed** — the gate works from day one and guards against NEW
  breakage. It does NOT notice the 84 `test:qa` failures or the 459 typecheck
  errors, because those are the documented backlog.
- **Fix first** — the gate then means "everything passes", which is stronger and
  is what "nothing may be called finished" literally says. But `test:qa`'s 84
  failures are a real unit of work nobody has scoped, and `test:law-registry` is
  red BY RULING and must never be wired in at all.

**Recommended: §2 now.** A gate that exists and catches regressions beats a
stronger gate that cannot be switched on. The backlog stays visible in the
sweep, which is where it already lives.

## §5 NOT COVERED

- **Nothing was written.** No hook file, no settings edit, no `/hooks` run.
- **`/hooks` verification needs Sam** — it is his harness, and a `TaskCompleted`
  hook blocks HIS completions, not just mine.
- **The changed-file list's exact shape** in the hook payload is NOT verified —
  I have not run a `TaskCompleted` hook in this repo, and the script's first
  version must print what it receives before it decides anything on it.
- **Whether `test:rules-kernel` is the right proxy** for the order's "full
  scenario suite" is a judgement, not a measurement. It is green and it is the
  kernel; it is not the 17 scenarios.

**NORTH STAR: neutral.** Tooling only; no app behaviour changes.
