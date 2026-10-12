-- Security fixes from the 2026-10 relaunch audit (L2, L3, L5).
--
-- 1. buy_shop_item (last defined in 0212, replaced whole here, never edit
--    0212 itself):
--    * L2: an item that has shop_option_stock rows now requires a stock
--      choice. Before, an empty p_stock_choice skipped the stock block
--      entirely, so the order went through without decrementing (or
--      checking) any stock.
--    * L3: the Beacon-unlock availability check moves inside the function,
--      after the users row is locked FOR UPDATE. The route's check in
--      shop.ts ran outside any lock, so two parallel purchases could both
--      spend the same last unlock. shop.ts keeps its pre-check as a fast
--      path (and so purchases stay gated if this migration lands late).
--    Everything else is byte-for-byte 0212's function.
--
-- 2. L5: show_n_tell_votes gets round_id and a UNIQUE (round_id, user_id),
--    so "one live vote per round" is enforced by the database instead of a
--    delete-then-insert in the handler that two parallel requests could
--    interleave. round_id is filled by a trigger from the entry, so a server
--    that doesn't send it (the one deployed before this) still works, and
--    a client can't claim a different round. Existing duplicates are
--    deduped first, keeping each voter's newest vote in the round.
--
-- Apply BEFORE deploying the server that upserts on (round_id, user_id); that
-- server falls back to the old delete+insert if the constraint is missing.
-- Idempotent. Run against the orchard/CNPG database as the app role.

BEGIN;

CREATE OR REPLACE FUNCTION public.buy_shop_item(p_user_id uuid, p_item_id integer, p_option text, p_config jsonb DEFAULT NULL::jsonb, p_quantity integer DEFAULT 1, p_note text DEFAULT ''::text, p_stock_choice text DEFAULT ''::text, p_buyer_region text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
declare
  v_item shop_items%rowtype;
  v_balance bigint;
  v_order_id bigint;
  v_unit_price integer;
  v_price integer;
  v_qty integer;
  v_group jsonb;
  v_choice jsonb;
  v_pick text;
  v_found boolean;
  v_key text;
  v_stock_remaining integer;
  v_discount integer;
  v_beacons integer;
  v_beacon_owned integer;
begin
  select * into v_item from shop_items where id = p_item_id;
  if not found or not v_item.active then
    return json_build_object('ok', false, 'error', 'unavailable');
  end if;
  if coalesce(v_item.unlock_xp, 0) > 0 or v_item.price <= 0 then
    return json_build_object('ok', false, 'error', 'not_for_sale');
  end if;

  -- Personal item: nobody but its player can buy it.
  if v_item.reserved_user_id is not null and v_item.reserved_user_id <> p_user_id then
    return json_build_object('ok', false, 'error', 'unavailable');
  end if;

  -- A personal item is not tied to a region, the player sees it in their
  -- shop wherever they live.
  if v_item.region is not null
     and v_item.reserved_user_id is null
     and (p_buyer_region is null or v_item.region <> p_buyer_region) then
    return json_build_object('ok', false, 'error', 'wrong_region');
  end if;

  v_qty := case
    when v_item.reserved_user_id is not null then 1
    else greatest(1, least(999, coalesce(p_quantity, 1)))
  end;
  v_discount := greatest(0, least(100, coalesce(v_item.discount_percent, 0)));
  v_unit_price := round(v_item.price * (100 - v_discount) / 100.0)::integer;

  if v_item.config_options is not null then
    v_unit_price := round(
      coalesce((v_item.config_options->>'base_price')::integer, v_item.price) * (100 - v_discount) / 100.0
    )::integer;
    for v_group in select * from jsonb_array_elements(v_item.config_options->'groups')
    loop
      v_key := v_group->>'name';
      if v_group->>'type' = 'multi' then
        if p_config is not null and p_config->v_key is not null then
          if jsonb_typeof(p_config->v_key) <> 'array' then
            return json_build_object('ok', false, 'error', 'invalid_config', 'group', v_key);
          end if;
          for v_pick in select jsonb_array_elements_text(p_config->v_key)
          loop
            v_found := false;
            for v_choice in select * from jsonb_array_elements(v_group->'choices')
            loop
              if v_choice->>'label' = v_pick then
                v_unit_price := v_unit_price + round(
                  coalesce((v_choice->>'price')::integer, 0) * (100 - v_discount) / 100.0
                )::integer;
                v_found := true;
              end if;
            end loop;
            if not v_found then
              return json_build_object('ok', false, 'error', 'invalid_config',
                'group', v_key, 'value', v_pick);
            end if;
          end loop;
        end if;
      else
        if p_config is not null and p_config->v_key is not null
           and jsonb_typeof(p_config->v_key) <> 'string' then
          return json_build_object('ok', false, 'error', 'invalid_config', 'group', v_key);
        end if;
        v_pick := p_config->>v_key;
        v_found := false;
        for v_choice in select * from jsonb_array_elements(v_group->'choices')
        loop
          if v_choice->>'label' = v_pick then
            v_unit_price := v_unit_price + round(
              coalesce((v_choice->>'price')::integer, 0) * (100 - v_discount) / 100.0
            )::integer;
            v_found := true;
          end if;
        end loop;
        if not v_found then
          if coalesce(v_pick, '') <> '' then
            return json_build_object('ok', false, 'error', 'invalid_config',
              'group', v_key, 'value', v_pick);
          end if;
          v_choice := v_group->'choices'->0;
          v_unit_price := v_unit_price + round(
            coalesce((v_choice->>'price')::integer, 0) * (100 - v_discount) / 100.0
          )::integer;
        end if;
      end if;
    end loop;
  end if;

  v_price := v_unit_price * v_qty;

  -- An item with a per-choice stock pool must name the choice: without one
  -- the order used to go through with no stock decremented at all.
  if exists (select 1 from shop_option_stock where item_id = p_item_id) then
    if coalesce(p_stock_choice, '') = '' then
      return json_build_object('ok', false, 'error', 'invalid_config', 'group', 'stock');
    end if;
    select remaining into v_stock_remaining
      from shop_option_stock
      where item_id = p_item_id and choice = p_stock_choice
      for update;
    if v_stock_remaining is null or v_stock_remaining < v_qty then
      return json_build_object('ok', false, 'error', 'sold_out',
        'remaining', coalesce(v_stock_remaining, 0));
    end if;
  else
    p_stock_choice := '';
  end if;

  select pixels into v_balance from users where id = p_user_id for update;
  if v_balance is null then
    return json_build_object('ok', false, 'error', 'unavailable');
  end if;

  -- One-time: checked after the buyer's row is locked, so two parallel
  -- requests from the same player can't both get past it. A cancelled order
  -- doesn't count, so a refunded personal item can be bought again.
  if v_item.reserved_user_id is not null and exists (
    select 1 from shop_orders where item_id = v_item.id and status <> 'cancelled'
  ) then
    return json_build_object('ok', false, 'error', 'already_purchased');
  end if;

  -- Beacon-locked items: one unlock per live Beacon project (is_peak, not
  -- archived/rejected/banned), shared across every beacon_locked item, an
  -- item already owned (non-cancelled order) stays unlocked. Checked here,
  -- after the buyer's row is locked, so two parallel purchases can't both
  -- spend the same last unlock (the route's own pre-check runs unlocked).
  if coalesce(v_item.beacon_locked, false) and not exists (
    select 1 from shop_orders
     where user_id = p_user_id and item_id = v_item.id and status <> 'cancelled'
  ) then
    select count(*) into v_beacons
      from projects
     where user_id = p_user_id and is_peak
       and archived_at is null and rejected_at is null and banned_at is null;
    select count(distinct o.item_id) into v_beacon_owned
      from shop_orders o join shop_items i on i.id = o.item_id
     where o.user_id = p_user_id and o.status <> 'cancelled' and i.beacon_locked;
    if v_beacons - v_beacon_owned < 1 then
      return json_build_object('ok', false, 'error', 'locked');
    end if;
  end if;

  if v_balance < v_price then
    return json_build_object('ok', false, 'error', 'insufficient',
      'balance', v_balance, 'price', v_price);
  end if;

  update users set pixels = pixels - v_price where id = p_user_id
    returning pixels into v_balance;

  insert into pixel_transactions (user_id, project_id, amount, hours, reason, created_by)
  values (p_user_id, null, -v_price, 0, 'shop_purchase', 'shop');

  if coalesce(p_stock_choice, '') <> '' then
    update shop_option_stock set remaining = remaining - v_qty
      where item_id = p_item_id and choice = p_stock_choice;
  end if;

  insert into shop_orders (user_id, item_id, item_name, option, config, price, quantity, status, buyer_note, stock_choice)
  values (p_user_id, v_item.id, v_item.name, coalesce(p_option, ''), coalesce(p_config, '{}'::jsonb), v_price, v_qty, 'pending',
          left(coalesce(p_note, ''), 300), coalesce(p_stock_choice, ''))
  returning id into v_order_id;

  -- A personal item is single-use: take it off the player's shop now.
  if v_item.reserved_user_id is not null then
    update shop_items set active = false where id = v_item.id;
  end if;

  return json_build_object('ok', true, 'balance', v_balance,
    'order_id', v_order_id, 'item_name', v_item.name, 'price', v_price, 'quantity', v_qty);
end;
$function$;


ALTER TABLE show_n_tell_votes
  ADD COLUMN IF NOT EXISTS round_id integer REFERENCES show_n_tell_rounds(id) ON DELETE CASCADE;

UPDATE show_n_tell_votes v
   SET round_id = e.round_id
  FROM show_n_tell_entries e
 WHERE e.id = v.entry_id
   AND v.round_id IS DISTINCT FROM e.round_id;

DELETE FROM show_n_tell_votes v
 USING (
   SELECT id, row_number() OVER (
            PARTITION BY round_id, user_id ORDER BY created_at DESC, id DESC
          ) AS rn
     FROM show_n_tell_votes
 ) ranked
 WHERE ranked.id = v.id AND ranked.rn > 1;

CREATE OR REPLACE FUNCTION public.show_n_tell_vote_round()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  select round_id into new.round_id from show_n_tell_entries where id = new.entry_id;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS show_n_tell_votes_round ON show_n_tell_votes;
CREATE TRIGGER show_n_tell_votes_round
  BEFORE INSERT OR UPDATE OF entry_id, round_id ON show_n_tell_votes
  FOR EACH ROW EXECUTE FUNCTION public.show_n_tell_vote_round();

ALTER TABLE show_n_tell_votes ALTER COLUMN round_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS show_n_tell_votes_round_user_key
  ON show_n_tell_votes (round_id, user_id);

COMMIT;
