# STATUS — seat `exportcleanup`

Branch `codex/failure-only-state-export`, cut from `main` at `723b2792`.

## Order

Sam saw **Export stored state** and its internal counts on the normal Welcome
screen, asked whether it was still needed, accepted this answer, then said
"okay do that": remove it from healthy Welcome and Profile screens; retain the
underlying diagnostic only on the actual onboarding completion failure.

## Shape chosen

1. Delete the exporter entirely. This makes healthy screens clean but throws
   away the only diagnostic reachable when completion fails before Profile.
2. Keep it everywhere. This preserves an old instrument by making every athlete
   carry its developer UI.
3. **Selected:** mount it only in CompleteScreen's real error branch. Healthy
   athletes never see internal state; a stranded athlete can still explicitly
   share the failure evidence.

No new diagnostic owner was built. The existing serializer and failure control
remain one implementation; Welcome and Profile simply stop importing or
rendering it.

## Evidence

- `test:action-log`: 12 passed / 0 failed. The new cell anchors the real error
  branch, requires its Release-reachable export, and rejects the normal Welcome
  and Profile controls and wiring.
- `test:profile-mirror-narrowing`: the new normal-Profile absence cell passes;
  the suite retains two pre-existing unrelated failures (hydration mint-site
  ownership and five undeclared test writers).
- Tests were written first: the failure-only action-log cell and the Profile
  absence cell both red against the old athlete-visible instruments.
- Mutation liveness: restoring the real Welcome import and export mount made
  `test:action-log` red by name; restoring the cleaned source returned it to
  12 passed / 0 failed.
- `test:law-registry`: the new R-141 row is well-formed, names real in-chain
  guards and does not change the existing 21-UNENFORCED count. The suite retains
  its three pre-existing reds: missing `test:game-feedback`, LR-18 without a
  row, and those 21 existing UNENFORCED rows.
- `test:compile` reports no changed-file failure from this unit. Its existing
  repository baseline drift remains red in unrelated files.

## NOT COVERED

- The actual completion error branch and the cleaned Welcome/Profile screens
  were not forced on simulator in this unit; the running simulator was already
  mid-onboarding and was not reset out from under the active user.
- No physical-phone Release rebuild or acceptance yet.
