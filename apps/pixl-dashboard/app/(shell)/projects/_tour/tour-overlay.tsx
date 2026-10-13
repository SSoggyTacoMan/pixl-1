"use client";

// One step of the guided tour: a dimmed page with a spotlight on the step's
// target and a card next to it. Built on Radix Dialog, so focus is trapped
// in the card, Escape skips, and screen readers get a titled dialog.
import { Dialog as D } from "radix-ui";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { Button, buttonVariants } from "@/components/ui/primitives";
import { RichText } from "./rich-text";
import type { TourStep } from "./steps";
import { useTargetRect, type Box } from "./use-target-rect";

const PAD = 6;
const GAP = 14;

function cardPosition(box: Box, card: { w: number; h: number }): CSSProperties {
  const below = box.top + box.height + GAP;
  const roomBelow = window.innerHeight - (box.top + box.height);
  const top = roomBelow > card.h + 20 ? below : Math.max(GAP, box.top - card.h - GAP);
  const left = Math.min(Math.max(GAP, box.left + box.width / 2 - card.w / 2), window.innerWidth - card.w - GAP);
  return { top, left };
}

export function TourOverlay({
  steps,
  index,
  onNext,
  onBack,
  onSkip,
  onExtra,
}: {
  steps: TourStep[];
  index: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onExtra: (href: string) => void;
}) {
  const step = steps[index];
  const last = index === steps.length - 1;
  const box = useTargetRect(step.target, `${index}:${step.target ?? ""}`);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState({ w: 340, h: 200 });

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el) setSize({ w: el.offsetWidth || 340, h: el.offsetHeight || 200 });
    nextRef.current?.focus();
  }, [index, box]);

  // While the target is still loading the card waits in the center.
  const spot = box && box !== "pending" ? box : null;

  return (
    <D.Root open onOpenChange={(open) => !open && onSkip()}>
      <D.Portal>
        {spot ? (
          <div
            className="pointer-events-none fixed z-[200] border-2 border-gold shadow-[0_0_0_9999px_rgb(10_10_14/.5)] transition-[top,left,width,height] duration-250 ease-[ease]"
            aria-hidden
            style={{ top: spot.top - PAD, left: spot.left - PAD, width: spot.width + PAD * 2, height: spot.height + PAD * 2 }}
          />
        ) : (
          <div className="fixed inset-0 z-[200] bg-[rgb(10_10_14/.5)]" aria-hidden />
        )}
        <D.Content
          ref={cardRef}
          className={cn(
            "fixed z-[201] w-[min(340px,calc(100vw-32px))] border-2 border-stroke bg-panel p-[18px] text-ink",
            !spot && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          )}
          style={spot ? cardPosition(spot, size) : undefined}
          // The backdrop is inert: only Skip / Done / Escape end the tour.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            nextRef.current?.focus();
          }}
        >
          <D.Title className="mb-[8px] font-pixel text-[18px] tracking-[.5px] text-gold">{step.title}</D.Title>
          <D.Description asChild>
            <div className="text-[14px] leading-[1.55] text-dim [&_b]:text-ink">
              <RichText value={step.body} />
            </div>
          </D.Description>
          {step.extra ? (
            <button
              type="button"
              className={cn(buttonVariants({ variant: "ghost" }), "mt-[12px] block w-full")}
              onClick={() => onExtra(step.extra!.href)}
            >
              {step.extra.label}
            </button>
          ) : null}
          <div className="mt-[16px] flex items-center gap-[10px]">
            <div className="mr-auto flex gap-[5px]" aria-hidden>
              {steps.map((_, n) => (
                <span key={n} className={cn("size-[7px]", n === index ? "bg-gold" : "bg-muted")} />
              ))}
            </div>
            <span className="sr-only">
              Step {index + 1} of {steps.length}
            </span>
            {!last ? (
              <button type="button" className="border-0 bg-transparent p-[6px] text-[12px] text-faint" onClick={onSkip}>
                Skip
              </button>
            ) : null}
            {index > 0 ? (
              <Button variant="ghost" onClick={onBack}>
                Back
              </Button>
            ) : null}
            <Button ref={nextRef} onClick={onNext}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
