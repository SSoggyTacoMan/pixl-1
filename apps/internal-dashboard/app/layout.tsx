import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getAccess } from "@/lib/guard";
import { countPendingReviews, countOpenReports, countPendingOrders } from "@/lib/db";
import { ticketStats } from "@/lib/tickets";
import { Shell } from "@/app/_components/Shell";
import { LiveModeProvider } from "@/app/_components/LiveMode";
import { LiveModeToggle } from "@/app/_components/LiveModeToggle";
import { ReviewCelebration } from "@/app/_components/ReviewCelebration";
import { getLiveMode, getHideReviewers } from "@/lib/liveModeServer";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const jetbrainsMonoHeading = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Pixl HQ",
  description: "The Pixl team's home for reviews, players, and pixels",
  // Internal admin tool , keep it out of search entirely so it never competes
  // with pixl.hackclub.com (the actual landing page) for "pixl hackclub".
  // Deliberately not paired with a robots.txt disallow: that would stop
  // Google from crawling the page at all, which means it can never see this
  // noindex tag and drop an already-indexed URL from its results.
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccess();
  const session = access?.session ?? null;
  // SidebarProvider writes this cookie on every toggle but never reads it
  // back itself (components/ui/sidebar.tsx) - without passing it in as
  // defaultOpen, the sidebar silently reopened on every fresh page load.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  const live = await getLiveMode();
  const hideReviewers = await getHideReviewers();
  // Owners see everything; reviewers the review area; helpers tickets;
  // fulfillers the order queue. Each page re-checks with requirePage().
  const owner = !!access?.isOwner;
  const helper = !!access?.isHelper;
  const fulfiller = !!access?.isFulfiller;
  const nav = access
    ? {
        overview: owner,
        players: owner,
        projects: owner || access.isReviewer,
        review: owner || access.isReviewer,
        pixels: !live && owner,
        moderation: !live && owner,
        ideas: owner,
        reports: !live && owner,
        tickets: helper,
        notify: owner,
        admins: owner,
        reviewers: owner,
        slackLookup: !live && owner,
        referrals: !live && owner,
        online: owner,
        shop: owner,
        events: owner,
        operations: owner,
        sidequests: owner,
        story: owner,
        goals: owner,
        news: owner,
        showNTell: owner,
        fulfillment: !live && fulfiller,
        forms: owner,
        audit: owner,
      }
    : null;
  const reviewCount =
    nav?.review && access
      ? await countPendingReviews({ viewer: access.session.slackId })
      : 0;
  const reportCount = nav?.reports ? await countOpenReports() : 0;
  const ticketCount = helper ? (await ticketStats()).open : 0;
  const orderCount = nav?.fulfillment ? await countPendingOrders() : 0;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        geist.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
        jetbrainsMonoHeading.variable,
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var html = document.documentElement;
  try {
    var t = localStorage.getItem("theme");
    if (t !== "light") {
      html.classList.add("dark");
    }
  } catch(e) {}
  document.addEventListener("click", function(e) {
    var themeBtn = e.target.closest("[data-theme-toggle]");
    if (themeBtn) {
      html.classList.toggle("dark");
      var dark = html.classList.contains("dark");
      document.querySelectorAll("[data-theme-toggle]").forEach(function(b) {
        b.textContent = dark ? "☀" : "☾";
      });
      try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch(e) {}
    }
  });
})();
`,
          }}
        />
      </head>
      <body className="min-h-screen">
        {session && <ReviewCelebration />}
        {session && nav ? (
          // <Shell
          //   session={{ name: session.name, slackId: session.slackId }}
          //   nav={nav}
          //   reviewCount={reviewCount}
          // >
          //   {children}
          // </Shell>
          <LiveModeProvider live={live} hideReviewers={hideReviewers} viewer={session?.slackId ?? ""}>
          <SidebarProvider defaultOpen={sidebarOpen}>
            <Shell
              session={{ name: session.name, slackId: session.slackId }}
              nav={nav}
              reviewCount={reviewCount}
              reportCount={reportCount}
              ticketCount={ticketCount}
              orderCount={orderCount}
            />

            <main className="flex-1 min-w-0 overflow-x-clip flex flex-col gap-4">
              <div className="bg-command-background/40 backdrop-blur-xl backdrop-saturate-150 shadow-2xl shadow-black/30 w-full h-10 sticky top-0 z-100 p-2 flex items-center justify-between">
                <SidebarTrigger />
                <LiveModeToggle live={live} />
              </div>
              <div className="px-10">{children}</div>
            </main>
          </SidebarProvider>
          </LiveModeProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
