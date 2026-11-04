export const unitHistoryMessage =
  "This motorcycle cannot be permanently deleted because it has booking or operational history. You can deactivate it instead.";

export type UnitLifecycleState = {
  outcome: "idle" | "error" | "history" | "blocked";
  message: string;
};

export const initialUnitLifecycleState: UnitLifecycleState = {
  outcome: "idle",
  message: "",
};

export const unitLifecycleMessages: Record<string, string> = {
  removed:
    "Motorcycle unit removed. Inventory and availability have been refreshed.",
  deactivated: "Motorcycle unit deactivated. It is excluded from new bookings.",
  reactivated: "Motorcycle unit reactivated. Availability has been refreshed.",
};
