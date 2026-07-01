import { logger } from '../utils/logger';
import type { SemanticProgramEditDraftMode } from '../utils/coachTurnController';

type PublicEnv = Record<string, string | undefined>;

export const COACH_SEMANTIC_PROGRAM_EDIT_DRAFT_FUNCTION_NAME =
  'coach-semantic-program-edit-draft';

export type ClientEnvKey =
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

export interface ClientEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseFunctionsBaseUrl: string;
  coachChatEndpoint: string;
  coachIntentEndpoint: string;
  coachSemanticProgramEditDraftEndpoint: string;
  coachSemanticProgramEditDraftFunctionName: string;
  semanticProgramEditDraftMode: SemanticProgramEditDraftMode;
  semanticProgramEditDraftRawMode: string;
  semanticProgramEditDraftDevActive: boolean;
  semanticProgramEditDraftActiveAllowed: boolean;
  supportEmail: string;
  feedbackEmail: string;
  missing: ClientEnvKey[];
  isReady: boolean;
}

interface ClientEnvOptions {
  isDev?: boolean;
}

const DEFAULT_SUPPORT_EMAIL = 'one22gym@gmail.com';

function readPublicEnv(): PublicEnv {
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL: process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL,
    EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_MODE: process.env.EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_MODE,
    EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_DEV_ACTIVE: process.env.EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_DEV_ACTIVE,
    EXPO_PUBLIC_SEMANTIC_PROGRAM_EDIT_DRAFT_MODE: process.env.EXPO_PUBLIC_SEMANTIC_PROGRAM_EDIT_DRAFT_MODE,
    EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
    EXPO_PUBLIC_FEEDBACK_EMAIL: process.env.EXPO_PUBLIC_FEEDBACK_EMAIL,
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

function runtimeIsDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function truthyFlag(value: string | undefined): boolean {
  return /^(?:1|true|yes|on)$/i.test(clean(value));
}

function semanticProgramEditRawMode(env: PublicEnv): string {
  return clean(
    env.EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_MODE ??
      env.EXPO_PUBLIC_SEMANTIC_PROGRAM_EDIT_DRAFT_MODE,
  ).toLowerCase();
}

function semanticProgramEditDraftMode(args: {
  rawMode: string;
  devActive: boolean;
  isDev: boolean;
}): SemanticProgramEditDraftMode {
  if (args.rawMode === 'shadow') return 'shadow';
  if (args.rawMode !== 'active') return 'off';
  if (args.isDev && args.devActive) return 'active';

  logger.warn('[env] Semantic ProgramEditDraft active mode requested but disabled', {
    rawMode: args.rawMode,
    isDev: args.isDev,
    devActive: args.devActive,
    resolvedMode: 'off',
  });
  return 'off';
}

export function shouldCreateSemanticProgramEditDraftAdapter(
  mode: SemanticProgramEditDraftMode,
): boolean {
  return mode === 'shadow' || mode === 'active';
}

export function getClientEnvConfig(
  env: PublicEnv = readPublicEnv(),
  options: ClientEnvOptions = {},
): ClientEnvConfig {
  const supabaseUrl = clean(env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = clean(
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const supportEmail = clean(env.EXPO_PUBLIC_SUPPORT_EMAIL) || DEFAULT_SUPPORT_EMAIL;
  const feedbackEmail = clean(env.EXPO_PUBLIC_FEEDBACK_EMAIL) || supportEmail;
  const rawSemanticMode = semanticProgramEditRawMode(env);
  const semanticDevActive = truthyFlag(env.EXPO_PUBLIC_COACH_SEMANTIC_PROGRAM_EDIT_DEV_ACTIVE);
  const isDev = options.isDev ?? runtimeIsDev();
  const resolvedSemanticMode = semanticProgramEditDraftMode({
    rawMode: rawSemanticMode,
    devActive: semanticDevActive,
    isDev,
  });

  const missing: ClientEnvKey[] = [];
  if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  const functionsBase = clean(env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL)
    || (supabaseUrl ? `${trimTrailingSlash(supabaseUrl)}/functions/v1` : '');

  return {
    supabaseUrl: supabaseUrl ? trimTrailingSlash(supabaseUrl) : '',
    supabaseAnonKey,
    supabaseFunctionsBaseUrl: functionsBase ? trimTrailingSlash(functionsBase) : '',
    coachChatEndpoint: functionsBase ? `${trimTrailingSlash(functionsBase)}/coach-chat` : '',
    coachIntentEndpoint: functionsBase ? `${trimTrailingSlash(functionsBase)}/coach-intent` : '',
    coachSemanticProgramEditDraftEndpoint: functionsBase
      ? `${trimTrailingSlash(functionsBase)}/${COACH_SEMANTIC_PROGRAM_EDIT_DRAFT_FUNCTION_NAME}`
      : '',
    coachSemanticProgramEditDraftFunctionName: COACH_SEMANTIC_PROGRAM_EDIT_DRAFT_FUNCTION_NAME,
    semanticProgramEditDraftMode: resolvedSemanticMode,
    semanticProgramEditDraftRawMode: rawSemanticMode || 'off',
    semanticProgramEditDraftDevActive: semanticDevActive,
    semanticProgramEditDraftActiveAllowed: resolvedSemanticMode === 'active',
    supportEmail,
    feedbackEmail,
    missing,
    isReady: missing.length === 0,
  };
}

export function describeMissingClientEnv(config: Pick<ClientEnvConfig, 'missing'>): string {
  if (config.missing.length === 0) return '';
  return `Missing required public environment variables: ${config.missing.join(', ')}`;
}

export function logMissingClientEnv(context: string, config: Pick<ClientEnvConfig, 'missing'>): void {
  const message = describeMissingClientEnv(config);
  if (!message) return;
  logger.error(`[env] ${context}: ${message}`);
}

export function buildMailto(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
