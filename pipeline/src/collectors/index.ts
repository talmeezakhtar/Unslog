import type { Config } from '../config.js';
import { Throttle } from '../lib/http.js';
import type { UserSecrets } from '../types.js';
import { ATS_NAMES, AtsCollector, type AtsName } from './ats.js';
import { GmailCollector } from './gmail/index.js';
import { JoobleCollector } from './jooble.js';
import type { CollectContext, Collector } from './types.js';

/**
 * Shared, public sources (no per-user credentials): ATS boards, merged across every profile's
 * target companies, collected once for the whole run.
 */
export function buildCollectors(config: Config, ctx: CollectContext): Collector[] {
  const throttle = new Throttle(config.HTTP_DELAY_MS);
  const ats = ctx.companies
    .filter((c): c is { ats: AtsName; slug: string; name?: string } => ATS_NAMES.includes(c.ats as AtsName))
    .map((c) => new AtsCollector(config, c, throttle));
  return ats;
}

/**
 * Gmail and Jooble are personal: run once per user, inside the per-profile loop, under that
 * user's own credentials (Gmail: no fallback, since a missing grant just means no Gmail
 * collector for them. Jooble: falls back to the instance-wide key in .env, since it's not
 * personal data, just a shared default when a user hasn't brought their own).
 */
export function buildPersonalCollectors(
  config: Config,
  secrets: UserSecrets,
  searches: Array<{ keywords: string; location: string }>,
  gmailSince: Date | null,
): Collector[] {
  const gmail =
    config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET && secrets.gmailRefreshToken
      ? new GmailCollector(
          { clientId: config.GMAIL_CLIENT_ID, clientSecret: config.GMAIL_CLIENT_SECRET, refreshToken: secrets.gmailRefreshToken },
          config.GMAIL_QUERY_DAYS,
          gmailSince,
        )
      : null;
  const joobleKey = secrets.joobleApiKey ?? config.JOOBLE_API_KEY;
  const jooble = joobleKey
    ? new JoobleCollector(
        { apiKey: joobleKey, host: config.JOOBLE_HOST, pages: config.JOOBLE_PAGES, httpDelayMs: config.HTTP_DELAY_MS, httpUserAgent: config.HTTP_USER_AGENT },
        searches,
      )
    : null;
  const built: Array<Collector | null> = [gmail, jooble];
  return built.filter((c): c is Collector => c !== null);
}

export type { Collector, CollectContext, RawJob } from './types.js';
