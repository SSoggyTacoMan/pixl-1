import { serverGet } from "@/lib/server-api";
import { EmptyNote, Notice, PageHeader } from "@/components/ui/primitives";
import { OrderCard, type Order } from "./order-card";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const res = await serverGet<{ orders?: Order[] }>("/api/shop/orders");
  const orders = res.ok ? (res.data.orders ?? []) : [];

  return (
    <>
      <PageHeader
        title="YOUR ORDERS"
        sub="Everything you've spent pixels on, and where it is in fulfilment"
      />
      <p className="mb-4 text-dim">We&apos;ll DM you the tracking number the moment it ships.</p>
      {!res.ok ? (
        <Notice tone="bad">Couldn&apos;t load your orders right now.</Notice>
      ) : orders.length === 0 ? (
        <EmptyNote>
          NO ORDERS YET.
          <br />
          HEAD TO THE SHOP AND SPEND SOME OF THOSE HARD-EARNED PIXELS.
        </EmptyNote>
      ) : (
        <div className="mt-[10px] flex flex-col gap-[14px]">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </>
  );
}
