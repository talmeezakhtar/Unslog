# Architecture decision records

Short notes on why Callback is built the way it is. Each one records the context, the decision,
the options we didn't take, and the consequences. Add a new numbered file when a decision
changes; don't rewrite old ones.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-typescript-first-spring-boot-later.md) | TypeScript for the MVP, Spring Boot later | Accepted |
| [0002](0002-scheduled-batch-instead-of-server.md) | A scheduled batch job instead of a server | Accepted |
| [0003](0003-supabase-with-rls.md) | Supabase with Row Level Security, no API layer | Accepted |
| [0004](0004-email-alerts-instead-of-scraping.md) | Email alerts, official APIs and ATS feeds instead of scraping | Accepted |
| [0005](0005-dedupe-by-fingerprint.md) | Deduplicate by a company + title + city fingerprint | Accepted |
| [0006](0006-ai-provider-strategy.md) | Free AI tiers behind a router, heuristics when unavailable | Accepted |
| [0007](0007-minimal-dependencies.md) | Keep dependencies minimal | Accepted |
