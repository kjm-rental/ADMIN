# Admin rental contract downloads

Each Admin booking detail header has **Download contract (PDF)**. The export includes saved booking/customer/unit details, exact rental times and elapsed duration, recorded pricing/payment figures, accessories, service locations, deposit requirements and instructions, and the complete archived rental terms.

The terms version and source SHA-256 come from the immutable booking acceptance record. The bundled archive must match both the acceptance and the published version's database hash; missing/unknown/mismatched archives fail closed rather than substituting newer terms. A booking without online acceptance is explicitly labeled as a draft, with current terms for review and no invented acceptance or signatures. Booking details reflect the current saved record at generation, not a frozen historical snapshot.

The GET export verifies a fresh active administrator session, reads through the existing session-scoped Supabase client/RLS, and returns a no-store private attachment. No public storage URLs, service-role bypasses, customer identity document images, or internal payment notes are included. No messages, booking changes or payments occur on download. No migration or new environment values are needed.

The owner-supplied 2026-10-12 agreement archive is identical to MAIN's published source. Noto Sans fonts are bundled under the SIL Open Font License; their license is in assets/contracts/OFL.txt. Font/logo assets are included in the route's output tracing.

Validation: 507 tests pass, ESLint and production build pass, zero production dependency vulnerabilities. Tests cover fresh-admin authorization, identifier validation, private download headers/safe filenames, absent bookings, server-error redaction, acceptance/version/hash handling, draft handling, and long unbroken text wrapping. Synthetic accepted and draft PDFs were rendered and visually inspected across all 10 pages; text checks verified every source section/clause/list item, accent and peso glyphs, and printable bounds. Generated validation files contain synthetic customer data only and are outside the repository.

## Presentation redesign

The export now uses a branded header, side-by-side renter/motorcycle cards, a pickup/return/duration band, an aligned payment table with a prominent balance, a separate deposit card, and an explicit acceptance panel. Saved instructions and service arrangements are grouped on the detail page. Full terms use two columns with shaded section headings and repeated page references. Document provenance is separated from the agreement wording at the end.

Standard synthetic export: 8 pages (previously 10); long-name/long-email draft stress case: 9 pages. All 28 sections, every clause/list item, Unicode accents/peso symbols, page bounds and draft/acceptance labels were checked after rendering. Auth, version/hash verification, stored amounts and agreement text are unchanged.
