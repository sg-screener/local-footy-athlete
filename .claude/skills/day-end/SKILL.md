---
name: day-end
description: One factual end-of-day report — what actually completed, what is verified, what is unfinished, and tomorrow's first action. Attempted work is never reported as completed.
disable-model-invocation: true
---

# /day-end — what actually happened today

Live state, injected so none of it is recalled:

- Today's commits: !`git --no-optional-locks log --oneline --since=midnight`
- Working tree: !`git --no-optional-locks status --short`
- Branch: !`git --no-optional-locks branch --show-current`

---

**THE ONE RULE: ATTEMPTED IS NOT COMPLETED.** A unit that was built and reverted
is UNFINISHED. A unit whose suite was never run is UNFINISHED. A unit that
landed with its red carved out is COMPLETED **with the red named**. If a commit
message says "done" and no cell backs it, the report says so — the commit is not
evidence about itself.

Write exactly these four sections. Nothing else.

## 1. COMPLETED AND VERIFIED

Only work that landed **and** has something that fails if it breaks. Each line:
what changed, and the cell or sweep that holds it. **No cell named, not this
section.**

## 2. LANDED BUT UNPROVEN

Code that shipped with nothing watching it, or whose proof is a suite nobody
ran. This section existing is normal; it being empty when it should not be is
the failure.

## 3. UNFINISHED

Attempted and reverted, blocked, or parked — **each with WHY, and with what it
is waiting on.** "Blocked on Sam" names the question. "Blocked on the phone"
names the check. A blocker with no named unblocker is not a blocker, it is an
abandonment.

## 4. TOMORROW'S FIRST ACTION

**One action.** Not a list, not a plan. The specific next thing, and the file or
command it starts at. If the first action is a question for Sam, write the
question in the words he should answer with.

---

**Read the sweep before writing section 1.** The failing set diffed name for
name against its baseline is the only thing that distinguishes "I broke nothing"
from "the count happens to match".
