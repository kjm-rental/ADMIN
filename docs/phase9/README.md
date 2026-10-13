# Phase 9 implementation and acceptance report

Status: implementation is prepared for review; migration 020 and deployment are not applied. Final acceptance remains pending database approval and authenticated acceptance tests. Public booking and anonymous Auth remain disabled. No production records, motorcycle prices or extras prices were modified. No payment gateways, Telegram or Resend integrations were added.

## Implemented workflow

MAIN checkout adds a security-deposit step with selected option cards, exact approved document types, server quotes, a policy-version check and separate centavo summaries. Rental receipts say CASH ON PICKUP. The request receipt says Booking Request Received and Pending KJM approval, and displays reference, ride, dates, extras, rental total, deposit arrangement and cash due. Submission never marks a rental paid or claims notifications were sent. Rapid repeats are guarded; a failed document-metadata write can be retried without uploading duplicate objects. Private verification uploads remain separate from collateral custody.

ADMIN adds Security Deposit Settings, a Security Deposits page, booking deposit controls and handover/return inspections. New policy settings require fresh active-admin authorization and an explicit cash approval; ID additionally requires explicit legal attestation, a review reference and exact eligible types. Neither option starts enabled. No default cash amount or ID category is invented. Instructions cover collection, return and disputes; partial cash returns default to disabled.

Cash rental receipts reuse Phase 6 payment intents, immutable payment events, audit records, server balances and idempotency. New receipts accept cash only; historical methods remain available for legitimate corrections. Approval leaves payment status Unpaid. Actual receipts produce Partially Paid or Paid according to the existing net ledger balance.

Cash deposits use a separate immutable collection/return ledger and immutable quote snapshot. Returns cannot exceed cash held; partial returns require the snapshotted approved policy. Deposits are liabilities, never rental revenue. No damage deductions or automatic deposit returns are implemented. ID events track receipt/return of the exact approved physical document, without new ID-number/image fields. Custody is separate from identity/licence verification.

For new version-9 requests, database guards enforce verified approval, assigned available inventory, full rental payment and received deposit before handover. Handover records actual time, odometer, fuel, condition, accessories, identity recheck and observations. Return inspection is saved before returning cash/the document and completing the rental. Actual inspection times are retained in handover/return fields. Outstanding cash or custody can remain after completion only with an explicit unresolved case; its liability/custody stays visible and cannot be written off through case resolution.

Overview displays actual separate deposit liabilities, awaiting returns and unresolved cases alongside existing pending/confirmed reservations, Manila pickups/returns, overdue rentals, outstanding rental balances, verified cash receipts and fleet availability. New tables use paginated reads, accurate empty states and explicit query-error states. Synthetic and business records are separated using stored provenance. Existing version-0 bookings keep their established workflow and are never assigned invented deposit requirements.

## Migration and security

Read the [migration proposal](../../../KJM MAIN/docs/phase9/migration-review.md). [Migration 020](../../../KJM MAIN/supabase/migrations/202610110020_cash_deposits_and_rental_operations.sql) introduces four forced-RLS tables and guarded RPCs. Direct mutations and legacy customer submission bypasses are revoked. Authentication, private documents, quantity inventory and the existing booking engine are retained. The schema and synthetic workflow were tested inside an actual disposable PostgreSQL transaction and rolled back.

Two meaningful defects were caught and fixed during verification: a BEFORE trigger cannot rely on generated `total_centavos`, so the handover check uses the authoritative PHP total; the existing whole-peso formatter could crash on fractional deposits, so MAIN now has a dedicated exact-centavo formatter. Regression tests cover both.

## Verification evidence

- MAIN: TypeScript, ESLint, 56 automated tests across 9 files, production build passed.
- ADMIN: TypeScript, ESLint, 164 automated tests across 16 files, production build passed.
- Actual PostgreSQL migration-020 tests: 80 passed. [database-results.json](../../../KJM MAIN/docs/phase9/database-results.json). These are rollback-only RPC/trigger/RLS tests, not static SQL assertions. See the recorded individual checks for cash/ID lifecycle, legal gate, authorization, immutable snapshots, stale quotes, rental/deposit reconciliation, excessive and partial returns, explicit disputes, inspection guards, actual timestamps and synthetic provenance.
- Existing committed-schema 001–019 disposable tests: 63 passed — [financial/extras/concurrency: 21](disposable-phase6.json), [quantity/inventory: 22](disposable-quantity.json), [verification/lifecycle: 14](disposable-booking.json), [authorization/timezone: 6](disposable-security.json). Actual concurrent connections test last-extra booking, rescheduling/submission, payment retry and quantity protections. Those suites retain isolated synthetic fixtures in the disposable project; migration 020 remains uncommitted.
- Offline admin browser: 65 layouts across 13 views at 360, 390, 768, 1024 and 1440px; no horizontal page overflow, no page errors; 26 automated accessibility scans had no violations. [Evidence](browser-results.json).
- Actual checkout component with mocked synthetic transport: 15 deposit/review/receipt layouts at all five widths, six accessibility scans with no violations, cash and approved-ID submissions, rapid-click protection, failed-document retry and reduced-motion checks. [Evidence](../../../KJM MAIN/docs/phase9/checkout-browser-results.json).
- Isolated ActionForm/confirmation/inventory controls: pending disabled states, duplicate prevention, keyboard submission, named submitters and success/failure feedback passed at all five widths. [Evidence](browser-controls.json).
- Unauthenticated production-connected local ADMIN: five sign-in widths and 15 protected routes passed; no authenticated record loading was tested. [Evidence](browser-readonly.json).
- Actual desktop/mobile screenshots were visually inspected. These are prominently labeled OFFLINE fixtures and are not proof of production record loading or an authenticated end-to-end browser session.

Intermediate failures (compile placement/type issues, formatter crash and invalid expired-hold fixture timestamps) were corrected and rerun. Current results, not intermediate artifacts, determine acceptance.

## Expiration and inventory behavior

Migration 020 does not change existing durations. The requested provisional business configuration is 24-hour pending expiration, 30-minute temporary hold and Asia/Manila. The rollback test uses those durations only as synthetic fixtures.

Migration 019 submits a pending request without assigning a physical unit. Its temporary hold reserves a unit while live. After the hold expires, the still-pending unassigned request does **not** continue reserving that physical unit. Pending extras remain reserved until the booking itself expires/cancels. Confirmation rechecks physical availability, other bookings, live holds and maintenance under the existing unit advisory lock. The pending-expiry worker locks rows with SKIP LOCKED, expires due requests and releases their holds. The disposable Cron registration is active every minute with `select public.expire_pending_bookings()`.

Production Cron execution/history and the exact live production durations were not independently verified. A read-only anonymous production booking-settings query returned HTTP 401; no permission bypass was attempted. [Evidence](production-public-settings.json). Confirmation-versus-expiration race testing on committed migration 020 remains pending.

## Screenshots and local review

MAIN is running at http://localhost:3000 and ADMIN at http://localhost:3001. Offline admin component preview: http://127.0.0.1:3019/dashboard. Offline synthetic checkout review: http://127.0.0.1:3020. Admin preview submissions are disabled; checkout uses mocked synthetic transport. All preview numbers are sample fixtures.

- Checkout: [desktop review](../../../KJM MAIN/docs/phase9/screenshots/checkout-review-1440.png), [mobile deposit choice](../../../KJM MAIN/docs/phase9/screenshots/checkout-deposit-390.png), [mobile received request](../../../KJM MAIN/docs/phase9/screenshots/checkout-received-390.png).
- ADMIN: [desktop handover](screenshots/bookings-booking-demo-1-1440.png), [mobile return](screenshots/bookings-booking-demo-2-390.png), [desktop settings](screenshots/settings-1440.png), [mobile deposit management](screenshots/deposits-390.png).

## Not executed / remaining approval blockers

Authenticated native-browser access was attempted again. Safari returned “Computer Use was not approved to use Safari”; no usable authorized session was available. No production authenticated layouts, production management mutations or private-document opening are claimed passed. PostgreSQL authenticated-role tests are separate from browser authentication.

Concurrent v3 submission, new deposit return/collection, simultaneous handover and confirmation-versus-expiration tests on a committed migration-020 schema still require the database approval step. Existing-engine concurrency tests passed but do not substitute for those new-schema tests. Real-browser checkout-to-admin HTTP/Storage/server-action transport remains unverified with an authorized disposable session. Production Auth configuration and Cron history were not inspected through privileged access.

Management must approve the actual cash amount, collection/return/dispute wording, partial-return policy, and the provisional expiration/hold policy before launch. ID must remain disabled without lawful retention review, exact allowed types, custody/privacy procedures and explicit approval. Unresolved completion preserves liability/custody; management must accept that documented exception workflow. Existing legacy bookings need manual policy reconciliation rather than automatic backfilling.

Public launch also requires the existing readiness evidence, private verification/privacy policies, international renter requirements, secure guest-Auth review and an explicit future decision about the public master switch. Nothing in this phase enables launch.

## Owner acceptance checklist (disposable only after schema approval)

1. Review the migration and approve disposable application first; use an authorized administrator and restricted synthetic customer. Keep public booking/anonymous Auth disabled.
2. Verify blank/default-disabled deposit settings. Ordinary/suspended users must fail RPC calls. Enable only a synthetic approved cash policy for testing.
3. Submit a synthetic booking with extras and private documents. Check server rental/deposit separation, quote snapshot, pending status and unpaid balance; repeat submission without duplicate rows.
4. Reject missing/rejected documents and incomplete international review. Approve only after all required checks and private documents pass; confirm no payment/deposit is created by approval.
5. Record actual synthetic cash rental payment. Retry the same key, reject changed parameters, and verify Paid/Partially Paid from the rental ledger. Separately collect the cash deposit once.
6. Attempt unpaid/uncollected-deposit handover; it must fail. Complete identity/accessory checks and inspection; verify actual Manila time and Active status.
7. Record return inspection, reject decreasing odometer/excess return, then physically return the synthetic deposit and complete. Rental revenue must not change when deposits move.
8. Test partial returns only with an approved snapshotted policy, and explicit unresolved cases retaining liability/custody after completion. Do not attempt deductions.
9. In the isolated test project only, approve the synthetic test-document policy and test ID receipt/return. Verify no collateral number/photo is requested and other customers cannot see event notes/documents.
10. Verify hold expiry, pending expiry, cancellation, rescheduling, last-unit concurrency and expiry/confirmation races. Check business/test scopes, all requested widths, keyboard controls, loading/errors and reduced motion. Verify live Cron history using authorized read-only access.

## Exact changed files

[Source/migration manifest](files-changed.json) records changes against the Phase 9 baseline; both repositories were already entirely untracked in Git. All files in the two `docs/phase9` directories are new review/test evidence. Running the existing disposable runner also refreshed four existing evidence files under `docs/phase8-corrections`: `disposable-phase6.json`, `disposable-quantity.json`, `disposable-booking.json`, `disposable-security.json`. Their scripts and application logic were not changed.

Stop point: approve migration 020 for the disposable project first. Production schema application and deployment require separate approval. No deployment performed.
