export const eventCatalog = {
  payment_successful: {
    title: "QRPh payment received",
    subject: "KJM QRPh Payment Received",
    heading: "Payment received",
    body: "Your rental and service payment was verified by PayMongo. Booking confirmation and handover requirements remain separate. The refundable security deposit is collected separately in cash.",
  },
  document_checks_passed: {
    title: "Document Checks Passed",
    subject: "KJM preliminary document checks passed",
    heading: "Document Checks Passed",
    body: "Preliminary checks passed. Authenticity, identity ownership and motorcycle license eligibility still require authorized approval.",
  },
  verification_manual_review: {
    title: "Identity manual review",
    subject: "KJM identity review in progress",
    heading: "Identity review in progress",
    body: "Authorized review is required. This is not approval or rejection.",
  },
  verification_approved: {
    title: "Identity verified",
    subject: "KJM identity verification approved",
    heading: "Verification approved",
    body: "Your identity review has been approved. All remaining handover requirements still apply.",
  },
  verification_rejected: {
    title: "Identity rejected",
    subject: "KJM identity verification update",
    heading: "Verification rejected",
    body: "Sign in to your booking for the recorded decision and next steps. Do not email identity documents.",
  },
  admin_verification_review: {
    title: "Customer documents received",
    subject: "KJM documents received",
    heading: "Documents ready for review",
    body: "Review private documents in the secure dashboard.",
  },
  admin_manual_review: {
    title: "Manual review required",
    subject: "KJM manual review required",
    heading: "Manual review required",
    body: "Check the current verification status in the secure dashboard.",
  },
  booking_requested: {
    title: "Booking request received",
    subject: "KJM Motorcycle Rental — Booking Request Received",
    heading: "🛵 NEW BOOKING REQUEST",
    body: "We received your request. It is pending administrator approval and is not yet confirmed.",
  },
  booking_approved: {
    title: "Your ride is confirmed",
    subject: "Your KJM Motorcycle Booking Is Confirmed",
    heading: "✅ BOOKING APPROVED",
    body: "Your booking is confirmed! Your motorcycle has been reserved for your selected dates. Document approval is required before motorcycle pickup. Confirmation does not mean payment has been received. Rental payment is due in cash at motorcycle collection.",
  },
  booking_rejected: {
    title: "An update on your request",
    subject: "Update on Your KJM Booking Request",
    heading: "BOOKING REJECTED",
    body: "We are unable to approve this booking request. Please contact KJM if you would like help planning another ride.",
  },
  verification_review: {
    title: "Document review required",
    subject: "Document review required",
    heading: "📋 DOCUMENT REVIEW REQUIRED",
    body: "Documents are ready for authorized administrator review.",
  },
  verification_action: {
    title: "A little more information",
    subject: "Additional Information Needed for Your KJM Booking",
    heading: "📋 VERIFICATION ACTION REQUIRED",
    body: "Additional verification information is needed. Please contact KJM for the next steps. Do not reply with identity documents.",
  },
  booking_cancelled: {
    title: "Your booking is cancelled",
    subject: "Your KJM Booking Has Been Cancelled",
    heading: "BOOKING CANCELLED",
    body: "Your booking has been cancelled. Any outstanding rental or security deposit matters remain subject to their recorded status.",
  },
  pickup_reminder: {
    title: "Your island ride is coming up",
    subject: "Your KJM Motorcycle Pickup Is Coming Up",
    heading: "📍 UPCOMING PICKUP",
    body: "Your approved pickup is coming up. Prepare for the required identity and driving eligibility checks. Rental payment is cash on pickup.",
  },
  pickup_summary: {
    title: "Today's scheduled pickup",
    subject: "Today's scheduled pickup",
    heading: "📍 MOTORCYCLE PICKUP TODAY",
    body: "An approved motorcycle pickup is scheduled today.",
  },
  handover: {
    title: "Enjoy your ride with KJM",
    subject: "Enjoy Your Ride with KJM!",
    heading: "🛵 MOTORCYCLE HANDOVER",
    body: "Motorcycle collection has been recorded. Enjoy your ride around Mactan and Cebu, and plan to return at the scheduled time.",
  },
  return_reminder: {
    title: "Your return is coming up",
    subject: "Your KJM Motorcycle Return Is Coming Up",
    heading: "UPCOMING RETURN",
    body: "Your motorcycle return is coming up. Please allow time for the return inspection.",
  },
  overdue: {
    title: "Overdue rental",
    subject: "Overdue rental",
    heading: "⏰ OVERDUE RENTAL",
    body: "The recorded return time has passed and the rental remains active. Review the booking in KJM ADMIN.",
  },
  returned: {
    title: "Thank you for riding with KJM",
    subject: "Thank You for Riding with KJM",
    heading: "🏁 MOTORCYCLE RETURNED",
    body: "The motorcycle return inspection has been recorded. This message does not confirm that all financial or deposit obligations are settled.",
  },
  cash_payment: {
    title: "Cash payment receipt",
    subject: "KJM Motorcycle Rental — Payment Receipt",
    heading: "💵 CASH PAYMENT RECEIVED",
    body: "An authorized administrator has recorded the cash rental payment below. Security deposits are accounted for separately.",
  },
  deposit_collected: {
    title: "Your security deposit receipt",
    subject: "KJM Motorcycle Rental — Cash Security Deposit Receipt",
    heading: "🔐 SECURITY DEPOSIT COLLECTED",
    body: "The cash security deposit below has been recorded as collected. It is separate from rental payment and is refundable under your approved rental terms.",
  },
  deposit_returned: {
    title: "Security deposit return recorded",
    subject: "KJM Motorcycle Rental — Deposit Return Confirmation",
    heading: "🔐 SECURITY DEPOSIT RETURNED",
    body: "The deposit amount below has been recorded as returned. This confirms this specific return, not any remaining balance.",
  },
  deposit_unresolved: {
    title: "Deposit resolution required",
    subject: "Deposit resolution required",
    heading: "🔐 DEPOSIT UNRESOLVED",
    body: "A deposit resolution case remains open. Review its recorded liability in KJM ADMIN.",
  },
  id_custody: {
    title: "Custody status updated",
    subject: "Custody status updated",
    heading: "🔐 CUSTODY STATUS UPDATED",
    body: "A generic, approved document custody status event was recorded. Review the authorized booking record; no identity details are included here.",
  },
} as const;
export type NotificationEvent = keyof typeof eventCatalog;
export type Channel = "telegram" | "resend";
export type NotificationStatus =
  | "pending"
  | "processing"
  | "sent"
  | "retry_scheduled"
  | "failed_permanently"
  | "cancelled";
export type NotificationPayload = {
  bookingId: string;
  reference: string;
  motorcycle: string;
  pickupAt: string;
  returnAt: string;
  rentalCentavos: number;
  delivery?: { address: string; areaName?: string; scheduledAt: string } | null;
  collection?: {
    address: string;
    areaName?: string;
    scheduledAt: string;
  } | null;
  deliveryFeeCentavos?: number;
  collectionFeeCentavos?: number;
  paymentMethod?: "cash" | "qrph";
  paymentStatus?: "paid" | "unpaid";
  rentalPricing?: unknown;
  depositOption: string;
  depositCentavos: number | null;
  amountCentavos: number | null;
  status: string;
  verificationStatus?: string;
};
export type OutboxRow = {
  id: string;
  event_key: string;
  booking_id: string;
  booking_reference: string;
  event_type: NotificationEvent;
  channel: Channel;
  recipient_reference: string;
  template_version: number;
  payload: NotificationPayload;
  is_test: boolean;
  status: NotificationStatus;
  attempt_count: number;
  manual_retry_count: number;
  available_at: string;
  created_at: string;
  first_attempt_at: string | null;
  last_attempt_at: string | null;
  delivered_at: string | null;
  lease_token: string | null;
  lease_until: string | null;
  request_hash: string | null;
  provider_reference: string | null;
  last_error: string | null;
  simulated: boolean;
};
export type NotificationSettings = {
  id: boolean;
  telegram_enabled: boolean;
  resend_enabled: boolean;
  enabled_events: string[];
  reminders_approved: boolean;
  pickup_hours: number;
  return_hours: number;
  morning_hour: number;
  updated_at: string;
  updated_by: string | null;
};
export type GenerationError = {
  id: string;
  booking_id: string | null;
  source: string;
  sql_state: string;
  event_key: string | null;
  event_type: string | null;
  amount_centavos: number | null;
  staff_only: boolean | null;
  recovered_at: string | null;
  created_at: string;
};
export type DeliveryResult = {
  outcome:
    | "sent"
    | "transient"
    | "rate_limited"
    | "provider_rejected"
    | "delivery_ambiguous"
    | "configuration"
    | "invalid_recipient"
    | "request_changed"
    | "unsupported_template";
  providerReference?: string;
  retrySeconds?: number;
  simulated?: boolean;
};
export type DeliveryMessage = {
  channel: Channel;
  eventId: string;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  telegramText: string;
  telegramAdminUrl?: string;
  isTest: boolean;
};
