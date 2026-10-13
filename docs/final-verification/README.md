# Phase 8 final verification — 11 October 2026 (Asia/Manila)

**Status: no final sign-off. Authenticated production record loading and dashboard visual verification remain unexecuted. Two action diagnostics failed, and the code review found additional usability/error-handling issues.**

Production: `slevojynuumrvgiznmxk`. Approved disposable test project: `uuxjymzrtncrnnkvdpjy`.

## Verified functionality

| Evidence | Result | Boundary |
| --- | --- | --- |
| TypeScript | Pass | Current KJM ADMIN source and test files |
| ESLint | Pass | Current source and verification scripts |
| Vitest | 65 tests pass across 6 files | 15 prior tests + 50 action-contract tests; Supabase/Next boundaries mocked in action tests |
| Production build | Pass | Local optimized build; no deployment |
| Disposable Phase 6 integration | 21 checks pass | Real PostgreSQL functions, financial transactions, extras inventory, concurrent requests and RLS |
| Disposable quantity integration | 22 checks pass | Migration 019 quantity protections, stale saves, booking/hold/maintenance constraints and concurrency |
| Disposable booking lifecycle | 14 checks pass | Authenticated database role with synthetic administrator JWT claims; verification → confirmation → handover → return |
| Real application access gates | 14 protected URLs redirect to sign-in | Anonymous browser; admin navigation absent |
| Production anonymous API isolation | 9 private tables reject reads | Public-catalog control returned HTTP 200, confirming valid project/key connectivity; private reads returned HTTP 401 |

The disposable database preflight verified all nineteen applied migration versions and RLS enabled on nine relevant public tables. Production's migration status was supplied by the owner; it was not independently inspected through an administrator session.

The new action-contract tests invoke the actual existing action functions with controlled in-memory boundaries. They verify IDs, cents, methods, idempotency keys, explicit-offset dates, Manila rescheduling, reasons, quantity expectedTotal, tester expiry/revocation values, model-field mapping, publication flags, archive semantics, image-primary/reorder operations, rejected file types, extras limits, denied-authorization paths and selected failure responses. They do **not** establish live browser-to-Server-Action behavior or Supabase Auth login success.

The disposable suites verified immutable payment events, partial refunds and reversal constraints, duplicate-payment deduplication, ordinary-user financial isolation, cross-customer document isolation, physical-unit identity/history preservation, quantity concurrency and both orderings of competing submissions/reductions. The lifecycle test explicitly uses `SET LOCAL ROLE authenticated`, active synthetic administrator claims, and manual verification choices. It confirms that one approved document does not approve the whole customer, missing required documents block confirmation, repeated confirmation is rejected, and exactly three status-history entries remain after confirmation, handover and return.

Evidence: [Phase 6](disposable-phase6.json), [quantity](disposable-quantity.json), [booking lifecycle](disposable-booking.json), [migration/RLS preflight](disposable-preflight.json), [anonymous production API checks](production-anon-readonly.json), [browser results](browser-readonly.json).

## Verified visual design

Fresh Chromium inspection of the **real production-connected sign-in page** at 360, 390, 768, 1024 and 1440px: no horizontal overflow, five WCAG A/AA scans with zero findings, visible PIN-field focus and no browser runtime errors. The production build was served locally on port 3003; no application deployment occurred.

Screenshots: [360](screenshots/sign-in-360.png), [390](screenshots/sign-in-390.png), [768](screenshots/sign-in-768.png), [1024](screenshots/sign-in-1024.png), [1440](screenshots/sign-in-1440.png).

The prior Phase 8 dashboard screenshots remain **offline sample-data evidence only**. Their original report recorded 70 viewport/page checks, 27 accessibility scans and 24 interaction checks. Those checks were not repeated or promoted into authenticated production evidence during this verification. [Previous offline desktop](../screenshots/phase8/overview-1440.png) and [previous offline mobile](../screenshots/phase8/overview-390.png).

## Authenticated route checklist

| Administration section | Real production records | Authenticated inspection at all five widths |
| --- | --- | --- |
| Overview | Not executed | Not executed |
| Bookings and booking details | Not executed | Not executed |
| Calendar | Not executed | Not executed |
| Verification | Not executed | Not executed |
| Fleet Management and existing edit forms | Not executed | Not executed |
| Booking Extras | Not executed | Not executed |
| Customers | Not executed | Not executed |
| Finance | Not executed | Not executed |
| Reports | Not executed | Not executed |
| Settings | Not executed | Not executed |

There was no accessible authorized administrator browser session. Browser inventory exposed no controllable browser tabs, and the computer-use tool returned **“Computer Use was not approved to use Safari.”** A request for an accessible signed-in session was sent while independent checks continued. No PIN was guessed, credentials requested in chat, cookies extracted, authorization bypass created or privileged production client substituted.

## Tests not executed

- Production authenticated record loading, counts/reconciliation, and private administrator layouts at the five requested widths.
- Actual HTTP Server Action success/failure, loading feedback, and repeated-click behavior in an authenticated browser against the disposable project. The existing disposable configuration provides a database connection, not a browser Supabase Auth session.
- Authenticated fleet image upload/download, primary-image selection, deletion and publication through the real UI.
- Real signed-document issuance/opening. The document endpoint inserts an access audit record; opening it in production would violate this task's no-record-mutations testing boundary.
- Production PIN changes, settings saves, tester grants/revocation, booking transitions, pricing changes, payment recording/refunds/reversals and all other production mutations. Deliberately excluded.
- Manual screen-reader inspection. Automated WCAG checks are not a substitute for it.

## Remaining problems

| Priority | Finding | Evidence / limit |
| --- | --- | --- |
| High | `changePin` authenticates the configured PIN identity but does not recheck an active `admin_users` record or invoke `requireAdmin` before updating the credential. | `src/app/actions/auth.ts:58`; controlled diagnostic reached one mocked password update with zero active-admin authorization calls. Existing pre-redesign code. This is not a demonstrated production exploit. |
| High | Payment and adjustment `datetime-local` inputs are interpreted in the server's timezone rather than explicitly Asia/Manila. | `src/app/actions/bookings.ts:27` and adjustment equivalent. On a controlled UTC process, 2031-06-01 12:00 became 12:00Z instead of 04:00Z. Existing pre-redesign code; local Manila hosts can conceal the defect. |
| Medium | Booking search includes literal JSX markup in its searchable string. Searching “test”, “span” or “admin-badge” can match unrelated bookings. | `src/app/dashboard/bookings/page.tsx:44`; source inspection. Introduced during the redesign; it is a string, so TypeScript/build checks do not catch it. |
| Medium | Several booking, payment, verification, publication/media and confirmation controls lack pending-state disabling/loading feedback. | Native buttons and `ConfirmButton` do not use `useFormStatus`. Payment duplication is protected in the database by idempotency; this does not establish that repeated clicks are prevented across all UI actions. |
| Medium | Some read failures can be shown as empty or incomplete data. | Calendar discards all query errors; Settings discards settings/readiness errors; several list/detail relationship queries discard errors. Actual production failure behavior was not exercised. |
| Medium | Some existing fleet/extras multi-step operations ignore intermediate errors and are non-atomic. | For example, optional-rate deletion, clearing a primary image, image-order swaps and the extras audit insert do not consistently check returned errors. Source review only; no destructive failure injection against production. |
| Low | Tester authorization redirects to `?tester=1`, but Settings does not render a corresponding success message. | Source review of `setBookingTesterAuthorization` and Settings page. |
| Scale limitation | Several list queries retain Supabase's default result cap; booking payment/extras joins and fleet commitments can be incomplete with large datasets. | Source inspection. Overview/Finance/Reports use paginated reads; other lists do not. No large production dataset test executed. |

Two controlled action diagnostics **failed**; they are recorded separately from the passing Vitest suite in [action-diagnostics.json](action-diagnostics.json). Passing automated checks do not erase these findings. No fixes to working backend actions, authentication or business rules were made during this verification-only task.

## Security and side effects

Production received only read-only public/anonymous API requests and unsigned browser GETs. Private row contents were not logged or saved. No production credentials or PIN values were displayed. No production records, prices, schemas, migrations, RLS policies, Auth configuration, readiness flags or public-booking restrictions were changed. No Telegram, Resend or payment gateway integration was added. No deployment occurred.

The existing Phase 6 and quantity suites commit uniquely named synthetic records **only in the approved disposable project**. Phase 6 also updates disposable booking-policy fixtures and a disposable seed model's publication flag. Those fixtures remain for review, as the existing harnesses are designed to do. The new lifecycle suite rolls back its entire transaction, including synthetic users, documents, history and audit rows. No physical document files were uploaded. Existing migrations and test-harness source in KJM MAIN were not edited.

## Exact files changed in this verification

No pre-existing application source or configuration file was modified. One test file was added:

- `src/app/actions/verification-contracts.test.ts`

New verification artifacts:

- `docs/final-verification/README.md`
- `docs/final-verification/files-changed.json`
- `docs/final-verification/run-disposable.cjs`
- `docs/final-verification/booking-lifecycle.cjs`
- `docs/final-verification/action-diagnostics.cjs`
- `docs/final-verification/action-diagnostics.json`
- `docs/final-verification/browser-readonly.cjs`
- `docs/final-verification/browser-readonly.json`
- `docs/final-verification/production-anon-readonly.cjs`
- `docs/final-verification/production-anon-readonly.json`
- `docs/final-verification/disposable-preflight.json`
- `docs/final-verification/disposable-phase6.json`
- `docs/final-verification/disposable-quantity.json`
- `docs/final-verification/disposable-booking.json`
- `docs/final-verification/screenshots/sign-in-360.png`
- `docs/final-verification/screenshots/sign-in-390.png`
- `docs/final-verification/screenshots/sign-in-768.png`
- `docs/final-verification/screenshots/sign-in-1024.png`
- `docs/final-verification/screenshots/sign-in-1440.png`

The source checksum baseline was captured at the start of this final-verification request, so this list is distinct from the earlier redesign changes. [Machine-readable file list](files-changed.json).

## Re-running checks

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

Disposable test execution uses the existing locally stored test configuration, verifies the exact approved project reference before connection, rejects production and requires migration 019 to already exist:

```sh
node docs/final-verification/run-disposable.cjs phase6
node docs/final-verification/run-disposable.cjs quantity
node docs/final-verification/run-disposable.cjs booking
```

The wrapper accepts `KJM_TEST_WORKDIR`, `KJM_TEST_PASSWORD_FILE` and `KJM_TEST_PG_ROOT` for configuration locations. Secrets stay in memory and are never printed. Database suites simulate Supabase JWT claims; they do not create an authenticated application browser session.

For read-only browser checks, start the local production build on port 3003, then run `node docs/final-verification/browser-readonly.cjs`. `KJM_BROWSER_TOOLS` selects the existing external Playwright/axe tooling installation. `node docs/final-verification/production-anon-readonly.cjs` performs only public-key GET requests and checks a public-catalog control before interpreting private-read denials. `node docs/final-verification/action-diagnostics.cjs` uses external temporary esbuild tooling and isolated stubs; it makes no Supabase calls.

Completion requires an accessible administrator session, authenticated inspection of every section, and review/remediation of the findings above. Phase 8 is not marked complete.
