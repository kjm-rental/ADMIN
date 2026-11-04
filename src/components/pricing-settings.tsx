import Link from "next/link";
import {
  ArrowUpRight,
  Bike,
  CreditCard,
  PackagePlus,
  ReceiptText,
} from "lucide-react";
import { GatewayFeeForm } from "./gateway-fee-form";
import {
  gatewayLabels,
  paymentMethodLabels,
  type GatewayFee,
} from "@/lib/gateway-fees";
export function PricingSettings({
  available,
  fees,
}: {
  available: boolean;
  fees: GatewayFee[];
}) {
  return (
    <div className="settings-pricing">
      <header className="settings-section-heading">
        <span className="settings-eyebrow">Money & pricing</span>
        <h2>Pricing & payments</h2>
        <p>
          Manage rental prices, extras and the costs your payment gateway
          charges.
        </p>
      </header>
      <div className="settings-link-grid">
        {[
          {
            href: "/dashboard/fleet",
            title: "Motorcycle rental rates",
            copy: "Update model prices in your existing fleet catalog.",
            Icon: Bike,
          },
          {
            href: "/dashboard/extras",
            title: "Extras & add-ons",
            copy: "Set extra prices, availability and customer limits.",
            Icon: PackagePlus,
          },
          {
            href: "/dashboard/finance",
            title: "Payments & finance",
            copy: "Review collected payments and rental balances.",
            Icon: ReceiptText,
          },
        ].map(({ href, title, copy, Icon }) => (
          <Link key={href} href={href} className="settings-link-card">
            <Icon size={22} />
            <strong>{title}</strong>
            <p>{copy}</p>
            <span>
              Manage <ArrowUpRight size={14} />
            </span>
          </Link>
        ))}
      </div>
      <div className="settings-payment-status">
        <CreditCard size={22} />
        <div>
          <strong>Customer payments: Cash on Pickup</strong>
          <p>
            Gateway cost profiles do not enable PayMongo or Maya, change
            customer prices, or add a processing fee to a booking.
          </p>
        </div>
        <span>Online payments off</span>
      </div>
      <section className="settings-card">
        <header>
          <h3>Gateway transaction costs</h3>
          <p>
            Record the percentage and fixed fee from your provider agreement.
            These settings estimate your business costs; the gateway determines
            its actual charges.
          </p>
        </header>
        {!available && (
          <div role="status" className="settings-setup-note">
            <strong>Saving profiles is not available yet</strong>
            <p>
              You can use the calculator below. Ask your developer to complete
              fee-profile setup before saving.
            </p>
          </div>
        )}
        {fees.length > 0 && (
          <div className="settings-saved-fees">
            {fees.map((fee) => (
              <details key={fee.id}>
                <summary>
                  <span>
                    <strong>
                      {gatewayLabels[fee.provider]} ·{" "}
                      {paymentMethodLabels[fee.payment_method]}
                    </strong>
                    <small>
                      {(fee.percentage_basis_points / 100).toFixed(2)}% + PHP{" "}
                      {(fee.flat_fee_centavos / 100).toFixed(2)}
                    </small>
                  </span>
                  <span>Edit profile</span>
                </summary>
                <GatewayFeeForm fee={fee} available={available} />
                <p className="settings-updated">
                  Updated{" "}
                  {new Date(fee.updated_at).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}{" "}
                  · Asia/Manila
                </p>
              </details>
            ))}
          </div>
        )}
        <details className="settings-new-fee" open={!fees.length}>
          <summary>
            <span>
              <strong>
                {fees.length
                  ? "Add or update another cost profile"
                  : "Create a gateway cost profile"}
              </strong>
              <small>One saved profile per gateway and payment method.</small>
            </span>
          </summary>
          <GatewayFeeForm available={available} />
        </details>
      </section>
    </div>
  );
}
