# Motorcycle unit colors — implementation handoff

The owner reported applying `KJM MAIN/docs/motorcycle-unit-colors/schema.prepared.sql`.
Read-only REST schema checks confirmed that `motorcycle_units.registration_plate`,
`motorcycle_units.color`, and `bookings.selected_color` are accessible.
No inventory or booking data was written during verification.

## Required follow-up SQL

Review `KJM MAIN/docs/motorcycle-unit-colors/booking-integration.prepared.sql`.
It has NOT been executed. It requires the initial schema proposal, MAIN migrations
through 039, and `KJM ADMIN/docs/migrations/202610270039_admin_manual_bookings.sql`.
It adds date-aware aggregate color availability, color-aware guest submission,
manual booking integration, assignment/hold guards, write normalization, and new
notification payload snapshots. It retains existing exclusion/locking and
verification rules. It performs no inventory creation or historical backfill.

The new application calls versioned submission RPCs that are unavailable until
this SQL is applied, so it cannot silently submit to an older color-ignoring RPC.
Do not regard customer color booking as operational until application and
read-only verification of the follow-up SQL are complete. Live concurrency and
transactional SQL behavior have not been tested against production.

## Implemented behavior

- Fleet model details: add individual units; edit plate/color in place; show
  model, plate, color and existing status. Existing model navigation chooses the
  model; no new models are generated.
- New unit entry requires plate/color. Plates are trimmed/uppercased and database
  uniqueness conflicts receive a clear error. Unchanged legacy plates and
  incomplete legacy fields remain intact.
- Common color suggestions and arbitrary custom colors support combinations.
  Whitespace, case and slash spacing are normalized, preserving combination order.
- Quantity creation UI/action is disabled. No motorcycles were created.
- Public colors come from unit inventory, refresh with dates/model changes,
  disable unavailable options, and are rechecked before submission. A model with
  no configured colors retains the no-preference path after SQL integration.
- Guest and admin submission use binding color snapshots; the SQL guards holds
  and assignment against mismatched colors. Existing booking records are not
  reassigned or backfilled.
- Color is shown in summaries, confirmation/status, emails, admin details,
  assignment, and handover/return inspection context. Plates remain admin-only.

## Files changed for this task

### KJM ADMIN

- `src/app/actions/motorcycle-units.ts` and `.test.ts`
- `src/app/actions/fleet.ts`
- `src/app/actions/manual-bookings.ts` and `.test.ts`
- `src/app/dashboard/fleet/[id]/page.tsx`
- `src/app/dashboard/bookings/[id]/page.tsx`
- `src/components/motorcycle-unit-form.tsx`
- `src/components/manual-booking-form.tsx`
- `src/components/manual-booking-management.tsx`
- `src/components/compact-inspection-form.tsx`
- `src/services/inspection-context.ts`
- `src/lib/motorcycle-color.ts`
- `src/lib/manual-booking.ts`
- `src/lib/notifications/templates.ts`
- `src/types/database.ts`
- This handoff document

### KJM MAIN

- `src/app/api/guest/bookings/route.ts` and `.test.ts`
- `src/app/api/guest/bookings/[bookingId]/route.ts`
- `src/app/api/guest/bookings/[bookingId]/finalize/route.ts`
- `src/app/(website)/booking/status/[id]/page.tsx`
- `src/components/website/booking-checkout.tsx`
- `src/components/website/checkout-summary.tsx`
- `src/components/website/guest-booking-status.tsx`
- `src/components/website/motorcycle-color-options.tsx` and `.test.ts`
- `src/lib/motorcycle-color.ts` and `.test.ts`
- `src/lib/guest-checkout/validation.ts`
- `src/lib/notifications/templates.ts`
- `src/types/database.ts`
- `docs/motorcycle-unit-colors/booking-integration.prepared.sql`

Existing unrelated workspace changes were retained.

## Validation

- ADMIN: 80 tests passed across unit actions, manual booking actions, compact
  inspections, booking details, and notifications.
- MAIN: 95 tests passed across color normalization/UI/SQL contracts, guest
  submission/finalization, booking utilities, notifications, and catalog visibility.
- Both projects: TypeScript checks and focused ESLint checks passed.
- Tests use mocks, static rendering and SQL contract inspection. No database
  fixture records were inserted. SQL contracts do not prove runtime concurrency.
- No full build, deployment, push, price changes, or PayMongo changes.

## Remaining limitations and readiness

Individual unit photographs are deferred because current media is model-scoped
and requires additional schema/storage-policy work. Existing model photos remain
intact and public summaries identify them as model images.

The current public UI uses guest checkout. Legacy authenticated submission RPCs
have no color input; with the follow-up guards they fail closed for newly
submitted bookings on configured-color models. Existing authenticated bookings
remain readable and their assignments unchanged; the current booking form is the
supported path for new color selections.

Manual plate/color unit entry: ready in the local code against the verified
foundation schema. End-to-end customer color booking: pending owner review,
application and verification of the follow-up SQL. No actual units were added.
