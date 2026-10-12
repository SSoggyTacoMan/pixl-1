import type { Metadata } from "next";
import { config } from "@/app/_generated/config";
import { Card, CardTitle, EmptyNote, PageHeader } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { CopyButton } from "../explore/_components/copy-button";
import { ApplyForm } from "./apply-form";
import { applyCardState, referralLink, TIERS, type ReferralMe } from "./lib";
import "./refers.css";

export const metadata: Metadata = { title: "Referrals" };

function Stat({ n, label }: { n: string | number; label: string }) {
  return (
    <div className="rf-stat">
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  );
}

export default async function RefersPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const sp = await searchParams;
  const prefill = Array.isArray(sp.code) ? (sp.code[0] ?? "") : (sp.code ?? "");
  // GET /api/referral/me (session). Assigns the code on first visit.
  const res = await serverGet<ReferralMe>("/api/referral/me");

  return (
    <div className="rf-wrap">
      <PageHeader
        title="REFERRALS"
        sub="Share your code. When someone you refer ships their first qualifying project, you both get paid."
      />
      {!res.ok ? (
        <EmptyNote>COULDN&apos;T LOAD YOUR REFERRAL INFO.<br />TRY AGAIN IN A BIT.</EmptyNote>
      ) : (
        <Body me={res.data} prefill={prefill} />
      )}
    </div>
  );
}

function Body({ me, prefill }: { me: ReferralMe; prefill: string }) {
  const link = referralLink(config.urls.site, me.code);
  const state = applyCardState(me);
  const r = me.referrals ?? { total: 0, rewarded: 0, pixelsEarned: 0 };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardTitle className="mb-3 text-gold">YOUR CODE</CardTitle>
        <div className="rf-code-row">
          <span className="rf-code">{me.code}</span>
          <CopyButton text={me.code} label="COPY CODE" />
        </div>
        <div className="rf-code-row mt-3">
          <span className="rf-link">{link}</span>
          <CopyButton text={link} label="COPY LINK" />
        </div>
        <p className="rf-note">
          The first time a project shipped by the person you referred hits one of these hour marks, you get paid,
          based on that project&apos;s hours, whichever ship it happens to be:
        </p>
        <div className="rf-tiers">
          {TIERS.map((t) => (
            <div className="rf-tier" key={t.hrs}>
              <div className="hrs">{t.hrs} SHIPPED BY THEM</div>
              <div className="amt">{t.amt}</div>
              <div className="usd">{t.usd}</div>
            </div>
          ))}
        </div>
        <p className="rf-note">
          This pays out once per referral. Refer 10 people who all ship and you get a <b>+83px</b> (~$8.30) milestone
          bonus, again every 10 after that.
        </p>
        <p className="rf-note">
          Worth mentioning when you share your code: the person you refer gets something too, <b>+4px/hr</b>{" "}
          (~$0.40/hr) extra on their own first shipped project.
        </p>
      </Card>

      {state === "boost-active" || state === "boost-used" ? (
        <Card>
          <CardTitle className="mb-3 text-gold">YOUR REFERRAL BOOST</CardTitle>
          <div className="rf-used">
            {state === "boost-active" ? (
              <>
                <span className="rf-chip">+4px/hr ACTIVE</span> applies to your next shipped project
              </>
            ) : (
              "You've used your referral boost, back to your normal rate now."
            )}
          </div>
          <div className="rf-boost-bar">
            <div style={{ width: state === "boost-active" ? "0%" : "100%" }} />
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle className="mb-3 text-gold">GOT A CODE?</CardTitle>
          {state === "apply" ? (
            <>
              <p className="rf-note mb-3 mt-0">
                Enter the code whoever referred you shared. You&apos;ll get +4px/hr on your first shipped project.
              </p>
              <ApplyForm prefill={prefill} />
            </>
          ) : (
            <p className="rf-note mt-0">
              Referral codes can only be applied within your first {me.referralWindowHours} hours on Pixl, that
              window&apos;s closed for your account.
            </p>
          )}
        </Card>
      )}

      <Card>
        <CardTitle className="mb-3 text-gold">YOUR REFERRALS</CardTitle>
        {r.total === 0 ? (
          <EmptyNote>
            NOBODY&apos;S USED YOUR CODE YET.
            <br />
            SHARE IT AROUND.
          </EmptyNote>
        ) : (
          <div className="rf-stats">
            <Stat n={r.total} label="REFERRED" />
            <Stat n={r.rewarded} label="REWARDED" />
            <Stat n={`${r.pixelsEarned}px`} label="EARNED" />
          </div>
        )}
      </Card>
    </div>
  );
}
