-- Rewritten Trial texts (the in-game NPC description and the Builder Terminal
-- brief) for five Trials, from the game text rewrite pass.
--
-- Target: the orchard/CNPG database. Idempotent, keyed by name. Run in psql.

update sidequests set description =
  $$Build a simple html and css website that introduce you as a new builder. It can show your interests, your past projects or anything you want to show!$$
  where name = 'Raise your Builder Page';

update sidequests set
  brief = $$This trial is really "open"! You can basically build anything you want as long as it works and follow the ship requirements!$$,
  description = $$Ridit has kept an eye on you since you came here, just to see how is your first trial going.$$
  where name = 'Claim Your Stake';

update sidequests set brief =
  $$Build a repeater: two physical devices that pass a message across on radio only, no wifi, no internet. It can either be with voice messages with a mic or text/morse with buttons. Be creative!$$
  where name = 'Contact the hackclubbers on earth for more support!';

update sidequests set description =
  $$That saloon has speakers but no jukebox. Build a software one, a web app where anyone can queue up a song!$$
  where name = 'A Jukebox for the Saloon';

update sidequests set description =
  $$Re-build the cafe's broken ordering system. It can have a menu, a cart, a payment system and even a screen where orders appear.$$
  where name = 'Order up';
