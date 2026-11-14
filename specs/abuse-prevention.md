# Abuse prevention

## Goal

Add a simple server-side limit on URL-creation attempts to reduce abuse without changing redirects or history.

## Scope

- One shared in-memory allowance per application process, covering all users.
- Limit only URL-creation requests; keep redirects and history available.
- No new dependencies, database changes, per-user/IP tracking, distributed limiter, or unrelated refactoring.
- The allowance resets on process restart and is not shared between processes. A single caller can exhaust the shared allowance; this is a deliberate simplicity tradeoff.

## Requirements

1. Allow up to 20 URL-creation attempts in a 60-second window beginning with the first attempt. Share this allowance across requests and users within the same application process.
2. Count admitted attempts before input validation, including invalid submissions and attempts that later fail. Do not refund attempts when shortening fails.
3. Reject further attempts until the window expires. Rejections do not extend the window. At or after expiry, the next attempt begins a new 60-second window and consumes its first slot.
4. Reject excess attempts with HTTP 429, a `Retry-After` header containing the remaining wait in whole seconds rounded up, and the inline message “Too many requests. Please try again shortly.”
5. Perform the rate-limit check before parsing the submitted form or invoking shortening. A rejected request must not generate a short code, access the shortener repository, or create a link.
6. Keep enforcement on the server at the HTTP boundary. Use a small limiter with a controllable clock for deterministic tests, and share its runtime instance across URL-creation requests. Do not add rate-limit concepts to the URL domain model or change existing application use cases.
7. Preserve existing responses and UI behavior for admitted requests. Rate-limit errors use the existing form error feedback and completion behavior. Redirects and history neither consume the allowance nor become blocked when it is exhausted.

## Acceptance criteria

- The first 20 creation attempts in a window pass the limiter; the 21st receives HTTP 429 and the agreed inline message.
- Invalid submissions consume the same allowance as valid submissions. Attempts that fail after admission also consume a slot.
- A rejected request does not parse form data or invoke shortening, code generation, or repository operations.
- `Retry-After` is a positive integer representing the remaining seconds rounded up. Repeated rejections leave the original expiry unchanged.
- With a controlled clock, an attempt exactly at the expiry starts a fresh window; its next 19 attempts are also admitted before rejection resumes.
- Different callers share the allowance in one process. A fresh limiter instance begins with a full allowance; process restart persistence and cross-process coordination are explicitly excluded.
- Redirect and history requests remain unaffected when the creation allowance is exhausted and do not consume creation slots.
- Component tests verify that a 429 response displays the message, preserves the entered URL, and restores the submit control after pending feedback.
- Use existing unit, route, and component tests with a controlled clock; no real-time waits or live database tests are needed. Run focused tests, the web suite, typecheck, and build. Report pre-existing failures separately.
