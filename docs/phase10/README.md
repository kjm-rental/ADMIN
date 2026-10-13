# Phase 10 — Transactional notifications

Implementation is prepared; all real external delivery remains disabled. Migration 022 was **not applied to any remote database**, following the owner's explicit “Prepare migration; do not apply it” response. Production remains at the owner-reported 001–019 state; 020, 021 and 022 each require production approval. There is no deployment, public booking activation, anonymous authentication activation, physical-ID policy activation, pricing/deposit policy change or payment gateway integration.

## Architecture

KJM MAIN owns `supabase/migrations/202610110022_transactional_notification_outbox.sql`. Both applications continue using their existing shared booking and financial actions. Database triggers create the durable outbox from authoritative deposit snapshots, booking status transitions, document submission/review state, cash ledger events, deposit ledger events and rental inspections. No browser notification event submission is trusted. The earlier `notification_events` table remains historical metadata and is not a dispatch source; its existing broad administrator permissions cannot enqueue arbitrary deliveries.

KJM ADMIN hosts the delivery worker at `POST /api/internal/notifications`. It requires an exact bearer secret of at least 32 characters, using timing-safe comparison. It accepts no event, recipient or chat from its request body. A server-only Supabase service-role client invokes tightly granted RPCs. Each invocation schedules eligible approved reminders and handles at most one Telegram plus one Resend message serially. No Cron schedule was activated. A deployment scheduler must use approved cadence and POST with the secret header; never put secrets in URLs.

Each outbox row stores UUID event ID, stable source key, booking/reference, event type, channel, recipient reference, template version, minimal immutable booking/deposit summary, state, attempt count, timestamps, lease token/expiry, request fingerprint, safe error code, provider message reference and simulated flag. Recipient email is resolved only from the booking owner's verified Auth email; arbitrary mutable customer profile email is not used. Telegram goes only to the configured approved private group. Payloads exclude names, phone numbers, identity numbers/types/images, document paths, private URLs, notes, PINs and auth credentials.

Three new tables have forced RLS and administrator-only SELECT. Client and service-role direct writes are revoked despite inherited default grants. Only fresh active-admin RPCs manage preferences, eligible email retries, simulation audits or authoritative generation repair. Service-only RPCs schedule, claim, resolve, prepare and finish deliveries. Every SECURITY DEFINER uses an empty search_path and qualified objects. UUID keys add no sequences. Local ordering checks retain the restricted deposit sequence from 020 → 021.

External transport failures happen after the business transaction and cannot undo it. Unexpected outbox generation failures preserve the booking/payment and record only source metadata plus SQLSTATE. Authorized generation repair replays that recorded authoritative event with its stable key and audits the repair. No external network request runs inside a database transaction.

## Event catalog

| Event | Telegram | Customer email |
| --- | --- | --- |
| Booking requested | Yes | Request received, explicitly pending approval |
| Booking approved | Yes | Confirmed booking; cash payment still due |
| Booking rejected | Yes | Respectful update; no internal review notes |
| Documents ready for review | Yes | No |
| Verification resubmission required | Yes | Contact KJM; no invented upload route |
| Booking cancelled | Yes | Cancellation status; no invented refund |
| Upcoming pickup | Yes | Approved pickup reminder |
| Morning pickup alerts | Per approved pickup, daily deduplicated | No |
| Motorcycle handover | Yes | Motorcycle collected |
| Upcoming return | Yes | Active-rental return reminder |
| Overdue rental | Once per active booking per Manila day | No |
| Return inspection recorded | Yes | Return recorded; no claim of full settlement |
| Authorized cash payment recorded | Yes | Receipt for actual amount |
| Cash deposit collected | Yes | Separate deposit receipt |
| Cash deposit returned | Yes | Actual returned amount only |
| Unresolved deposit case opened | Yes | No |
| Legally approved custody event | Generic status only | No |

The 12 customer HTML/text templates are in `emails/`, generated using synthetic fixtures. They use ocean teal #143F40, ivory #FAF7F0 and coral #F6A783, responsive 600px tables, accessible text, Manila date/time formatting and precise centavos. No external images, invented locations or online payment instructions are used. Absolute `/contact` links appear only for configured approved origins. Telegram uses plain text with no parse_mode, so user markup cannot execute. Admin booking links appear only under an explicitly configured secure admin origin.

## Delivery and retry semantics

Claims use FOR UPDATE SKIP LOCKED with UUID leases lasting 90 seconds. Provider requests time out after 12 seconds. Stale workers cannot prepare/finish; expired leases are held for review because delivery may already have occurred. The worker persists a SHA-256 fingerprint including rendered message, recipient, sender, chat and provider account fingerprint before sending. Changed retry requests are held permanently rather than sent to a new target.

Resend receives stable `Idempotency-Key: kjm-v1/<outbox UUID>`. Its documented retention is 24 hours; automatic and manual retries are held after 23 hours from first attempt. Identical requests preserve exact rendered content. Transient Resend failures retry with exponential backoff (60 seconds, doubling), at most six total attempts; manual retries do not reset attempt history and have an additional three-action limit. Provider rate limits are respected, up to a one-day scheduled wait, after which the retry-window guard may hold the event for review. Invalid recipients and permanent provider rejections are not automatically retried.

Telegram has no corresponding sendMessage idempotency guarantee. Transport timeout, 5xx, malformed success or worker crash may mean a message was accepted. Such outcomes are held for review rather than automatically retried. Explicit rate-limit responses are retryable. No mathematically guaranteed exactly-once external delivery is claimed. Neither provider receives synthetic rows in live mode. Development mock mode claims only is_test rows, never uses network, marks simulated successes and is refused under NODE_ENV=production.

Reminder timings default provisionally to 24 hours before pickup/return and 08:00 Manila morning alerts, but scheduling is off until an active administrator explicitly approves timings. Eligibility is checked at claim and immediately before delivery: pending/unapproved/cancelled/expired pickups cannot get reminders; returns/overdue require active rentals. Reschedules invalidate stale timestamp snapshots. Stable reminder keys use epoch timestamps, independent of session timezone. Booking state can still change after the final check while the provider request is in flight; an external system cannot be made atomic with the booking transaction.

## Administration

`Settings → Notifications` provides provider configuration/approval status without tokens, last success/error per channel, simulated test controls, supported event preferences, timing approval, latest 100 deliveries, responsive scrollable history, safe failure descriptions, eligible customer retries with confirmation, and generation repair with confirmation. Authorization is refreshed on every action and rechecked by database functions. Forms prevent duplicate submissions, disable pending controls and show errors/success. Missing migration 022 renders an explicit unavailable state; actual database errors throw into the existing dashboard error boundary instead of displaying an empty queue.

Simulation controls are explicitly mock-only; live provider test sends are not offered until a separate verified configuration and communication approval workflow is completed. This implementation does not send owner/customer test messages automatically.

## Telegram setup (owner)

1. Create the KJM bot through Telegram's official BotFather and keep its token in server-only secret storage.
2. Add it to a management-approved **private** operations group. Use its numeric negative chat ID, not a public username. Grant only permission needed to post; do not grant broad administrator privileges without a separate need.
3. Populate TELEGRAM_BOT_TOKEN and TELEGRAM_OPERATIONS_CHAT_ID from secret storage, never NEXT_PUBLIC or Git.
4. Independently verify bot identity and private-group membership using the official getMe/getChat APIs or approved dashboard workflow. Do not claim verification from environment presence alone.
5. Obtain approval for an actual staff test message and inspect the real Bot API response. Only then record TELEGRAM_OPERATIONS_VERIFIED=true.
6. Keep NOTIFICATIONS_MODE=disabled until migration review, endpoint/scheduler setup and production activation are separately approved.

## Resend setup (owner)

1. Create the approved sender domain in Resend, publish its required DNS records and confirm verified status in Resend. This phase has not verified a domain.
2. Create a least-privilege sending API key and store RESEND_API_KEY server-side. Set RESEND_FROM_EMAIL to the approved verified bare sender address.
3. Set approved KJM_MAIN_BASE_URL/KJM_ADMIN_BASE_URL HTTPS origins and the actual approved KJM_PICKUP_LOCATION. Do not invent an address or contact account.
4. Obtain approval for a real transactional test email, use an approved verified recipient and inspect delivery/provider results. Verify HTML/text in actual customer email clients (including Outlook/Gmail/mobile).
5. Only after domain and sending verification, record RESEND_SENDER_VERIFIED=true. This is a management attestation, not independent runtime verification.
6. Keep customer delivery disabled until explicit production activation approval.

## Deployment and activation checklist

- Review and approve migration ordering 020 → 021 → 022. Never deploy 020 alone; apply 021 before client exposure.
- Migration 022 still needs approved disposable Supabase application/integration and environment-specific concurrency validation. Local native PostgreSQL separate-connection tests passed; remote application was not authorized this turn.
- Review new RLS, grants, empty search_path functions and default privileges. Confirm no new sequences and restricted deposit sequence effective grants.
- Configure secrets from `notifications.env.example`; do not edit production env files until approved. Set a random ≥32-character NOTIFICATION_CRON_SECRET and server-only service-role key; do not reuse a bot/API key as scheduler secret.
- Validate authorized admin UI against the real schema/session and complete the manual checklist below.
- Verify actual private Telegram group and Resend sender domain, then separately approve recipient-scoped provider test messages. Neither real provider was tested here.
- Review pending backlog before activating. Disable obsolete event categories; stale requests/reminders are cancelled by eligibility rules. Do not activate sending to historical customers casually.
- Approve reminder times and scheduler cadence. Configure only authenticated POST invocation, with monitoring for failures, lease expiration and generation errors. No unsecured Cron endpoint or webhook exists.
- With explicit activation approval, a trusted owner/database operation can set the approved channel flag in notification_settings; the application UI cannot enable external sending. Set NOTIFICATIONS_MODE=live, NOTIFICATIONS_EXTERNAL_APPROVED=true, and the appropriate verified-provider attestation. Both database channel flag and server approval/configuration are required.
- Keep public booking, anonymous authentication and physical-ID deposits disabled. No online gateway is included.
- Monitoring should use safe status codes/counts and event UUIDs only. Do not log raw provider request bodies, bot-token URLs, responses or customer emails. No delivery webhooks are implemented; `sent` means provider accepted, not mailbox/inbox confirmed. Retention rules for notification summaries require management/privacy approval before any future deletion policy.

## Manual authorized-owner checklist

- Sign in as an active administrator; confirm suspended/customer sessions cannot access controls.
- Open Settings → Notifications at 360/390/768/1024/1440px and verify scrolling, readable states and keyboard focus.
- Save event categories and timing approval. Confirm separate channel activation remains disabled.
- In approved development mock mode, run simulated tests; confirm audited status and no network delivery.
- Generate synthetic guarded booking/payment/deposit/inspection events after an approved test migration; confirm one logical row per channel and immutable deposit snapshot.
- Repeat concurrent database worker tests in the approved disposable Supabase environment; local separate-connection tests passed, but shared-host validation remains required.
- Simulate rate limits, timeout-after-acceptance and crash-after-send. Review ambiguous outcomes; do not resend blindly.
- Confirm cancelled/expired/unapproved pickup reminders and rescheduled reminders are suppressed.
- Retry an eligible failed email with confirmation; verify audit, unchanged booking and no duplicate concurrent retries.
- Validate real provider acceptance only after explicit test-send approval, and distinguish acceptance from final inbox delivery.

Official API references: [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage), [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys), [PGlite local PostgreSQL](https://pglite.dev/docs/about).

## Final verification report

| Check | Completed result |
| --- | --- |
| KJM MAIN TypeScript / ESLint / production build | Passed |
| KJM ADMIN TypeScript / ESLint / production build | Passed |
| Existing + new automated tests | MAIN 56; ADMIN 204 (40 new notification tests); all passed |
| Local PGlite integration | Actual migrations 001–022; 53 SQL assertions passed |
| Local native PostgreSQL 18.4 integration | Actual migrations 001–022; 53 SQL assertions passed |
| Native PostgreSQL concurrency | 18 assertions passed across six separate simultaneous-connection races |
| Admin isolated browser preview | 21 scenarios across all five requested widths; zero page overflow or WCAG automated violations |
| Customer HTML email previews | 60 checks (12 templates × five widths); zero overflow or automated accessibility violations |
| Real unauthenticated admin navigation | New route redirects to sign-in |
| Local scheduled endpoint | Unauthorized POST 401; unsupported GET 405 |
| Preservation | Prior migrations and both environment files unchanged; no existing files deleted |
| Remote migrations and remote mutation tests | Not executed; owner explicitly withheld application approval |
| Real Telegram / Resend | Not executed; no provider sends or verified real responses |
| Authenticated admin browser | Not executed; Computer Use permissions are not granted and no signed-in session was supplied |
| Real email clients / native Supabase Cron | Not executed; Chromium previews and local Cron shim only |

The native PostgreSQL cluster was created specifically in `/tmp/kjm-phase10-postgres-data`, bound only to 127.0.0.1:55432, and stopped after testing. It read no remote credentials. Supabase's auth/storage schemas and pg_cron interfaces were explicit local bootstrap shims; actual KJM migrations, RLS, functions and guards were used. Native races prove duplicate payment callbacks create one financial event and one message per channel, concurrent workers use distinct backend PIDs and never share a lease, stale duplicate completion rolls back, only one concurrent manual retry/audit commits, repeated full-balance payment callbacks add nothing, and overpayment failures leave ledger/outbox unchanged. Synthetic fixture money was reconciled to zero through existing cancellation/refund RPCs; no remote records were involved.

Initial failures were corrected before the final passing runs: synthetic fixture omissions/inconsistent quoted totals, a test runner context setup issue, ProcessEnv fixture typing, and the explicit route runtime flag rejected by Next cacheComponents. The first native concurrency run reached all 16 core race assertions but its final fixture cleanup lacked the quoted deposit column update; the fixture was corrected and its local ledger reconciled before the final complete 18-assertion run. These were recorded implementation/test-run failures, not claimed passes. No final automated, local SQL or browser test remains failed.

**Review status:** implementation is ready for owner code/design review and approval of a disposable 022 migration test. It is not ready for production delivery activation. Remote Supabase validation, authorized administrator UI validation, real provider identity/domain checks, approved test messages, monitoring and separate production migration/deployment approvals remain.

Screenshots: `notifications-1440.png`, `notifications-390.png` (also 360/768/1024), plus `emails/booking_requested-1440.png`, `emails/booking_requested-390.png` and payment receipt previews. Every screenshot uses clearly synthetic data; none demonstrates an authenticated production session.

Exact source/evidence file inventory: `files-changed.json`. Preservation evidence: `preservation-checks.json`. Automated and local/browser evidence: `verification-summary.json` and the referenced detailed result JSON files. No credentials were added to Git or shown in logs.
