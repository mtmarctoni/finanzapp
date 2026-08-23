/* eslint-disable no-console -- Single sanctioned place for raw console access */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function write(level: LogLevel, ...args: unknown[]): void {
  if (level === 'warn') {
    console.warn(...args);
    return;
  }
  if (level === 'error') {
    console.error(...args);
    return;
  }
  const prefix = level === 'debug' ? '[debug]' : undefined;
  if (prefix) {
    console.log(prefix, ...args);
    return;
  }
  console.log(...args);
}

export const logger = {
  debug: (...args: unknown[]) => write('debug', ...args),
  info: (...args: unknown[]) => write('info', ...args),
  warn: (...args: unknown[]) => write('warn', ...args),
  error: (...args: unknown[]) => write('error', ...args),
};
