# Admin logo and layout correction

Implemented only ADMIN logo/layout changes. No Supabase changes, migrations, booking/payment changes, public-booking changes or deployment were performed.

The recent logo integration supplied the original 1164×1351 dimensions and relied on Tailwind utility widths. Without those styles, the browser could show the logo at its enormous intrinsic size. The reported visible skip link is also consistent with missing dashboard styles. Fresh localhost requests currently load the stylesheet successfully; the precise failure in the owner's signed-in browser could not be inspected because Computer Use permissions are not granted.

## Changes

- Sidebar logo has display dimensions 56×65, inline 56px width / 160px maximum width / 72px maximum height, auto height and object-fit contain. Dedicated CSS bounds no longer depend on Tailwind utilities. A small ivory backing preserves contrast on the teal sidebar without changing artwork.
- Collapsed desktop navigation renders a compact motorcycle icon and does not render the full logo in its sidebar.
- Sign-in branding now also uses bounded display dimensions and dedicated CSS, with a 160px maximum width and 190px maximum height.
- Dashboard styles are imported directly by the root layout, independently of Tailwind's stylesheet import processing.
- Skip link is translated offscreen until focused, has visible keyboard focus and correctly transfers focus to the workspace. Workspace scroll margin keeps its heading below the sticky topbar.
- Official PNG bytes match the supplied original in both apps. KJM MAIN and Phase 10 email template source were not changed by this correction.

Exact application files changed:

1. src/components/admin-shell.tsx
2. src/app/sign-in/page.tsx
3. src/app/admin-design.css
4. src/app/globals.css
5. src/app/layout.tsx

## Verification

TypeScript, ESLint, all **204 automated tests**, and production build passed. Browser checks passed at **360, 390, 768, 1024 and 1440px**: normal overview cards/sidebar/topbar/buttons, bounded logos, mobile navigation, collapsed compact icon, no horizontal page overflow, hidden-by-default skip link, keyboard focus/activation and zero automated WCAG violations. Removing all CSS in the isolated test still leaves the sidebar logo at 56px wide.

Actual localhost:3001 sign-in and CSS were inspected through an isolated browser. The protected dashboard correctly redirects an unauthenticated browser. The owner offered an existing signed-in session, but the browser-control tool returned “Computer Use permissions are not granted.” No credentials/session cookies were accessed or authentication bypassed. **Authenticated live-dashboard inspection remains unexecuted.** Screenshots show the actual dashboard component/layout source using synthetic fixtures and CSS fetched from localhost:3001; they are not production records or proof of an authenticated session.

KJM MAIN was checked at all five widths: 48/56px header logo, no page overflow. Phase 10 email templates have no reference to this logo asset, so this change cannot enlarge them.

Screenshots: dashboard-1440.png, dashboard-390.png, additional 360/768/1024px captures, and collapsed-1024/1440px captures. browser-results.json contains detailed results. Repeatable isolated review: http://127.0.0.1:3022/dashboard (synthetic records, submissions disabled).

Remaining owner check: reload localhost:3001/dashboard in the signed-in browser and confirm the corrected layout. If CSS still fails there, inspect that browser's blocked/failed stylesheet requests; current server requests return HTTP 200 with the expected admin layout, logo and skip-link rules.
