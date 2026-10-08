import { log } from './log.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
    public readonly retryAfterMs?: number,
  ) {
    super(`HTTP ${status} for ${redact(url)}: ${body.slice(0, 200)}`);
    this.name = 'HttpError';
  }
}

/** Never print API keys that live inside URLs (Jooble puts the key in the path). */
export function redact(url: string): string {
  return url
    .replace(/(api\/)[A-Za-z0-9-]{12,}/, '$1***')
    .replace(/([?&](key|token|api_key)=)[^&]+/gi, '$1***')
    .replace(/(\/bot)[^/]+/, '$1***');
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RequestOptions extends RequestInit {
  /** Retries for network errors, 429 and 5xx. Other 4xx errors fail immediately. */
  retries?: number;
  timeoutMs?: number;
  /** Base delay for exponential backoff: base, 2*base, 4*base ... plus jitter. */
  backoffMs?: number;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

/**
 * fetch() with a timeout, retries and exponential backoff.
 * Concepts: idempotent retries, backoff with jitter, honouring Retry-After.
 */
export async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const { retries = 2, timeoutMs = 20_000, backoffMs = 1000, ...init } = opts;
  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.ok) return res;
      const body = await res.text().catch(() => '');
      const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
      const err = new HttpError(res.status, url, body, retryAfterMs);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= retries) throw err;
      const wait = retryAfterMs ?? backoffMs * 2 ** attempt + Math.random() * 250;
      log.warn('retrying request', { url: redact(url), status: res.status, waitMs: Math.round(wait) });
      await sleep(Math.min(wait, 60_000));
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (attempt >= retries) throw err;
      const wait = backoffMs * 2 ** attempt + Math.random() * 250;
      log.warn('network error, retrying', { url: redact(url), waitMs: Math.round(wait) });
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
    attempt++;
  }
}

export async function getJson<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(url, { ...opts, headers: { accept: 'application/json', ...(opts.headers ?? {}) } });
  return (await res.json()) as T;
}

/**
 * Politeness: a minimum gap between requests to the same host, so we never hammer a site.
 * Concept: client-side rate limiting.
 */
export class Throttle {
  private last = 0;
  constructor(private readonly minIntervalMs: number) {}
  async wait(): Promise<void> {
    const gap = Date.now() - this.last;
    if (gap < this.minIntervalMs) await sleep(this.minIntervalMs - gap);
    this.last = Date.now();
  }
}
