"use client";

// Player avatar: the player-set avatar_url when it's a safe https image,
// otherwise (or if it fails to load) their initial as plain text.
import { useState } from "react";
import { safeImageSrc } from "@/lib/safe-url";
import { initial } from "../lib";

export function Avatar({ name, url, className }: { name: unknown; url: unknown; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : safeImageSrc(url);
  return (
    <div className={`avatar${className ? ` ${className}` : ""}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initial(name)
      )}
    </div>
  );
}
