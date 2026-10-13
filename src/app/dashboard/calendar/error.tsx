"use client";
export default function CalendarError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="admin-note">
      <p>The reservation calendar could not be loaded.</p>
      <button className="admin-button mt-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
