import Link from "next/link";
import { serverApi } from "@/lib/server-api";
import { normalizeItems, type ShopItemsResponse } from "../shop-lib";
import { earnRates } from "../../calc/estimates";
import { ItemDetail, type CheckoutEligibility } from "./item-detail";
import "../shop.css";

export const metadata = { title: "Shop item" };

interface EligibilityResponse {
  ok?: boolean;
  hasAddress?: boolean;
  hasPhone?: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  addressPostal?: string | null;
}

// Only what the checkout confirm needs leaves the server: a one-line
// address summary and two flags, never the raw address fields.
function toCheckout(e: EligibilityResponse | null): CheckoutEligibility {
  if (!e || !e.ok) return { hasAddress: false, hasPhone: false, summary: "" };
  const summary = [
    e.addressLine1,
    e.addressLine2,
    [e.addressCity, e.addressState].filter(Boolean).join(", "),
    [e.addressCountry, e.addressPostal].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
  return { hasAddress: !!e.hasAddress, hasPhone: !!e.hasPhone, summary };
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
  const [data, wallet, elig] = await Promise.all([
    serverApi<ShopItemsResponse>("/api/shop/items"),
    serverApi<{ pixels: number }>("/api/profile/wallet"),
    serverApi<EligibilityResponse>("/api/profile/eligibility"),
  ]);
  const item = Number.isSafeInteger(itemId) ? normalizeItems(data?.items).find((i) => i.id === itemId) : undefined;

  return (
    <>
      <Link className="back-link" href="/shop">
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
          verifyReturn={sp.addr_verified_return ? (sp.addr_verified === "1" ? "ok" : "failed") : null}
        />
      ) : (
        <div className="empty-note">
          CAN&apos;T FIND THAT ITEM.
          <br />
          IT MAY HAVE SOLD OUT OR VANISHED.
          <div className="mt-4">
            <Link className="btn dark" href="/shop">
              BACK TO THE SHELVES
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
