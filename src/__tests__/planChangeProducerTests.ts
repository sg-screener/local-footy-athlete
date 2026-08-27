/**
 * Historical command alias, now exercising the current accepted-action contract.
 * The retired suite fabricated visible plans to test buildPlanChangeProposal,
 * a parallel proposal author with no app callers. That author has been removed.
 * The current suite drives real compiler state, accepted effects, accumulated
 * actions and restart instead of requiring that obsolete proposal shape.
 */
import './canonicalWeeklyCompilerSliceTests';
