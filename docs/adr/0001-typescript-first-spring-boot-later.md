# 0001. TypeScript for the MVP, Spring Boot later

**Status:** Accepted, October 2026

## Context

The tool has to be useful within weeks, during a 60-day job hunt. The author knows Node.js and
NestJS from an internship and is learning Spring Boot for Java interviews. Free hosting for a
scheduled job is easiest with Node (GitHub Actions runs it with no build step).

## Decision

Build the pipeline and dashboard in TypeScript now. Rewrite the backend in Spring Boot + Docker
later as a deliberate learning exercise, against the same database.

## Alternatives considered

- **Spring Boot from day one.** Better Java practice, but slower to ship and awkward to host for free.
- **Python.** Good scraping and AI libraries, but not in the target job stack.

## Consequences

- Fast first version; one language across pipeline and dashboard.
- The SQL schema is the contract, so a Spring Boot rewrite can reuse it unchanged.
