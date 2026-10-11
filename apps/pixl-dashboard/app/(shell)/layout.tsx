import { headers } from "next/headers";
import { serverApi } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { GAME_URL } from "@/lib/urls";
import { Gate } from "./gate";
import { ShellNav } from "./shell-nav";

interface Wallet {
  pixels: number;
  re: number;
}
interface EventsActive {
  community_re: number;
}

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  // Verified locally against JWT_SECRET on every request.
  const session = await getSession();

  if (!session) {
    // proxy.ts forwards the requested path so the no-JS login link returns
    // to the same page; safeNext() re-checks it server side.
    const h = await headers();
    return <Gate next={h.get("x-pixl-path") ?? "/dashboard"} />;
  }

  const [wallet, events] = await Promise.all([
    serverApi<Wallet>("/api/profile/wallet"),
    serverApi<EventsActive>("/api/events/active"),
  ]);

  return (
    <>
      <ShellNav
        game={GAME_URL}
        displayName={session.displayName}
        pixels={wallet ? Math.round(wallet.pixels) : 0}
        re={wallet ? Math.round(wallet.re) : 0}
        communityRe={events ? Math.round(events.community_re) : 0}
      />
      <div className="shell-main">
        <main className="wrap">{children}</main>
      </div>
    </>
  );
}
