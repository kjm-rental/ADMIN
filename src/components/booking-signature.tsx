import type { Database } from "@/types/database";
import { formatDate } from "@/components/admin-ui";
type Signature =
  Database["public"]["Tables"]["booking_electronic_signatures"]["Row"];
export function BookingSignature({
  signature,
}: {
  signature: Signature | null;
}) {
  return (
    <section className="py-5" aria-labelledby="booking-signature-title">
      <h2
        id="booking-signature-title"
        className="text-base font-bold text-deep-teal"
      >
        Rental agreement signature
      </h2>
      {!signature ? (
        <p className="mt-2 text-sm text-slate-500">
          No electronic signature recorded for this booking.
        </p>
      ) : (
        <>
          <div
            className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4"
            style={{ touchAction: "pan-y" }}
          >
            {signature.method === "uploaded" &&
            signature.signature_image_base64 ? (
              /* This private saved image must never pass through a public image proxy. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`data:image/png;base64,${signature.signature_image_base64}`}
                alt={`Signature provided by ${signature.signature_name}`}
                className="mx-auto max-h-40 max-w-full object-contain"
              />
            ) : signature.method === "drawn" && signature.signature_strokes ? (
              <svg
                role="img"
                aria-label={`Signature drawn by ${signature.signature_name}`}
                viewBox="0 0 600 180"
                className="mx-auto max-h-40 w-full max-w-lg"
              >
                {signature.signature_strokes.map((stroke, index) => (
                  <polyline
                    key={index}
                    points={stroke
                      .map((p) => `${p.x * 600},${p.y * 180}`)
                      .join(" ")}
                    fill="none"
                    stroke="#153f40"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            ) : (
              <p className="text-lg font-semibold text-deep-teal">
                {signature.signature_name}
              </p>
            )}
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Signed by</dt>
              <dd className="mt-1 break-words font-semibold">
                {signature.signature_name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Signed · Manila time</dt>
              <dd className="mt-1">{formatDate(signature.signed_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Method</dt>
              <dd className="mt-1">
                {signature.method === "uploaded"
                  ? "Uploaded signature image"
                  : signature.method === "drawn"
                    ? "Drawn electronic signature"
                    : "Typed full name"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Accepted terms version</dt>
              <dd className="mt-1">{signature.terms_version}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            This saved signature is also included in the downloadable rental
            contract.
          </p>
        </>
      )}
    </section>
  );
}
