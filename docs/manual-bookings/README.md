# Admin manual reservations

Implemented in KJM ADMIN only. No SQL, deployments, provider requests, live payments or production record changes were performed.

Entry: **Bookings → + New Booking** (`/dashboard/bookings/new`). Existing manual reservations use **Edit admin booking** within their existing booking details page (`?tab=manual`). This is an orchestration layer over the shared booking system, not a new booking engine.

## Activation dependency

`docs/migrations/202610270039_admin_manual_bookings.sql` is a **prepared, unapplied migration for review**. It requires the shared schema through migration 038. The canonical migration owner remains KJM MAIN; review and transfer the approved file into its migration sequence separately. Do not execute it as part of reviewing this change.

The form detects the missing adjustment column and stays disabled until this dependency is installed. Current bookings still load if the new metadata table is missing.

The migration adds:

- `bookings.manual_adjustment_php`, retaining standard base/extras/service totals and the existing final total and generated centavo columns.
- Admin-only booking metadata (source, internal notes, reason, creator and optimistic revision) and an internal request idempotency log. These tables do not duplicate bookings, customers, inventory or payment ledgers.
- An optional accessory model compatibility array on the existing accessory catalog. Configure it through the existing Extras editor. Top boxes fail closed until their compatible models are explicitly selected. No accessory/model records or compatibility assumptions are seeded.
- Guarded quote, search, transactional create/edit, private document registration and driving-details RPCs.
- A canonical extras calculator overload that excludes the current booking during edits. Existing callers retain the original five-argument contract and behavior.
- A strictly scoped manual reservation confirmation workflow. It records the authorizing admin and reason in existing confirmation/history/audit infrastructure, without approving identity or inventing terms acceptance. Existing website confirmation calls retain their prior checks. Both existing handover guards are unchanged.
- A narrow private-storage insert policy for active administrators adding documents to eligible manual bookings. Existing public/customer storage requirements are unchanged. Public guest/service snapshots remain immutable; only eligible manual snapshots can be edited by authenticated administrators through guarded operations.
- Deferral of the manual request notification until contact/service snapshots exist. The existing outbox, templates, recipients, worker and transport switches remain in use.

KJM MAIN impact: new columns default to existing behavior, public pricing/creation inputs are unchanged, and public document/payment/verification requirements are unchanged. The migration does not enable public booking, Resend, Telegram, delivery or PayMongo. It does change shared functions and therefore needs disposable-database regression testing against both applications before production approval.

## Implemented behavior

- Search existing guests by name, normalized phone or email; select without creating an account. New contacts require name/phone, with optional real email. Ambiguous contact matches require explicit selection; no fake email is inserted.
- Model/photo/rate selection, Manila rental dates and available units. Quotes use the canonical daily/package/hourly calculator, extras inventory rules and configured delivery quote. Saves lock and recheck inventory and prices; existing exclusion constraints remain active.
- Independent delivery/collection areas, addresses and instructions. The service schedule matches rental start/return, following the existing service model and operating hours. No new independent scheduling model is introduced.
- Configured compatible accessories and quantity limits. Accessories are inventory-validated again on save.
- Standard price, fixed or percentage discount, special agreed price and mandatory override reason. Adjustments use **whole PHP**, matching the existing integer rental ledger; percentages support two decimal places and round the final amount to the nearest peso. The PHP 2,500 refundable cash deposit is never discounted, collected or refunded by creation/editing.
- Pending reservations use the configured expiration and temporary hold policy with no permanent unit assignment. Edits do not prolong a hold. An expired hold requires a new reservation.
- Confirmation can precede document upload only through explicit admin reservation authorization. Handover still requires genuine document review, a valid license, actual payment, the separate collected deposit and the existing inspection workflow.
- Existing booking list, calendar, customer history, payment, deposit, handover and return infrastructure handles these records normally. Admin/source labels and internal notes appear in booking management.
- Private optional document uploads and later driving details from booking details. Document registration does not approve verification. Approved/rejected verification and approved evidence cannot be overwritten through the new driving-details form.
- Pre-handover pending/confirmed manual editing rechecks all charges and unit/accessory conflicts. Agreed adjustments remain explicit form values and appear in a fresh quote before saving. Changing the model requires a new entitlement review; names bound to other reservations or approved evidence require an authorized identity correction. Existing confirmation records remain historical evidence if an authorized editor changes a unit; current assignment and changes are audited. Handover still requires full verification of the current booking.
- Any payment intent/event, deposit event or inspection blocks this editor. Existing financial events are not deleted or rewritten. Active/completed bookings also cannot use it.
- Real optional email is bound per booking through existing guest notification infrastructure using an unissued random access hash. No guest access token, password or account is issued. Phone-only reservations skip customer emails but retain staff notifications. Save retries retain their request key and the server enforces actor/payload-bound idempotency.

## Files added or extended for this feature

- `src/app/dashboard/bookings/new/page.tsx`
- `src/app/dashboard/bookings/page.tsx`
- `src/app/dashboard/bookings/[id]/page.tsx`
- `src/components/manual-booking-form.tsx`
- `src/components/manual-booking-management.tsx`
- `src/components/manual-booking-documents.tsx`
- `src/components/manual-driving-details.tsx`
- `src/app/actions/manual-bookings.ts`
- `src/app/api/manual-bookings/[id]/documents/route.ts`
- `src/services/manual-bookings.ts`
- `src/lib/manual-booking.ts`
- `src/types/database.ts`
- `src/app/dashboard/extras/page.tsx`
- `src/app/actions/extras.ts`
- `src/lib/manual-booking.test.ts`
- `src/lib/manual-booking-migration.test.ts`
- `src/app/actions/manual-bookings.test.ts`
- `src/app/api/manual-bookings/[id]/documents/route.test.ts`
- `src/app/dashboard/bookings/[id]/page.test.ts` (server child mocks and existing button-label assertions)
- This README and the prepared SQL migration.

Existing unrelated uncommitted changes in this workspace were preserved. No KJM MAIN source files were modified for this task.

## Verification and remaining validation

Final focused verification: **98 tests passed across 9 files**; TypeScript, focused ESLint and formatting checks passed. SQL grammar and PL/pgSQL function bodies were parsed successfully without database execution.

Focused TypeScript, ESLint and Vitest checks cover input validation, discounts/rounding, phone-only/no-document authorization, server action authentication, timestamp conversion, quote requirements, retry keys, unavailable inventory error handling, existing calendar/deposit behavior, private document authorization/signatures/cleanup and existing booking-page behavior. Static SQL contract checks verify that required guards and canonical helpers are present; they **do not prove database runtime behavior**.

Before enabling this feature, apply the reviewed migration to a disposable/local database and exercise:

1. New and existing customers, including phone-only customers; normalized phone/email duplicate matching.
2. Pending and explicitly confirmed reservations with no documents; pending hold expiry and confirmation after hold expiry; no indefinite unit locks.
3. Canonical price parity with public quotes for identical details, all adjustment modes, zero and invalid totals, deposit separation and stale policy/quote rejection.
4. Concurrent overlapping creation, confirm-versus-expiry, service availability/hours/fees, extras stock races and top-box compatibility.
5. Two-admin edit revision conflicts, changed model/unit/dates, preserved agreed adjustments, service rescheduling and financial-history rejection.
6. List, calendar, customer history, partial cash payment, deposit collection/refund, handover and return integration.
7. Optional email/no-email outbox behavior; notification failures and identical/mutated idempotency retries.
8. Private document upload/replacement, real metadata binding, RLS denial for non-admins, genuine review and denied handover before all existing requirements pass.
9. Unchanged public booking creation/verification/payment behavior and non-manual snapshot immutability.
10. Authenticated browser checks of the form, summary and details on desktop/mobile.

No SQL or database integration tests were executed, and no browser visual verification was performed. Ready for code review and UI inspection; complete end-to-end local testing requires the migration and configured inventory, booking/hold policy, approved PHP 2,500 cash deposit and delivery settings. This is not a production-readiness claim.
