"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/app/_ui/ui";

// Older name for a submit button that disables itself while its form's action
// runs. New code can use ActionButton from app/_ui/ui; both look the same.
const VARIANT: Record<string, ButtonVariant> = {
  default: "primary",
  secondary: "cream",
  destructive: "danger",
};

export function PendingButton({
  children,
  pendingText = "Working...",
  confirm,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  type = "submit",
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  children: ReactNode;
  pendingText?: string;
  confirm?: string;
  variant?: ButtonVariant | "default" | "secondary" | "destructive";
  size?: ButtonSize | "default";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type={type}
      disabled={pending || disabled}
      aria-busy={pending}
      className={`${buttonClass(VARIANT[variant] ?? (variant as ButtonVariant), size === "default" ? "md" : size)} ${className}`}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...props}
    >
      {pending ? pendingText : children}
    </button>
  );
}
