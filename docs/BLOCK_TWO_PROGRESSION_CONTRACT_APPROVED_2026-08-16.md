# Block Two Progression Contract — Approved Implementation Input

**Approved by Sam:** 2026-08-16.

**Status:** Approved coaching input, deliberately uncommitted until the implementation, registry entries and behavioural guards land together. The app does not enforce this document yet.

## Evidence the app may use

Progression may use only information the app genuinely records:

- completed and skipped sessions;
- athlete-selected loads;
- difficulty feedback;
- readiness and soreness;
- injury reports;
- athlete exercise removals and substitutions.

The app does not record set-by-set or rep-by-rep completion. It must not claim to know which rep was missed, whether extra reps were completed or whether every prescribed rep was achieved merely because a session was marked complete.

## Progression order

When training is being completed and recovery is good:

1. Increase load by the smallest practical increment.
2. Add one set when more volume is appropriate and the session remains inside its approved cap.
3. Add another session only when phase, schedule and gym availability permit it, and after athlete confirmation.

Do not add repetitions merely to manufacture progression. Rep ranges follow exercise role and season phase. Increasing repetitions is appropriate only when the phase explicitly calls for more hypertrophy-oriented work.

For barbell work, the normal increase is the smallest practical increment, usually 2.5 kg. Ten percent is an exceptional upper bound, not the default. Every suggested load remains editable and the athlete has the final say.

If the same exercise continues, its last successful load may seed the next prescription. When an exercise rotates, the old exercise's load must not be blindly transferred and increased; the athlete selects a safe starting load for the new movement, informed conservatively where a valid mapping exists.

## Completed but very hard

Keep meaningful load/intensity and reduce volume first:

- reduce a four-set main lift to three sets;
- reduce secondary-lift sets where necessary;
- reduce the number of hard conditioning sessions;
- replace removed hard conditioning with easier aerobic work when the weekly conditioning requirement still needs to be met.

## High readiness and low soreness

Progress the quality the athlete is tolerating well while protecting all required movement and conditioning minima:

- strength easy, conditioning difficult: progress strength load or sets while keeping conditioning achievable;
- conditioning easy, strength difficult: progress conditioning within the phase-approved template progression while keeping strength volume manageable;
- everything consistently easy: load first, sets second, then consider another session.

A difficult quality is made achievable rather than abandoned. An existing strength must not consume progression while a weaker required quality disappears.

## Low readiness or high soreness

Reduce workload in this order:

1. remove or reduce hard conditioning;
2. reduce main- and secondary-lift sets;
3. replace remaining conditioning with easier aerobic work where appropriate;
4. retain meaningful load/intensity where safe while performing less total work.

Do not add sessions or load in this state. Injury rules outrank ordinary readiness adjustments.

## Missed sessions

One disrupted week does not redesign the program. When the athlete completes less than roughly 75 percent of required sessions across the block, ask whether the weekly commitment is unrealistic.

Example:

> You have been completing about two of your four planned sessions. Would a two- or three-session program fit your life better?

Rebuild only after the athlete confirms the new commitment. Do not shame them, cram missed work into later days or silently reduce the plan.

## Pain and injury

There is no independent exercise-pain progression system unless the product explicitly collects that information. The athlete reports an injury through the injury flow. The injury system removes prohibited movements, selects legal alternatives, adjusts affected work according to severity and explains what changed.

## Exercise rotation

- Movement patterns remain stable while exercises normally rotate at block boundaries.
- Most exercises change when a new block begins.
- Main and secondary lifts may remain for a second consecutive block when progression, comfort and technical continuity justify it.
- The default maximum is two consecutive blocks for the same main or secondary lift.
- Accessories may rotate more freely.
- A deload normally uses the current block's exercises at reduced volume; rotation occurs when the next build block begins.
- Block length follows the approved phase plan, normally three build weeks plus one deload week, while preserving the approved shorter early-off-season blocks.

## Athlete substitutions and exclusions

An ordinary substitution changes the programmed row without banning the original exercise. The substituted movement may rotate normally at the next block boundary.

Whenever the athlete removes an exercise, ask:

> How long should we leave this exercise out?

The typed scopes are:

- **Today only:** removed from this session; future sessions and blocks are unaffected.
- **This block:** excluded for the remainder of the current block and expires automatically at the next block.
- **Until I change it:** excluded from all future programming until the athlete restores it.

The active exclusion is a canonical modifier and must survive persistence, hydration, rebuilding and block generation. Exercise pools, rotation and validators must respect it. Nothing may quietly restore an excluded exercise.

If another legal exercise can train the movement pattern, use it. If the exclusion makes the pattern impossible, disclose the gap rather than restoring the exercise.

Status shows every active exclusion with:

- exercise name;
- scope;
- expiry;
- athlete-provided reason, when present;
- controls to change the scope or restore the exercise.

Today-only exclusions leave active Status after the day but remain in history. This-block exclusions expire at the block boundary. Until-I-change-it exclusions persist until explicitly restored.

## Implementation boundary

This contract belongs to the later athlete-authorship and Block Two progression phase. It must not be folded into the current weekly-scheduler mission. When implementation begins, this document, its typed production rules, registry entries and mutation-proven behavioural guards land together.
