# KJM ADMIN settings workspace

October 23, 2026 · Local implementation only. No production database reads/writes, migration application, provider calls, customer charges, email sends, deployment or push occurred. Existing unrelated working changes were preserved.

## What staff can manage

The settings page is now a responsive workspace with five categories. Switching sections keeps their mounted forms and current edits. Existing save actions/approval checks remain in use.

| Section            | Controls                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pricing & payments | Links to existing motorcycle-rate editor, extras pricing/limits and finance; new internal gateway cost profiles/calculator                                                                                                                              |
| Security deposits  | Existing cash deposit amount, collection/return/dispute instructions and required policy approvals. Changes retain the existing future-booking snapshot rules                                                                                           |
| Booking rules      | Weekly pickup/return hours, rental-day and partial-day calculation, request expiry/hold timing, accepted IDs, licence/international policies, privacy and retention. Technical evidence and test-account controls are collapsed under advanced sections |
| Notifications      | Existing Telegram setup/test controls and link to existing email/Telegram preferences, history and retries                                                                                                                                              |
| Account security   | Existing administrator PIN change with its original authorization and credential handling                                                                                                                                                               |

Summary cards show the actual loaded public-booking master switch, configured enabled cash deposit and operating-day count. Unknown/missing configuration is not replaced by a made-up amount or schedule. The deposit dashboard link now opens the deposit category directly.

Settings loading now reads only the deposit configuration row instead of fetching every deposit snapshot, ledger event and rental inspection. Those full ledger reads remain available to their existing operational pages.

## Gateway fees: provider costs, not customer surcharges

The owner clarified that these are transaction fees deducted by the gateway. New cost profiles support PayMongo/Maya and supported profile labels for card (Visa/Mastercard), GCash and Maya wallet. A Maya/GCash pairing is rejected.

Each profile has an explicitly entered percentage, fixed PHP amount and notes. There are no invented/default provider rates. A saved gateway/method pair can be edited, and last-updated time is shown in Asia/Manila. Provider/method identity stays fixed while editing an existing profile; another pair uses the new-profile form.

The calculator estimates `transaction amount × configured percentage + fixed fee`, rounds to the nearest centavo and displays estimated net proceeds separately. It allows explicit zero fees and does not hide a negative net. Additional tax, provider-specific rounding/deductions and actual settlement fees are not inferred.

These are **internal cost estimates only**. Editing them does not renegotiate the gateway's actual fees, enable online payments, charge customers, modify quoted rental prices, change deposit handling or rewrite historical payment/finance records. The existing PayMongo/Maya activation controls are untouched. Actual reconciliation/settlement and financial ledger calculations do not consume these estimates.

## Database setup required for profile saving

Prepared canonical MAIN migration:

`/Users/mac/Desktop/KJM/KJM MAIN/supabase/migrations/202610230028_payment_gateway_fee_settings.sql`

It was **not applied**. It creates only an internal cost-settings table and an audited admin save RPC. No fee rates are seeded. The table has enabled/forced RLS, active-admin SELECT policy and no direct anonymous/authenticated/service-role mutations. The SECURITY DEFINER RPC checks the active administrator, uses an empty search path, validates stored values through table constraints, upserts the unique gateway/method pair, and writes an audit log in the same transaction. Only authenticated execution is granted; the application action freshly verifies the administrator before calling it.

Until the table is installed, the settings page explicitly shows that saving is unavailable, keeps Save disabled and lets the user try the local calculator. Permission/connection failures are not disguised as “setup needed.” Do not treat the disabled Save control as a working database save.

Before applying, review migration ordering against the earlier recorded migration-history discrepancy and test this migration/RLS/RPC against an isolated database. Do not perform a blanket push of other pending migrations. Database execution/privilege enforcement has not been tested in this task; no production changes are authorized by this local implementation report.

## Validation

- **47 focused tests passed across six files**: fee parsing/precision, bounds, centavo rounding, net calculation, fresh admin requirement, input rejection, RPC payload, failed-save handling, missing-table versus permission errors, settings-only query scope, existing deposit services, booking settings and dashboard query-error propagation.
- TypeScript and focused ESLint passed; whitespace checks passed. No full build or broad suite was run.
- Browser checked the new workspace/pricing components using an isolated local Vite fixture with all save actions stubbed and database/auth imports blocked. The fixture does not read `.env.local` and is not a public application route.
- Viewports: desktop 1440px and mobile 390px; no horizontal overflow or JavaScript errors. A fictional `3.50% + PHP 15` example on `PHP 1,000` showed `PHP 50` cost and `PHP 950` net. These are **synthetic test figures, not asserted gateway prices**.
- Browser interaction confirmed edited fee fields survive switching sections. The fixture Save returned an explicit “no settings were saved” message. No real save, active admin session or production database was used.

Evidence: [desktop](settings-desktop.png), [mobile](settings-mobile.png), [browser checks](browser-checks.json).

To open the isolated fixture with the existing installed tools:

```sh
cd '/Users/mac/Desktop/KJM/KJM ADMIN'
node node_modules/vite/bin/vite.js --config docs/settings-workspace/preview/vite.config.mjs
```

Then open `http://127.0.0.1:4178/docs/settings-workspace/preview/index.html`. Only the pricing/new navigation is live component UI in that fixture; other category bodies are labelled placeholders. Actual business forms remain those on the authenticated ADMIN settings page. Server-side save/RLS behavior and the complete authenticated page still need integration checks after approved isolated schema setup.

## Useful next additions

Further self-service controls worth scoping separately are verified pickup location/instructions, business contact details and the genuine review link. Each must be connected to the customer website/email snapshot source before presenting it as a live setting. Late-return/cancellation/damage fees need explicit business rules and booking quote/history treatment; no such charges were invented or introduced here.
