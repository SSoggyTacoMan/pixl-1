-- We no longer own pixl.rsvp. 0109 already moved shop images to
-- pixl.hackclub.com, but rows inserted after it (0203's Mac Mini M6 SKUs)
-- point at the old domain again. Whoever registers the domain next would
-- control the images shown in the shop, so every remaining image URL is
-- rewritten.
-- The image files themselves are served by apps/pixl-dashboard under /shop.
--
-- Idempotent: only touches rows that still mention the old domain.

update shop_items
set image_url = replace(image_url, 'https://pixl.rsvp/', 'https://pixl.hackclub.com/')
where image_url like 'https://pixl.rsvp/%';

update collectibles
set image_url = replace(image_url, 'https://pixl.rsvp/', 'https://pixl.hackclub.com/')
where image_url like 'https://pixl.rsvp/%';
