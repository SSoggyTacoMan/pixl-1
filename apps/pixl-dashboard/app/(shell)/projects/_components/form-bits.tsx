"use client";

// Small form building blocks for the project editor.
import type { ReactNode } from "react";
import { safeHttpUrl } from "@/lib/safe-url";

export function Row({ label, children, extra }: { label: ReactNode; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label">
        {label}
        {extra ? <span className="ml-2 normal-case tracking-normal">{extra}</span> : null}
      </span>
      {children}
    </div>
  );
}

export function OpenLink({ url }: { url: string }) {
  const href = safeHttpUrl(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      open
    </a>
  ) : null;
}

export function CountedTextarea({
  value,
  onChange,
  max,
  placeholder,
  disabled,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="relative">
      <textarea
        id={id}
        className="field"
        maxLength={max}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="hint block text-right">
        {value.length} / {max}
      </span>
    </div>
  );
}

export function Disclosure({
  checked,
  onChange,
  label,
  desc,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="disclosure">
      <label className="check-row font-semibold">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      <p className="hint">{desc}</p>
      {checked && children ? <div className="mt-3 flex flex-col gap-3">{children}</div> : null}
    </div>
  );
}
