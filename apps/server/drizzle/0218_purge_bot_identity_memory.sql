-- PRIVACY PURGE of DM-derived data held by Pixo (apps/pixorpheus).
--
-- IRREVERSIBLE. Run once at go-live, and only after the owner has confirmed
-- it in writing. There is no backup step here on purpose: the point is that
-- this data stops existing, so do not snapshot these tables first.
--
-- Why: Pixo's memory extractor (memory/users.ts extractMemory /
-- extractPersonality) used to save "identity" facts - real name, age,
-- location, nationality, school, pronouns - harvested mostly from private
-- DMs with minors, and fed them back into public replies, /pixl-roast and
-- other users' /pixl-mymemory lookups. The bot now refuses to extract those
-- categories and filters them at read time (memory/identityFilter.ts), but
-- rows written before that fix still hold them. Deleting every row is the
-- only way to be sure; the bot rebuilds harmless interest-only memory on
-- its own as people keep talking to it.
--
--   user_memory       per-user facts extracted from DMs and channel messages
--   user_personality  per-user traits extracted from the same messages
--
-- Not touched: program_memory (server-wide facts written by staff) and
-- style_memory (style notes from the staff-only training channel).
--
-- Pixo keeps both tables cached in memory, so restart the pixorpheus
-- deployment right after this runs, or the old rows live on until the next
-- restart and can be written back by the next upsert for that user.

begin;
delete from user_memory;
delete from user_personality;
commit;
