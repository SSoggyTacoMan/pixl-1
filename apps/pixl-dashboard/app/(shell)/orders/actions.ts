"use server";

import { z } from "zod";
import { guardedAction } from "@/lib/guarded-action";

/** Only pending orders can be cancelled; apps/server enforces that and refunds. */
export const cancelOrder = guardedAction(
  "shop.order_cancel",
  z.object({ id: z.number().int().positive() }),
  (input) => ({ method: "POST", path: `/api/shop/orders/${input.id}/cancel`, target: `order:${input.id}` }),
  { revalidate: ["/orders"], pick: (d: { refunded?: number }) => ({ refunded: Number(d?.refunded ?? 0) }) },
);
