/* eslint-disable @next/next/no-img-element */
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/guard";
import { getSession } from "@/lib/session";
import { Button, Card } from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

export default async function RemovedPage() {
  const access = await getAccess();
  if (access) redirect("/");
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <div className="flex flex-col items-center gap-4 text-center">
            <img src="/logo.png" alt="Pixl" width={64} height={64} />
            <h1 className="hc-title">You&apos;ve been removed from the team</h1>
            <p className="hc-caption text-sm">
              Hey {session.name || "there"}, your access to the Pixl dashboard has been removed, so
              there&apos;s nothing for you here anymore. If you think this was a mistake, reach out to
              the Pixl team and they&apos;ll sort you out.
            </p>
            <form action="/api/auth/logout" method="post" className="w-full">
              <Button type="submit" variant="outline" icon="door-leave" className="w-full justify-center">
                Sign out
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </main>
  );
}
