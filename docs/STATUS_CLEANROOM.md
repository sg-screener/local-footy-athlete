# STATUS — seat `cleanroom`

**Mission:** Coach rebuild step 2 — remove the frozen unreachable Coach systems
and the unreachable Journal UI before the new Coach is built.

**Branch:** `codex/coach-cleanroom-demolition`, cut from the verified recovery
point `pre-coach-rebuild-2026-08-24`.

## Protected current owners

- The reachable `CoachTabScreen` stays until the replacement is proven.
- Journal facts, notes, load/readiness/progress derivations and their
  athlete-visible data-collection controls stay.
- The accepted-state/program-control transaction door stays.

## Options compared before editing

1. **Incremental cut:** remove the unreachable screen import and startup warm-up,
   but leave the frozen pipeline and endpoints in the tree. This removes the
   immediate runtime side effect but preserves the audit, test and maintenance
   tax Sam explicitly ruled against.
2. **Authority demolition:** census the full value-import tree and every
   source-reading suite, delete only modules whose production authority is
   frozen/unreachable, and retire or re-aim their guards in the same work.

**Selected:** option 2. It removes the whole defect class while preserving the
current Coach, data owners and program door.

## Working rule

No file is deleted because its name contains `coach`, `journal` or `legacy`.
Each deletion needs proof that it is unreachable or that its authority is
superseded. Mixed modules are split or retained.

## 2026-08-24 demolition checkpoint

- Pre-cut census: removing the frozen Coach root made 42 modules / 41,654
  source lines unreachable. Removing the Journal screen root made 11 modules /
  4,857 source lines unreachable; those 11 were split because seven are useful
  Journal calculations that the Coach snapshot will reuse.
- Retired: frozen Coach screen/orchestrators/classifiers/clarifiers, old chat and
  memory persistence, old server functions, Journal screen/chart/reminder, and
  their startup/configuration wires.
- Preserved: current `CoachTabScreen`, read-only answer rules, Journal week/load/
  month/changes/niggle/strength/job/status derivations and notes, and the durable
  program-control transaction path.
- New guard: `test:coach-cleanroom` is green at 58/58 and checks both directions
  — retired systems remain absent and protected owners remain present. Three
  fabricated counterexamples prove its absence, preservation and import scans
  can each turn red.
- Behaviour checks green: current read-only Coach slice 2 (72/72), Journal week
  derivation (42/42), Journal load derivation (125/125), durable program door
  (11/11), Coach reset (32/32), and profile reset (167/167).
- Pure Journal suites remain green after their retired UI assertions were
  removed: feel 54/54, strength trend 17/17, week job 24/24, niggle history
  29/29, month 29/29, and changes 13/13.
- Configuration/copy boundaries remain green: current client environment 11/11,
  copy ruling binding 9/9, signed-copy extraction 7/7, feature registry 6/6,
  and dead-affordance scan 6/6.
- The old phrase baseline was replaced by a fresh lexical ratchet over the
  living product Coach files. It is green 8/8 and refuses new phrase-handler
  files or growth in existing ones while allowing the read-only question parser.
- Every package test command now resolves to a file. The product typecheck has
  no import of a retired Coach or Journal owner and improved from 32 errors
  before the cut to 27 after it.
- Known pre-existing reds reproduced unchanged: current Coach slice 1 has one
  Home naming assertion red; slice 3 has two existing red claims (the unchained
  move tape and phase-review source assertion). The typecheck ratchet remains
  red on pre-existing/concurrent Home, exercise-filter, temporary-source-fact
  and test-harness drift; none names a retired Coach or Journal module. The law
  registry remains red on 21 existing `UNENFORCED` rows, the missing
  `test:game-feedback` script and the existing LR-18 row gap. These were not
  silently changed as part of demolition.

## Step-2 boundary

- Complete for the named surface: dead Coach/Journal authorities are absent,
  living owners are guarded, their focused suites are green, and startup/package
  configuration cannot reach the retired system.
- NOT COVERED: no replacement dashboard or chat exists yet; response quality,
  model/provider choice, device rendering, and a real program-change execution
  by the future Coach are Step 3 and later. Repo-wide green is not claimed; the
  pre-existing red gates above remain visible.
