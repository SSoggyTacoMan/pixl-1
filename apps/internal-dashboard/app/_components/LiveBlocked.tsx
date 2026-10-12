import { Card, EmptyState } from "@/app/_ui/ui";

// Stand-in for a page that is nothing but PII (fulfillment, Slack lookup, ...)
// while live mode is on. Rendered instead of the page, so the data is never
// even fetched.
export function LiveBlocked({
  what,
  reason = "This page is full of personal details",
}: {
  what: string;
  reason?: string;
}) {
  return (
    <div className="mx-auto mt-10 max-w-lg">
      <Card>
        <EmptyState title={`${what} is hidden in live mode`} icon="private">
          {reason}, so it stays closed while you are live. Turn off live mode in the top bar to open it.
        </EmptyState>
      </Card>
    </div>
  );
}
