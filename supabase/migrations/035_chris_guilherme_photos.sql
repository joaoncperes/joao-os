-- =============================================================
-- 035_chris_guilherme_photos.sql
-- Wires up the last two pending author photos: Chris Williamson and
-- Guilherme Freire. Both recovered from Claude Code's image cache once
-- Pedro re-paste them. Idempotent — only writes when photo_url is NULL.
-- =============================================================

update authors set photo_url = '/authors/chris-williamson.png'
  where name = 'Chris Williamson' and photo_url is null;

update authors set photo_url = '/authors/guilherme-freire.png'
  where name = 'Guilherme Freire' and photo_url is null;
