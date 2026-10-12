"use client";

import { useEffect, useState } from "react";

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const POLL_MS = 100;
const MAX_TRIES = 20; // ~2s: the target may be on a page that's still loading

/**
 * Where the spotlighted element is on screen. "pending" while we wait for
 * it to render (e.g. right after Next navigated to /projects/new), null when
 * the step has no target or it never showed up (falls back to a centered
 * card), otherwise its viewport box, kept current on scroll/resize.
 */
export function useTargetRect(id: string | undefined, stepKey: string): Box | null | "pending" {
  const [box, setBox] = useState<Box | null | "pending">(id ? "pending" : null);
  const [prevKey, setPrevKey] = useState(stepKey);
  if (prevKey !== stepKey) {
    setPrevKey(stepKey);
    setBox(id ? "pending" : null);
  }

  useEffect(() => {
    if (!id) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let el: HTMLElement | null = null;

    const measure = () => {
      if (!el || !el.isConnected || !el.getClientRects().length) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const find = () => {
      el = document.getElementById(id);
      if (!el || !el.getClientRects().length) {
        if (tries++ < MAX_TRIES) timer = setTimeout(find, POLL_MS);
        else setBox(null);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "instant" });
      raf = requestAnimationFrame(() => (raf = requestAnimationFrame(measure)));
    };
    find();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [id, stepKey]);

  return box;
}
