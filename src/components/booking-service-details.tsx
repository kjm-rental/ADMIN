import type { BookingServices } from "@/services/booking-services";
import { formatDate, formatPHP } from "./admin-ui";
export function BookingServiceDetails({
  data,
  handedOver,
  returned,
}: {
  data?: BookingServices;
  handedOver: boolean;
  returned: boolean;
}) {
  if (!data) return null;
  return (
    <section className="space-y-3 py-5">
      <h2 className="font-extrabold text-deep-teal">Delivery & Collection</h2>
      <p className="text-sm">
        Payment method:{" "}
        {data.payment_method === "qrph"
          ? "QRPh via PayMongo"
          : "Cash on Pickup / Delivery"}
        . Security deposit remains separate cash.
      </p>
      {(["delivery", "collection"] as const).map((leg) => {
        const detail = data[leg];
        return (
          <div key={leg} className="rounded-xl border p-3 text-sm">
            <h3 className="font-bold capitalize">
              {leg} —{" "}
              {detail
                ? leg === "delivery"
                  ? handedOver
                    ? "Delivered"
                    : "Scheduled"
                  : returned
                    ? "Collected"
                    : "Scheduled"
                : leg === "delivery"
                  ? "Self pickup"
                  : "Self return"}
            </h3>
            {detail && (
              <>
                <p>
                  {detail.areaName} · {detail.address}
                </p>
                <p>
                  {detail.hotel} {detail.landmark}
                </p>
                <p>{formatDate(detail.scheduledAt)}</p>
                <p>{detail.instructions}</p>
                <p className="font-bold">
                  {formatPHP(
                    (leg === "delivery"
                      ? data.delivery_fee_centavos
                      : data.collection_fee_centavos) / 100,
                  )}
                </p>
                {detail.mapsUrl && /^https:\/\//.test(detail.mapsUrl) && (
                  <a
                    href={detail.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean underline"
                  >
                    Location map
                  </a>
                )}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
