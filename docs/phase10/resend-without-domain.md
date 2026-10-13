# Resend preparation before KJM owns a domain

The existing Phase 10 notification infrastructure is retained. The booking system, templates, outbox worker, SQL migrations and production database were not changed by this preparation. No application was deployed and no actual provider request was sent.

## Ready

- `RESEND_API_KEY` is read only by the server-only notification configuration. It is never prefixed with `NEXT_PUBLIC_`, included in status output, logged or embedded in client code.
- Local `.env.local` is Git-ignored and owner-readable only (0600). It has an empty server-side key entry; **no actual Resend key is currently configured locally**. Hosted secrets were not inspected. This preparation does not claim that a valid credential is installed or that Resend account authentication has been tested.
- Customer notification mode remains `disabled`, external approval remains false and sender verification remains false. `RESEND_TEST_ENABLED` defaults to false.
- A separate local CLI reuses the existing rendering and provider-request implementation, including HTML/text output, timeout, error sanitization and idempotency headers. It does not query or mutate any Supabase records and is not exposed through a public route or connected to the customer worker.
- Provider tests require development mode, explicit test opt-in, a server-side key, a disabled customer worker and external approval false. Real records and Telegram are rejected.
- Recipients are limited to Resend's official `delivered`, `bounced`, `complained` and `suppressed` test inboxes. Labels are allowed for the first three. Arbitrary personal/customer addresses, header injection and lookalike domains are rejected.
- Test sender is `onboarding@resend.dev`. The future real sender remains separately configurable through `RESEND_FROM_EMAIL`; no website domain is hardcoded.
- Booking request/confirmation, approval, cancellation, pickup and return-reminder templates remain unchanged.

Resend documents its [test inboxes](https://resend.com/docs/dashboard/emails/send-test-emails) and the [limitations of the resend.dev sender domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). The default sender cannot be used for arbitrary customer delivery. A provider's account/sender rejection must not be worked around by widening recipients or marking a sender verified. Simulator API acceptance does not prove real customer delivery, and test requests count against provider quotas.

## Local preview — no credentials or network required

From `KJM ADMIN`:

```sh
node scripts/resend-test.mjs
```

This generates HTML and plain-text previews for the five existing templates in an owner-only temporary directory. It prints only the directory, template count and a boolean credential-presence status. All payload fields are fixed synthetic values and are unrelated to motorcycle prices or approved business policies.

A verified preview run produced five HTML/text pairs with **zero network requests** at:

`/var/folders/1j/c95g1jt90p728rsbdk1nrz_80000gn/T/kjm-resend-preview-b5JAtI/`

## Future provider test — not executed in this task

Install the credential directly into a protected server-side environment or secret manager. Do not put it in commands, source files, browser variables or chat. Do not change `NOTIFICATIONS_MODE`, external approval or sender verification to enable a test.

With the credential privately configured, the following explicit development-only command sends **one synthetic approval message** to the configured official test inbox:

```sh
RESEND_TEST_ENABLED=true node scripts/resend-test.mjs --send
```

`RESEND_TEST_RECIPIENT` defaults to `delivered@resend.dev` and can select only the other approved simulator addresses. The normal outbox worker stays disabled. Preview is the default; no provider request occurs without `--send`. The test CLI prints only a sanitized outcome and never prints API credentials, recipient context or provider error descriptions.

## Before production activation

1. Obtain a sending domain and verify its required DNS records in Resend.
2. Privately configure the approved server-side key and verified bare sender in `RESEND_FROM_EMAIL`; confirm least-privilege key scope and account/domain readiness.
3. Set the existing website base URLs to approved HTTPS origins when the website domain is ready, so template links resolve correctly.
4. Complete authorized provider tests, deliverability and retry checks. A sender-verification flag is a management attestation, not independent provider verification.
5. Obtain separate activation authorization before changing database channel switches, `NOTIFICATIONS_MODE=live`, `NOTIFICATIONS_EXTERNAL_APPROVED=true` or `RESEND_SENDER_VERIFIED=true`. Keep test mode disabled in production. Do not activate Telegram as part of Resend setup.

Production notification switches were not changed. Domain verification, credential installation, actual Resend API authentication/provider testing and production activation remain outstanding.

## Files

- `src/lib/notifications/config.ts`: non-production test opt-in.
- `src/lib/notifications/transports.ts`: guarded test entry point sharing the existing provider handler; live and mock guards retained.
- `src/lib/notifications/resend-test.test.ts`: synthetic tests with stubbed fetch.
- `scripts/resend-test.mjs`, `scripts/server-only-cli.mjs`: isolated local previews and explicit provider test.
- `.env.example`: safe disabled settings and server-only variable names.
- `.env.local`: ignored local file, disabled flags and blank key/sender placeholders; never committed.
- This report.

## Verification result

ADMIN TypeScript, ESLint, all **225 tests across 18 files** (including 21 new test-safety assertions), and the production webpack build passed. The preview command was rerun successfully after formatting and implementation verification; the latest preview directory is `/var/folders/1j/c95g1jt90p728rsbdk1nrz_80000gn/T/kjm-resend-preview-61nLND/`. Git ignore and local environment permissions (0600) were verified. No Resend API request, customer delivery, production database change or deployment was executed. Logs: `/tmp/kjm-resend-{typecheck,lint,tests,build}.log`.
