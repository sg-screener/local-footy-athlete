# STATUS — seat `onboardingcopy`

Branch `codex/failure-only-state-export`, following the committed R-141
diagnostic cleanup.

## Order

Sam pointed at the Name screen and said: "remove so i can coach you properly".

## Landed

- **What should I call you?** remains unchanged.
- **So I can coach you properly.** is removed with no replacement copy.
- The unused subtitle style and its title-to-subtitle spacing are removed; the
  existing section spacing now places the input beneath the question.
- R-142 and `LAW-name-question-stands-alone` record the decision with its
  in-chain guard.

## Evidence

- `test:onboarding-presentation` was tests-first: 59/60 with the exact absence
  cell red on the old screen, then 60/60 after removal.
- `test:law-registry`: R-142 is a well-formed 155th row with a real in-chain
  guard; the existing 21-UNENFORCED count did not increase. Its three existing
  unrelated reds remain unchanged.
- `test:compile` names no changed file from this unit; the repository's existing
  baseline drift remains red in unrelated files.

## NOT COVERED

- Sam is driving the live simulator and asked only for the copy removal; this
  unit did not interrupt his flow for a separate screenshot.
- No physical-phone Release rebuild or acceptance yet.
