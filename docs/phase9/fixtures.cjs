const now = new Date(),
  start = new Date(now.getTime() + 3600000).toISOString(),
  end = new Date(now.getTime() + 86400000).toISOString(),
  created = now.toISOString();
const models = [
  {
    id: "model-demo",
    brand: "Demo brand",
    model_name: "Sample motorcycle",
    display_name: "Sample motorcycle · preview",
    slug: "sample-motorcycle",
    generation: "Preview",
    daily_rate_php: 500,
    is_published: false,
    archived_at: null,
    notable_features: [],
    created_at: created,
  },
];
const customers = [
  {
    id: "customer-demo",
    full_name: "Sample customer",
    email: "preview@example.invalid",
    phone: null,
    country_of_residence: "Philippines",
    customer_type: "local_resident",
    created_at: created,
  },
];
const bookings = ["pending", "confirmed", "active"].map((status, i) => ({
  id: `booking-demo-${i}`,
  booking_reference: `PREVIEW-00${i + 1}`,
  customer_id: "customer-demo",
  motorcycle_model_id: "model-demo",
  motorcycle_unit_id: i ? "unit-demo-" + i : null,
  start_at:
    i === 2 ? new Date(now.getTime() - 2 * 86400000).toISOString() : start,
  end_at: i === 2 ? new Date(now.getTime() - 3600000).toISOString() : end,
  status,
  quoted_total_php: 500,
  base_total_php: 500,
  extras_total_php: 0,
  total_centavos: 50000,
  is_test: false,
  created_at: created,
}));
const units = ["available", "reserved", "rented", "maintenance"].map(
  (status, i) => ({
    id: `unit-demo-${i}`,
    motorcycle_model_id: "model-demo",
    internal_unit_code: `DEMO-${i}`,
    status,
    archived_at: null,
  }),
);
const verifications = bookings.map((b, i) => ({
  id: `verification-demo-${i}`,
  booking_id: b.id,
  customer_id: "customer-demo",
  customer_type: "local_resident",
  overall_status: i ? "approved" : "submitted",
  identity_status: i ? "approved" : "submitted",
  license_status: i ? "approved" : "submitted",
  entitlement_status: i ? "approved" : "submitted",
  created_at: created,
}));
module.exports = {
  motorcycle_models: models,
  customers,
  bookings,
  motorcycle_units: units,
  customer_verifications: verifications,
  payment_events: [
    {
      id: "event-demo",
      booking_id: "booking-demo-1",
      event_type: "payment",
      amount_centavos: 20000,
      method: "cash",
      transaction_reference: "PREVIEW ONLY",
      occurred_at: created,
      created_at: created,
      is_test: false,
      internal_notes: "Sample event · no real payment",
    },
  ],
  booking_extras_catalog: [
    {
      id: "extra-demo",
      name: "Sample rental extra",
      description: "Preview content only",
      price_php: 100,
      price_centavos: 10000,
      pricing_model: "per_rental",
      total_quantity: 5,
      max_per_booking: 1,
      is_active: true,
      is_available: true,
      display_order: 0,
      image_path: null,
    },
  ],
  booking_inventory_holds: [],
  motorcycle_media: [],
  pricing_rules: [],
  verification_documents: [],
  booking_status_history: [],
  booking_extra_items: [],
  booking_settings: [],
  booking_readiness_checks: [],
  motorcycle_unavailability: [],
  audit_logs: [],
};

// Offline only: never connected to Supabase. Synthetic amounts are not business policy.
module.exports.bookings.forEach((b) => (b.rental_workflow_version = 9));
module.exports.security_deposit_settings = [
  {
    id: true,
    cash_enabled: true,
    cash_amount_centavos: 12345,
    cash_policy_approved_at: created,
    id_enabled: false,
    id_legal_approved_at: null,
    id_legal_reference: "",
    accepted_document_types: [],
    collection_instructions: "Synthetic offline collection policy",
    return_instructions: "Synthetic offline return policy",
    dispute_instructions: "Synthetic offline dispute policy",
    partial_cash_return_allowed: false,
    updated_at: created,
    updated_by: null,
  },
];
module.exports.booking_deposits = bookings.map((b) => ({
  booking_id: b.id,
  option: "cash",
  required_centavos: 12345,
  document_type: null,
  partial_return_allowed: false,
  collection_instructions: "Synthetic offline collection policy",
  return_instructions: "Synthetic offline return policy",
  dispute_instructions: "Synthetic offline dispute policy",
  policy_version: created,
  legal_reference: null,
  is_test: false,
  created_at: created,
}));
module.exports.security_deposit_events = [
  {
    id: "deposit-demo",
    sequence: 1,
    booking_id: "booking-demo-2",
    event_type: "cash_collected",
    amount_centavos: 12345,
    occurred_at: created,
    recorded_at: created,
    recorded_by: "offline-sample-administrator",
    notes: "OFFLINE FIXTURE ONLY",
    is_test: false,
  },
];
module.exports.rental_inspections = [
  {
    id: "inspection-demo",
    booking_id: "booking-demo-2",
    kind: "handover",
    occurred_at: created,
    odometer_km: 100,
    fuel_percent: 75,
    condition_notes: "Synthetic checked condition",
    accessories_notes: "Synthetic checked accessories",
    existing_damage_notes: "None observed in offline sample",
    new_damage_notes: "None observed in offline sample",
    recorded_by: "offline-sample-administrator",
    is_test: false,
  },
];
