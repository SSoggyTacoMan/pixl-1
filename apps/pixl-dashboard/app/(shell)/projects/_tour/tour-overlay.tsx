"use client";

// One step of the guided tour: a dimmed page with a spotlight on the step's
// target and a card next to it. Built on Radix Dialog, so focus is trapped
// in the card, Escape skips, and screen readers get a titled dialog.
import { Dialog as D } from "radix-ui";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
            className="pt-hole"
            aria-hidden
            style={{ top: spot.top - PAD, left: spot.left - PAD, width: spot.width + PAD * 2, height: spot.height + PAD * 2 }}
          />
        ) : (
          <div className="pt-veil" aria-hidden />
        )}
        <D.Content
          ref={cardRef}
          className={`pt-card${spot ? "" : " center"}`}
          style={spot ? cardPosition(spot, size) : undefined}
          // The backdrop is inert: only Skip / Done / Escape end the tour.
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            nextRef.current?.focus();
          }}
        >
          <D.Title className="pt-title">{step.title}</D.Title>
          <D.Description asChild>
            <div className="pt-body">
              <RichText value={step.body} />
            </div>
          </D.Description>
          {step.extra ? (
            <button type="button" className="btn ghost pt-extra" onClick={() => onExtra(step.extra!.href)}>
              {step.extra.label}
            </button>
          ) : null}
          <div className="pt-foot">
            <div className="pt-dots" aria-hidden>
              {steps.map((_, n) => (
                <span key={n} className={`pt-dot${n === index ? " on" : ""}`} />
              ))}
            </div>
            <span className="sr-only">
              Step {index + 1} of {steps.length}
            </span>
            {!last ? (
              <button type="button" className="pt-skip" onClick={onSkip}>
                Skip
              </button>
            ) : null}
            {index > 0 ? (
              <button type="button" className="btn ghost" onClick={onBack}>
                Back
              </button>
            ) : null}
            <button ref={nextRef} type="button" className="btn" onClick={onNext}>
              {last ? "Done" : "Next"}
            </button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
