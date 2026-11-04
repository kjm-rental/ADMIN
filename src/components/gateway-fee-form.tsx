"use client";
import { useState } from "react";
import { Calculator } from "lucide-react";
import { ActionForm } from "./action-form";
import { SubmitButton } from "./submit-button";
import { saveGatewayFee } from "@/app/actions/gateway-fees";
import {
  decimalHundredths,
  estimatedGatewayFee,
  feePHP,
  gatewayFeeInput,
  gatewayLabels,
  paymentMethodLabels,
  type GatewayFee,
} from "@/lib/gateway-fees";
export function GatewayFeeForm({
  fee,
  available,
}: {
  fee?: GatewayFee;
  available: boolean;
}) {
  const [provider, setProvider] = useState(fee?.provider ?? "");
  const [method, setMethod] = useState(fee?.payment_method ?? "");
  const [percentage, setPercentage] = useState(
    fee ? (fee.percentage_basis_points / 100).toFixed(2) : "",
  );
  const [fixed, setFixed] = useState(
    fee ? (fee.flat_fee_centavos / 100).toFixed(2) : "",
  );
  const [amount, setAmount] = useState("");
  let estimate: ReturnType<typeof estimatedGatewayFee> | null = null;
  const values = gatewayFeeInput.safeParse({
    provider,
    paymentMethod: method,
    percentage,
    flatFeePhp: fixed,
    notes: "",
  });
  if (values.success && amount) {
    try {
      estimate = estimatedGatewayFee(
        decimalHundredths(amount, 2147483647),
        values.data.percentage,
        values.data.flatFeePhp,
      );
    } catch {
      /* Show an estimate only for valid complete inputs. */
    }
  }
  return (
    <ActionForm action={saveGatewayFee} className="gateway-fee-form">
      {fee && (
        <>
          <input type="hidden" name="provider" value={fee.provider} />
          <input
            type="hidden"
            name="paymentMethod"
            value={fee.payment_method}
          />
        </>
      )}
      <div className="settings-field-grid">
        <label>
          Gateway
          <select
            required
            name="provider"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              if (e.target.value === "maya" && method === "gcash")
                setMethod("");
            }}
            disabled={Boolean(fee)}
          >
            <option value="">Choose a gateway</option>
            {Object.entries(gatewayLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment method
          <select
            required
            name="paymentMethod"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={Boolean(fee)}
          >
            <option value="">Choose a method</option>
            {Object.entries(paymentMethodLabels)
              .filter(([key]) => provider !== "maya" || key !== "gcash")
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Percentage fee (%)
          <input
            required
            name="percentage"
            inputMode="decimal"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Enter your gateway's rate"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
          />
        </label>
        <label>
          Fixed fee (PHP)
          <input
            required
            name="flatFeePhp"
            inputMode="decimal"
            type="number"
            min="0"
            max="21474836.47"
            step="0.01"
            placeholder="Enter 0 if there is no fixed fee"
            value={fixed}
            onChange={(e) => setFixed(e.target.value)}
          />
        </label>
      </div>
      <label>
        Notes
        <textarea
          name="notes"
          maxLength={1000}
          rows={2}
          defaultValue={fee?.notes ?? ""}
          placeholder="For example, where this rate was confirmed or when to review it."
        />
      </label>
      <div className="settings-fee-estimate">
        <div>
          <h4>
            <Calculator size={16} />
            Estimate a transaction
          </h4>
          <p>
            Percentage plus fixed fee, rounded to the nearest centavo.
            Additional taxes or provider-specific deductions are not included.
          </p>
        </div>
        <label>
          Transaction amount (PHP)
          <input
            inputMode="decimal"
            type="number"
            min="0"
            max="21474836.47"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter an amount"
          />
        </label>
        {estimate && (
          <dl aria-live="polite">
            <div>
              <dt>Estimated gateway cost</dt>
              <dd>{feePHP(estimate.feeCentavos)}</dd>
            </div>
            <div>
              <dt>Estimated net proceeds</dt>
              <dd>{feePHP(estimate.netCentavos)}</dd>
            </div>
          </dl>
        )}
      </div>
      <div className="settings-save-row">
        <SubmitButton disabled={!available} pendingLabel="Saving cost profile…">
          {fee ? "Save changes" : "Save cost profile"}
        </SubmitButton>
        <span>Internal estimates only · No customer surcharge</span>
      </div>
    </ActionForm>
  );
}
