import type { Metadata } from "next";
import { EmptyNote, Notice } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import type { VaultData } from "./vault-lib";
import { Chamber, Gauge, Leaderboard } from "./vault-parts";
import "./vault.css";

export const metadata: Metadata = { title: "The Core Vault" };

export default async function VaultPage() {
  const res = await serverGet<VaultData>("/api/vault");
  const data = res.ok ? { ...res.data, levels: res.data.levels ?? [], energy: res.data.energy || 0 } : null;

  return (
    <div className="vault-page">
      <section className="v-hero">
        <h1 className="page-title">THE CORE VAULT</h1>
        <div className="page-sub">EVERY SHIP FEEDS RESTORATION ENERGY, THE COMMUNITY RECOVERS THE VAULT TOGETHER</div>
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
              <div className="chambers">
                {data.levels.map((l, i) => (
                  <Chamber key={l.level} level={l} energy={data.energy} index={i} />
                ))}
              </div>
              <div className="lore panel-deep">
                The Core is a vault holding the old civilization&apos;s technology. As the community pours in{" "}
                <b>Restoration Energy</b>, it recovers another chamber, and hands the equipment inside back to{" "}
                <b>everyone</b>. These aren&apos;t gifts from an NPC. They&apos;re what the Core has finally managed
                to restore.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
