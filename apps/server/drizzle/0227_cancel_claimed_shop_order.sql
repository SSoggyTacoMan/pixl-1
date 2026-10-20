-- Lets the internal dashboard cancel a shop order a fulfiller has already
-- claimed (status 'ordered' or 'credited') and refund the pixels. Owner-only,
-- dashboard-only: cancel_shop_order stays pending-only and is what the
-- player's own cancel button calls (routes/shop.ts), so a player still can't
-- cancel once a fulfiller has the order. A shipped or done order is not
-- cancellable here either.
--
-- Same refund, stock restore and pixel_transactions row (reason 'shop_refund')
-- as cancel_shop_order. Idempotent: a second call finds the order already
-- cancelled and returns 0, so a double-click cannot refund twice.
--
-- Run against the orchard/CNPG database. Safe to re-run.

CREATE OR REPLACE FUNCTION cancel_claimed_shop_order(p_order_id bigint, p_by text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_order shop_orders%rowtype;
  v_refund integer;
BEGIN
  SELECT * INTO v_order FROM shop_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status NOT IN ('ordered', 'credited') THEN
    RETURN 0;
  END IF;

  v_refund := v_order.price;
  IF v_refund = 0 THEN
    SELECT trial_prize_px INTO v_refund
      FROM projects WHERE trial_prize_order_id = p_order_id;
    v_refund := coalesce(v_refund, 0);
  END IF;

  UPDATE shop_orders
    SET status = 'cancelled', fulfilled_at = now(), fulfilled_by = p_by
    WHERE id = p_order_id;

  UPDATE users SET pixels = pixels + v_refund WHERE id = v_order.user_id;

  INSERT INTO pixel_transactions (user_id, project_id, amount, hours, reason, created_by)
  VALUES (v_order.user_id, NULL, v_refund, 0, 'shop_refund', p_by);

  IF coalesce(v_order.stock_choice, '') <> '' THEN
    UPDATE shop_option_stock SET remaining = remaining + v_order.quantity
      WHERE item_id = v_order.item_id AND choice = v_order.stock_choice;
  END IF;

  RETURN v_refund;
END;
$$;
