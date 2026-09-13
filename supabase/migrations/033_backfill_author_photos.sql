-- =============================================================
-- 033_backfill_author_photos.sql
-- Wires up 10 author photos that were previously NULL because the
-- screenshots Pedro pasted were in macOS sandboxed temp folders. Files
-- recovered from Claude Code's image cache and dropped under
-- /public/authors/. Idempotent — only writes when photo_url is NULL.
-- =============================================================

update authors set photo_url = '/authors/jorge-paulo-lemann.png'
  where name = 'Jorge Paulo Lemann' and photo_url is null;

update authors set photo_url = '/authors/tallis-gomes.png'
  where name = 'Tallis Gomes' and photo_url is null;

update authors set photo_url = '/authors/jorlan.png'
  where name = 'Jorlan' and photo_url is null;

update authors set photo_url = '/authors/elon-musk.png'
  where name = 'Elon Musk' and photo_url is null;

update authors set photo_url = '/authors/elias-maman.png'
  where name = 'Elias Maman' and photo_url is null;

update authors set photo_url = '/authors/dana-white.png'
  where name = 'Dana White' and photo_url is null;

update authors set photo_url = '/authors/eduardo-correa.png'
  where name = 'Eduardo Correa' and photo_url is null;

update authors set photo_url = '/authors/alex-schultz.png'
  where name = 'Alex Schultz' and photo_url is null;

update authors set photo_url = '/authors/alex-hormozi.png'
  where name = 'Alex Hormozi' and photo_url is null;

update authors set photo_url = '/authors/coldzera.png'
  where name = 'Coldzera' and photo_url is null;
