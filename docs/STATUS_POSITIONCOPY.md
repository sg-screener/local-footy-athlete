# Position copy checkpoint

Branch: `codex/failure-only-state-export`

## Landed

- The onboarding title now says **What position fits you best?**
- Its supporting line now says **Your position gives LFA a small programming bias.**
- The matching Profile edit step now uses the same position question.

## Evidence

- `test:role-buckets`: tests-first 49 passed / 3 failed, then 52 passed / 0 failed.
- `test:profile-reset-ui`: tests-first 170 passed / 1 failed, then 171 passed / 0 failed.

## NOT COVERED

- Simulator pixels after this copy-only change.
- The next physical-iPhone Release build.
