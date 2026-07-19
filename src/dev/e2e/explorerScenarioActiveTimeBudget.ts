import type { DevE2EKeyValueStorage } from './devE2ECheckpoint';

declare const __DEV__: boolean | undefined;

export const EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_VERSION = 1 as const;
export const EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_STORAGE_KEY =
  'dev-e2e-explorer-scenario-active-time-budget-v1' as const;

export const EXPLORER_EXTERNAL_STAGE_DEADLINE_MS = Object.freeze({
  physical_evidence_acknowledgement: 120_000,
  external_action_ingress: 120_000,
  rendered_observation: 30_000,
  physical_evidence_capture: 120_000,
  reload_receipt: 120_000,
} as const);

export type ExplorerExternalPauseReason =
  keyof typeof EXPLORER_EXTERNAL_STAGE_DEADLINE_MS;

export const EXPLORER_ACTIVE_TIME_BUDGET_FAILURE = Object.freeze({
  NOT_STARTED: 'active_time_budget_not_started',
  ALREADY_STARTED: 'active_time_budget_already_started',
  EXPIRED: 'budget_expired',
  FINISHED: 'active_time_budget_finished',
  TOKEN_MISMATCH: 'active_time_pause_token_mismatch',
  STALE_TOKEN: 'active_time_pause_token_stale',
  CORRUPT_SNAPSHOT: 'active_time_budget_snapshot_corrupt',
  EXTERNAL_STAGE_DEADLINE: 'external_stage_deadline_expired',
} as const);

export type ExplorerActiveTimeBudgetFailureCode =
  (typeof EXPLORER_ACTIVE_TIME_BUDGET_FAILURE)[
    keyof typeof EXPLORER_ACTIVE_TIME_BUDGET_FAILURE
  ];

export class ExplorerScenarioActiveTimeBudgetError extends Error {
  readonly reasonCode: ExplorerActiveTimeBudgetFailureCode;

  constructor(reasonCode: ExplorerActiveTimeBudgetFailureCode, detail?: string) {
    super(detail ? `${reasonCode}:${detail}` : reasonCode);
    this.name = 'ExplorerScenarioActiveTimeBudgetError';
    this.reasonCode = reasonCode;
  }
}

export interface ExplorerActiveTimePauseToken {
  readonly protocolVersion: typeof EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_VERSION;
  readonly tokenId: string;
  readonly scenarioId: string;
  readonly generation: number;
  readonly reason: ExplorerExternalPauseReason;
  readonly scope: string;
}

export interface ExplorerScenarioActiveTimeBudgetSnapshot {
  readonly protocolVersion: typeof EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_VERSION;
  readonly scenarioId: string;
  readonly generation: number;
  readonly budgetMs: number;
  readonly status: 'running' | 'paused' | 'finished';
  readonly activeElapsedMs: number;
  readonly activeStartedAtMs: number | null;
  readonly nextTokenOrdinal: number;
  readonly pauseTokens: readonly ExplorerActiveTimePauseToken[];
  readonly completedTokens: readonly ExplorerActiveTimePauseToken[];
}

interface ExplorerActiveTimeBudgetStorage
  extends Pick<DevE2EKeyValueStorage, 'getItem' | 'setItem' | 'removeItem'> {}

type TimerHandle = ReturnType<typeof setTimeout>;

export interface ExplorerExternalStageDeadlineOptions {
  readonly timeoutMs?: number;
  readonly setTimer?: (callback: () => void, timeoutMs: number) => TimerHandle;
  readonly clearTimer?: (timer: TimerHandle) => void;
}

function defaultStorage(): ExplorerActiveTimeBudgetStorage {
  // Loaded only from guarded development Explorer code.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

function available(): boolean {
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function sameToken(
  left: ExplorerActiveTimePauseToken,
  right: ExplorerActiveTimePauseToken,
): boolean {
  return left.protocolVersion === right.protocolVersion &&
    left.tokenId === right.tokenId && left.scenarioId === right.scenarioId &&
    left.generation === right.generation && left.reason === right.reason &&
    left.scope === right.scope;
}

function validReason(value: unknown): value is ExplorerExternalPauseReason {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(EXPLORER_EXTERNAL_STAGE_DEADLINE_MS, value);
}

function parseToken(value: unknown): ExplorerActiveTimePauseToken {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ExplorerScenarioActiveTimeBudgetError(
      EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.CORRUPT_SNAPSHOT,
      'token',
    );
  }
  const token = value as ExplorerActiveTimePauseToken;
  if (token.protocolVersion !== EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_VERSION ||
    !nonEmpty(token.tokenId) || !nonEmpty(token.scenarioId) ||
    !Number.isInteger(token.generation) || token.generation < 1 ||
    !validReason(token.reason) || !nonEmpty(token.scope)) {
    throw new ExplorerScenarioActiveTimeBudgetError(
      EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.CORRUPT_SNAPSHOT,
      'token_shape',
    );
  }
  return { ...token };
}

function parseSnapshot(raw: string): ExplorerScenarioActiveTimeBudgetSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ExplorerScenarioActiveTimeBudgetError(
      EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.CORRUPT_SNAPSHOT,
      'json',
    );
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ExplorerScenarioActiveTimeBudgetError(
      EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.CORRUPT_SNAPSHOT,
      'envelope',
    );
  }
  const snapshot = value as ExplorerScenarioActiveTimeBudgetSnapshot;
  const pauseTokens = Array.isArray(snapshot.pauseTokens)
    ? snapshot.pauseTokens.map(parseToken)
    : [];
  const completedTokens = Array.isArray(snapshot.completedTokens)
    ? snapshot.completedTokens.map(parseToken)
    : [];
  const tokenIds = [...pauseTokens, ...completedTokens].map((token) => token.tokenId);
  if (snapshot.protocolVersion !== EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_VERSION ||
    !nonEmpty(snapshot.scenarioId) || !Number.isInteger(snapshot.generation) ||
    snapshot.generation < 1 || !Number.isInteger(snapshot.budgetMs) ||
    snapshot.budgetMs < 1 ||
    !finiteNonNegative(snapshot.activeElapsedMs) ||
    !Number.isInteger(snapshot.nextTokenOrdinal) || snapshot.nextTokenOrdinal < 1 ||
    !['running', 'paused', 'finished'].includes(snapshot.status) ||
    (snapshot.activeStartedAtMs !== null &&
      !finiteNonNegative(snapshot.activeStartedAtMs)) ||
    new Set(tokenIds).size !== tokenIds.length ||
    [...pauseTokens, ...completedTokens].some((token) =>
      token.scenarioId !== snapshot.scenarioId ||
      token.generation !== snapshot.generation) ||
    (snapshot.status === 'running' && (
      snapshot.activeStartedAtMs === null || pauseTokens.length !== 0)) ||
    (snapshot.status === 'paused' && (
      snapshot.activeStartedAtMs !== null || pauseTokens.length === 0)) ||
    (snapshot.status === 'finished' && (
      snapshot.activeStartedAtMs !== null || pauseTokens.length !== 0))) {
    throw new ExplorerScenarioActiveTimeBudgetError(
      EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.CORRUPT_SNAPSHOT,
      'shape',
    );
  }
  return { ...snapshot, pauseTokens, completedTokens };
}

/**
 * Single owner of Explorer manifest active elapsed time. External wall time is
 * represented only by scoped pause tokens and never subtracted after the fact.
 */
export class ExplorerScenarioActiveTimeBudget {
  private state: ExplorerScenarioActiveTimeBudgetSnapshot | null = null;
  private generationCounter = 0;
  private persistenceChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly nowMs: () => number,
    private readonly storage: ExplorerActiveTimeBudgetStorage | null = null,
  ) {}

  private current(): ExplorerScenarioActiveTimeBudgetSnapshot {
    if (!this.state) {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.NOT_STARTED,
      );
    }
    return this.state;
  }

  private enqueuePersistence(): void {
    if (!this.storage) return;
    const snapshot = this.state;
    this.persistenceChain = this.persistenceChain.then(async () => {
      if (!snapshot) {
        await this.storage!.removeItem(
          EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_STORAGE_KEY,
        );
      } else {
        await this.storage!.setItem(
          EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_STORAGE_KEY,
          JSON.stringify(snapshot),
        );
      }
    });
  }

  start(scenarioId: string, budgetMs: number): void {
    if (!nonEmpty(scenarioId) || !Number.isInteger(budgetMs) || budgetMs < 1) {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.CORRUPT_SNAPSHOT,
        'start',
      );
    }
    if (this.state && this.state.status !== 'finished') {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.ALREADY_STARTED,
      );
    }
    this.generationCounter = Math.max(
      this.generationCounter + 1,
      (this.state?.generation ?? 0) + 1,
    );
    this.state = {
      protocolVersion: EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_VERSION,
      scenarioId,
      generation: this.generationCounter,
      budgetMs,
      status: 'running',
      activeElapsedMs: 0,
      activeStartedAtMs: this.nowMs(),
      nextTokenOrdinal: 1,
      pauseTokens: [],
      completedTokens: [],
    };
    this.enqueuePersistence();
  }

  remaining(): number {
    const state = this.current();
    const elapsed = state.status === 'running'
      ? state.activeElapsedMs + Math.max(0, this.nowMs() - state.activeStartedAtMs!)
      : state.activeElapsedMs;
    return Math.max(0, state.budgetMs - elapsed);
  }

  assert(): void {
    const state = this.current();
    if (state.status === 'finished') {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.FINISHED,
      );
    }
    if (this.remaining() <= 0) {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.EXPIRED,
      );
    }
  }

  pause(reason: ExplorerExternalPauseReason, scope: string): ExplorerActiveTimePauseToken {
    this.assert();
    if (!validReason(reason) || !nonEmpty(scope)) {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.TOKEN_MISMATCH,
        'pause_scope',
      );
    }
    const state = this.current();
    const now = this.nowMs();
    const token: ExplorerActiveTimePauseToken = {
      protocolVersion: EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_VERSION,
      tokenId: [
        'explorer-active-time-pause', state.scenarioId, state.generation,
        state.nextTokenOrdinal, reason, scope,
      ].join(':'),
      scenarioId: state.scenarioId,
      generation: state.generation,
      reason,
      scope,
    };
    const activeElapsedMs = state.status === 'running'
      ? state.activeElapsedMs + Math.max(0, now - state.activeStartedAtMs!)
      : state.activeElapsedMs;
    this.state = {
      ...state,
      status: 'paused',
      activeElapsedMs,
      activeStartedAtMs: null,
      nextTokenOrdinal: state.nextTokenOrdinal + 1,
      pauseTokens: [...state.pauseTokens, token],
    };
    this.enqueuePersistence();
    return token;
  }

  resume(token: ExplorerActiveTimePauseToken): boolean {
    const state = this.current();
    if (token.scenarioId !== state.scenarioId ||
      token.generation !== state.generation) {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.STALE_TOKEN,
        token.tokenId,
      );
    }
    const completed = state.completedTokens.find((candidate) =>
      candidate.tokenId === token.tokenId);
    if (completed) {
      if (sameToken(completed, token)) return false;
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.TOKEN_MISMATCH,
        token.tokenId,
      );
    }
    const active = state.pauseTokens.find((candidate) =>
      candidate.tokenId === token.tokenId);
    if (!active || !sameToken(active, token)) {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.TOKEN_MISMATCH,
        token.tokenId,
      );
    }
    const pauseTokens = state.pauseTokens.filter((candidate) =>
      candidate.tokenId !== token.tokenId);
    this.state = {
      ...state,
      status: pauseTokens.length === 0 ? 'running' : 'paused',
      activeStartedAtMs: pauseTokens.length === 0 ? this.nowMs() : null,
      pauseTokens,
      completedTokens: [...state.completedTokens, active],
    };
    this.enqueuePersistence();
    return true;
  }

  findPausedToken(args: {
    reason: ExplorerExternalPauseReason;
    scope: string;
    scenarioId?: string;
  }): ExplorerActiveTimePauseToken | null {
    const state = this.state;
    if (!state || (args.scenarioId && state.scenarioId !== args.scenarioId)) {
      return null;
    }
    const matches = state.pauseTokens.filter((token) =>
      token.reason === args.reason && token.scope === args.scope);
    if (matches.length > 1) {
      throw new ExplorerScenarioActiveTimeBudgetError(
        EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.TOKEN_MISMATCH,
        'competing_pause_tokens',
      );
    }
    return matches[0] ?? null;
  }

  async runExternal<T>(
    reason: ExplorerExternalPauseReason,
    scope: string,
    operation: (token: ExplorerActiveTimePauseToken) => Promise<T>,
  ): Promise<T> {
    const token = this.pause(reason, scope);
    await this.flush();
    try {
      return await operation(token);
    } finally {
      // A live owner may already have resumed this exact token at its external
      // completion boundary. Identical duplicate completion is intentional.
      this.resume(token);
      await this.flush();
    }
  }

  finish(): void {
    if (!this.state || this.state.status === 'finished') return;
    const state = this.state;
    const activeElapsedMs = state.status === 'running'
      ? state.activeElapsedMs + Math.max(0, this.nowMs() - state.activeStartedAtMs!)
      : state.activeElapsedMs;
    this.state = {
      ...state,
      status: 'finished',
      activeElapsedMs,
      activeStartedAtMs: null,
      pauseTokens: [],
    };
    this.enqueuePersistence();
  }

  resetScenario(scenarioId?: string): void {
    if (scenarioId && this.state && this.state.scenarioId !== scenarioId) return;
    this.state = null;
    this.enqueuePersistence();
  }

  snapshot(): ExplorerScenarioActiveTimeBudgetSnapshot | null {
    return this.state ? JSON.parse(JSON.stringify(this.state)) : null;
  }

  async restore(): Promise<ExplorerScenarioActiveTimeBudgetSnapshot | null> {
    if (!this.storage) return this.snapshot();
    const raw = await this.storage.getItem(
      EXPLORER_SCENARIO_ACTIVE_TIME_BUDGET_STORAGE_KEY,
    );
    this.state = raw ? parseSnapshot(raw) : null;
    if (this.state) {
      this.generationCounter = Math.max(
        this.generationCounter,
        this.state.generation,
      );
      // A durable paused snapshot deliberately has no wall-clock anchor, so
      // offline time cannot enter the active elapsed total.
      if (this.state.status === 'running') {
        this.state = { ...this.state, activeStartedAtMs: this.nowMs() };
      }
    }
    return this.snapshot();
  }

  async flush(): Promise<void> {
    await this.persistenceChain;
  }
}

export async function withExplorerExternalStageDeadline<T>(
  reason: ExplorerExternalPauseReason,
  operation: () => Promise<T>,
  options: ExplorerExternalStageDeadlineOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? EXPLORER_EXTERNAL_STAGE_DEADLINE_MS[reason];
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new ExplorerScenarioActiveTimeBudgetError(
      EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.EXTERNAL_STAGE_DEADLINE,
      `${reason}:invalid_deadline`,
    );
  }
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let timer: TimerHandle | null = null;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimer(() => reject(new ExplorerScenarioActiveTimeBudgetError(
      EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.EXTERNAL_STAGE_DEADLINE,
      reason,
    )), timeoutMs);
  });
  try {
    return await Promise.race([operation(), deadline]);
  } finally {
    if (timer !== null) clearTimer(timer);
  }
}

let liveBudget: ExplorerScenarioActiveTimeBudget | null = null;

export function explorerLiveScenarioActiveTimeBudget():
ExplorerScenarioActiveTimeBudget {
  if (!available()) {
    throw new ExplorerScenarioActiveTimeBudgetError(
      EXPLORER_ACTIVE_TIME_BUDGET_FAILURE.NOT_STARTED,
      'release_build',
    );
  }
  if (!liveBudget) {
    liveBudget = new ExplorerScenarioActiveTimeBudget(Date.now, defaultStorage());
  }
  return liveBudget;
}

export async function restoreExplorerScenarioActiveTimeBudget(): Promise<void> {
  await explorerLiveScenarioActiveTimeBudget().restore();
}

export async function clearExplorerScenarioActiveTimeBudget(
  scenarioId?: string,
): Promise<void> {
  const budget = explorerLiveScenarioActiveTimeBudget();
  budget.resetScenario(scenarioId);
  await budget.flush();
}

export async function resumeExplorerLiveExternalPauseIfPresent(args: {
  reason: ExplorerExternalPauseReason;
  scope: string;
  scenarioId?: string;
}): Promise<boolean> {
  const resumed = resumeExplorerLiveExternalPauseIfPresentSync(args);
  if (liveBudget) await liveBudget.flush();
  return resumed;
}

export function resumeExplorerLiveExternalPauseIfPresentSync(args: {
  reason: ExplorerExternalPauseReason;
  scope: string;
  scenarioId?: string;
}): boolean {
  if (!liveBudget) return false;
  const token = liveBudget.findPausedToken(args);
  if (!token) return false;
  const resumed = liveBudget.resume(token);
  void liveBudget.flush();
  return resumed;
}

export function resumeExplorerLiveExternalPauseTokenSync(
  token: ExplorerActiveTimePauseToken,
): boolean {
  if (!liveBudget) return false;
  const resumed = liveBudget.resume(token);
  void liveBudget.flush();
  return resumed;
}

export function __resetExplorerScenarioActiveTimeBudgetForTest(): void {
  liveBudget = null;
}
