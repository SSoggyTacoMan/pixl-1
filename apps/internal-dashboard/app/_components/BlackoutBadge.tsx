export function BlackoutBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`hc-badge ${className}`} data-tone="warning" title="Operation Blackout entry">
      Blackout
    </span>
  );
}
