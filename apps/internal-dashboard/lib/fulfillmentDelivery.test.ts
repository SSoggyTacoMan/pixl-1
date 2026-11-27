import { describe, expect, test } from "bun:test";
import { isDigitalOrder } from "./fulfillmentDelivery";

describe("digital delivery", () => {
  test("software items are delivered as a code", () => {
    expect(isDigitalOrder({ item_category: "software" })).toBe(true);
  });

  test("physical items and grants are not code delivery", () => {
    expect(isDigitalOrder({ item_category: "tech" })).toBe(false);
    expect(isDigitalOrder({ item_category: "merch" })).toBe(false);
    expect(isDigitalOrder({ item_category: "grants" })).toBe(false);
    expect(isDigitalOrder({ item_category: "software", is_grant: true })).toBe(false);
  });

  test("an unfulfilled grant-category order pushed onto the item flow is not software", () => {
    expect(isDigitalOrder({ item_category: "grants", item_flow: true })).toBe(false);
  });

  test("an order with no category is not assumed digital", () => {
    expect(isDigitalOrder({ item_category: null })).toBe(false);
  });
});
