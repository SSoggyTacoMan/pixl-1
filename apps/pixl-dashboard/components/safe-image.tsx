// <img> for database/player-supplied URLs: renders only https or same-origin
// sources (see lib/safe-url.ts), never sends a referrer, and shows the given
// fallback otherwise. Plain <img> rather than next/image because shop and
// project images can live on any https host; next/image is reserved for the
// allowlisted CDN hosts in next.config.ts.
import { safeImageSrc } from "@/lib/safe-url";

export function SafeImage({
  src,
  alt = "",
  className,
  fallback = null,
}: {
  src: unknown;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const safe = safeImageSrc(src);
  if (!safe) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={safe} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" />;
}
