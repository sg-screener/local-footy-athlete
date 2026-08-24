# STATUS — seat `coachfailures`

Opened 2026-08-24 for audit finding HIGH-5: every live Coach failure was being
collapsed into one untyped catch.

## Options compared

1. Inspect HTTP status codes and error-message text in `CoachTabScreen`. This is
   the smallest patch, but makes the UI a second owner of server semantics.
2. Give the one Coach API client a closed failure vocabulary and let the screen
   read only that vocabulary.

Selected: option 2. `CoachChatError` now owns `unavailable | refused | no_answer`.
The edge endpoint separately names an invalid/empty provider answer and an answer
rejected by the response contract. Transport detail and provider prose never
reach the screen.

## Checkpoint

- Action-bearing and false-change answers are typed `refused`.
- Empty/unreadable answers are typed `no_answer`.
- Offline, timeout, disabled, rate-limit and provider failures are typed
  `unavailable`.
- The screen logs only the refusal kind, never the athlete question or model
  answer.
- `test:coach-chat-integration`: 47 green / 0 red.
- The full `test:coach-snapshot` chain is green.
- Liveness: changing the server response-contract failure from
  `coach_chat_response_refused` to `coach_chat_invalid_answer` killed the named
  production-refusal cell. The mutation was restored.

NOT COVERED: the three causes still intentionally use the one already-approved
athlete sentence. A distinct outage sentence is blocked on Sam's copy approval;
no new athlete wording was invented here. The updated edge function is not yet
deployed, no real provider call was made, no React Native failure state was
mounted, and no physical-phone acceptance was run.
