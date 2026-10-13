import type { Metadata } from "next";
import { EmptyNote, Notice, pageSub, pageTitle, panelDeep } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { serverGet } from "@/lib/server-api";
import type { VaultData } from "./vault-lib";
import { Chamber, Gauge, Leaderboard } from "./vault-parts";

export const metadata: Metadata = { title: "The Core Vault" };

export default async function VaultPage() {
  const res = await serverGet<VaultData>("/api/vault");
  const data = res.ok ? { ...res.data, levels: res.data.levels ?? [], energy: res.data.energy || 0 } : null;

  return (
    <div className="mx-auto max-w-[960px]">
      <section className="px-[20px] pt-[24px] pb-[4px] text-center">
        <h1 className={pageTitle}>THE CORE VAULT</h1>
        <div className={cn(pageSub, "text-teal")}>EVERY SHIP FEEDS RESTORATION ENERGY, THE COMMUNITY RECOVERS THE VAULT TOGETHER</div>
      </section>

      {!data ? (
        <Notice tone="bad" className="mt-6">
          Couldn&apos;t load the vault.
        </Notice>
      ) : (
        <>
          <Gauge data={data} />
          <Leaderboard data={data} />
          {data.levels.length === 0 ? (
            <EmptyNote>THE VAULT IS SEALED, NO LEVELS CONFIGURED YET.</EmptyNote>
          ) : (
            <>
              <div className="mt-[28px] flex flex-col gap-[16px]">
                {data.levels.map((l, i) => (
                  <Chamber key={l.level} level={l} energy={data.energy} index={i} />
                ))}
              </div>
              <div className={cn(panelDeep, "mt-[34px] mb-[10px] px-[20px] py-[16px] text-[14px] leading-[1.75] text-dim")}>
                The Core is a vault holding the old civilization&apos;s technology. As the community pours in{" "}
                <b className="text-teal">Restoration Energy</b>, it recovers another chamber, and hands the equipment inside back to{" "}
                <b className="text-teal">everyone</b>. These aren&apos;t gifts from an NPC. They&apos;re what the Core has finally managed
                to restore.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
