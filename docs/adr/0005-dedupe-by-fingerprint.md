# 0005. Deduplicate by a company + title + city fingerprint

**Status:** Accepted, October 2026

## Context

The same opening appears on Indeed, LinkedIn, Jooble and the company's own page, each with its
own URL, tracking parameters and slightly different title ("Backend Developer (Urgent)").

## Decision

`fingerprint = sha1(normalizedCompany | normalizedTitle | city)`:

- company: lowercased, legal suffixes removed (LLC, FZ-LLC, L.L.C., Ltd, …), punctuation dropped
- title: lowercased, "Sr." → senior, noise words removed ("urgent", "hiring"), text after " - " dropped
- city: canonical emirate/city, or "uae" when unknown

Jobs with no company use the source's own id instead, so two unknown-company jobs never merge.
Each site where a job is seen becomes a `job_sightings` row.

## Alternatives considered

- **URL only.** Misses cross-site duplicates.
- **Fuzzy matching on descriptions (embeddings, similarity).** Better recall, but needs more
  compute, and email snippets are too short to compare.

## Consequences

- Simple, fast, idempotent (a unique index makes upserts safe).
- Some misses: the same job with very different titles stays as two jobs. Acceptable for now.
- Rare false merges: one company posting the same title twice in one city merges into one job,
  which for a job seeker is usually what you want anyway.
