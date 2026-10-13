import { publicGet, serverApi } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { EmptyNote, PageHeader } from "@/components/ui/primitives";
import { normalizeItems, type ShopItemsResponse } from "./shop-lib";
import { earnRates } from "../calc/estimates";
import { ShopBrowser } from "./shop-browser";

export const metadata = { title: "Shop" };

interface Wallet {
  pixels: number;
}

export default async function ShopPage() {
  // Signed out, the catalog comes from the same route without a session (the
  // server defaults every personal field), and there's no wallet to read.
  const session = await getSession();
  const [data, wallet] = await Promise.all([
    session ? serverApi<ShopItemsResponse>("/api/shop/items") : publicGet<ShopItemsResponse>("/api/shop/items"),
    session ? serverApi<Wallet>("/api/profile/wallet") : null,
  ]);

  return (
    <>
      <PageHeader title="THE SHOP" sub="Spend the pixels you earn shipping real projects" />
      {data ? (
        <ShopBrowser
          items={normalizeItems(data.items)}
          xp={Number(data.xp || 0)}
          claimed={(data.claimed ?? []).map(Number)}
          region={data.region ?? "US"}
          pixels={wallet ? Number(wallet.pixels) : null}
          rates={earnRates()}
          signedIn={!!session}
        />
      ) : (
        <EmptyNote>COULDN&apos;T REACH THE SHOP SERVER.<br />TRY AGAIN IN A BIT.</EmptyNote>
      )}
    </>
  );
}
