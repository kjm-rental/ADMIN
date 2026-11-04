"use client";
import { useState, type ReactNode } from "react";
import {
  Banknote,
  CalendarClock,
  ChevronRight,
  KeyRound,
  Bell,
  ShieldCheck,
} from "lucide-react";
const sections = [
  {
    id: "delivery",
    label: "Delivery & Collection",
    description: "Service areas, fees and hours",
    Icon: CalendarClock,
  },
  {
    id: "methods",
    label: "Payment Methods",
    description: "Cash and verified QRPh availability",
    Icon: Banknote,
  },
  {
    id: "pricing",
    label: "Pricing & payments",
    description: "Rental rates and gateway costs",
    Icon: Banknote,
  },
  {
    id: "deposits",
    label: "Security deposits",
    description: "Amounts and collection policies",
    Icon: ShieldCheck,
  },
  {
    id: "booking",
    label: "Booking rules",
    description: "Hours, timing and renter policies",
    Icon: CalendarClock,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email and Telegram preferences",
    Icon: Bell,
  },
  {
    id: "security",
    label: "Account security",
    description: "Administrator PIN",
    Icon: KeyRound,
  },
] as const;
export type SettingsSection = (typeof sections)[number]["id"];
export function SettingsWorkspace({
  initialSection = "pricing",
  panels,
}: {
  initialSection?: SettingsSection;
  panels: Record<SettingsSection, ReactNode>;
}) {
  const [selected, setSelected] = useState<SettingsSection>(initialSection);
  return (
    <div className="settings-workspace">
      <aside className="settings-navigation">
        <nav aria-label="Settings sections">
          {sections.map(({ id, label, description, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={selected === id}
              aria-controls={`settings-panel-${id}`}
              className={selected === id ? "is-selected" : ""}
              onClick={() => setSelected(id)}
            >
              <Icon size={19} />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        </nav>
        <p>
          Switch sections without losing edits. Save each form before leaving
          this page.
        </p>
      </aside>
      <div className="settings-panels">
        {sections.map(({ id, label }) => (
          <section
            key={id}
            id={`settings-panel-${id}`}
            aria-label={label}
            hidden={selected !== id}
          >
            {panels[id]}
          </section>
        ))}
      </div>
    </div>
  );
}
