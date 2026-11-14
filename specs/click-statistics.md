# Click statistics

## Goal

Add persistent click statistics following the existing DDD and hexagonal architecture, and show recent links created in the current browser on the home page.

## Scope

- Track a total click count per shortened URL.
- Remember up to 50 short codes in browser `localStorage`, with destinations and total counts displayed on the home page.
- Extend the existing shortener module, PostgreSQL persistence, and controller/view boundaries.
- Exclude a global public listing, accounts, unique visitors, bot filtering, and time-based analytics. Browser history filtering is not authentication or an ownership guarantee.
- Do not add live PostgreSQL verification checks for this feature; the user explicitly declined them.

## Requirements

1. Count each GET request that successfully resolves a short code for a redirect. Repeat visits and bots count. Invalid or unknown codes and non-GET requests do not increment statistics. A count represents a redirect attempt, not proof that the destination loaded.
2. Persist counts in PostgreSQL. New links start at zero; existing links retain their codes and destinations and begin with zero recorded clicks when the feature is introduced. Concurrent increments must not overwrite each other.
3. If the destination has been resolved but recording its click fails, still return the existing redirect. Preserve current errors when destination resolution itself fails.
4. Show a “Your Recent Links” section on the home page with the short link, destination, and total click count for links remembered in the current browser. Remember newly created codes, newest first, without duplicates, retaining at most 50. Retain this history across reloads using `localStorage`. A browser without remembered codes must not receive a global listing.
5. Keep business rules and application orchestration independent of React Router, browser storage, PostgreSQL, and Drizzle. Application use cases depend on ports; persistence adapters implement storage operations, including safe increments. HTTP and browser-history concerns stay in web, with dependencies wired through the existing composition root. Keep domain invariants explicit without introducing unrelated abstractions.
6. Preserve existing shortening, validation, error feedback, and redirect behavior except for the agreed statistics and recent-link additions. Apply schema changes through the existing explicit migration mechanism.

## Acceptance criteria

- A newly created link has zero clicks. Two successful GET resolutions produce a count of two when recording succeeds, including repeat requests from the same visitor.
- Invalid codes, missing links, and non-GET requests do not add clicks.
- A click-recording failure after successful resolution still produces the existing 302 redirect to the stored destination. Resolution failures retain their current HTTP behavior.
- The home page displays remembered links with destinations and counts. Newly created links join the browser history; duplicates do not consume additional entries, and the history retains only the latest 50 codes.
- Reloading preserves the browser's recent-link selection. An empty browser history does not show links created by other browsers. Selecting links for display does not itself count as a click.
- Domain/application code depends inward on domain types and ports, with storage and HTTP details confined to adapters and web composition.
- Unit, route, and component tests cover counting, excluded requests, failed-count redirects, and browser-history filtering while preserving existing behavior. Run the existing test suite, typecheck, and build during implementation verification.
- Review the migration and atomic increment implementation structurally. Do not claim that mocked/unit tests verify actual PostgreSQL concurrency or restart durability: live-database verification is explicitly excluded, and those properties remain unverified against a running database in this feature's checks.
