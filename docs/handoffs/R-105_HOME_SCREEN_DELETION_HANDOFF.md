# HANDOFF — THE R-105 DELETION ON THE PROGRAM SURFACE

**For the UI / integration lane. Written by seat `finish-coach-product`,
2026-08-20, on Sam's instruction:**

> *"Do not make further HomeScreen changes; the UI lane owns it concurrently.
> Preserve your deletion as a precise integration handoff if it conflicts."*

**The change is already committed on `feat/finish-coach-product`.** This file
exists so that if the UI lane's concurrent work conflicts, the integrator can
reapply the deletion exactly rather than re-deriving it. **The patch is
`docs/handoffs/R-105-home-screen-deletion.patch`** (`git diff main...HEAD` over
the two files).

## WHY THERE IS A HOME-SCREEN EDIT AT ALL

R-105, Sam, 2026-08-19: *"This should not be popping up on the main page - it
should show up in the coaches chat with a notification"*. Removing the
conversation from the Program page IS the ruling. There is no path to it that
does not touch these two files.

## IT IS A DELETION. NOTHING WAS ADDED, MOVED OR RESTYLED.

**29 insertions, 104 deletions**, and every insertion is a comment naming where
the behaviour went.

### `src/screens/home/HomeScreenV2.tsx`

1. the import block loses `ExtraSessionOfferCard` and `WeeklyCommitmentPromptCard`
   (`BlockBoundaryNoticeCard` stays);
2. the destructure loses `weeklyCommitmentPrompt`, `extraSessionOffer`,
   `handleConfirmWeeklyCommitment`, `handleDeclineWeeklyCommitment`,
   `handleAcceptExtraSession`, `handleDeclineExtraSession`
   (`blockBoundaryNotice` and `handleAcknowledgeBlockBoundaryNotice` stay);
3. the two JSX blocks that mounted those cards are replaced by one comment.

**The `BlockBoundaryNoticeCard` block immediately above them is untouched** —
that is a notice about a decision already taken, not a negotiation, and R-105's
subject is a surface that asks the athlete to renegotiate their week.

### `src/screens/home/useHomeScreen.ts`

1. the `weeklyCommitmentAnswer` import narrows to
   `acknowledgeBlockBoundaryNotice`;
2. `availableTrainingDays` is no longer imported;
3. `useBlockBoundaryPrompts` is called with three arguments instead of seven —
   the hook itself now derives only the notice;
4. the four handlers are deleted, replaced by a comment naming their new home;
5. the return object loses the six fields listed above.

## IF IT CONFLICTS

**The conflict will be textual, not semantic** — nothing here competes with a
layout, a style or a control. Resolve by keeping the UI lane's version of the
surrounding code and re-applying these six removals. The check afterwards is not
a diff read:

```
npm run test:coach-weekly-reduction
```

Section [1] asserts, at the SOURCE, that the Program screen mounts neither card,
that its hook no longer derives either of them, that the prompt module derives
only the notice, and that the two card components are gone — each behind a
CONTROL cell proving the notice IS still there, so the four cannot pass by the
whole file having vanished.

## WHAT MUST NOT BE "RESTORED"

`WeeklyCommitmentPromptCard` and `ExtraSessionOfferCard` are deleted from
`src/screens/home/BlockBoundaryCards.tsx`. **Re-adding either is re-opening
R-105.** Their replacement is `src/components/CommitmentCard.tsx`, mounted by
`src/screens/coach/CoachTabScreen.tsx` in the keyboard-safe footer.
