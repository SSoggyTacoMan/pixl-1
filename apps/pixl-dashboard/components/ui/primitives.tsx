// shadcn-style primitives over the LEDGER classes in app/globals.css
// (.btn, .chip, .panel, .field, ...). Small and dependency-free so server
// and client components can both use them.
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva("btn", {
  variants: {
    variant: { default: "", dark: "dark", ghost: "ghost", teal: "teal", red: "red" },
    size: { default: "", sm: "!px-3 !py-1 !text-xs" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("panel p-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("font-pixel text-lg tracking-wide text-ink", className)} {...props} />;
}

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn("field", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn("field", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn("field", className)} {...props} />;
});

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("label", className)} {...props} />;
}

export const badgeVariants = cva("chip", {
  variants: {
    tone: { default: "", gold: "gold", teal: "teal", green: "green", red: "red" },
  },
  defaultVariants: { tone: "default" },
});

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Notice({
  tone,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: "bad" | "good" }) {
  return <div role={tone === "bad" ? "alert" : "status"} className={cn("notice", tone, className)} {...props} />;
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="empty-note">{children}</div>;
}
