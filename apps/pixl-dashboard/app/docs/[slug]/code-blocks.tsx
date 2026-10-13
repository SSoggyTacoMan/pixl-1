"use client";

import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    hljs?: { highlightAll: () => void };
  }
}

// The block behind it is dark in every theme, so the copied state is the
// light green, not the dark-on-white one. Shown on hover of its <pre>.
const copyButton = [
  "absolute top-[8px] right-[8px] flex items-center gap-[5px] px-[10px] py-[5px] opacity-0",
  "border border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.06)] font-sans text-[11.5px] tracking-[.2px] text-[#f5eed2]",
  "[transition:opacity_.15s_ease,background-color_.15s_ease,border-color_.15s_ease]",
  "[pre:hover>&]:opacity-100 focus-visible:opacity-100",
  "hover:border-[rgba(255,255,255,.34)] hover:bg-[rgba(255,255,255,.14)]",
  "data-copied:border-[rgba(126,231,135,.4)] data-copied:text-[#7ee787] data-copied:opacity-100",
  "data-copied:hover:border-[rgba(126,231,135,.4)]",
].join(" ");

export function CodeBlocks({ slug }: { slug: string }) {
  useEffect(() => {
    // Covers the fast path: hljs was already loaded by an earlier doc page
    // in this client-side session, so it's ready the instant this mounts.
    // The Script below's onLoad covers the other path (first page load,
    // hljs still in flight when this effect runs).
    if (window.hljs) window.hljs.highlightAll();

    const cleanups: (() => void)[] = [];
    document.querySelectorAll("[data-doc-body] pre").forEach((pre) => {
      if (pre.querySelector("[data-copy-btn]")) return;
      const btn = document.createElement("button");
      btn.className = copyButton;
      btn.dataset.copyBtn = "";
      btn.type = "button";
      btn.textContent = "Copy";
      const handler = async () => {
        try {
          await navigator.clipboard.writeText(pre.querySelector("code")?.textContent ?? "");
          btn.textContent = "Copied";
          btn.dataset.copied = "";
          setTimeout(() => {
            btn.textContent = "Copy";
            delete btn.dataset.copied;
          }, 1600);
        } catch {
          // clipboard permission denied - button just stays "Copy"
        }
      };
      btn.addEventListener("click", handler);
      pre.appendChild(btn);
      cleanups.push(() => {
        btn.removeEventListener("click", handler);
        btn.remove();
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [slug]);

  return (
    <Script
      src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"
      integrity="sha512-D9gUyxqja7hBtkWpPWGt9wfbfaMGVt9gnyCvYa+jojwwPHLCzUm5i8rpk7vD7wNee9bA35eYIjobYPaQuKS1MQ=="
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onLoad={() => window.hljs?.highlightAll()}
    />
  );
}
