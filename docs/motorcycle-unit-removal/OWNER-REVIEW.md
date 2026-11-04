# Individual motorcycle unit removal

Implementation is complete in KJM ADMIN. Database integration is pending review
and application of `docs/migrations/202610300040_motorcycle_unit_removal.prepared.sql`.
The migration has not been executed. No actual units or bookings were changed.

## Behavior

The existing unit forms now include Remove Unit and Deactivate Unit controls.
Inactive units offer Reactivate Unit and remain visible in the same list.
Confirmation shows the model and actual plate, including legacy placeholders.
Cancel only closes the dialog. Successful operations return to the same model's
inventory section, refresh counts/availability, and show a page-level notification.

Removal uses an administrator-only transactional RPC. It checks current status,
locks the unit and the existing model/unit advisory keys, and locks referencing
tables with NOWAIT before inspecting all foreign keys to motorcycle_units.
Any reference blocks deletion, including CASCADE/SET NULL relationships, expired
holds, maintenance history, booking confirmations and checkout records. Booking
children such as payments and inspections are protected through their booking.
Known booking audit metadata also protects historical unit assignments.
Ordinary unit CRUD audit records remain intact and alone do not prevent removal.

Units with history are offered deactivation. Deactivation preserves all records
and uses the existing inactive status. It blocks unresolved assigned bookings,
live holds, reserved/rented unit states, and unassigned model-level demand without
a live hold. This conservatively includes overdue unresolved reservations until
their status is resolved. It does not cancel or reassign anything.

Existing availability queries require status=available, so inactive units are
excluded from new bookings. Reactivation restores available status while existing
booking and maintenance exclusions continue to apply. Plates and colors are not
edited by these operations.

A database trigger applies the history/deactivation guard to direct unit writes
as well as the RPC. Mutation and audit insertion commit together. Busy inventory
returns a retry message instead of waiting through a conflicting transaction.

## Files changed

- `src/app/actions/motorcycle-unit-lifecycle.ts`
- `src/app/actions/motorcycle-unit-lifecycle.test.ts`
- `src/components/motorcycle-unit-lifecycle.tsx`
- `src/components/motorcycle-unit-lifecycle.test.tsx`
- `src/components/motorcycle-unit-form.tsx`
- `src/app/dashboard/fleet/[id]/page.tsx`
- `src/lib/motorcycle-unit-lifecycle.ts`
- `src/lib/motorcycle-unit-lifecycle-sql.test.ts`
- `src/types/database.ts`
- `docs/migrations/202610300040_motorcycle_unit_removal.prepared.sql`
- This review document

## Validation and limits

35 focused tests passed across the new action/dialog/SQL contracts and existing
unit-save/inventory tests. Coverage includes confirmation gating, authorization,
successful operation responses, history refusal, blocked deactivation, stale
records, safe database/network errors, redirects/revalidation, inactive inventory
counts, confirmation rendering and a static check of the cancel handler.
TypeScript, focused ESLint, and git diff --check passed.

These tests use mocks/static rendering and SQL inspection. They do not execute
the migration or prove live PostgreSQL dependency/concurrency behavior. Verify
that behavior after owner review/application before claiming operational readiness.
Until the RPC exists, the controls fail safely with a migration-required message.

No dependencies were installed, no full build was run, KJM MAIN was not modified,
and no deployment or Git push was performed.
