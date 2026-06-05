export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerSink {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface LoggerOptions {
  isDev?: boolean;
  enableDebugLogs?: boolean;
  sink?: LoggerSink;
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function readDebugOverride(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS === 'true';
}

export function shouldEmitLog(
  level: LogLevel,
  options: Pick<LoggerOptions, 'enableDebugLogs'> = {},
): boolean {
  if (level === 'warn' || level === 'error') return true;
  const enableDebugLogs = options.enableDebugLogs ?? readDebugOverride();
  return enableDebugLogs;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const sink = options.sink ?? console;
  const emit = (level: LogLevel, args: unknown[]) => {
    if (!shouldEmitLog(level, options)) return;
    if (level === 'warn') {
      sink.warn(...args);
      return;
    }
    if (level === 'error') {
      sink.error(...args);
      return;
    }
    sink.log(...args);
  };

  return {
    debug: (...args: unknown[]) => emit('debug', args),
    info: (...args: unknown[]) => emit('info', args),
    warn: (...args: unknown[]) => emit('warn', args),
    error: (...args: unknown[]) => emit('error', args),
  };
}

export const logger = createLogger();
