"use client";
import { useActionState, useEffect, useRef } from "react";
import { submitAdminAction } from "@/app/actions/feedback";
export function ActionForm({
  action,
  children,
  successMessage = "Change saved successfully.",
  ...props
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (data: FormData) => Promise<void>;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitAdminAction.bind(null, action),
    { error: "", saved: false },
  );
  const submitted = useRef(false);
  useEffect(() => {
    if (!pending) submitted.current = false;
  }, [pending]);
  return (
    <form
      {...props}
      action={formAction}
      aria-busy={pending}
      onSubmitCapture={(event) => {
        if (submitted.current) event.preventDefault();
        else submitted.current = true;
      }}
    >
      <fieldset
        disabled={pending}
        className={`min-w-0 border-0 p-0 m-0 contents ${(props.className ?? "")
          .split(" ")
          .filter((name) => /(?:^|:)space-y-/.test(name))
          .join(" ")}`}
      >
        {children}
      </fieldset>
      {pending && (
        <p role="status" className="mt-2 text-sm text-slate-500">
          Saving… Please wait.
        </p>
      )}
      {!pending && state.error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {!pending && state.saved && (
        <p role="status" className="mt-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      )}
    </form>
  );
}
