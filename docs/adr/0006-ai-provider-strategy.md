# 0006. Free AI tiers behind a router, heuristics when unavailable

**Status:** Accepted, October 2026

## Context

The project must cost nothing. Free AI tiers exist (Gemini Flash / Flash-Lite, Groq) but have
daily and per-minute limits, and models get renamed or retired.

## Decision

- An `LlmProvider` interface with Gemini (main) and Groq (fallback) implementations.
- An `AiRouter` that enforces daily limits from the `ai_usage` table, waits between calls, opens
  a circuit breaker on 429/401/403, validates output with Zod, and falls through providers.
- Free pre-filtering first, so only the best N jobs per user per day use AI.
- When no AI is available: heuristic scores and template drafts, so the product still works.
- Model names are configuration, not code.

## Alternatives considered

- **Sign in with Google to use each user's Gemini quota.** Gemini's OAuth path is meant for
  developers, needs the broad `cloud-platform` scope and app verification, and likely bills the
  app's own project anyway.
- **A paid model.** Better quality, breaks the zero-cost goal.

## Consequences

- Zero cost for personal use; resilient to one provider being down.
- Free-tier prompts may be used for model training, which is acceptable for the owner's own data only.
- For a multi-user product: **bring your own key** (each user pastes a free Gemini key from
  Google AI Studio, stored encrypted), or a local model through Ollama.
