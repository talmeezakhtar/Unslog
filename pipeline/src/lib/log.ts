/** Tiny structured logger. One line per event so GitHub Actions logs stay readable. */
type Level = 'debug' | 'info' | 'warn' | 'error';
const order: Record<Level | 'silent', number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

function write(level: Level, msg: string, data?: Record<string, unknown>) {
  // Read on every call so tests can set LOG_LEVEL=silent after import.
  const threshold = order[(process.env.LOG_LEVEL as Level | 'silent') ?? 'info'] ?? order.info;
  if (order[level] < threshold) return;
  const time = new Date().toISOString().slice(11, 19);
  const extra = data ? ' ' + JSON.stringify(data) : '';
  const line = `${time} ${level.toUpperCase().padEnd(5)} ${msg}${extra}`;
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>) => write('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => write('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => write('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write('error', msg, data),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
