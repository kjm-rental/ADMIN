import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
import { saveDelivery } from "@/app/actions/delivery";
type Settings = {
  enabled: boolean;
  delivery_open: string;
  delivery_close: string;
  collection_open: string;
  collection_close: string;
  cash_enabled: boolean;
  qrph_enabled: boolean;
};
type Area = {
  id: string;
  name: string;
  delivery_php: number;
  collection_php: number;
  enabled: boolean;
};
export async function DeliverySettings({
  paymentOnly = false,
}: {
  paymentOnly?: boolean;
}) {
  const { supabase } = await requireAdmin();
  const db = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: Settings | null; error: unknown }>;
        order: (c: string) => Promise<{ data: Area[] | null; error: unknown }>;
      };
    };
    rpc: (
      n: string,
    ) => Promise<{ data: { qrph_ready?: boolean } | null; error: unknown }>;
  };
  const [s, a, options] = await Promise.all([
    db.from("delivery_settings").select("*").maybeSingle(),
    db.from("delivery_areas").select("*").order("name"),
    db.rpc("get_delivery_options"),
  ]);
  if (s.error || a.error || !s.data)
    return (
      <p className="rounded-xl bg-amber-50 p-5 text-sm">
        Delivery and payment controls require migration 037. Existing
        self-pickup and cash operations are preserved.
      </p>
    );
  const settings = s.data;
  const ready =
    options.data?.qrph_ready &&
    process.env.NEXT_PUBLIC_QRPH_LIVE_VERIFIED === "true";
  return (
    <section className="space-y-5 rounded-2xl bg-white p-5">
      <h2 className="text-xl font-extrabold text-deep-teal">
        {paymentOnly ? "Payment Methods" : "Delivery & Collection"}
      </h2>
      <ActionForm action={saveDelivery} className="space-y-4">
        <input type="hidden" name="mode" value="settings" />
        {paymentOnly ? (
          <>
            <input
              type="hidden"
              name="enabled"
              value={settings.enabled ? "on" : ""}
            />
            {(
              [
                "delivery_open",
                "delivery_close",
                "collection_open",
                "collection_close",
              ] as const
            ).map((k) => (
              <input key={k} type="hidden" name={k} value={settings[k]} />
            ))}
          </>
        ) : (
          <>
            <label className="flex gap-3 font-bold">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={settings.enabled}
              />
              Motorcycle Delivery & Collection
            </label>
            <p className="text-sm text-slate-500">
              Turning off preserves areas, quoted fees and existing bookings.
              Service hours apply every day in Asia/Manila. Set both opening and
              closing to 00:00 for 24/7 service. Booking time blocks also apply.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  "delivery_open",
                  "delivery_close",
                  "collection_open",
                  "collection_close",
                ] as const
              ).map((k) => (
                <label key={k} className="text-sm capitalize">
                  {k.replaceAll("_", " ")}
                  <input
                    name={k}
                    type="time"
                    defaultValue={settings[k].slice(0, 5)}
                    required
                    className="mt-1 w-full rounded-lg border p-2"
                  />
                </label>
              ))}
            </div>
          </>
        )}
        {paymentOnly ? (
          <>
            <label className="flex gap-2">
              <input
                type="checkbox"
                name="cash_enabled"
                defaultChecked={settings.cash_enabled}
                disabled={!ready}
              />
              {!ready && <input type="hidden" name="cash_enabled" value="on" />}
              Cash on Pickup / Delivery
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                name="qrph_enabled"
                defaultChecked={settings.qrph_enabled}
                disabled={!ready}
              />
              QRPh via PayMongo —{" "}
              {ready
                ? "Live readiness verified"
                : "Unavailable: live integration verification required"}
            </label>
            <p className="text-xs text-slate-500">
              At least one verified, usable method must remain available.
              Refundable security deposits are collected separately in cash.
            </p>
            {[
              "Visa / Mastercard",
              "Google Pay",
              "Apple Pay",
              "GCash",
              "Maya",
            ].map((name) => (
              <div
                key={name}
                aria-disabled="true"
                className="flex justify-between rounded-lg border p-3 text-sm text-slate-400"
              >
                {name}
                <span>Coming Soon</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <input
              type="hidden"
              name="cash_enabled"
              value={settings.cash_enabled ? "on" : ""}
            />
            <input
              type="hidden"
              name="qrph_enabled"
              value={settings.qrph_enabled ? "on" : ""}
            />
          </>
        )}
        <SubmitButton>
          Save {paymentOnly ? "payment methods" : "delivery settings"}
        </SubmitButton>
      </ActionForm>
      {!paymentOnly && (
        <>
          <h3 className="font-bold">Service areas</h3>
          <p className="text-xs text-slate-500">
            Owner-configured fees in whole PHP, matching the existing booking
            pricing format. No areas or fees are prefilled.
          </p>
          <div className="space-y-3">
            {a.data?.map((area) => (
              <AreaForm key={area.id} area={area} />
            ))}
          </div>
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer font-bold">
              Add service area
            </summary>
            <AreaForm />
          </details>
        </>
      )}
    </section>
  );
}
function AreaForm({ area }: { area?: Area }) {
  return (
    <div className="rounded-xl border p-3">
      <ActionForm action={saveDelivery} className="grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="mode" value="area" />
        <input type="hidden" name="id" value={area?.id ?? ""} />
        <label className="text-xs">
          Service area
          <input
            required
            name="name"
            maxLength={120}
            defaultValue={area?.name}
            className="mt-1 min-h-10 w-full rounded-lg border p-2"
          />
        </label>
        {(["delivery_php", "collection_php"] as const).map((k) => (
          <label key={k} className="text-xs">
            {k === "delivery_php"
              ? "Delivery Fee (PHP)"
              : "Collection Fee (PHP)"}
            <input
              type="number"
              required
              min={0}
              max={100000}
              step={1}
              name={k}
              defaultValue={area?.[k]}
              className="mt-1 min-h-10 w-full rounded-lg border p-2"
            />
          </label>
        ))}
        <div className="space-y-2">
          <label className="flex gap-2 text-xs">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={area?.enabled}
            />
            Enabled
          </label>
          <SubmitButton>Save area</SubmitButton>
        </div>
      </ActionForm>
      {area && (
        <details className="mt-2 text-xs">
          <summary>Remove unused area</summary>
          <ActionForm action={saveDelivery}>
            <input type="hidden" name="mode" value="area" />
            <input type="hidden" name="id" value={area.id} />
            <input type="hidden" name="remove" value="yes" />
            <p className="my-2">
              Removal is blocked if a booking uses this area.
            </p>
            <SubmitButton>Remove unused area</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
