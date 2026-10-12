import type { ReactNode } from "react";

// Collapsible section. A plain <details>, so server-action forms inside it
// work without any client JS.
export function Disclosure({
  summary,
  children,
  className = "",
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`hc-details ${className}`}>
      <summary>{summary}</summary>
      <div className="hc-details-body">{children}</div>
    </details>
  );
}
