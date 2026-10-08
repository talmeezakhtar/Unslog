# Roadmap

## Now (MVP, done)

- Collectors: Gmail alerts (Indeed, LinkedIn, Bayt, Naukrigulf), Jooble, five ATS boards
- Dedupe, skills, visa/experience/salary parsing, free pre-filter
- AI scoring and drafts with fallback, quota tracking, heuristic/template fallback
- Follow-ups, Telegram/email digest
- Dashboard: Today, Jobs, Job detail, Pipeline, Outreach, Insights, Settings
- RLS-isolated multi-user data model, CI with end-to-end tests

## Next (making it better for me)

- [ ] Tune email parsers with real alert emails (`npm run gmail:sample`)
- [ ] Jooble: confirm the best host and keywords for UAE results
- [ ] "Applied via referral" path: link an outreach message to an application
- [ ] Keyboard shortcuts on Today
- [ ] Weekly email: what I applied to, replies, interviews

## Later (making it a product)

- [ ] **Bring your own AI key.** Each user pastes a free Gemini key from Google AI Studio in a
      one-minute onboarding step, stored encrypted (Supabase Vault) and used only for their jobs.
      AI cost stays at zero as users grow. See [ADR 0006](adr/0006-ai-provider-strategy.md).
- [ ] Ollama provider for fully local, private AI
- [ ] Per-user Gmail connection (OAuth in the dashboard) and a transactional email service for digests
- [ ] Onboarding: upload a CV → profile filled in automatically
- [ ] Queue-based workers (Postgres `SKIP LOCKED`) so per-user scoring runs in parallel
- [ ] Terms, privacy page, sign-up rate limits

## Learning track: Spring Boot + Docker + Kubernetes

The pipeline is TypeScript because that ships fastest. Rewriting the backend is planned practice
for Java interviews:

1. **Spring Boot service** with JPA entities for `jobs`, `job_matches`, `applications`,
   `application_events`, using the same database and migrations.
2. Port `Repo`, `prefilter` and the AI router (an interface with two implementations, like now).
3. REST endpoints for the dashboard's write actions, secured with Supabase JWTs.
4. **Docker:** a `Dockerfile` and `docker-compose.yml` (service + Postgres) so anyone can run
   it with one command.
5. **Kubernetes:** deploy the compose setup to a local cluster (minikube or kind) with a CronJob
   for the daily run.
