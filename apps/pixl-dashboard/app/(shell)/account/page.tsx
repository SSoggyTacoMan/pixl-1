import type { Metadata } from "next";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/primitives";
import { serverApi } from "@/lib/server-api";
import { FlowButton } from "./flow-button";

export const metadata: Metadata = { title: "Account" };

interface Eligibility {
  ok: boolean;
  birthday?: string | null;
  age?: number | null;
  yswsEligible?: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  addressPostal?: string | null;
}

function fmtBirthday(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const NOT_ON_FILE = "Not on file yet. Re-sync from Hack Club Auth to pull it in.";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ needs?: string }>;
}) {
  const { needs } = await searchParams;
  const data = await serverApi<Eligibility>("/api/profile/eligibility");
  const ok = !!data?.ok;

  const address = ok
    ? [
        data!.addressLine1,
        data!.addressLine2,
        [data!.addressCity, data!.addressState].filter(Boolean).join(", "),
        [data!.addressCountry, data!.addressPostal].filter(Boolean).join(" "),
      ].filter((s): s is string => !!s)
    : [];

  return (
    <>
      <PageHeader
        title="ACCOUNT"
        sub="Your birthday and mailing address, pulled from your Hack Club identity. Hack Club needs these on file for shipped projects and shop orders."
      />

      <div className="flex flex-col gap-4">
        {needs === "legal-name" ? (
          <Notice>
            <p className="mb-2 font-semibold">One more step: add your legal name</p>
            <p className="mb-3">
              Hack Club needs your legal name on file before projects can be reviewed or orders shipped. It&apos;s set
              on Hack Club Auth and only used for fulfillment.
            </p>
            <FlowButton name="legal-name" label="ADD LEGAL NAME" />
          </Notice>
        ) : null}

        {!ok ? <Notice tone="bad">Couldn&apos;t load your account details. Refresh to try again.</Notice> : null}

        {ok && data!.birthday && data!.yswsEligible === false ? (
          <Notice tone="bad">
            <p className="font-pixel">NOT ELIGIBLE FOR YSWS PROGRAMS</p>
            <p className="mt-1">
              You&apos;re {data!.age}, and Hack Club&apos;s YSWS programs (including Pixl) are for people under 19. You
              can still explore Pixl, but shipped projects won&apos;t be eligible for review or shop rewards.
            </p>
          </Notice>
        ) : null}

        <Card>
          <CardTitle>BIRTHDAY</CardTitle>
          <p className="mb-2 text-sm text-dim">Comes from your Hack Club identity.</p>
          <p className={data?.birthday ? "text-ink" : "italic text-muted"}>
            {ok && data!.birthday
              ? `${fmtBirthday(data!.birthday)}${data!.age != null ? ` (age ${data!.age})` : ""}`
              : NOT_ON_FILE}
          </p>
        </Card>

        <Card>
          <CardTitle>MAILING ADDRESS</CardTitle>
          <p className="mb-2 text-sm text-dim">
            Where we&apos;d ship a physical shop order or prize, also from your Hack Club identity. You&apos;ll get a
            chance to verify it&apos;s current right before you order.
          </p>
          {address.length ? (
            <address className="not-italic text-ink">
              {address.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </address>
          ) : (
            <p className="italic text-muted">{NOT_ON_FILE}</p>
          )}
        </Card>

        <Card className="text-sm">
          <p className="mb-3">
            Something wrong here? Update it on{" "}
            <a href="https://auth.hackclub.com" target="_blank" rel="noopener noreferrer">
              Hack Club Auth
            </a>{" "}
            first, then re-sync. A plain log out and back in does not pull a fresh address.
          </p>
          <div className="flex flex-wrap gap-2">
            <FlowButton name="verify-address" label="VERIFY ADDRESS" />
            <FlowButton name="resync" label="RE-SYNC FROM HACK CLUB AUTH" variant="ghost" />
          </div>
        </Card>
      </div>
    </>
  );
}
