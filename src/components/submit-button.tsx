"use client";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "",
  disabled,
  unstyled = false,
  ...props
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  unstyled?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      aria-busy={pending}
      disabled={pending || disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60 ${unstyled ? "" : "rounded-xl bg-ocean px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#066f7a]"} ${className}`}
    >
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
