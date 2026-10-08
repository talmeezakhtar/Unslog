import type { Config } from '../config.js';
import { Throttle } from '../lib/http.js';
import { ATS_NAMES, AtsCollector, type AtsName } from './ats.js';
import { GmailCollector } from './gmail/index.js';
import { JoobleCollector } from './jooble.js';
import type { CollectContext, Collector } from './types.js';

/** Builds every collector for this run. Adding a new source = adding one class here. */
export function buildCollectors(config: Config, ctx: CollectContext): Collector[] {
  const throttle = new Throttle(config.HTTP_DELAY_MS);
  const ats = ctx.companies
    .filter((c): c is { ats: AtsName; slug: string; name?: string } => ATS_NAMES.includes(c.ats as AtsName))
    .map((c) => new AtsCollector(config, c, throttle));
  return [new GmailCollector(config), new JoobleCollector(config, ctx.searches), ...ats];
}

export type { Collector, CollectContext, RawJob } from './types.js';
