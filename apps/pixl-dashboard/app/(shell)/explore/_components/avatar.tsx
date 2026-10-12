"use client";

// Player avatar: the player-set avatar_url when it is on the Hack Club CDN or
// a Slack profile photo host (lib/safe-url.ts playerImageSrc),
// otherwise (or if it fails to load) their initial as plain text.
import { useState } from "react";
import { playerImageSrc } from "@/lib/safe-url";
import { initial } from "../lib";

export function Avatar({ name, url, className }: { name: unknown; url: unknown; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = broken ? null : playerImageSrc(url, { avatar: true });
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
