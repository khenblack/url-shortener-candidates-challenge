# Loading states

## Goal

Provide clear feedback while shortening a URL or fetching recent-link history, without changing the existing layout or backend behavior.

## Scope

- Add pending feedback to the shortening form and recent-links history.
- Keep the current controller/view separation, responsive layout, form validation, and history refresh triggers.
- Exclude backend changes, new endpoints, polling, unrelated refactoring, and fixes for existing bootstrap test failures.

## Requirements

1. While a shortening request is pending, show “Shortening…” on the submit button and disable submission until that request completes. Prevent duplicate submissions through both button clicks and the Enter key.
2. Hide the previous shortening success or error message when a new shortening request starts. Preserve the entered URL and keep history visible. Once the request completes, restore the “SHORTEN IT” button and show the latest success or error through the existing feedback UI.
3. Show “Loading history…” during the initial history request. Do not show the empty-history message while that request is pending. A browser with no remembered links keeps the existing empty state and does not issue a history request merely to display loading feedback.
4. Show “Refreshing…” during subsequent history requests. Keep existing links and their counts visible until the request completes, then display the returned data or existing error feedback. Remove the pending message on either success or failure.
5. Keep form and history pending states independent: a history refresh alone must not disable shortening or hide its result. Preserve the existing refreshes on page load, successful creation, and window focus.
6. Derive request state in the existing controller and pass presentation state to the view. Preserve backend contracts, persistence, click counting, history selection, and the current desktop/mobile layout.

## Acceptance criteria

- With a controlled pending shortening request, “Shortening…” is visible, submission is disabled, and attempts to click or press Enter do not create another request.
- Starting a new shortening request hides a prior success or error while preserving the input value and displayed history.
- Completing shortening with success or an expected failure restores submission and displays the latest result or error.
- A controlled initial history request displays “Loading history…” instead of the empty-history message; completion removes that indicator.
- A controlled subsequent history request displays “Refreshing…” alongside the previously loaded links. Success updates the displayed data; failure ends the pending state and displays the existing history error feedback.
- An empty browser history does not fetch a global listing or remain in a loading state.
- Refreshing history independently leaves the form available and preserves its result.
- Verify pending states and success/failure transitions through the existing React Router component-test setup with controlled requests. Preserve existing submission, validation, history, and focus-refresh tests; run the web tests, typecheck, and build. Report pre-existing failures separately.
