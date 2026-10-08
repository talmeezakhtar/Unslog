# 0004. Email alerts, official APIs and ATS feeds instead of scraping

**Status:** Accepted, October 2026

## Context

The most-used job sites in the UAE (Indeed, LinkedIn, Bayt, Naukrigulf) have no public read API.
Indeed retired its public job-search API in 2023. Scraping is against these sites' terms, gets
blocked, and breaks when the HTML changes. Getting a LinkedIn account restricted mid-search
would be costly.

## Decision

Collect only through channels meant for it:

1. **Job-alert emails** the sites send you, read through the Gmail API.
2. **Jooble's official API** (free key), which aggregates many boards.
3. **Public ATS job feeds** (Greenhouse, Lever, Ashby, Workable, SmartRecruiters) that companies
   publish for anyone to read.

Never log in as the user, never submit applications automatically.

## Alternatives considered

- **Scraping the boards** (Playwright). Most coverage, but against their terms, fragile, and risky for the account.
- **Paid scraping services.** Cost money, with the same terms problem.

## Consequences

- Stable, free, within the rules, and a good story in interviews.
- Email alerts carry snippets, not full descriptions; scoring works from title + snippet unless a
  careers page provides the full text.
- Email layouts change; parsers are written defensively and tuned with real samples
  (`npm run gmail:sample`).
