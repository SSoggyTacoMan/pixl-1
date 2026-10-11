import { LandingPage, landingMetadata } from "./_landing/LandingPage";

// "/" is the English landing page; other locales live at /fr, /es, /pt, /hi.
export function generateMetadata() {
  return landingMetadata("en");
}

export default function Home() {
  return <LandingPage locale="en" />;
}
