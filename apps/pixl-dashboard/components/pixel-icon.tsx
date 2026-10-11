import type { Rect } from "@/app/(shell)/nav-data";

export function PixelIcon({ rects, className = "ic" }: { rects: readonly Rect[]; className?: string }) {
  return (
    <span className={className}>
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        {rects.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} />
        ))}
      </svg>
    </span>
  );
}

/** Restoration Energy shard. */
export function ReIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1l4 6-4 8-4-8z" />
    </svg>
  );
}
