"use client";

import { useEffect } from "react";
import { Button, Card, EmptyState } from "@/app/_ui/ui";

// Server Actions are versioned per build and this app auto-deploys on every
// push to main, so a tab left open across a deploy holds stale action ids and
// its next click fails with "Failed to find Server Action". next.config's
// deploymentId catches most of these on navigation; this catches the rest by
// reloading once (a sessionStorage flag stops a reload loop).
// See https://nextjs.org/docs/messages/failed-to-find-server-action
const STALE = /failed to find server action|older or newer deployment/i;
const RELOAD_FLAG = "pixl:stale-reload";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isStaleDeploy = STALE.test(error.message);

  useEffect(() => {
    if (!isStaleDeploy) return;
    let reloaded = false;
    try {
      reloaded = sessionStorage.getItem(RELOAD_FLAG) === location.pathname;
      sessionStorage.setItem(RELOAD_FLAG, location.pathname);
    } catch {
      // storage blocked: reload anyway
    }
    if (!reloaded) window.location.reload();
  }, [isStaleDeploy]);

  useEffect(() => {
    if (!isStaleDeploy) console.error(error);
  }, [error, isStaleDeploy]);

  return (
    <div className="mx-auto max-w-md pt-16">
      <Card>
        {isStaleDeploy ? (
          <EmptyState title="New version deployed" icon="history">
            Reloading to pick it up. Your last click didn&apos;t go through, so do it again after the reload.
          </EmptyState>
        ) : (
          <EmptyState title="Something broke" icon="important">
            {error.digest ? `Error ${error.digest} was logged.` : error.message || "Unknown error."}
          </EmptyState>
        )}
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          {!isStaleDeploy && <Button onClick={() => reset()}>Try again</Button>}
        </div>
      </Card>
    </div>
  );
}
