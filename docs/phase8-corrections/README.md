# Phase 8 corrections — review report

Corrections implemented locally. **Phase 8 is ready for owner review, but not final sign-off until authenticated browser testing is completed.** This report supersedes the two failing diagnostics and outstanding issues documented in `../final-verification/README.md`.

## Root causes and code changes

| Issue | Root cause | Correction |
| --- | --- | --- |
| PIN authorization | `changePin` reauthenticated the configured email and called Auth `updateUser` without verifying current active administrator membership. | Added uncached `getFreshAdminSession`: Auth `getUser` plus active `admin_users` lookup, fail closed on either error. Check before PIN reauthentication and again immediately before password update. Require configured account email and unchanged caller identity. Existing matching four-digit PIN validation, current-PIN reauthentication and server-only derived credential remain. |
| Payment timezone | `new Date(datetimeLocal)` interpreted a timezone-free form input in the server timezone. | Added `businessTimestamp` using IANA `Asia/Manila` via Intl. Local input converts once; explicitly zoned timestamps retain their true instant; date-only input is rejected as a payment timestamp. Invalid dates are rejected before RPC. Payment/refund/reversal, rescheduling and tester expiry use this conversion. Stored UTC audit timestamps remain untouched. Added Intl formatting for existing timestamp input values; removed arithmetic eight-hour offsets. Calendar bounds and date navigation use Manila business dates and UTC calendar arithmetic rather than host-local setters. Labels identify Asia/Manila. |
| Booking search | Search text accidentally contained a literal JSX test badge expression. | Search helper concatenates only reference, customer name and motorcycle name as plain text. Existing status and verification filters and rendered test badge remain. No HTML insertion or unsafe rendering introduced. |
| Pending states and query errors | Several mutation buttons had no pending guards; relationship queries, calendar/settings queries and intermediate writes ignored errors. | Shared `ActionForm` preserves original server actions and Next redirects, blocks repeated submit events, disables its fieldset and announces pending/success/failure states. Submit/confirmation controls preserve names, values and validation flags. Inventory retains its original action-state contract and concurrency token, adds a repeated-submit guard and disables its input. Query batches reject errors before rendering empty states or related information. Fleet/extras intermediate requests and audit errors propagate instead of announcing false success. Settings readiness query errors stop saves. Private document query failures return 500; genuine absence remains 404; failed access auditing prevents releasing the private URL. Empty readiness results no longer assert a migration is missing. |

No migration was needed or applied. No production data, existing financial records, prices, RLS policies, public-booking setting, authentication configuration or integrations were modified. KJM MAIN source was not edited. Nothing was deployed and Phase 9 was not started.

## Executed verification

- TypeScript: passed (`typecheck.log`).
- ESLint: passed (`lint.log`).
- Automated tests: **128 passed in 12 files**, zero final failures (`tests.log`). Includes 11 PIN security cases; UTC/Manila midnight, leap-day and host timezone tests; actual payment/adjustment action parameter assertions; plain-text search; all ten dashboard pages plus booking/fleet details failing queries; accurate empty results; action feedback and authorization redirects; private document errors/auditing; and the existing authorization/inventory/business tests.
- Production build: passed (`build.log`).
- Approved disposable Supabase `uuxjymzrtncrnnkvdpjy`: **63 checks passed**, zero failures. Financial/extras suite 21, quantity suite 22, booking lifecycle 14, fresh-membership/timestamp suite 6. Includes financial retry idempotency/concurrency, immutable ledger, authorization/RLS, inventory protections and stale saves, confirmation/handover/return, suspended administrator lookup with an existing JWT, and application timestamp → PostgreSQL timestamptz → Manila roundtrips. Target guards reject production and require migrations 001–019. Credentials are loaded in memory and are not stored in reports. The new security suite and booking lifecycle roll back fixtures; existing financial/quantity suites retain synthetic fixtures in the disposable project.
- Isolated Chromium controls at **360, 390, 768, 1024, 1440px**: pending controls disabled; repeated `requestSubmit` blocked; keyboard activation; named approval/rejection values retained; success and failure messages; inventory duplicate protection and original quantity/concurrency parameters retained. Five axe scans: zero violations; no overflow. These use real components with synthetic delayed actions, not Supabase or an administrator session (`browser-controls.json`).
- Updated offline page browser inspection: **70 layouts**, **27 axe scans**, **26 passing interactions**, no page overflow, no axe violations, no browser errors (`screenshots/browser-results.json`). Includes all administration sections, booking/fleet forms, keyboard drawer focus, search, reduced motion, confirmations, error retry and real production-build unauthenticated redirects. Offline fixtures are prominently labeled sample data and all business submissions are disabled. Desktop/mobile screenshots were visually inspected.

Early implementation failures were corrected: quantity error return values and original model error handling were preserved; incorrectly parameterized page tests were fixed. A browser probe was corrected to inspect the fieldset's native `disabled` property and then verify individual buttons. Final runs have no failed checks.

## Authenticated browser status and unexecuted tests

Retried browser inventory: no browser tabs were exposed. Safari returned **“Computer Use was not approved to use Safari.”** No session was borrowed, no PIN was guessed, and no browser profile/cookies were read. Authenticated production loading, protected Next server-action transport and real Auth PIN updates were **not executed**. Database role/JWT checks and mocked Auth security tests are separate evidence, not a substitute for those browser tests.

Remaining limitations: Auth password updates and database membership checks are separate services, so the fresh authorization read is immediately before the update but cannot be one atomic transaction with it. Existing fleet/media/catalog workflows contain multiple requests; a later failure may follow a partial save. Errors now report this and suppress false success, but these workflows were not converted into database transactions. Large production datasets and private document delivery in a signed-in browser still need owner review. No newly demonstrated authorization bypass remains in the completed regression checks.

## Owner manual checklist

1. Sign in using your own administrator session. Read all ten sections and booking/fleet details at 360, 390, 768, 1024 and 1440px. Confirm displayed data matches real records, no horizontal page overflow, keyboard focus and dialogs work. Do not mutate production for testing.
2. In the disposable project with synthetic accounts, personally test PIN changes: incorrect current PIN, mismatched new PIN, active caller success, suspended caller using an old session denied, and suspension after current-PIN reauthentication denied. Never share the PIN in chat.
3. Record synthetic payments and adjustments at Manila 00:01 and 23:59. Confirm the displayed Manila date/time and the stored UTC instant. Date-only or invalid inputs must fail without financial events.
4. Search by real reference, customer and motorcycle; preserve status/verification filters. Terms such as `span`, `className` and `admin-badge` must not find records unless those are actual record text.
5. On a slow connection, double-click or press Enter repeatedly on synthetic review, payment, inventory, publication and media forms. Confirm one action runs while controls are disabled; named decisions and form validation stay correct. Cancel confirmations, force a request failure, and verify clear feedback. A database query failure must show an error; a successful empty query must show the appropriate empty state. Verify private document access auditing with synthetic document metadata only.

## Screenshots

All screenshots are **offline sample data or synthetic controls**, never authenticated production evidence.

- [Mobile booking details](screenshots/bookings-booking-demo-0-390.png)
- [Desktop fleet editor](screenshots/fleet-model-demo-1440.png)
- [Desktop settings](screenshots/settings-1440.png)
- [Mobile pending controls](controls-pending-390.png)
- [Desktop failure feedback](controls-error-1440.png)
- Other administration layouts are in `screenshots/`; controls are captured at all five requested widths.

## Exact application files changed

Paths below are relative to KJM ADMIN. See `source-files-changed.json` for added/modified status and final SHA-256 hashes.

- `src/app/actions/auth-security.test.ts` (added)
- `src/app/actions/auth.ts` (modified)
- `src/app/actions/bookings.ts` (modified)
- `src/app/actions/extras.ts` (modified)
- `src/app/actions/feedback.test.ts` (added)
- `src/app/actions/feedback.ts` (added)
- `src/app/actions/fleet.ts` (modified)
- `src/app/actions/settings.ts` (modified)
- `src/app/actions/verification-contracts.test.ts` (modified)
- `src/app/dashboard/bookings/[id]/page.tsx` (modified)
- `src/app/dashboard/bookings/page.tsx` (modified)
- `src/app/dashboard/calendar/page.tsx` (modified)
- `src/app/dashboard/customers/page.tsx` (modified)
- `src/app/dashboard/documents/[id]/route.ts` (modified)
- `src/app/dashboard/documents/document-errors.test.ts` (added)
- `src/app/dashboard/extras/page.tsx` (modified)
- `src/app/dashboard/fleet/[id]/page.tsx` (modified)
- `src/app/dashboard/fleet/page.tsx` (modified)
- `src/app/dashboard/query-errors.test.ts` (added)
- `src/app/dashboard/settings/page.tsx` (modified)
- `src/app/dashboard/verifications/page.tsx` (modified)
- `src/components/action-form.tsx` (added)
- `src/components/booking-settings-form.tsx` (modified)
- `src/components/confirm-button.tsx` (modified)
- `src/components/inventory-quantity-form.tsx` (modified)
- `src/components/media-upload-form.tsx` (modified)
- `src/components/model-form.tsx` (modified)
- `src/components/submit-button.tsx` (modified)
- `src/lib/auth.ts` (modified)
- `src/lib/booking-search.ts` (added)
- `src/lib/business-time.ts` (added)
- `src/lib/calendar-period.test.ts` (added)
- `src/lib/calendar-period.ts` (added)
- `src/lib/corrections.test.ts` (added)
- `src/lib/query-results.ts` (added)

Verification scripts, logs, JSON evidence, screenshots and this report were added only under `docs/phase8-corrections/`. `files-changed.json` inventories every application and report artifact changed for these corrections.
