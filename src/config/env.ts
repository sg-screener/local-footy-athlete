import { logger } from '../utils/logger';
import type { SemanticProgramEditDraftMode } from '../utils/coachTurnController';

type PublicEnv = Record<string, string | undefined>;

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
  semanticProgramEditDraftMode: Exclude<SemanticProgramEditDraftMode, 'active'>;
  supportEmail: string;
  feedbackEmail: string;
  missing: ClientEnvKey[];
  isReady: boolean;
}

const DEFAULT_SUPPORT_EMAIL = 'one22gym@gmail.com';

function readPublicEnv(): PublicEnv {
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL: process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL,
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

function semanticProgramEditDraftMode(value: string | undefined): Exclude<SemanticProgramEditDraftMode, 'active'> {
  return clean(value).toLowerCase() === 'shadow' ? 'shadow' : 'off';
}

export function getClientEnvConfig(env: PublicEnv = readPublicEnv()): ClientEnvConfig {
  const supabaseUrl = clean(env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = clean(
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const supportEmail = clean(env.EXPO_PUBLIC_SUPPORT_EMAIL) || DEFAULT_SUPPORT_EMAIL;
  const feedbackEmail = clean(env.EXPO_PUBLIC_FEEDBACK_EMAIL) || supportEmail;

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
      ? `${trimTrailingSlash(functionsBase)}/coach-semantic-program-edit-draft`
      : '',
    semanticProgramEditDraftMode: semanticProgramEditDraftMode(env.EXPO_PUBLIC_SEMANTIC_PROGRAM_EDIT_DRAFT_MODE),
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
