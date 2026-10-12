"use client";

// Starts a Hack Club Auth redirect flow: POST /auth/flow/:name (Bearer, via
// the startAuthFlow Server Action) returns the URL, then the browser goes there.
import { Button } from "@/components/ui/primitives";
import { goTo, useAction } from "@/components/use-action";
import { startAuthFlow } from "@/lib/actions/flows";

export function FlowButton({
  name,
  label,
  returnTo = "/account",
  variant,
}: {
  name: "verify-address" | "resync" | "legal-name";
  label: string;
  returnTo?: string;
  variant?: "ghost" | "dark" | "teal";
}) {
  const { run, pending, error, setError } = useAction(startAuthFlow);

  async function start() {
    const res = await run({ name, returnTo });
    if (res.ok && !goTo(res.data.url)) setError("The server didn't return a valid link. Try again.");
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant={variant} onClick={start} disabled={pending}>
        {pending ? "OPENING..." : label}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-bad">
          {error}
        </span>
      ) : null}
    </span>
  );
}
