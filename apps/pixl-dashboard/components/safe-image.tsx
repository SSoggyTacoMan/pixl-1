// <img> for database/player-supplied URLs: never sends a referrer, and shows
// the given fallback when the URL isn't allowed. Plain <img> rather than
// next/image because admin-set shop images can live on any https host;
// next/image is reserved for the allowlisted CDN hosts in next.config.ts.
//
// `player`: the URL was set by a player (project thumbnail, idea image,
// show-n-tell entry, cart screenshot), so only the Hack Club CDN is allowed
// (lib/safe-url.ts playerImageSrc) - an arbitrary host would log the IP of
// every viewer. Without it (admin-set shop/collectible images) any https or
// same-origin source renders (safeImageSrc).
import { playerImageSrc, safeImageSrc } from "@/lib/safe-url";

export function SafeImage({
  src,
  alt = "",
  className,
  fallback = null,
  player = false,
}: {
  src: unknown;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  player?: boolean;
}) {
  const safe = player ? playerImageSrc(src) : safeImageSrc(src);
  if (!safe) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={safe} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" />;
}
