export const OWNER_TOUR_VERSION = 1;
export const ownerTourSteps = [
  {
    id: "overview",
    title: "Start your day here",
    href: "/dashboard",
    topic: "overview",
    summary: "Overview brings today's work into one place.",
    points: [
      "Check today's pickups, returns and overdue rentals first.",
      "Pending verification tells you which documents still need a decision.",
      "Rental payments and refundable security deposits have separate totals.",
    ],
  },
  {
    id: "bookings",
    title: "Find and open a booking",
    href: "/dashboard/bookings",
    topic: "bookings",
    summary: "Bookings is your main reservation list.",
    points: [
      "Search by reference, renter or motorcycle, then open the booking reference.",
      "Expired requests are hidden by default. Choose Expired or All statuses in the filter to see history.",
      "Inside a booking, Next step and Rental readiness tell you what is still needed.",
    ],
  },
  {
    id: "statuses",
    title: "Read the three status columns",
    href: "/dashboard/bookings",
    topic: "statuses",
    summary: "Booking, verification and payment describe different things.",
    points: [
      "Confirmed means the reservation is confirmed; it does not mean the documents are approved or the motorcycle was handed over.",
      "Under Review means a person still needs to assess the documents. Paid means rental payments are recorded.",
      "Expired means an unfinished request passed its deadline. It is not the renter's license expiry date.",
    ],
  },
  {
    id: "verification",
    title: "Review the renter's documents",
    href: "/dashboard/verifications",
    topic: "verification",
    summary: "Use Verification to check identity and driving eligibility.",
    points: [
      "Open the review, inspect the private documents and check the renter details and license validity.",
      "Automated checks are only preliminary. Record the required identity, license and entitlement decisions.",
      "If something is missing, request a replacement or manual review rather than approving an unclear document.",
    ],
  },
  {
    id: "payments",
    title: "Record rental payments correctly",
    href: "/dashboard/bookings",
    topic: "rental-payments",
    summary: "Open the booking and use Rental payment or Manage booking.",
    points: [
      "Record cash only after it has actually been received. The confirmation records an event; it does not collect money.",
      "QRPh payments must show provider verification. A screenshot alone does not establish a successful payment.",
      "Check the remaining rental balance. Security deposits are recorded separately.",
    ],
  },
  {
    id: "deposit",
    title: "Collect cash or an original-ID deposit",
    href: "/dashboard/deposits",
    topic: "deposit-workflow",
    summary:
      "The booking's saved deposit arrangement determines what is required.",
    points: [
      "Open its booking to record cash collection or receipt of the original ID, after physically receiving it.",
      "An ID-deposit option is a requirement choice; it does not mean the ID is already in KJM's custody.",
      "Security Deposits shows held money, deposits awaiting return and unresolved cases.",
    ],
  },
  {
    id: "handover",
    title: "Release the motorcycle",
    href: "/dashboard/bookings",
    topic: "handover",
    summary: "Open the booking's handover inspection when the renter arrives.",
    points: [
      "Complete the required document, payment, deposit and unit-assignment checks.",
      "Record odometer, fuel, condition, existing damage and supplied accessories accurately.",
      "The handover action starts the rental. Confirmed and Active are different stages.",
    ],
  },
  {
    id: "return",
    title: "Receive the bike and close the rental",
    href: "/dashboard/bookings",
    topic: "return",
    summary:
      "Use the return inspection and deposit-return actions on the booking.",
    points: [
      "Record returned condition, fuel, mileage, accessories and any new damage.",
      "Record actual cash returned or the original ID handed back. Resolve any deposit case before completion.",
      "Complete the rental when the required return and deposit checks are satisfied.",
    ],
  },
  {
    id: "contract",
    title: "Give the renter a contract copy",
    href: "/dashboard/bookings",
    topic: "contracts",
    summary: "Open any booking and choose Download contract (PDF).",
    points: [
      "The copy contains the saved rental details, charges, deposit arrangement and full terms.",
      "Recorded online acceptance keeps its original terms version. A booking without it is clearly marked as a draft.",
      "The download does not send an email, sign for anyone or change the booking.",
    ],
  },
  {
    id: "manual",
    title: "Add a walk-in or phone booking",
    href: "/dashboard/bookings/new",
    topic: "manual-bookings",
    summary: "New Booking is for reservations the owner enters directly.",
    points: [
      "Choose the renter, motorcycle, pickup and return times, extras and any delivery arrangements.",
      "Review the quote and any adjustment reason before saving; check the final booking afterward.",
      "An admin-created booking still needs the required driving, payment, deposit and handover checks.",
    ],
  },
  {
    id: "calendar",
    title: "Plan the schedule",
    href: "/dashboard/calendar",
    topic: "calendar",
    summary: "Calendar puts bookings and unit unavailability on a timeline.",
    points: [
      "Switch between day, week and month, then choose the date you need.",
      "Open a reservation for its details; inspect delivery/collection timings before planning a trip.",
      "Date-specific pickup/return closures are managed separately in Settings → Booking rules.",
    ],
  },
  {
    id: "fleet",
    title: "Manage models and actual motorcycles",
    href: "/dashboard/fleet",
    topic: "fleet",
    summary: "A model is the public listing. A unit is an actual motorcycle.",
    points: [
      "Edit the model's description, pricing, specifications and approved images.",
      "Maintain each unit's registration, color and operating status accurately.",
      "Publishing controls the customer listing; it does not create a physical unit or make a busy bike available.",
    ],
  },
  {
    id: "extras",
    title: "Keep accessories available",
    href: "/dashboard/extras",
    topic: "extras",
    summary:
      "Booking Extras manages items such as helmets, raincoats and top boxes.",
    points: [
      "Set item availability, stock quantities, allowed quantities and prices.",
      "Check compatibility and installation readiness where the item requires them.",
      "Existing bookings keep their saved accessory charges; new settings apply to future selections.",
    ],
  },
  {
    id: "customers",
    title: "Look up a renter",
    href: "/dashboard/customers",
    topic: "customers",
    summary: "Customers shows contact information and booking history.",
    points: [
      "Use the booking history to open the relevant reservation.",
      "Review identity documents in Verification, where private document access belongs.",
      "Check the correct renter and reference before sharing a contract copy.",
    ],
  },
  {
    id: "finance",
    title: "Understand payments and balances",
    href: "/dashboard/finance",
    topic: "finance",
    summary:
      "Finance shows recorded rental payments, adjustments and outstanding balances.",
    points: [
      "Separate business records from synthetic test records using the scope controls.",
      "A refund/reversal record documents an adjustment; it is not an automatic transfer of money.",
      "Use Security Deposits for deposit liabilities rather than treating held deposits as rental income.",
    ],
  },
  {
    id: "reports",
    title: "Review business activity",
    href: "/dashboard/reports",
    topic: "reports",
    summary: "Reports summarizes all-time activity and current inventory.",
    points: [
      "Read the all-time business booking and payment totals alongside current unit readiness.",
      "Business booking and financial totals exclude synthetic test records; a separate card counts test bookings.",
      "Open the underlying booking or finance record when a total needs investigation.",
    ],
  },
  {
    id: "hours",
    title: "Control hours and unavailable times",
    href: "/dashboard/settings?section=booking",
    topic: "hours",
    summary:
      "Booking rules controls recurring hours and dated pickup/return blocks.",
    points: [
      "24/7 means renters can choose any exact minute; the normal minimum duration and pricing policy still apply.",
      "Block a start/end period for pickup, return or both, and add an optional internal note.",
      "The block's end time becomes available again. Existing bookings are unchanged, and a rental may span a closure.",
    ],
  },
  {
    id: "deposit-settings",
    title: "Choose deposit options",
    href: "/dashboard/settings?section=deposits",
    topic: "deposit-settings",
    summary: "Security deposit settings controls choices for new bookings.",
    points: [
      "Use Enable ID deposit or Disable ID deposit for the original-ID option.",
      "Cash deposit amount, instructions and cash-policy approval are in the separate cash form.",
      "Changing settings does not rewrite the deposit arrangement saved on an existing booking.",
    ],
  },
  {
    id: "delivery",
    title: "Set delivery areas and fees",
    href: "/dashboard/settings?section=delivery",
    topic: "delivery",
    summary:
      "Delivery & Collection controls the service, areas, fees and hours.",
    points: [
      "Enable the service and save the areas you actually serve, with their delivery and collection fees.",
      "00:00 opening and 00:00 closing means 24/7 service. Pickup/return time blocks still apply.",
      "Disable an area you no longer serve. An area already used by a booking may not be removable.",
    ],
  },
  {
    id: "pricing",
    title: "Manage prices and payment methods",
    href: "/dashboard/settings?section=pricing",
    topic: "pricing",
    summary: "Pricing & payments explains rates and gateway transaction costs.",
    points: [
      "Set model prices from Fleet; review pricing and gateway-cost settings before changing them.",
      "Payment Methods controls cash and verified QRPh availability. A displayed Coming Soon option cannot be enabled here.",
      "Actual rental duration uses selected dates and minutes; billable extra hours can round up under the saved policy.",
    ],
  },
  {
    id: "notifications",
    title: "Check customer and owner messages",
    href: "/dashboard/settings?section=notifications",
    topic: "notifications",
    summary: "Notifications covers customer email and owner Telegram delivery.",
    points: [
      "Open notification history to distinguish pending, sent and failed delivery.",
      "A confirmed booking and a delivered email are separate events; inspect the failure reason if a message is missing.",
      "Review the recipient and event before retrying a failed message to avoid unnecessary duplicates.",
    ],
  },
  {
    id: "security",
    title: "Your guide stays here",
    href: "/dashboard/help",
    topic: "security",
    summary: "Use Help & guide any time you need a reminder.",
    points: [
      "The full guide covers each section, the daily workflow and a status glossary, with search and links.",
      "Replay or resume this walkthrough from the Help button at the top of the dashboard.",
      "Account security in Settings changes the administrator PIN. Keep it private and sign out on shared devices.",
    ],
  },
] as const;
export type OwnerTourProgress = {
  seen: boolean;
  step: number;
  completed: boolean;
};
export function parseOwnerTourProgress(
  value: string | null,
): OwnerTourProgress {
  try {
    const p = JSON.parse(value ?? "null");
    if (
      p?.version === OWNER_TOUR_VERSION &&
      typeof p.seen === "boolean" &&
      typeof p.completed === "boolean" &&
      Number.isInteger(p.step)
    )
      return {
        seen: p.seen,
        step: Math.max(0, Math.min(ownerTourSteps.length - 1, p.step)),
        completed: p.completed,
      };
  } catch {}
  return { seen: false, step: 0, completed: false };
}
export function ownerTourStorageKey(ownerId: string) {
  return `kjm:owner-tour:v${OWNER_TOUR_VERSION}:${ownerId}`;
}
