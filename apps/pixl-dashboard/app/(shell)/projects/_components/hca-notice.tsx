import { Notice } from "@/components/ui/primitives";

// Shown after the Hack Club Auth resync flow returns with ?hca_synced=<status>.
const HCA_SYNCED: Record<string, [string, boolean]> = {
  verified: ["Verified with Hack Club Auth. You can ship now.", false],
  pending: ["Hack Club Auth still shows your verification as pending. Try again once it's approved.", true],
  needs_submission: ["Hack Club Auth still needs you to finish verifying.", true],
  ineligible: [
    "Hack Club Auth has this identity as ineligible for YSWS programs. If you think that's a mistake, reach out to the Pixl team.",
    true,
  ],
  unknown: ["Hack Club Auth didn't return a verification status. Try again in a bit.", true],
};

export function HcaSyncedNotice({ value }: { value: string | undefined }) {
  if (value === undefined) return null;
  const [text, bad] = Object.hasOwn(HCA_SYNCED, value) ? HCA_SYNCED[value] : HCA_SYNCED.unknown;
  return (
    <Notice tone={bad ? "bad" : "good"} className="mb-4">
      {text}
    </Notice>
  );
}
