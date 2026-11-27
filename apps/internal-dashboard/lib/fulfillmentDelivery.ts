import { isGrantOrder, type GrantShaped } from "./fulfillmentGrant";

// Software-category items (licenses, game codes, credits...) are delivered as a
// code instead of being shipped. They still use the normal item flow and the
// same `shop_orders.tracking` text column; this helper only decides which
// labels and messages to use.
//
// A grant is never code delivery: grants are sent as an HCB grant invite, and a
// manual conversion (is_grant) or an unfulfill onto the item flow (item_flow)
// wins exactly like isGrantOrder.
export function isDigitalOrder(order: GrantShaped): boolean {
  return !isGrantOrder(order) && order.item_category === "software";
}
