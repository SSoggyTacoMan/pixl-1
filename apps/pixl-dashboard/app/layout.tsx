import type { Metadata } from "next";
import { JetBrains_Mono, Pixelify_Sans, Poppins } from "next/font/google";
import { headers } from "next/headers";
import { config } from "@/app/_generated/config";
import "./globals.css";

// next/font self-hosts the font files at build time (served from this app's
// own origin), which also keeps font-src 'self' in the CSP sufficient.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-pixelify-sans",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(config.urls.site),
  title: { default: "Pixl", template: "%s | Pixl" },
  description: config.tagline,
};

// Static, constant script (no user input): applies the saved font and theme
// before first paint so the page never flashes. Carries the per-request CSP
// nonce from proxy.ts.
const PRE_PAINT = `try{var d=document.documentElement;if(localStorage.getItem("pixl_font")==="phantom")d.dataset.font="phantom";var t=localStorage.getItem("pixl_theme_v2");if(t==="dark"||t==="light")d.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers() makes every route dynamic, which the nonce CSP needs.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${pixelifySans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
