"use server";

// Shop mutations. Each is one guarded call to one apps/server endpoint.
import { z } from "zod";
import { guardedAction, json } from "@/lib/guarded-action";
import { REGION_IDS } from "./shop-lib";

const itemId = z.number().int().positive();
const configPicks = z
  .record(z.string().max(80), z.union([z.string().max(120), z.array(z.string().max(120)).max(40)]))
  .nullable();

export const setRegion = guardedAction(
  "shop.region",
  z.object({ region: z.enum(REGION_IDS) }),
  (input) => ({ method: "POST", path: "/api/shop/region", body: json({ region: input.region }) }),
  { revalidate: ["/shop"] },
);

export const saveItem = guardedAction(
  "shop.save",
  z.object({ id: itemId, option: z.string().max(400), config: configPicks }),
  (input) => ({
    method: "POST",
    path: `/api/shop/save/${input.id}`,
    body: json({ option: input.option, config: input.config }),
    target: `shop_item:${input.id}`,
  }),
);

export const unsaveItem = guardedAction(
  "shop.unsave",
  z.object({ id: itemId }),
  (input) => ({ method: "DELETE", path: `/api/shop/save/${input.id}`, target: `shop_item:${input.id}` }),
);

export const claimTrophy = guardedAction(
  "shop.claim",
  z.object({ id: itemId }),
  (input) => ({ method: "POST", path: `/api/shop/claim/${input.id}`, target: `shop_item:${input.id}` }),
  { revalidate: ["/shop"] },
);

export const buyItem = guardedAction(
  "shop.buy",
  z.object({
    id: itemId,
    option: z.string().max(400),
    note: z.string().max(300),
    phone: z.string().trim().min(7).max(20).optional(),
    config: configPicks.optional(),
    quantity: z.number().int().min(1).max(999).optional(),
    stockChoice: z.string().max(120).optional(),
  }),
  (input) => ({
    method: "POST",
    path: `/api/shop/buy/${input.id}`,
    body: json({
      option: input.option,
      note: input.note,
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.config ? { config: input.config } : { quantity: input.quantity ?? 1 }),
      ...(input.stockChoice ? { stockChoice: input.stockChoice } : {}),
    }),
    target: `shop_item:${input.id}`,
  }),
  { revalidate: ["/shop", "/orders"], pick: (d: { balance?: number }) => ({ balance: d?.balance ?? null }) },
);
