import { notFound, permanentRedirect } from "next/navigation";
import { LandingPage, landingMetadata } from "../_landing/LandingPage";
import { hasLocale, locales } from "../_landing/dictionaries";

// Only the five landing locales exist here. dynamicParams = false means any
// other single segment 404s instead of rendering, so this route can never
// swallow /dashboard, /shop, /docs, /login and friends (those are static
// segments and win anyway; this is the belt to that brace).
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return landingMetadata(hasLocale(lang) ? lang : "en");
}

export default async function LocaleHome({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  // English is served at the bare root.
  if (lang === "en") permanentRedirect("/");
  return <LandingPage locale={lang} />;
}
