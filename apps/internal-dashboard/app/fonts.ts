import {
  Atkinson_Hyperlegible,
  Fira_Code,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Inter,
  JetBrains_Mono,
  Source_Code_Pro,
} from "next/font/google";

// Every font a staff member can pick on /settings (FONTS / MONO_FONTS in
// lib/staffSettings.ts), self-hosted by next/font. Only the defaults preload:
// the rest download the first time someone picks one or opens the picker.
// Phantom Sans and the system stacks aren't here, they need no loader.
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", preload: false });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", preload: false });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: "variable", variable: "--font-plex-sans", preload: false });
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  preload: false,
});
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", preload: false });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code", preload: false });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-plex-mono",
  preload: false,
});
const sourceCodePro = Source_Code_Pro({ subsets: ["latin"], variable: "--font-source-code-pro", preload: false });

/** Goes on <html> so every font's CSS variable is defined for app/_ui/fonts.css. */
export const fontVariables = [
  jetbrainsMono,
  inter,
  geist,
  plexSans,
  atkinson,
  geistMono,
  firaCode,
  plexMono,
  sourceCodePro,
]
  .map((f) => f.variable)
  .join(" ");
