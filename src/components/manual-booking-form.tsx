"use client";
import { ManualRentalPeriod } from "@/components/manual-rental-period";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Panel } from "@/components/admin-ui";
import {
  type ManualBookingInput,
  type ManualOptions,
  type ManualQuote,
  type ManualCustomer,
} from "@/lib/manual-booking";
import {
  quoteManualBooking,
  saveManualBooking,
  searchManualCustomers,
} from "@/app/actions/manual-bookings";
import { getManualBookingUnits } from "@/app/actions/manual-booking-units";
import { ManualBookingSummary } from "@/components/manual-booking-summary";

const inputClass =
  "mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50";
const money = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n,
  );
export function ManualBookingForm({
  options,
  initial,
}: {
  options: ManualOptions;
  initial?: ManualBookingInput;
}) {
  const router = useRouter();
  const [d, setD] = useState<ManualBookingInput>(
    initial ?? {
      requestId: "",
      bookingId: null,
      revision: 0,
      customerId: null,
      fullName: "",
      phone: "",
      email: "",
      customerType: "philippine_resident",
      source: "whatsapp",
      modelId: "",
      unitId: "",
      selectedColor: null,
      startAt: "",
      endAt: "",
      services: { delivery: null, collection: null },
      extras: [],
      adjustment: { kind: "none", value: 0, reason: "" },
      notes: "",
      action: "pending",
      confirmationReason: "",
    },
  );
  const [quote, setQuote] = useState<ManualQuote | null>(null);
  const [priceError, setPriceError] = useState("");
  const pricingKey = JSON.stringify({
    bookingId: d.bookingId,
    modelId: d.modelId,
    startAt: d.startAt,
    endAt: d.endAt,
    selectedColor: d.selectedColor,
    services: d.services,
    extras: d.extras,
    adjustment: d.adjustment,
  });
  useEffect(() => {
    const input = JSON.parse(pricingKey);
    if (!input.modelId || !input.startAt || !input.endAt || !options.ready)
      return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void quoteManualBooking(input)
        .then((result) => {
          if (cancelled) return;
          setQuote(result.quote ?? null);
          setPriceError(result.error ?? "");
        })
        .catch(() => {
          if (!cancelled) {
            setQuote(null);
            setPriceError(
              "Price could not be loaded. Use Refresh price to try again.",
            );
          }
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pricingKey, options.ready]);
  const [availability, setAvailability] = useState<{
    key: string;
    units: ManualQuote["units"];
    error?: string;
  } | null>(null);
  const availabilityKey = `${d.modelId}:${d.startAt}:${d.endAt}:${d.bookingId ?? ""}`;
  const availabilityReady = Boolean(d.modelId && d.startAt && d.endAt);
  const currentAvailability =
    availability?.key === availabilityKey ? availability : null;
  const availableUnits = currentAvailability?.units ?? [];
  const colorChoices = [
    ...new Set(availableUnits.flatMap((u) => (u.color ? [u.color] : []))),
  ];
  useEffect(() => {
    if (!d.modelId || !d.startAt || !d.endAt || !options.ready) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void getManualBookingUnits({
        modelId: d.modelId,
        startAt: d.startAt,
        endAt: d.endAt,
        bookingId: d.bookingId,
      })
        .then((result) => {
          if (!cancelled) setAvailability({ key: availabilityKey, ...result });
        })
        .catch(() => {
          if (!cancelled)
            setAvailability({
              key: availabilityKey,
              units: [],
              error:
                "Availability could not be loaded. Check your dates and try again.",
            });
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    d.modelId,
    d.startAt,
    d.endAt,
    d.bookingId,
    options.ready,
    availabilityKey,
  ]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<ManualCustomer[]>([]);
  const lastRequest = useRef<ManualBookingInput | null>(null);
  const searchSequence = useRef(0);
  const locked = pending || !options.ready;
  function change(patch: Partial<ManualBookingInput>) {
    const rentalChanged =
      patch.modelId !== undefined ||
      patch.startAt !== undefined ||
      patch.endAt !== undefined;
    setD((current) => ({
      ...current,
      ...(rentalChanged ? { selectedColor: null, unitId: "" } : {}),
      ...patch,
    }));
    if (
      [
        "modelId",
        "startAt",
        "endAt",
        "selectedColor",
        "services",
        "extras",
        "adjustment",
      ].some((key) => key in patch)
    ) {
      setQuote(null);
      setPriceError("");
    }
    setError("");
    lastRequest.current = null;
  }
  function selectCustomer(c: ManualCustomer) {
    change({
      customerId: c.id,
      fullName: c.full_name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      customerType:
        c.customer_type === "international_visitor"
          ? "international_visitor"
          : "philippine_resident",
    });
    setCustomers([]);
    setSearch("");
  }
  function quoteInput(): ManualBookingInput {
    // Unit selection is populated by the availability quote; the server never trusts this placeholder for saving.
    return {
      ...d,
      unitId: d.unitId || "00000000-0000-4000-8000-000000000000",
      requestId: d.requestId || crypto.randomUUID(),
      action: "pending",
    };
  }
  function preview(color = d.selectedColor) {
    startTransition(async () => {
      setError("");
      const result = await quoteManualBooking({
        ...quoteInput(),
        selectedColor: color,
      }).catch(() => ({
        error: "Connection interrupted. Please request the quote again.",
        quote: undefined,
      }));
      if (result.error) {
        setQuote(null);
        setPriceError(result.error);
      } else if (result.quote) {
        setQuote(result.quote);
        setPriceError("");
        setD((current) => ({
          ...current,
          selectedColor: color,
          unitId: result.quote!.units.some(
            (u) => u.id === current.unitId && (!color || u.color === color),
          )
            ? current.unitId
            : (result.quote!.units.find((u) => !color || u.color === color)
                ?.id ?? ""),
        }));
      }
    });
  }
  function save(action: "pending" | "confirmed") {
    if (!quote) return;
    startTransition(async () => {
      const request = lastRequest.current ?? {
        ...d,
        action,
        requestId: crypto.randomUUID(),
        quoteToken: quote.token,
        expectedTotal: quote.final,
      };
      if (request.action !== action) {
        setError(
          "The previous save may have succeeded. Retry the same action or check the booking list first.",
        );
        return;
      }
      lastRequest.current = request;
      const result = await saveManualBooking(request).catch(() => ({
        error:
          "Connection interrupted. Retry the same action to recover the existing reservation safely; the request key has been preserved.",
        bookingId: undefined,
      }));
      if (result.error) setError(result.error);
      else if (result.bookingId) {
        router.push(`/dashboard/bookings/${result.bookingId}?updated=1`);
        router.refresh();
      }
    });
  }
  const model = options.models.find((m) => m.id === d.modelId);
  const accessories = options.extras.filter((e) =>
    e.compatible_model_ids.length
      ? e.compatible_model_ids.includes(d.modelId)
      : !/top[ _-]*box/i.test(e.name),
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        preview();
      }}
      className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"
    >
      <fieldset disabled={locked} className="min-w-0 space-y-5 border-0 p-0">
        {!options.ready && (
          <p
            role="alert"
            className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
          >
            Manual booking is not activated. Review and apply migration 039
            before creating or editing reservations.
          </p>
        )}
        <Panel
          title="1. Customer information"
          description="No customer account or password. Email is optional."
        >
          {!initial && (
            <div className="mb-4 rounded-xl bg-slate-50 p-3">
              <label className="text-sm font-semibold">
                Find an existing customer
                <input
                  className={inputClass}
                  value={search}
                  placeholder="Name, phone or email"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCustomers([]);
                    searchSequence.current++;
                  }}
                />
              </label>
              <button
                type="button"
                className="admin-btn-secondary mt-2"
                disabled={search.trim().length < 2 || pending}
                onClick={() => {
                  const sequence = ++searchSequence.current;
                  startTransition(async () => {
                    try {
                      const found = await searchManualCustomers(search);
                      if (sequence === searchSequence.current)
                        setCustomers(found);
                    } catch {
                      setError("Customer search failed. Please try again.");
                    }
                  });
                }}
              >
                Search customers
              </button>
              <ul>
                {customers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 text-left text-sm hover:border-ocean"
                      onClick={() => selectCustomer(c)}
                    >
                      <strong>{c.full_name}</strong>
                      <span className="block text-xs text-slate-500">
                        {c.phone} · {c.email || "No email"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {d.customerId && (
                <p className="mt-2 text-xs text-ocean">
                  Existing customer selected.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() =>
                      change({
                        customerId: null,
                        fullName: "",
                        phone: "",
                        email: "",
                      })
                    }
                  >
                    Use a new customer
                  </button>
                </p>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Full name
              <input
                required
                maxLength={160}
                className={inputClass}
                value={d.fullName}
                onChange={(e) => change({ fullName: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Mobile phone
              <input
                required
                type="tel"
                className={inputClass}
                value={d.phone}
                onChange={(e) => change({ phone: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Email (optional)
              <input
                type="email"
                className={inputClass}
                value={d.email}
                onChange={(e) => change({ email: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Customer type
              <select
                className={inputClass}
                value={d.customerType}
                disabled={!!initial}
                onChange={(e) =>
                  change({
                    customerType: e.target
                      .value as ManualBookingInput["customerType"],
                  })
                }
              >
                <option value="philippine_resident">Philippine resident</option>
                <option value="international_visitor">
                  International visitor
                </option>
              </select>
            </label>
            <label className="text-sm">
              Booking source
              <select
                className={inputClass}
                value={d.source}
                onChange={(e) =>
                  change({
                    source: e.target.value as ManualBookingInput["source"],
                  })
                }
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="walk_in">Walk-in</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Documents are optional for reservation creation. Add them privately
            from booking details before verification and handover. Missing
            documents are never marked verified.
          </p>
        </Panel>
        <Panel
          title="2. Motorcycle & rental period"
          description="All dates and times are Asia/Manila. Minimum rental: 24 hours."
        >
          <div className="flex items-end gap-3">
            {model?.image && (
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                <Image
                  src={model.image}
                  alt={model.display_name}
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              </div>
            )}
            <label className="min-w-0 flex-1 text-xs font-bold text-slate-500">
              Motorcycle model
              <select
                required
                className={inputClass}
                value={d.modelId}
                onChange={(e) =>
                  change({
                    modelId: e.target.value,
                    unitId: "",
                    selectedColor: null,
                    extras: [],
                  })
                }
              >
                <option value="">Select motorcycle</option>
                {options.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} · {money(m.daily_rate_php)}/day
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ManualRentalPeriod
            startAt={d.startAt}
            endAt={d.endAt}
            onChange={change}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-500">
              Color *
              <select
                className={inputClass}
                value={d.selectedColor ?? ""}
                disabled={
                  pending || !currentAvailability || !colorChoices.length
                }
                onChange={(e) => {
                  const color = e.target.value || null;
                  change({
                    selectedColor: color,
                    unitId:
                      availableUnits.find((u) => !color || u.color === color)
                        ?.id ?? "",
                  });
                }}
              >
                <option value="">
                  {!availabilityReady
                    ? "Choose model and dates first"
                    : !currentAvailability
                      ? "Checking available colors…"
                      : colorChoices.length
                        ? "Choose available color"
                        : "No configured colors available"}
                </option>
                {colorChoices.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-500">
              Unit / license plate
              <select
                required
                className={inputClass}
                value={d.unitId}
                disabled={
                  pending ||
                  !currentAvailability ||
                  !availableUnits.length ||
                  (colorChoices.length > 0 && !d.selectedColor)
                }
                onChange={(e) => {
                  change({ unitId: e.target.value });
                }}
              >
                <option value="">Select unit</option>
                {availableUnits
                  .filter(
                    (u) => !d.selectedColor || u.color === d.selectedColor,
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.plate || `Unit ${u.id.slice(0, 8).toUpperCase()}`}
                      {u.color ? ` · ${u.color}` : ""}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {!availabilityReady && (
            <p className="mt-2 text-xs text-slate-500">
              Choose a model and rental dates to see available colors and
              license plates.
            </p>
          )}
          {availabilityReady && !currentAvailability && (
            <p role="status" className="mt-2 text-sm text-slate-500">
              Checking unit availability…
            </p>
          )}
          {currentAvailability?.error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {currentAvailability.error}
            </p>
          )}
          {currentAvailability &&
            !currentAvailability.error &&
            !availableUnits.length && (
              <p role="status" className="mt-2 text-sm text-amber-800">
                No units are available for these dates. Choose another rental
                period or model.
              </p>
            )}
        </Panel>
        <Panel
          title="3. Delivery & collection"
          description="Services use configured areas, fees and operating hours. Delivery is at rental start; collection is at rental return."
        >
          <label className="mb-3 flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={!d.services.delivery && !d.services.collection}
              onChange={() =>
                change({ services: { delivery: null, collection: null } })
              }
            />
            Self pick-up & self drop-off
          </label>
          {!options.delivery.enabled && (
            <p className="text-sm text-slate-500">
              Delivery and collection are currently disabled. Customer collects
              and returns the motorcycle.
            </p>
          )}
          {(["delivery", "collection"] as const).map((leg) => (
            <div key={leg} className="mb-3 last:mb-0">
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  disabled={!options.delivery.enabled}
                  checked={!!d.services[leg]}
                  onChange={(e) =>
                    change({
                      services: {
                        ...d.services,
                        [leg]: e.target.checked
                          ? { areaId: "", address: "", instructions: "" }
                          : null,
                      },
                    })
                  }
                />
                {leg === "delivery"
                  ? "Deliver motorcycle"
                  : "Collect motorcycle"}
              </label>
              {d.services[leg] && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Service area
                    <select
                      required
                      className={inputClass}
                      value={d.services[leg]!.areaId}
                      onChange={(e) =>
                        change({
                          services: {
                            ...d.services,
                            [leg]: {
                              ...d.services[leg]!,
                              areaId: e.target.value,
                            },
                          },
                        })
                      }
                    >
                      <option value="">Choose configured area</option>
                      {options.delivery.areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ·{" "}
                          {money(
                            leg === "delivery"
                              ? a.delivery_php
                              : a.collection_php,
                          )}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    {leg === "delivery" ? "Delivery" : "Collection"} address
                    <input
                      required
                      minLength={5}
                      maxLength={500}
                      className={inputClass}
                      value={d.services[leg]!.address}
                      onChange={(e) =>
                        change({
                          services: {
                            ...d.services,
                            [leg]: {
                              ...d.services[leg]!,
                              address: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Service instructions (optional)
                    <input
                      maxLength={1000}
                      className={inputClass}
                      value={d.services[leg]!.instructions}
                      onChange={(e) =>
                        change({
                          services: {
                            ...d.services,
                            [leg]: {
                              ...d.services[leg]!,
                              instructions: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <p className="text-xs text-slate-500 sm:col-span-2">
                    {leg === "delivery"
                      ? `${options.delivery.delivery_open}–${options.delivery.delivery_close}`
                      : `${options.delivery.collection_open}–${options.delivery.collection_close}`}{" "}
                    Manila time · {leg === "delivery" ? d.startAt : d.endAt}
                  </p>
                </div>
              )}
            </div>
          ))}
        </Panel>
        <Panel title="4. Optional accessories">
          {!accessories.length ? (
            <p className="text-sm text-slate-500">
              {options.extras.length
                ? "No compatible accessories are available for this motorcycle."
                : "No accessories are currently configured."}
            </p>
          ) : (
            accessories.map((e) => (
              <label
                key={e.id}
                className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0"
              >
                <span>
                  {e.name}
                  <small className="block text-slate-500">
                    {money(e.price_php)} /{" "}
                    {e.pricing_model === "per_day" ? "day" : "rental"}
                  </small>
                </span>
                <input
                  aria-label={`${e.name} quantity`}
                  type="number"
                  min={0}
                  max={e.max_per_booking}
                  className="w-20 rounded-lg border border-slate-200 p-2"
                  value={d.extras.find((x) => x.id === e.id)?.quantity ?? 0}
                  onChange={(event) =>
                    change({
                      extras: [
                        ...d.extras.filter((x) => x.id !== e.id),
                        ...(Number(event.target.value) > 0
                          ? [{ id: e.id, quantity: Number(event.target.value) }]
                          : []),
                      ],
                    })
                  }
                />
              </label>
            ))
          )}
        </Panel>
        <Panel
          title="5. Pricing & internal notes"
          description="Adjustments apply to this booking only, in whole pesos. Percentage discounts round to the nearest peso. The security deposit is separate."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Price adjustment
              <select
                className={inputClass}
                value={d.adjustment.kind}
                onChange={(e) =>
                  change({
                    adjustment: {
                      kind: e.target
                        .value as ManualBookingInput["adjustment"]["kind"],
                      value: 0,
                      reason: "",
                    },
                  })
                }
              >
                <option value="none">Standard calculated price</option>
                <option value="fixed">Fixed discount (PHP)</option>
                <option value="percentage">Percentage discount</option>
                <option value="agreed">
                  Special agreed rental price (PHP)
                </option>
              </select>
            </label>
            {d.adjustment.kind !== "none" && (
              <>
                <label className="text-sm">
                  {d.adjustment.kind === "percentage"
                    ? "Discount (%)"
                    : "Amount (PHP)"}
                  <input
                    type="number"
                    min={0}
                    step={d.adjustment.kind === "percentage" ? "0.01" : "1"}
                    className={inputClass}
                    value={d.adjustment.value}
                    onChange={(e) =>
                      change({
                        adjustment: {
                          ...d.adjustment,
                          value: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  Adjustment reason
                  <input
                    required
                    minLength={5}
                    maxLength={500}
                    className={inputClass}
                    value={d.adjustment.reason}
                    onChange={(e) =>
                      change({
                        adjustment: { ...d.adjustment, reason: e.target.value },
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>
          <label className="mt-3 block text-sm">
            Internal booking notes
            <textarea
              maxLength={2000}
              rows={3}
              className={inputClass}
              value={d.notes}
              onChange={(e) => change({ notes: e.target.value })}
            />
          </label>
        </Panel>
        <Panel title="6. Payment & reservation authorization">
          <p className="text-sm leading-relaxed text-slate-600">
            No payment or deposit is recorded by this form. Record cash, partial
            payments and the refundable deposit separately through the existing
            booking details workflows. Online payments retain the existing
            provider readiness controls.
          </p>
          <label className="mt-3 block text-sm">
            Confirmation reason (required to confirm)
            <textarea
              maxLength={500}
              rows={2}
              className={inputClass}
              value={d.confirmationReason}
              onChange={(e) => change({ confirmationReason: e.target.value })}
              placeholder="Customer confirmed the reservation by phone; original documents will be reviewed before handover."
            />
          </label>
          <p className="mt-2 text-xs text-amber-800">
            Confirmation reserves inventory. It does not approve documents or
            authorize handover.
          </p>
        </Panel>
      </fieldset>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-6">
        <Panel title="Booking summary">
          <ManualBookingSummary
            model={model?.display_name}
            customer={d.fullName}
            color={d.selectedColor}
            plate={availableUnits.find((u) => u.id === d.unitId)?.plate}
            startAt={d.startAt}
            endAt={d.endAt}
            quote={quote}
            error={priceError}
          />
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => preview()}
              disabled={locked || !d.modelId || !d.startAt || !d.endAt}
              className="admin-button admin-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Please wait…" : "Refresh price"}
            </button>
            <button
              type="button"
              disabled={
                locked ||
                !quote ||
                !d.unitId ||
                (colorChoices.length > 0 && !d.selectedColor) ||
                initial?.action === "confirmed"
              }
              onClick={() => save("pending")}
              className="admin-button admin-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {initial ? "Save pending changes" : "Save as Pending"}
            </button>
            <button
              type="button"
              disabled={
                locked ||
                !quote ||
                !d.unitId ||
                (colorChoices.length > 0 && !d.selectedColor) ||
                d.confirmationReason.trim().length < 5
              }
              onClick={() => save("confirmed")}
              className="admin-button w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {initial?.action === "confirmed"
                ? "Save confirmed changes"
                : "Confirm Booking"}
            </button>
          </div>
          {!quote && (
            <p className="mt-3 text-xs text-slate-500">
              A verified price and available unit are required to save.
            </p>
          )}
          {quote && d.confirmationReason.trim().length < 5 && (
            <p className="mt-3 text-xs text-slate-500">
              To confirm, enter a confirmation reason in section 6.
            </p>
          )}
          {pending && (
            <p role="status" className="mt-3 text-sm text-slate-500">
              Processing securely…
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </Panel>
      </aside>
    </form>
  );
}
