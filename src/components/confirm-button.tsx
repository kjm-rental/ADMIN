"use client";
import { useFormStatus } from "react-dom";

export function ConfirmButton({
  children,
  message,
  className,
  ...props
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      className={className}
      disabled={pending || props.disabled}
      aria-busy={pending}
      onClick={(event) => {
        if (pending || !window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
