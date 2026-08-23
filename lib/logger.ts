/* eslint-disable no-console -- Single sanctioned place for raw console access */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function sanitizeLogString(value: string): string {
  return value.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

function sanitizeLogArg(arg: unknown): unknown {
  if (typeof arg === 'string') {
    return sanitizeLogString(arg);
  }

  if (arg && typeof arg === 'object') {
    try {
      return sanitizeLogString(JSON.stringify(arg));
    } catch {
      return sanitizeLogString(String(arg));
    }
  }

  return arg;
}

function write(level: LogLevel, ...args: unknown[]): void {
  const sanitizedArgs = args.map(sanitizeLogArg);

  if (level === 'warn') {
    console.warn(...sanitizedArgs);
    return;
  }
  if (level === 'error') {
    console.error(...sanitizedArgs);
    return;
  }
  const prefix = level === 'debug' ? '[debug]' : undefined;
  if (prefix) {
    console.log(prefix, ...sanitizedArgs);
    return;
  }
  console.log(...sanitizedArgs);
}

export const logger = {
  debug: (...args: unknown[]) => write('debug', ...args),
  info: (...args: unknown[]) => write('info', ...args),
  warn: (...args: unknown[]) => write('warn', ...args),
  error: (...args: unknown[]) => write('error', ...args),
};
