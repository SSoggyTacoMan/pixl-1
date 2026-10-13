import Link from "next/link";
import { cityCountry } from "@/lib/address-summary";
import { buttonVariants, emptyNote } from "@/components/ui/primitives";
import { publicGet, serverApi } from "@/lib/server-api";
import { getSession } from "@/lib/session";
import { loginUrl } from "@/lib/urls";
import { normalizeItems, type ShopItemsResponse } from "../shop-lib";
import { earnRates } from "../../calc/estimates";
import { ItemDetail, type CheckoutEligibility } from "./item-detail";

export const metadata = { title: "Shop item" };

interface EligibilityResponse {
  ok?: boolean;
  hasAddress?: boolean;
  hasPhone?: boolean;
  // apps/server only sends city/country; street lines stay server side.
  addressCity?: string | null;
  addressCountry?: string | null;
}

// Only what the checkout confirm needs reaches the client: a city/country
// summary and two flags.
function toCheckout(e: EligibilityResponse | null): CheckoutEligibility {
  if (!e || !e.ok) return { hasAddress: false, hasPhone: false, summary: "" };
  const place = cityCountry(e);
  return { hasAddress: !!e.hasAddress, hasPhone: !!e.hasPhone, summary: place || "your address on file" };
}

export default async function ShopItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ addr_verified_return?: string; addr_verified?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const itemId = Number(id);
  // Signed out: public catalog only, nothing personal to fetch (see ShopPage).
  const session = await getSession();
  const [data, wallet, elig] = await Promise.all([
    session ? serverApi<ShopItemsResponse>("/api/shop/items") : publicGet<ShopItemsResponse>("/api/shop/items"),
    session ? serverApi<{ pixels: number }>("/api/profile/wallet") : null,
    session ? serverApi<EligibilityResponse>("/api/profile/eligibility") : null,
  ]);
  const item = Number.isSafeInteger(itemId) ? normalizeItems(data?.items).find((i) => i.id === itemId) : undefined;

  return (
    <>
      <Link
        className="mb-[14px] inline-block font-pixel tracking-[1px] text-gold hover:text-gold-soft"
        href="/shop"
      >
        ← BACK TO SHOP
      </Link>
      {item ? (
        <ItemDetail
          key={item.id}
          item={item}
          xp={Number(data?.xp || 0)}
          claimed={(data?.claimed ?? []).map(Number).includes(item.id)}
          pixels={wallet ? Number(wallet.pixels) : null}
          eligibility={toCheckout(elig)}
          rates={earnRates()}
          loginHref={session ? null : loginUrl(`/shop/${item.id}`)}
          verifyReturn={sp.addr_verified_return ? (sp.addr_verified === "1" ? "ok" : "failed") : null}
        />
      ) : (
        <div className={emptyNote}>
          CAN&apos;T FIND THAT ITEM.
          <br />
          IT MAY HAVE SOLD OUT OR VANISHED.
          <div className="mt-4">
            <Link className={buttonVariants({ variant: "dark" })} href="/shop">
              BACK TO THE SHELVES
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
