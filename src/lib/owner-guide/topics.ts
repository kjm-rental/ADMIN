export type GuideTopic = {
  id: string;
  group: string;
  title: string;
  summary: string;
  href: string;
  linkLabel: string;
  steps: string[];
  notes?: string[];
  glossary?: { label: string; meaning: string }[];
};
export const guideGroups = [
  "Basics",
  "Bookings",
  "Daily operations",
  "Fleet & extras",
  "Money",
  "Settings",
] as const;
export const ownerGuideTopics: GuideTopic[] = [
  {
    id: "getting-started",
    group: "Basics",
    title: "Your first day with KJM Admin",
    summary: "Learn the layout and the usual order of work.",
    href: "/dashboard",
    linkLabel: "Open Overview",
    steps: [
      "Use the left navigation to move between sections. On a small screen, use Open navigation; the collapse button gives the workspace more room on desktop.",
      "Start in Overview, check pickups and returns, then open Bookings and Verification for any outstanding work.",
      "Follow this usual sequence: review the reservation → verify documents → record payment and deposit → handover inspection → return inspection → return/resolve the deposit → complete the rental.",
      "Use the Help button at the top to resume or restart the walkthrough. Help & guide opens this reference at any time.",
    ],
    notes: [
      "The walkthrough only opens pages and explains them. It never submits a booking, records money, approves documents or changes a setting.",
      "Your walkthrough progress is remembered for this administrator on this browser. Clearing browser storage or changing devices can show the welcome again. All displayed rental times are Philippine time (Asia/Manila), and amounts are PHP.",
    ],
  },
  {
    id: "overview",
    group: "Basics",
    title: "Overview: what each summary means",
    summary: "The dashboard cards are shortcuts for deciding what to do next.",
    href: "/dashboard",
    linkLabel: "Open Overview",
    steps: [
      "Today's pickups are confirmed bookings scheduled to start today. Today's returns are active rentals scheduled to end today.",
      "Overdue returns are active rentals past their scheduled return time. Contact the renter and inspect the booking before making any change.",
      "Pending requests counts submitted/pending business bookings. Pending verification counts reviews and resubmissions still needing attention.",
      "Total bookings includes business records in all statuses. Confirmed bookings and Active rentals are separate stages.",
      "The deposit cards summarize held cash, deposits awaiting return and unresolved cases. Held deposit money is separate from rental revenue.",
    ],
    notes: [
      "A summary total is not proof that one specific customer paid or passed verification. Open that booking for its individual record.",
    ],
  },
  {
    id: "bookings",
    group: "Bookings",
    title: "Bookings: search, filters and details",
    summary:
      "Find the right reservation and understand its separate status columns.",
    href: "/dashboard/bookings",
    linkLabel: "Open Bookings",
    steps: [
      "Enter a reference, renter name or motorcycle in Search bookings.",
      "Choose Booking status and Verification status, then press Filter.",
      "Hide expired is the default. Select Expired to review timed-out requests, or All statuses (including expired) for the full list.",
      "Open the booking reference to see the renter, exact dates, chosen color/unit, charges, payment history, document readiness and available actions.",
      "Use Next step and Rental readiness for a summary of the checks still required. Manage booking opens the actions for the record.",
    ],
    notes: [
      "Changing a filter does not change any booking. Booking, verification and payment badges are independent.",
    ],
  },
  {
    id: "statuses",
    group: "Bookings",
    title: "Booking status glossary",
    summary:
      "What Draft, Confirmed, Active, Expired and the other booking labels mean.",
    href: "/dashboard/bookings",
    linkLabel: "Review booking statuses",
    steps: [
      "Read the booking status together with the verification and payment columns.",
      "A confirmed reservation can still be unpaid or have documents under review. Complete the handover checks before releasing the bike.",
    ],
    glossary: [
      {
        label: "Draft",
        meaning:
          "A booking record has not completed the submission/finalization workflow.",
      },
      {
        label: "Submitted / Pending",
        meaning:
          "The request is awaiting its next confirmation or completion step. A deadline or temporary inventory hold may apply.",
      },
      {
        label: "Confirmed",
        meaning:
          "The reservation is confirmed with an assigned motorcycle. This does not itself authorize handover.",
      },
      {
        label: "Active",
        meaning:
          "The motorcycle has been handed over and the rental is in progress.",
      },
      {
        label: "Completed",
        meaning: "The rental has passed the required closing steps.",
      },
      {
        label: "Rejected",
        meaning:
          "The request was declined. Inspect the saved reason in the record.",
      },
      {
        label: "Cancelled",
        meaning:
          "The reservation was stopped. Cancellation does not itself prove a refund was paid.",
      },
      {
        label: "Expired",
        meaning:
          "An unfinished pending/submitted request reached its deadline and its temporary reservation was released. Pickup can still be in the future; this is not the license's expiry date.",
      },
    ],
    notes: [
      "To proceed after expiry, create a fresh booking and recheck availability. Do not assume the earlier unit or quote is still reserved.",
    ],
  },
  {
    id: "manage-booking",
    group: "Bookings",
    title: "Manage booking: confirmations and changes",
    summary:
      "Use the record's available actions and check the result after saving.",
    href: "/dashboard/bookings",
    linkLabel: "Choose a booking",
    steps: [
      "Open the reference, then Manage booking or the relevant Quick action.",
      "If assignment/confirmation is available, choose an eligible unit matching the booking and review its availability.",
      "For rescheduling, choose valid new dates/times and review the result. A delivery/collection booking can require service review instead of ordinary rescheduling.",
      "Use cancellation or rejection only for the correct record, and supply the requested reason.",
      "Check the booking status and activity history after a successful action. Existing prerequisites can prevent an action from appearing or saving.",
    ],
    notes: [
      "Cancellation, a document decision, a payment adjustment and a refund are different actions. One does not automatically perform the others.",
    ],
  },
  {
    id: "manual-bookings",
    group: "Bookings",
    title: "New Booking: walk-ins, phone and owner-entered reservations",
    summary:
      "Create a reservation directly without asking the renter to use checkout.",
    href: "/dashboard/bookings/new",
    linkLabel: "Open New Booking",
    steps: [
      "Choose the booking source and enter the renter/contact information carefully.",
      "Select the model or eligible unit, color, pickup and return dates/times, extras and delivery/collection options where needed.",
      "Review the calculated quote. If using a supported price adjustment, record the reason and verify the final amount.",
      "Save only when the details are correct, then open the created record.",
      "Use Edit admin booking when available to update a pending/confirmed owner-entered booking. Complete driving details and private document uploads in the booking's admin controls.",
    ],
    notes: [
      "An owner-entered booking does not bypass document, payment, deposit, inspection or availability requirements. Saving a quote is not the same as receiving money.",
    ],
  },
  {
    id: "contracts",
    group: "Bookings",
    title: "Download a customer's rental contract",
    summary: "Create a printable PDF copy directly from the booking.",
    href: "/dashboard/bookings",
    linkLabel: "Choose a booking to download",
    steps: [
      "Open the booking reference and check the renter and rental dates.",
      "Press Download contract (PDF). Wait for Preparing PDF to finish and open the downloaded file.",
      "Review its booking status, charges, deposit arrangement and agreement record before providing it to the renter.",
      "Download again after a saved booking change if an updated copy is needed.",
    ],
    notes: [
      "Recorded online acceptance uses the original accepted terms version. Without online acceptance, the document is labeled as a draft; no signature is invented.",
      "The PDF reflects the saved booking at generation time. Downloading it neither emails it nor changes the booking. Keep customer copies private.",
    ],
  },
  {
    id: "verification",
    group: "Daily operations",
    title: "Verification: review identity and driving documents",
    summary:
      "The owner's review is separate from automated preliminary checks.",
    href: "/dashboard/verifications",
    linkLabel: "Open Verification",
    steps: [
      "Open a review from the queue and check it against the correct renter and booking.",
      "Inspect the private uploaded identity and license documents. Check names, document clarity, validity dates and motorcycle-driving eligibility.",
      "Record the required identity, license, entitlement and any international-visitor decisions using the available review controls.",
      "When required information is unclear or missing, request a replacement or manual review with a useful reason.",
      "Recheck the booking's readiness after the review. Approval of one check does not necessarily complete every check.",
    ],
    glossary: [
      {
        label: "Missing / Not submitted",
        meaning: "A required document or submission has not been recorded.",
      },
      {
        label: "Submitted / Under Review",
        meaning: "Information is present and still needs the required review.",
      },
      {
        label: "Resubmission required",
        meaning: "The renter must provide a replacement or corrected document.",
      },
      {
        label: "Approved",
        meaning:
          "That particular review/check was approved. Other checks can still be outstanding.",
      },
      {
        label: "Rejected",
        meaning: "The reviewed item was declined; inspect the reason.",
      },
      {
        label: "Not applicable",
        meaning:
          "That specific conditional check is not required for this case.",
      },
    ],
    notes: [
      "OCR or preliminary checks do not prove authenticity or driving eligibility. Replacing a document can require a fresh review. View private identity documents only within the verification workflow.",
    ],
  },
  {
    id: "rental-payments",
    group: "Money",
    title: "Record a cash rental payment",
    summary: "Record money only after receiving and verifying it.",
    href: "/dashboard/bookings",
    linkLabel: "Open a booking's payment controls",
    steps: [
      "Open the booking and check Total, Net paid and the remaining rental balance.",
      "Use Mark Rental as Paid or the available cash payment action in Manage booking.",
      "Verify the amount and requested details, then confirm only after the cash was actually received.",
      "Review the payment event/history and resulting balance after saving.",
    ],
    notes: [
      "This records a cash event. It does not charge a card, withdraw money or create a PayMongo transaction.",
      "Security deposit collection has its own action; do not record deposit cash as rental income.",
    ],
  },
  {
    id: "online-payments",
    group: "Money",
    title: "QRPh: verified payments and payment statuses",
    summary: "Use the provider-verified payment record, not only a screenshot.",
    href: "/dashboard/bookings",
    linkLabel: "Open payment details",
    steps: [
      "Open the booking and inspect QRPh via PayMongo where an online checkout exists.",
      "Look for Paid — verified and the provider transaction/reference details.",
      "If payment is pending, failed, cancelled, or requires reconciliation/review, investigate before treating it as settled.",
      "If the customer reports paying but the record is unresolved, use the supported review/reconciliation workflow or contact the responsible payment operator.",
    ],
    glossary: [
      {
        label: "Unpaid",
        meaning: "No positive net rental payment is recorded.",
      },
      {
        label: "Partially paid",
        meaning: "Recorded net rental payments are below the rental total.",
      },
      {
        label: "Paid",
        meaning:
          "Recorded net rental payments cover the rental total; deposit requirements remain separate.",
      },
      {
        label: "Refunded / Partially refunded",
        meaning: "Refund/reversal events reduce the net recorded payment.",
      },
      {
        label: "Checkout window elapsed",
        meaning:
          "The checkout deadline passed; provider reconciliation can still be required.",
      },
      {
        label: "Payment received — owner review required",
        meaning:
          "A provider payment was received but booking fulfilment needs owner attention.",
      },
    ],
    notes: [
      "A customer screenshot alone is not provider verification. Booking cancellation does not automatically transfer a refund.",
    ],
  },
  {
    id: "deposit-workflow",
    group: "Money",
    title: "Security deposits: collect, hold, return and resolve",
    summary: "Follow the arrangement saved on each booking.",
    href: "/dashboard/deposits",
    linkLabel: "Open Security Deposits",
    steps: [
      "Use Security Deposits to review held cash, deposits awaiting return, unresolved cases and booking links.",
      "Open the booking. Check whether its saved requirement is refundable cash or an original-ID deposit.",
      "After physical receipt, use Mark Deposit as Collected or the available ID-custody action. Confirm the correct amount or document.",
      "On return, inspect the motorcycle and review outstanding issues. Record actual cash returned or original ID handed back.",
      "For a dispute or deduction, use the supported booking/deposit case controls and record a clear reason. Resolve outstanding cases before completing the rental.",
    ],
    notes: [
      "Enabling ID deposits in Settings does not mean an ID was collected. Deposit requirement, money held and document custody are different records.",
      "Changing today's deposit settings does not rewrite existing bookings. Deposit events are separate from rental payments and do not themselves move money.",
    ],
  },
  {
    id: "handover",
    group: "Daily operations",
    title: "Pickup and handover: before the renter rides away",
    summary: "Release the bike only when the booking's readiness checks pass.",
    href: "/dashboard/bookings",
    linkLabel: "Open a booking for handover",
    steps: [
      "Open the confirmed booking. Verify the assigned unit/color and renter's identity.",
      "Finish the required document reviews, rental payment and deposit collection/custody checks.",
      "Open the handover inspection. Enter the actual odometer, fuel level, condition, existing damage and included accessories.",
      "Complete the review/identity confirmations and save the handover when correct.",
      "Check the resulting rental status and inspection history.",
    ],
    notes: [
      "If the handover control is disabled, read the missing-readiness checks instead of changing unrelated fields. A reservation being Confirmed does not mean the motorcycle is already Active.",
    ],
  },
  {
    id: "return",
    group: "Daily operations",
    title: "Return inspection and completion",
    summary:
      "Close the rental with the bike's actual condition and deposit outcome recorded.",
    href: "/dashboard/bookings",
    linkLabel: "Open a returning rental",
    steps: [
      "Open the active rental and its return inspection.",
      "Record actual return mileage, fuel, condition, returned accessories and any new damage. Compare against the pickup record.",
      "Save the return inspection, then review the saved deposit and any open issue.",
      "Record actual cash returned or return of the original ID, and resolve any deposit case using the supported controls.",
      "Complete the rental after all required closing checks pass.",
    ],
    notes: [
      "A scheduled return time passing does not itself complete the rental or return a deposit. Record what happened physically before confirming a cash/ID action.",
    ],
  },
  {
    id: "calendar",
    group: "Daily operations",
    title: "Calendar: dates, commitments and service planning",
    summary: "View reservations by day, week or month.",
    href: "/dashboard/calendar",
    linkLabel: "Open Calendar",
    steps: [
      "Choose Day, Week or Month and the date to inspect.",
      "Review overlapping reservations, unit commitments and any displayed unit-unavailability blocks.",
      "Open the reservation for its full details. Check delivery and collection information when planning staff movements.",
      "For a new dated restriction on customer pickup/return times, use Settings → Booking rules → Block unavailable times.",
    ],
    notes: [
      "A rental occupying a unit and a pickup/return time closure are different restrictions. The calendar is a planning view; the booking workflow still rechecks availability.",
    ],
  },
  {
    id: "fleet",
    group: "Fleet & extras",
    title: "Fleet Management: models versus physical units",
    summary:
      "The public model listing and each actual motorcycle have different roles.",
    href: "/dashboard/fleet",
    linkLabel: "Open Fleet Management",
    steps: [
      "Open a model or create a new listing from Fleet Management.",
      "Maintain the display name, description, model specifications and applicable rental prices. Publish the model when it is ready for customers.",
      "Within the model, add or edit the actual units with their plate numbers and colors.",
      "Use unit Deactivate/Reactivate controls when appropriate and review the confirmation. Removal can be blocked by existing records or commitments.",
      "Check the customer listing after changing published information.",
    ],
    notes: [
      "One model can have several physical units. A published listing does not create a unit, and a booked/inactive bike is not automatically available.",
      "Archiving a model removes it from the active catalog; it is different from deactivating one physical motorcycle.",
    ],
  },
  {
    id: "photos",
    group: "Fleet & extras",
    title: "Model photos and publication",
    summary: "Upload, order and approve customer-facing catalog images.",
    href: "/dashboard/fleet",
    linkLabel: "Choose a model",
    steps: [
      "Open the model and its catalog-image controls.",
      "Use the upload controls with accurate descriptive text and the required rights/source information.",
      "Set the main image and image ordering using the available controls.",
      "Confirm that the image meets the publication/verification requirements, then inspect the public listing.",
    ],
    notes: [
      "An uploaded image is not necessarily published immediately. Only approved, verified catalog media is used on the customer site.",
      "Delete-image controls are destructive; use them only for the image you intend to remove.",
    ],
  },
  {
    id: "extras",
    group: "Fleet & extras",
    title: "Booking Extras: stock, prices and compatibility",
    summary: "Control helmets, raincoats, top boxes and other supplied extras.",
    href: "/dashboard/extras",
    linkLabel: "Open Booking Extras",
    steps: [
      "Add or edit the item with a clear name and the supported price/pricing model.",
      "Set the stock quantity and per-booking limit accurately, and use the active/available controls as appropriate.",
      "For extras that require compatibility or fitting, maintain the supported model/installation settings.",
      "Save, then check how the item appears for a new booking.",
    ],
    notes: [
      "Existing bookings retain their saved item quantities and price snapshots. New availability is checked against inventory and commitments.",
      "Changing a stock setting is not the same as recording accessories physically handed out or returned; the inspection handles that.",
    ],
  },
  {
    id: "customers",
    group: "Daily operations",
    title: "Customers: contact details and booking history",
    summary: "Find a renter's records without browsing private identity files.",
    href: "/dashboard/customers",
    linkLabel: "Open Customers",
    steps: [
      "Review the customer name, contact information, type and country.",
      "Open the relevant booking from their history to see rental-specific details.",
      "Use Verification for private documents and review decisions.",
      "Confirm the renter and booking reference before sharing a contract copy or discussing payments.",
    ],
    notes: [
      "A customer's latest verification label does not replace checking the requirements for the specific booking.",
    ],
  },
  {
    id: "finance",
    group: "Money",
    title: "Finance: net payments, balances and adjustments",
    summary:
      "Understand recorded money without mixing rental income and deposits.",
    href: "/dashboard/finance",
    linkLabel: "Open Finance",
    steps: [
      "Choose Business records or Test records before reading totals.",
      "Review rental payment events, refunds/reversals and outstanding balances.",
      "Open the related booking to investigate a transaction or record an eligible correction/refund event.",
      "Use the actual offline-adjustment workflow with its requested reason/reference and verify the result in history.",
    ],
    notes: [
      "A financial event records an action already verified by the owner; it does not initiate a bank transfer. Saved financial events cannot simply be edited like a text field.",
      "Unverified payment intents and booking quotes are not received income. Refundable cash deposits are tracked separately under Security Deposits.",
    ],
  },
  {
    id: "reports",
    group: "Money",
    title: "Reports: all-time summaries",
    summary:
      "Review the business's overall booking, payment and inventory picture.",
    href: "/dashboard/reports",
    linkLabel: "Open Reports",
    steps: [
      "Read Business bookings, Physical units and Net recorded payments.",
      "Use the booking-status distribution to understand how business reservations are split across statuses.",
      "Review current fleet readiness separately from the financial totals.",
      "Open Bookings, Finance or Fleet for the underlying records when a total needs investigation.",
    ],
    notes: [
      "This screen is an all-time, read-only report, not a date-filtered statement. Business booking/financial totals exclude synthetic records; a separate card counts test bookings.",
      "Current unit readiness is not a forecast of availability for an arbitrary future date.",
    ],
  },
  {
    id: "hours",
    group: "Settings",
    title: "Booking rules: 24/7 hours and unavailable time blocks",
    summary:
      "Allow exact customer times while closing dates/times you cannot serve.",
    href: "/dashboard/settings?section=booking",
    linkLabel: "Open Booking rules",
    steps: [
      "Use Set all hours to 24/7 to open pickup, return, delivery and collection hours. Existing dated blocks remain.",
      "To close a specific period, enter From and Until in Philippine time, choose Pickup, Return or Both, and optionally add an internal note.",
      "Press Block these times. Review the Upcoming blocks list to confirm the interval.",
      "Use Remove block to reopen the selected interval.",
      "For recurring restrictions, edit Weekly pickup and return hours. Opening 00:00 and closing 00:00 means a full 24-hour day; a midnight closing time is the end of that business day.",
    ],
    notes: [
      "Blocks prevent new pickup/delivery and/or return/collection endpoints inside the interval. The exact end time becomes available again.",
      "Existing bookings are not rewritten. A rental can start before a closure and finish afterward if its own pickup/return endpoints remain allowed.",
    ],
  },
  {
    id: "pricing",
    group: "Settings",
    title: "Rates, exact duration and hourly extensions",
    summary:
      "Separate actual elapsed rental time from how extra time is billed.",
    href: "/dashboard/settings?section=pricing",
    linkLabel: "Open Pricing & payments",
    steps: [
      "Maintain model rental prices in Fleet. Use Pricing & payments for its pricing links and provider cost profiles.",
      "Customers type an exact hour/minute and choose AM or PM. 12 AM is midnight; 12 PM is noon. 07:25 PM means 7:25 in the evening.",
      "Duration is calculated from the selected pickup/return instants. For example, next-day 02:17 to 03:43 is 1 day + 1 hour + 26 minutes.",
      "In Booking rules, review the rental-day and hourly-extension policy. A partial billable extra hour can round up; the displayed elapsed duration still shows actual minutes.",
      "Gateway cost profiles estimate provider costs. They do not enable a payment method or automatically add a customer charge.",
    ],
    notes: [
      "The minimum rental is 24 hours. A configured maximum hourly extension can restrict which longer periods are allowed.",
      "Always review the saved quote/booking total; changing a rate is not the same as changing an already saved booking.",
    ],
  },
  {
    id: "delivery",
    group: "Settings",
    title: "Delivery & Collection: service areas, fees and hours",
    summary: "Configure where the team can bring or collect motorcycles.",
    href: "/dashboard/settings?section=delivery",
    linkLabel: "Open Delivery & Collection",
    steps: [
      "Use the service checkbox and save delivery settings to enable/disable the service.",
      "Set delivery and collection hours independently. Set both open and close to 00:00 for 24/7 service.",
      "Add/edit the actual service areas, their delivery/collection fees and whether each area is enabled.",
      "Save each area form. Disable an old area if it should no longer be selectable.",
      "Check the customer's booking for its chosen address, area and scheduled service time.",
    ],
    notes: [
      "Pickup/return time blocks still apply. Delivery/collection fees are separate quoted service charges.",
      "An area referenced by a booking may not be removable; disabling preserves the saved booking history.",
    ],
  },
  {
    id: "payment-methods",
    group: "Settings",
    title: "Payment Methods: cash and verified QRPh",
    summary: "Control which supported payment choices customers may use.",
    href: "/dashboard/settings?section=methods",
    linkLabel: "Open Payment Methods",
    steps: [
      "Review cash and QRPh availability in Payment Methods.",
      "Only enable supported online methods when their live-readiness requirements are satisfied.",
      "Keep at least one usable method available and save the form.",
      "Treat options labeled Coming Soon as unavailable rather than as enabled checkout choices.",
    ],
    notes: [
      "Editing a gateway transaction-cost profile is not payment activation. Security deposit collection is a separate booking arrangement.",
    ],
  },
  {
    id: "deposit-settings",
    group: "Settings",
    title: "Deposit settings: cash amount and one-button ID option",
    summary: "Set the choices and instructions offered on future bookings.",
    href: "/dashboard/settings?section=deposits",
    linkLabel: "Open Security deposit settings",
    steps: [
      "Use Enable ID deposit or Disable ID deposit for the original-ID choice.",
      "In the separate cash form, set whether cash is enabled, its amount, and the collection/return/dispute instructions.",
      "Review the requested cash-policy approval and partial-return choice before saving.",
      "Check a new booking to confirm the available choices and amount.",
    ],
    notes: [
      "Existing bookings keep the requirement saved when they were created. Changing these settings does not record cash receipt, ID custody or a refund.",
    ],
  },
  {
    id: "booking-policy",
    group: "Settings",
    title: "Booking rules: public-booking switch and policy fields",
    summary: "Understand draft settings, approval and request deadlines.",
    href: "/dashboard/settings?section=booking",
    linkLabel: "Review booking policy",
    steps: [
      "Review the rental-day calculation, pending-request expiration and temporary hold durations.",
      "Maintain accepted identification types, local/international license instructions and the reviewed source/date where required.",
      "Keep customer-facing privacy and document-retention instructions accurate.",
      "Review the approval and public-booking controls before saving. Saving an incomplete draft can leave public booking disabled.",
      "Technical readiness checks report configured verification evidence; saving a business policy does not mark those checks passed.",
    ],
    notes: [
      "Restricted booking testers is an advanced, time-limited test authorization for a dedicated existing account. It does not grant administrator access or open public booking.",
      "Short request deadlines can cause unfinished requests to expire even before the scheduled pickup date.",
    ],
  },
  {
    id: "notifications",
    group: "Settings",
    title: "Notifications: customer email and owner Telegram",
    summary: "Understand queued, sent and failed transactional messages.",
    href: "/dashboard/settings?section=notifications",
    linkLabel: "Open Notifications",
    steps: [
      "Review Telegram configuration/status and the notification settings shown in this section.",
      "Open Notifications delivery/history for customer email and owner alert records.",
      "For a missing message, find the correct booking/event and inspect whether it is pending, sent, failed or held.",
      "Read the failure reason and check the recipient/configuration before using an available retry control.",
      "For a customer email marked sent, ask the customer to check the address and spam folder as well.",
    ],
    notes: [
      "Background delivery may take time. A confirmed booking does not itself prove an email reached the inbox.",
      "A sent status records provider acceptance, not a guarantee of inbox placement. Avoid repeated retries without checking existing delivery history.",
    ],
  },
  {
    id: "security",
    group: "Settings",
    title: "Account security and signing out",
    summary: "Protect access to private bookings and customer documents.",
    href: "/dashboard/settings?section=security",
    linkLabel: "Open Account security",
    steps: [
      "To change the administrator PIN, enter the current PIN, the new four-digit PIN and the matching confirmation.",
      "Save the change and keep the new PIN private.",
      "Use Sign out from the sidebar when finished on a shared device.",
      "Reopen this guide through Help & guide. Replay the walkthrough from the Help button in the top bar.",
    ],
    notes: [
      "Do not include the PIN in customer messages, screenshots or contract copies. Walkthrough progress is local to this administrator/browser; it is not a booking or financial record.",
    ],
  },
  {
    id: "troubleshooting",
    group: "Basics",
    title: "Why is a button disabled or an action failing?",
    summary: "Follow the visible prerequisites instead of guessing.",
    href: "/dashboard/bookings",
    linkLabel: "Check a booking's readiness",
    steps: [
      "Confirm you opened the right booking and check its current status.",
      "Read Next step, Rental readiness, and the action's own error or missing-check message.",
      "Check unit assignment/availability, document approval, required rental payment and deposit receipt/custody.",
      "For returns, check that inspection, deposit return and any unresolved case have been handled.",
      "After a save, wait for the success/error feedback and inspect the updated record before clicking the same action again.",
    ],
    notes: [
      "Some actions intentionally stop on an expired/terminal booking or a schedule conflict. A disabled action is not permission to skip a required check.",
      "If a page cannot load, refresh and try again. If the problem persists, keep the reference and visible error for the person maintaining the site; do not share the PIN.",
    ],
  },
  {
    id: "daily-checklist",
    group: "Daily operations",
    title: "A practical daily checklist",
    summary: "A repeatable routine from first booking to final return.",
    href: "/dashboard",
    linkLabel: "Start from Overview",
    steps: [
      "Morning: review today's pickups, returns, overdue rentals and pending document reviews.",
      "Before pickup: confirm the reference, unit/color, exact time/location, documents, rental balance and deposit arrangement.",
      "At pickup: receive/record actual money or original ID, inspect the bike and accessories, then save handover.",
      "During the day: use Calendar for movements and inspect new booking/notification records.",
      "At return: inspect condition, fuel, mileage and accessories; resolve issues, return/record the deposit or ID, and complete the rental.",
      "End of day: reconcile recorded rental payments in Finance and held/awaiting-return deposits in Security Deposits.",
    ],
  },
];
