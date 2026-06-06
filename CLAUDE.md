# Claude Instructions

Read and follow `AGENTS.md` before changing this repo.

The short version: for coach chat bugs, do not add phrase-by-phrase special
cases as the main fix. Improve the typed intent, context, target-resolution,
mutation history, executor, or verification layer that explains the whole class
of behaviour. If the correct abstraction is unclear, ask first.
