import { Panel } from "@/components/admin-ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveManualDrivingDetails } from "@/app/actions/manual-bookings";
import { requireAdmin } from "@/lib/auth";
export async function ManualDrivingDetails({
  bookingId,
}: {
  bookingId: string;
}) {
  const { supabase } = await requireAdmin();
  const { data: v, error } = await supabase
    .from("customer_verifications")
    .select("*")
    .eq("booking_id", bookingId)
    .single();
  if (error || !v) throw Error("Verification details could not be loaded.");
  return (
    <Panel
      title="Driving details for later verification"
      description="Enter details from genuine documents before review. Saving these fields does not approve verification."
    >
      <ActionForm
        action={saveManualDrivingDetails}
        className="grid gap-3 sm:grid-cols-2"
      >
        <input type="hidden" name="bookingId" value={bookingId} />
        {[
          ["identityName", "Name on identity document", v.identity_name],
          ["licenseName", "Name on driver’s license", v.license_name],
          [
            "licenseCountry",
            "License issuing country",
            v.license_issuing_country,
          ],
          ["licenseExpiry", "License expiration", v.license_expiration_date],
          [
            "categories",
            "Permitted motorcycle categories",
            v.permitted_vehicle_categories,
          ],
          [
            "entryDate",
            "Philippines entry date (international visitors)",
            v.philippines_entry_date,
          ],
        ].map(([name, label, value]) => (
          <label key={name} className="text-sm">
            {label}
            <input
              name={name!}
              required={name !== "entryDate"}
              type={
                name === "licenseExpiry" || name === "entryDate"
                  ? "date"
                  : "text"
              }
              defaultValue={value ?? ""}
              maxLength={200}
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
        ))}
        <SubmitButton className="sm:col-span-2">
          Save driving details for review
        </SubmitButton>
      </ActionForm>
    </Panel>
  );
}
