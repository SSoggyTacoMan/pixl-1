import { serverApi } from "@/lib/server-api";
import { EmptyNote, PageHeader } from "@/components/ui/primitives";
import { normalizeItems, type ShopItemsResponse } from "./shop-lib";
import { earnRates } from "../calc/estimates";
import { ShopBrowser } from "./shop-browser";
import "./shop.css";

export const metadata = { title: "Shop" };

interface Wallet {
  pixels: number;
}

export default async function ShopPage() {
  const [data, wallet] = await Promise.all([
    serverApi<ShopItemsResponse>("/api/shop/items"),
    serverApi<Wallet>("/api/profile/wallet"),
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
        />
      ) : (
        <EmptyNote>COULDN&apos;T REACH THE SHOP SERVER.<br />TRY AGAIN IN A BIT.</EmptyNote>
      )}
    </>
  );
}
