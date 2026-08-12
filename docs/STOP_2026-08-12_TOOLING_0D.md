# STOP — 0d IS BUILT, BOTH HALVES, AND THE START COMMAND WAS ONE STEP SHORT

**LOOP CHECK:** *a doc that names commands it cannot check* — sighting 1.
**Disposition: iterate**, and the iteration is a cell. `CLAUDE.md` now hands a
new session a command table, which is the part of a document that rots first; a
renamed npm script would leave the instruction reading exactly as authoritative
as a true one. The cell that reds on a command that does not exist ships in the
same commit as the table.

**HEAD:** `3194fc05` on `main`. Branch verified immediately before the commit.

---

## 1. WHAT THE ORDER ASKED, AND WHAT LANDED

**Item 0d, from Sam:** *"all of chat is done? wasn't there like 7-8 things?"* —
0c covered six, and the seat said "all of it" without counting.

### (i) `CLAUDE.md` DOES NOT SAY WHAT COUNTS AS FINISHED — it does now

`## WHAT COUNTS AS FINISHED` carries the five things the order named: the
source-of-truth order (criteria → registry → tests → code, and **the code is
evidence of what was BUILT, never of what was INTENDED**), the athlete-visible
definition of done, writer + reader + behavioural test for every new domain
field, the three words with the banned six, and the commands.

**IT GOT SHORTER: 137 → 104 lines.** The order said to cut what is now covered
by `AGENTS.md` or the path-scoped rules, and two of this file's three big
sections were **word-for-word duplicates**:

| section | was also in | now |
| --- | --- | --- |
| Coach Architecture Escalation Rule | `.claude/rules/coach-and-plan-edits.md` | pointer |
| Elegant Solution Requirement | `AGENTS.md` "Elegant Solution Requirement" | pointer |
| Stop-Patching Trigger | **nowhere else** | MOVED to the coach rule file, pointer left |

The trigger moved rather than stayed because it is coach and plan-edit law and
belongs where that law loads. **Ten docs cite it as "CLAUDE.md's stop-patching
trigger" and every one of those citations is still true** — the pointer is one
hop, which is the same containment 0c(ii) used for the sections it moved.

### (ii) ONE COMMAND THAT STARTS EVERYTHING — `npm run lfa:dev`

**THE ORDER SAID CHECK FIRST, AND THE CHECK PAID.** `scripts/qa-start.sh`
already existed, tracked, named by `QA_RUNBOOK.md`, headed *"One command to a
testable app"*. Nothing needed writing. It is now behind `npm run lfa:dev` and
recorded as the `lfa-dev` skill.

**BUT IT WAS ONE STEP SHORT OF THE ORDER'S OWN WORDS.** The order asks for a
command that *"gets to a running app"*. The script booted a simulator, started
Metro, and then **printed the remaining steps as homework** — which is precisely
the part being rediscovered every session. Three changes, all inside the one
script:

1. **It launches the app.** That is what makes the command's name true.
2. **It picks the booted simulator that HAS the app.** This machine keeps a
   dozen `LFA Explorer` simulators; the hardcoded `iPhone 17 Pro` default is not
   the one on screen, and booting a second device beside it is how a session ends
   up driving a simulator nobody is looking at. Override order is documented and
   printed: `$QA_SIM_UDID` → `$QA_SIM_NAME` → booted-with-the-app → the default →
   any device with the app.
3. **It fails closed.** Nothing installed anywhere → exit 69 naming
   `npx expo run:ios`, rather than starting Metro for an app that is not there.

## 2. TWO THINGS I GOT WRONG WHILE BUILDING IT, BOTH RECORDED AT THE CODE

**`simctl get_app_container` CANNOT ANSWER "IS IT INSTALLED" FOR A SHUTDOWN
DEVICE.** It returns *"Unable to lookup in current state: Shutdown"* (code 405),
which is indistinguishable from "not installed" unless you read the message. I
read the code and concluded the app was missing from `iPhone 17 Pro`. **It is
installed there.** Detection now reads `CFBundleIdentifier` out of the app
bundles on disk, which works on a shutdown device.

**THE DEVICE PARSER MATCHED NOTHING AND LOOKED CORRECT.** `simctl list devices`
pads its lines with a trailing space, so a regex anchored on `\)$` returned zero
rows — and the script announced *"not installed on any simulator"* about a
simulator sitting on screen with the app open. **A scan that reads nothing is
green in exactly the shape of a scan that read everything and found nothing**,
which is the class `LAW-green-gate-is-a-claim` exists for. Fixed, and the reason
is a comment at the regex.

## 3. WHAT HOLDS IT

**Two registry rows, both born `guarded` by `test:repo-law-guards`, 35 → 37
cells. Registry 97/65 → 99/67; UNENFORCED unmoved at 32.**

- **`LAW-one-startup-command`** — scans `scripts/` for any OTHER file that starts
  the dev server (comments stripped: prose naming a command is not a use of it)
  and asserts `lfa:dev` invokes the one script. **Scope is SCRIPT FILES, not npm
  scripts** — `start`, `web` and `dev:coach-semantic-active` are one-line Expo
  passthroughs, and a law that reddened on them on day one would be switched off
  by the end of the week.
- **`LAW-definition-of-done`** — the section exists, still offers all three
  words, still bans the six, and **every command it names is real**. Its receipt
  states the PARTIAL out loud: the judgment half — is this proof really
  athlete-visible — is carried by `lfa-verifier` and `scripts/completion-gate.sh`,
  neither of which is a cell. That is 0b and 0c doing their job, not a gap this
  row is hiding.

**MUTATIONS — three, each killing only what it should.** A fabricated
`scripts/tmp-rival-start.sh` reds the startup cell. Renaming `lfa:dev` reds
**both** cells, correctly: the doc genuinely goes stale in the same move.
Replacing the banned-words line reds the done cell. An early version of the
command checker read the deliberate placeholder `npm run test:<name>` as the
script name `test:` and reddened on correct prose — **that false positive is now
its own liveness probe**, because a cell stricter than its law gets deleted.

**PROOF THAT IS NOT A CELL:** `npm run lfa:dev` launched
`com.localfootyathlete.app` on the booted simulator (pid 35161) and the
screenshot is the **Profile screen with real state** — Sammy, inside mid, 4 days,
Tue/Thu team training, Saturday game — not a splash and not a white screen.

**Green:** `test:repo-law-guards` 37/0 · `test:seat-inbox-hook` 21/0 ·
`test:rules-kernel` 113/0 · `test:compile` PASSED, no file regressed against the
baseline. `test:law-registry` is red **only** on the standing stop-the-line
ruling.

## 4. NORTH STAR

**Neutral, and it is tooling, so that is the honest answer.** Nothing stored,
nothing derived, no app behaviour touched. The one adjacency: this unit removed
two duplicated law texts and replaced them with pointers — **one owner per law**
is the same shape as one owner per fact.

## 5. NOT COVERED

- **No sweep.** This unit changed one suite, one registry file, one shell script
  and four docs; the targeted suites plus `test:compile` are the proportional
  instrument (`1c`, mechanical items batch). A full sweep was not run and is not
  claimed.
- **The `lfa-dev` skill and the `.claude/rules` move are still unverified as
  MECHANISMS from here.** I can see the files; I cannot see this build load them.
  Same containment as 0c(ii): pointers everywhere, so an inert mechanism costs a
  hop rather than a law. **Sam's `/context` after a restart is still the only
  thing that closes it — and it is already owed from 0c.**
- **`npm run lfa:dev` was proven on THIS machine, with the app already built.**
  The fail-closed branch (nothing installed anywhere → `npx expo run:ios`) was
  read, not executed; exercising it means uninstalling the app from fourteen
  simulators.
- **The judgment half of `LAW-definition-of-done` has no cell** and the row says
  so. Whether a proof is really athlete-visible is a question no script asks.
- **Nothing was checked on Sam's phone.** Stand-down C: he cannot device-test
  until he rebuilds. Nothing here needs his phone.
