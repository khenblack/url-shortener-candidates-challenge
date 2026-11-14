# Submission

## What I Did

**Estimated total effort: 2 hours 22 minutes.** This is a retrospective estimate,
not a measured time log, and exceeds the challenge's suggested approximately
2-hour timebox.

- [10 min] Set up CortexDB project memory and knowledge graph, and added agent instructions in `AGENTS.md` to preserve context and guide implementation. See "AI Usage" for details.
- [15 min] Got familiar with the codebase and ran the application locally.
- [18 min] Restyled the UI, extracted reusable React components, and separated the shortener's controller from its view.
- [20 min] Added URL domain objects, server validation, application use cases, and shared result types following DDD and hexagonal boundaries.
- [30 min] Replaced in-memory URL storage with PostgreSQL/Drizzle persistence, explicit migrations, repository ports, and collision-safe Nano ID generation.
- [22 min] Added persistent click counts and a responsive browser-local history panel for the latest 50 links, with count refresh on window focus.
- [12 min] Added independent form/history loading states, duplicate-submission prevention, and a shared server-side limit of 20 creation attempts per minute per process.
- [15 min] Added domain, adapter, route, component, and bootstrap tests; updated setup instructions and documented verification limitations below.

## Decisions and Rationale

- **UI:** custom reusable controls avoid unnecessary dependencies. Controller/view separation keeps rendering separate from application logic; light and dark themes follow system preferences.
- **Domain boundaries:** engine use cases own shortening and resolution; React Router owns HTTP/UI. Zod checks input shape, domain objects enforce HTTP/HTTPS destinations, and shared `Result` types represent expected failures.
- **Persistence:** PostgreSQL provides durable storage and uniqueness constraints. Drizzle offers typed SQL/schema access and explicit migrations instead of the suggested Prisma. A separate database package isolates connection lifecycle, at the cost of extra scaffolding.
- **Composition:** web's bootstrap eagerly validates configuration and wires the database, adapters, and use cases. Startup errors propagate; runtime storage failures return safe HTTP 503 responses. PostgreSQL is the sole store, with no in-memory fallback or automatic migrations.
- **Priorities:** I emphasized UI, domain boundaries, and persistence. Architecture and AI workflow setup reduced the time available for final integrated verification.

## Behavior and Tradeoffs

- **Short codes:** ten case-sensitive alphanumeric characters provide 62^10 possibilities. Atomic inserts enforce uniqueness without overwriting links. Only code conflicts retry, with three total attempts; exhaustion returns HTTP 503: `Could not create a short link. Please try again.` Each successful submission creates a separate link.
- **Statistics:** successful GET resolutions count, including bots and repeat visits. Invalid/missing codes and non-GET requests do not. Counts represent redirect attempts, not confirmed destination loads; recording failures still redirect, so totals can undercount.
- **Recent links:** localStorage remembers the latest 50 codes in the current browser; destinations and counts come from PostgreSQL. History does not sync across devices. Clearing storage or evicting an entry does not delete its persisted link. Browser selection is not access control.
- **Loading:** form and history progress are independent. Refresh preserves the visible history; pending submissions hide stale feedback and prevent duplicate submissions.
- **Abuse prevention:** a process-wide fixed window allows 20 creation attempts per minute, including invalid inputs and later failures. Excess requests return HTTP 429 with `Retry-After`. One caller can exhaust everyone's allowance; it resets on restart, is not coordinated across instances, and does not filter malicious destinations. Redirects and history remain available.

## What I Would Do With More Time

- Complete integrated verification and retain reproducible application-level PostgreSQL tests for uniqueness, click-count concurrency, and restart durability.
- Improve abuse controls with caller isolation and coordination across instances.
- Split `ShortenerRepository` into narrower read/write ports to simplify dependencies and test doubles.

## AI Usage

I defined and approved scope and design choices; AI agents implemented changes and
ran checks. Agent validation does not mean I personally repeated every check.

I used CortexDB to preserve source-backed project context and `AGENTS.md` to guide
implementation and verification. One actual retrieval prompt was:

> Retrieve information from cortex db

I used [start-feature](.agents/skills/start-feature/SKILL.md) to clarify scope and
write specifications, and [implement-spec](.agents/skills/implement-spec/SKILL.md)
for separate planning, implementation, and independent validation. The
[hexagonal-architecture skill](.agents/skills/hexagonal-architecture/SKILL.md)
guided domain/infrastructure boundaries. Specifications remain in [specs](specs/).

For the UI, I chose the palette and scope; the agent helped refine accessibility,
error states, and responsive behavior. Early browser checks covered light/dark
themes and mobile/desktop widths. Behavior changes used failing tests before
implementation where applicable. I also requested removal of extra database
test scaffolding and the separate web integration runner; this reduced retained
integration coverage. Live PostgreSQL checks for click statistics were explicitly
excluded from that feature's scope.

## Current Verification

- Last recorded checks: `pnpm test` passed 215 tests (37 database, 100 engine, 78 web); `pnpm typecheck` and `pnpm build` passed. These commands reproduce the retained checks.
- Tests include mocked adapters and structural SQL assertions; their count does not establish live PostgreSQL coverage. Bootstrap tests were reconciled with eager initialization and cover configuration, shared instances, cleanup, and runtime failures.
- `pnpm test:database` requires Docker and Compose 2.24.4+ and covers only the generic database package.
- Earlier application-level PostgreSQL checks covered collisions, migrations, restarts, outages, and host/container resolution. Those results are historical; the removed runner is not available to reproduce them.
- Click-count concurrency and restart durability remain unverified against live PostgreSQL. Final integrated browser checks have not been repeated.

## Feedback

**Final Docker verification was not completed because I ran out of time.** Earlier
container checks do not verify the final submission. The remaining check is to
follow [Docker setup](README.md#docker-setup), apply migrations, and confirm startup,
shortening, redirects, and statistics.

The requirements cover a broad range of frontend, backend, persistence, and
security concerns for an approximately two-hour exercise. The guidance to
prioritize and explain tradeoffs is useful; identifying a smaller core set of
requirements and marking the rest as stretch goals would make the expected scope
clearer.

I did not feel entirely comfortable with the starting React Router SSR setup. I
would have preferred a more explicitly structured frontend and backend, with a
dedicated server layer such as Express. Without that separate layer, I found the
organization of server responsibilities less familiar. This is a preference about
structure and familiarity, rather than a limitation of React Router's ability to
handle server-side functionality.
