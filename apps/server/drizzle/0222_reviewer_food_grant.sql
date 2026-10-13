-- Reviewer Food Grant: a $20 food grant (220 px) that reviewers unlock by
-- reviewing. One grant is earned at each milestone (150, 200, 300 and 400
-- reviews), they still have to buy it. Earned minus already bought (a
-- non-cancelled order) is how many they can buy right now.
--
-- Reviews counted = the rows the internal dashboard's review stats board shows
-- for that reviewer (review_audits, matched on the "(Uxxxx)" slack id in the
-- reviewer label), so the number a reviewer sees there is the one that counts.
--
-- Same shape as beacon_locked (0212/0217): a flag on the item, the gate checked
-- under the buyer's row lock so two parallel claims can't both spend the same
-- grant. buy_shop_item itself is left untouched: claim_review_grant wraps it.
--
-- The item is ONE row, shown in every region (the server skips the region
-- scoping for review_locked items, like trophies), so its price is edited once.
--
-- The item is inserted INACTIVE: a server without this change would sell it as
-- an ordinary US item. Deploy the server, then:
--   UPDATE shop_items SET active = true WHERE review_locked;
--
-- Idempotent. Run against the orchard/CNPG database as the app role.

BEGIN;

ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS review_locked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.reviewer_food_grant_status(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_slack text;
  v_reviews integer := 0;
  v_milestones integer[] := array[150, 200, 300, 400];
  v_earned integer;
  v_claimed integer;
  v_next integer;
begin
  select slack_id into v_slack from users where id = p_user_id;
  if coalesce(v_slack, '') <> '' then
    select count(*) into v_reviews
      from review_audits
     where reviewer ilike '%(' || v_slack || ')%';
  end if;

  select count(*) into v_earned from unnest(v_milestones) m where m <= v_reviews;
  select min(m) into v_next from unnest(v_milestones) m where m > v_reviews;

  -- Counted per slack id, not per account: a person with two accounts shares
  -- one set of grants.
  select count(*) into v_claimed
    from shop_orders o join shop_items i on i.id = o.item_id
   where o.status <> 'cancelled' and i.review_locked
     and (o.user_id = p_user_id
          or (coalesce(v_slack, '') <> ''
              and o.user_id in (select id from users where slack_id = v_slack)));

  return json_build_object(
    'reviews', v_reviews,
    'milestones', to_json(v_milestones),
    'earned', v_earned,
    'claimed', v_claimed,
    'available', greatest(v_earned - v_claimed, 0),
    'next_at', v_next,
    'to_go', case when v_next is null then null else v_next - v_reviews end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_review_grant(p_user_id uuid, p_item_id integer, p_note text DEFAULT ''::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
declare
  v_item shop_items%rowtype;
  v_status json;
  v_slack text;
begin
  select * into v_item from shop_items where id = p_item_id;
  if not found or not v_item.active or not v_item.review_locked then
    return json_build_object('ok', false, 'error', 'unavailable');
  end if;
  if v_item.manual_locked then
    return json_build_object('ok', false, 'error', 'locked');
  end if;

  -- Lock the buyer, and every account sharing their slack id, first
  -- (buy_shop_item takes the buyer's lock again, in this transaction), so the
  -- count below can't go stale under a parallel claim. Ordered by id so two
  -- claims can't deadlock.
  select slack_id into v_slack from users where id = p_user_id;
  perform 1 from users
   where id = p_user_id or (coalesce(v_slack, '') <> '' and slack_id = v_slack)
   order by id for update;
  if not found then
    return json_build_object('ok', false, 'error', 'unavailable');
  end if;

  v_status := reviewer_food_grant_status(p_user_id);
  if (v_status->>'available')::integer < 1 then
    return json_build_object('ok', false, 'error', 'locked');
  end if;

  -- The item's own region is passed as the buyer's: it is one row for every
  -- region, so the region check in buy_shop_item must always pass.
  return buy_shop_item(p_user_id, p_item_id, '', null, 1, p_note, '', v_item.region);
end;
$function$;

INSERT INTO shop_items (name, description, price, image_url, options, active, position, created_by, unlock_xp, region, category, review_locked)
SELECT 'Reviewer Food Grant',
       'A $20 food grant for reviewers. Earn one at 150, 200, 300 and 400 reviews, then buy it here or from the review dashboard stats.',
       220,
       (SELECT image_url FROM shop_items WHERE name = 'Food Grant' AND region = 'US' LIMIT 1),
       '[]'::jsonb, false, 60, 'gabin-cli', 0, 'US', 'grants', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE review_locked);

COMMIT;
