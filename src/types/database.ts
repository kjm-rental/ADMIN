import type {
  OutboxRow,
  NotificationSettings,
  GenerationError,
} from "@/lib/notifications/types";
import type {
  DepositSettings,
  BookingDeposit,
  DepositEvent,
  RentalInspection,
} from "./rental";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      booking_admin_details: {
        Row: {
          booking_id: string;
          created_by: string;
          source: string;
          internal_notes: string;
          adjustment: Json;
          confirmation_reason: string;
          revision: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_settings: {
        Row: NotificationSettings;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_outbox: {
        Row: OutboxRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_generation_errors: {
        Row: GenerationError;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      security_deposit_settings: {
        Row: DepositSettings;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      booking_deposits: {
        Row: BookingDeposit;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      security_deposit_events: {
        Row: DepositEvent;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      rental_inspections: {
        Row: RentalInspection;
        Insert: never;
        Update: never;
        Relationships: [];
      };

      motorcycle_models: {
        Row: {
          hourly_extension_rate_php?: number | null;
          id: string;
          slug: string;
          brand: string;
          model_name: string;
          display_name: string;
          engine_cc: number | null;
          description: string | null;
          generation: string | null;
          model_year: string | null;
          exact_model_name: string | null;
          transmission: string | null;
          fuel_tank_capacity_liters: number | null;
          cooling_system: string | null;
          starting_system: string | null;
          braking_system: string | null;
          category: string | null;
          notable_features: Json;
          specification_status: string;
          specification_note: string;
          specification_source_url: string | null;
          archived_at: string | null;
          daily_rate_php: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["motorcycle_models"]["Row"]
        > & {
          slug: string;
          brand: string;
          model_name: string;
          display_name: string;
          daily_rate_php: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["motorcycle_models"]["Row"]
        >;
        Relationships: [];
      };
      motorcycle_units: {
        Row: {
          id: string;
          motorcycle_model_id: string;
          internal_unit_code: string;
          registration_plate: string | null;
          color: string | null;
          status: string;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["motorcycle_units"]["Row"]
        > & { motorcycle_model_id: string; internal_unit_code: string };
        Update: Partial<
          Database["public"]["Tables"]["motorcycle_units"]["Row"]
        >;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          auth_user_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          country_of_residence: string | null;
          customer_type: string | null;
          notes: string | null;
          is_test: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      bookings: {
        Row: {
          manual_adjustment_php?: number;
          rental_pricing?: Json | null;
          id: string;
          booking_reference: string;
          selected_color: string | null;
          customer_id: string;
          motorcycle_unit_id: string | null;
          motorcycle_model_id: string | null;
          start_at: string;
          end_at: string;
          status: string;
          quoted_total_php: number;
          pricing_daily_rate_php: number | null;
          pricing_units: number | null;
          submitted_at: string | null;
          approved_by: string | null;
          handover_at: string | null;
          handover_by: string | null;
          returned_at: string | null;
          returned_by: string | null;
          idempotency_key: string | null;
          expires_at: string | null;
          status_reason: string | null;
          is_test: boolean;
          base_total_php: number;
          extras_total_php: number;
          base_total_centavos: number;
          extras_total_centavos: number;
          fees_total_centavos: number;
          deposit_required_centavos: number | null;
          rental_workflow_version?: number;
          total_centavos: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      booking_extras_catalog: {
        Row: {
          compatible_unit_ids?: string[];
          compatible_model_ids?: string[];
          id: string;
          name: string;
          description: string | null;
          price_php: number;
          price_centavos: number;
          is_available: boolean;
          is_active: boolean;
          pricing_model: string;
          total_quantity: number;
          max_per_booking: number;
          image_path: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          compatible_unit_ids?: string[];
          compatible_model_ids?: string[];
          id?: string;
          name: string;
          description?: string | null;
          price_php: number;
          is_available?: boolean;
          display_order?: number;
          is_active?: boolean;
          pricing_model?: string;
          total_quantity?: number;
          max_per_booking?: number;
          image_path?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["booking_extras_catalog"]["Insert"]
        >;
        Relationships: [];
      };
      booking_extra_items: {
        Row: {
          id: string;
          booking_id: string;
          extra_id: string | null;
          name_snapshot: string;
          price_php_snapshot: number;
          quantity: number;
          pricing_model_snapshot: string;
          charged_units: number;
          unit_price_centavos_snapshot: number;
          line_total_centavos: number;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      booking_status_history: {
        Row: {
          id: string;
          booking_id: string;
          old_status: string | null;
          new_status: string;
          changed_by: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          id: string;
          motorcycle_model_id: string;
          rule_name: string;
          pricing_type: string;
          amount_php: number;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
        };
        Insert: Partial<
          Database["public"]["Tables"]["pricing_rules"]["Row"]
        > & {
          motorcycle_model_id: string;
          rule_name: string;
          pricing_type: string;
          amount_php: number;
        };
        Update: Partial<Database["public"]["Tables"]["pricing_rules"]["Row"]>;
        Relationships: [];
      };
      motorcycle_unavailability: {
        Row: {
          id: string;
          motorcycle_unit_id: string;
          start_at: string;
          end_at: string;
          reason: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      motorcycle_media: {
        Row: {
          id: string;
          motorcycle_model_id: string;
          storage_path: string;
          alt_text: string;
          sort_order: number;
          is_primary: boolean;
          media_kind: string;
          license_status: string;
          license_source_url: string | null;
          license_note: string | null;
          verification_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["motorcycle_media"]["Row"]
        > & {
          motorcycle_model_id: string;
          storage_path: string;
          alt_text: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["motorcycle_media"]["Row"]
        >;
        Relationships: [];
      };
      payment_gateway_fee_settings: {
        Row: {
          id: string;
          provider: "paymongo" | "maya";
          payment_method: "card" | "gcash" | "maya";
          percentage_basis_points: number;
          flat_fee_centavos: number;
          notes: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      booking_settings: {
        Row: {
          max_hourly_extension_hours?: number | null;
          id: boolean;
          timezone: string;
          operating_hours: Json | null;
          partial_day_policy: string | null;
          pending_hold_minutes: number | null;
          accepted_philippine_id_types: Json;
          international_policy_source_url: string | null;
          international_policy_verified_at: string | null;
          privacy_notice: string | null;
          retention_policy: string | null;
          public_booking_enabled: boolean;
          partial_day_pricing_policy: string | null;
          pending_expiration_minutes: number | null;
          philippine_license_policy: string | null;
          international_license_policy: string | null;
          international_manual_review_required: boolean;
          policies_approved_at: string | null;
          policies_approved_by: string | null;
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["booking_settings"]["Row"]
        >;
        Update: Partial<
          Database["public"]["Tables"]["booking_settings"]["Row"]
        >;
        Relationships: [];
      };
      customer_verifications: {
        Row: {
          id: string;
          booking_id: string;
          customer_id: string;
          customer_type: string;
          identity_status: string;
          license_status: string;
          entitlement_status: string;
          international_status: string;
          overall_status: string;
          document_check_status?: string;
          document_risk_level?: number | null;
          document_review_reasons?: Json;
          document_check_id?: string | null;
          license_issuing_country: string | null;
          license_expiration_date: string | null;
          permitted_vehicle_categories: string | null;
          philippines_entry_date: string | null;
          identity_name: string | null;
          license_name: string | null;
          customer_declaration_at: string | null;
          privacy_consent_at: string | null;
          reviewer_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Partial<
          Database["public"]["Tables"]["customer_verifications"]["Row"]
        >;
        Relationships: [];
      };
      verification_documents: {
        Row: {
          id: string;
          verification_id: string;
          booking_id: string;
          owner_user_id: string;
          document_kind: string;
          storage_path: string;
          mime_type: string;
          size_bytes: number;
          status: string;
          replaced_at: string | null;
          is_test: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Partial<
          Database["public"]["Tables"]["verification_documents"]["Row"]
        >;
        Relationships: [];
      };
      verification_reviews: {
        Row: {
          id: string;
          verification_id: string;
          document_id: string | null;
          review_type: string;
          result: string;
          reason: string | null;
          reviewer_user_id: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      notification_events: {
        Row: {
          id: string;
          booking_id: string | null;
          event_type: string;
          payload: Json;
          delivery_status: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      admin_users: {
        Row: {
          id: string;
          auth_user_id: string;
          role: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
          entity_type: string;
        };
        Update: Record<string, unknown>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          payment_provider: string;
          provider_reference: string | null;
          request_fingerprint: Json;
          is_test: boolean;
          amount_php: number;
          status: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      booking_inventory_holds: {
        Row: {
          id: string;
          booking_id: string;
          motorcycle_unit_id: string;
          start_at: string;
          end_at: string;
          expires_at: string;
          released_at: string | null;
          converted_at: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      booking_readiness_checks: {
        Row: {
          check_key: string;
          passed: boolean;
          checked_at: string | null;
          checked_by: string | null;
          evidence: string | null;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      payment_intents: {
        Row: {
          id: string;
          booking_id: string;
          idempotency_key: string;
          kind: string;
          amount_centavos: number;
          currency: string;
          status: string;
          provider: string | null;
          provider_reference: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      payment_attempts: {
        Row: {
          id: string;
          payment_intent_id: string;
          attempt_number: number;
          status: string;
          provider_reference: string | null;
          response_code: string | null;
          failure_message: string | null;
          is_test: boolean;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      payment_events: {
        Row: {
          id: string;
          booking_id: string;
          payment_intent_id: string | null;
          original_payment_event_id: string | null;
          event_type: string;
          amount_centavos: number;
          method: string;
          transaction_reference: string | null;
          occurred_at: string;
          recorded_by: string | null;
          internal_notes: string | null;
          idempotency_key: string;
          is_test: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_manage_motorcycle_unit: {
        Args: {
          p_model_id: string;
          p_unit_id: string;
          p_operation: string;
          p_expected_status: string;
        };
        Returns: Json;
      };
      get_motorcycle_color_availability: {
        Args: { p_model_id: string; p_start_at: string; p_end_at: string };
        Returns: { color: string; available_count: number }[];
      };
      get_verification_progress: {
        Args: { p_booking_id: string };
        Returns: Json;
      };
      admin_save_payment_gateway_fee: {
        Args: {
          p_provider: string;
          p_payment_method: string;
          p_percentage_basis_points: number;
          p_flat_fee_centavos: number;
          p_notes: string;
        };
        Returns: string;
      };
      admin_save_notification_settings: {
        Args: { p_settings: Json };
        Returns: undefined;
      };
      admin_retry_notification: { Args: { p_id: string }; Returns: undefined };
      admin_repair_notification_generation: {
        Args: { p_id: string };
        Returns: undefined;
      };
      admin_audit_notification_mock_test: {
        Args: { p_channel: string };
        Returns: undefined;
      };
      notification_schedule_reminders: {
        Args: Record<string, never>;
        Returns: number;
      };
      notification_claim: {
        Args: { p_channel: string; p_mock: boolean };
        Returns: OutboxRow[];
      };
      notification_delivery_context: {
        Args: { p_id: string; p_lease: string };
        Returns: Json;
      };
      notification_prepare: {
        Args: { p_id: string; p_lease: string; p_hash: string };
        Returns: Json;
      };
      notification_finish: {
        Args: {
          p_id: string;
          p_lease: string;
          p_result: string;
          p_provider_reference?: string;
          p_retry_seconds?: number;
        };
        Returns: undefined;
      };
      get_security_deposit_options: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_set_id_deposit_enabled: {
        Args: { p_enabled: boolean };
        Returns: undefined;
      };
      admin_save_security_deposit_settings: {
        Args: { p_settings: Json };
        Returns: undefined;
      };
      get_booking_deposit_summary: {
        Args: { p_booking_id: string };
        Returns: Json;
      };
      admin_record_security_deposit_event: {
        Args: {
          p_booking_id: string;
          p_event_type: string;
          p_amount_centavos: number;
          p_occurred_at: string;
          p_notes: string;
          p_idempotency_key: string;
          p_verified: boolean;
        };
        Returns: string;
      };
      admin_record_rental_inspection: {
        Args: {
          p_booking_id: string;
          p_kind: string;
          p_details: Json;
          p_idempotency_key: string;
        };
        Returns: string;
      };

      admin_set_motorcycle_quantity: {
        Args: { p_model_id: string; p_total: number; p_expected_total: number };
        Returns: undefined;
      };
      admin_record_offline_payment: {
        Args: {
          p_booking_id: string;
          p_amount_centavos: number;
          p_method: string;
          p_transaction_reference: string | null;
          p_paid_at: string;
          p_notes: string | null;
          p_idempotency_key: string;
        };
        Returns: string;
      };
      admin_record_payment_adjustment: {
        Args: {
          p_original_payment_event_id: string;
          p_operation: string;
          p_amount_centavos: number;
          p_method: string;
          p_transaction_reference: string;
          p_occurred_at: string;
          p_reason: string;
          p_idempotency_key: string;
        };
        Returns: string;
      };
      admin_set_booking_tester: {
        Args: {
          p_auth_user_id: string;
          p_expires_at: string | null;
          p_authorized: boolean;
        };
        Returns: undefined;
      };
      admin_review_verification: {
        Args: {
          p_verification_id: string;
          p_review_type: string;
          p_result: string;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      admin_confirm_booking: {
        Args: { p_booking_id: string; p_unit_id: string };
        Returns: undefined;
      };
      admin_transition_booking: {
        Args: { p_booking_id: string; p_new_status: string };
        Returns: undefined;
      };
      admin_transition_booking_with_reason: {
        Args: {
          p_booking_id: string;
          p_new_status: string;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      admin_reschedule_booking: {
        Args: {
          p_booking_id: string;
          p_start_at: string;
          p_end_at: string;
          p_unit_id?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
