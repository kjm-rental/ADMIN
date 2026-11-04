import React from "react";
import { createRoot } from "react-dom/client";
import "/src/app/admin-design.css";
import { SettingsWorkspace } from "/src/components/settings-workspace";
import { PricingSettings } from "/src/components/pricing-settings";
function Placeholder({ title }) {
  return (
    <div className="fixture-placeholder">
      <h2>{title}</h2>
      <p>
        This panel is a local fixture. The application uses its existing
        settings form here.
      </p>
      <label>
        Fixture edit field
        <input defaultValue="Sample value" />
      </label>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <div className="settings-page">
    <header className="settings-page-heading">
      <div>
        <p className="settings-eyebrow">KJM workspace</p>
        <h1>Settings</h1>
        <p>Make everyday changes to your rental business, all in one place.</p>
      </div>
      <span className="settings-timezone">Asia/Manila · PHP</span>
    </header>
    <div className="settings-overview">
      <div>
        <span>Public booking</span>
        <strong>Paused</strong>
        <small>Current booking master switch</small>
      </div>
      <div>
        <span>Cash security deposit</span>
        <strong>₱2,500.00</strong>
        <small>Fictional fixture configuration</small>
      </div>
      <div>
        <span>Operating schedule</span>
        <strong>6 days / week</strong>
        <small>Fictional fixture schedule</small>
      </div>
    </div>
    <SettingsWorkspace
      panels={{
        pricing: <PricingSettings available fees={[]} />,
        deposits: <Placeholder title="Security deposits" />,
        booking: <Placeholder title="Booking rules" />,
        notifications: <Placeholder title="Notifications" />,
        security: <Placeholder title="Account security" />,
      }}
    />
  </div>,
);
