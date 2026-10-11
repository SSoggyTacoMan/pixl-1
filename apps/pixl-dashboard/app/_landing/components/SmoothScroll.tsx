"use client";

import { useEffect } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis();
    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    const ro = new ResizeObserver(() => lenis.resize());
    ro.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      ro.disconnect();
    };
  }, []);

  return <>{children}</>;
}
