"use client";

// Runs the projects-section guided tours. Lives in projects/layout.tsx so a
// tour survives the Next-driven hop from /projects to /projects/new.
//
//  - Onboarding tour: auto-runs while the server's onboarding counter says
//    "not done"; finishing or skipping records step 2 through the
//    setOnboardingStep guardedAction (the server is the source of truth).
//    The current step index is also kept in localStorage purely so a detour
//    into the docs resumes instead of restarting (the server counter has no
//    room for it).
//  - First-project tour: ?onboard=first-project, Trial-aware, not synced.
//  - Replay: <TourReplayButton /> anywhere under the layout.
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setOnboardingStep } from "@/lib/actions/onboarding";
import { FP_SHOWN_KEY, ONBOARDED_KEY, TOUR_STEP_KEY } from "@/lib/local-state";
import { clampStep, firstProjectSteps, onboardingSteps, type TourStep, type TourTrial } from "./steps";
import { TourOverlay } from "./tour-overlay";
import "./tour.css";

const START_DELAY_MS = 700;

function store(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
function read(kind: "local" | "session", key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function write(kind: "local" | "session", key: string, value: string | null) {
  try {
    if (value === null) store(kind)?.removeItem(key);
    else store(kind)?.setItem(key, value);
  } catch {
    // storage blocked: the tour just won't resume mid-way
  }
}

interface ActiveTour {
  steps: TourStep[];
  index: number;
  /** true for the onboarding auto-tour: completion goes to the server. */
  sync: boolean;
}

const TourContext = createContext<{ replay: () => void } | null>(null);

export function TourProvider({
  children,
  onboarding,
  trial,
  basePxPerHour,
}: {
  children: ReactNode;
  /** Server onboarding state; null when it couldn't be read. */
  onboarding: { done: boolean } | null;
  trial: TourTrial | null;
  basePxPerHour: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tour, setTour] = useState<ActiveTour | null>(null);
  const steps = useMemo(() => onboardingSteps(basePxPerHour), [basePxPerHour]);

  // Decide once per entry into the projects section.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Read straight from the URL (client-only effect): no useSearchParams, so
    // the layout needs no Suspense boundary around the whole section.
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboard") === "first-project") {
      const rest = new URLSearchParams(params);
      rest.delete("onboard");
      router.replace(pathname + (rest.size ? `?${rest}` : ""), { scroll: false });
      if (read("session", FP_SHOWN_KEY) !== "1") {
        timer = setTimeout(() => {
          write("session", FP_SHOWN_KEY, "1");
          setTour({ steps: firstProjectSteps(trial, basePxPerHour), index: 0, sync: false });
        }, START_DELAY_MS);
      }
      return () => clearTimeout(timer);
    }
    const pending = onboarding ? !onboarding.done : read("local", ONBOARDED_KEY) !== "1";
    if (onboarding?.done) {
      write("local", ONBOARDED_KEY, "1");
      write("local", TOUR_STEP_KEY, null);
    }
    if (pending) {
      const saved = read("local", TOUR_STEP_KEY);
      timer = setTimeout(
        () => setTour({ steps, index: saved != null ? clampStep(saved, steps.length) : 0, sync: true }),
        START_DELAY_MS,
      );
    }
    return () => clearTimeout(timer);
    // Mount-only on purpose: stripping ?onboard must not re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = useCallback((t: ActiveTour, index: number) => {
    if (t.sync) write("local", TOUR_STEP_KEY, String(index));
    setTour({ ...t, index });
  }, []);

  const close = useCallback((t: ActiveTour) => {
    setTour(null);
    write("local", ONBOARDED_KEY, "1");
    if (t.sync) {
      write("local", TOUR_STEP_KEY, null);
      void setOnboardingStep({ step: 2 }).catch(() => {});
    }
  }, []);

  const replay = useCallback(() => setTour({ steps, index: 0, sync: false }), [steps]);
  const ctx = useMemo(() => ({ replay }), [replay]);

  return (
    <TourContext.Provider value={ctx}>
      {children}
      {tour ? (
        <TourOverlay
          steps={tour.steps}
          index={tour.index}
          onSkip={() => close(tour)}
          onBack={() => goTo(tour, Math.max(tour.index - 1, 0))}
          onNext={() => {
            const step = tour.steps[tour.index];
            if (tour.index >= tour.steps.length - 1) return close(tour);
            if (step.nextRoute) router.push(step.nextRoute);
            goTo(tour, tour.index + 1);
          }}
          onExtra={(href) => {
            // Detour: resume past this step when the player comes back.
            if (tour.sync) write("local", TOUR_STEP_KEY, String(Math.min(tour.index + 1, tour.steps.length - 1)));
            setTour(null);
            router.push(href);
          }}
        />
      ) : null}
    </TourContext.Provider>
  );
}

/** "Replay the tour" button; renders nothing outside the projects layout. */
export function TourReplayButton() {
  const ctx = useContext(TourContext);
  if (!ctx) return null;
  return (
    <button type="button" className="btn ghost" onClick={ctx.replay} title="New here? Replay the tour">
      TOUR
    </button>
  );
}
