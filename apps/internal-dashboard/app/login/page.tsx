/* eslint-disable @next/next/no-img-element */
import { Callout, Card, Icon, buttonClass } from "@/app/_ui/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    error === "denied"
      ? "That Hack Club account isn't linked to a Pixl team member. If you think that's a mistake, contact the Pixl team."
      : error
        ? "Sign-in failed. Try again."
        : null;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Card>
          <div className="flex flex-col items-center gap-4 text-center">
            <img src="/logo.png" alt="Pixl" width={64} height={64} />
            <div>
              <h1 className="hc-title">Pixl</h1>
              <p className="hc-caption mt-1 text-sm">Access is limited to approved Hack Club accounts.</p>
            </div>
            {message && (
              <div className="w-full text-left">
                <Callout tone="danger" icon="important">
                  {message}
                </Callout>
              </div>
            )}
            {/* A plain <a>, not next/link: the login route sets the OAuth state
                cookie, so it must never be prefetched or fetched as RSC. */}
            <a href="/api/auth/login" className={`${buttonClass("primary", "lg")} w-full justify-center`}>
              <Icon glyph="door-enter" size={22} />
              Sign in with Hack Club
            </a>
          </div>
        </Card>
      </div>
    </main>
  );
}
