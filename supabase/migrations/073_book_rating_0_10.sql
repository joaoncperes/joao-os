-- =============================================================
-- 073_book_rating_0_10.sql
-- Widen the book grade ("nota") scale from 1–5 to 0–10.
--
-- The 1–5 bound came from 000_schema.sql:
--   rating smallint check (rating between 1 and 5)
-- That inline single-column check is auto-named `books_rating_check` by Postgres.
-- The books table carried no rating data through the UI (the 049 redesign noted
-- the table was UI-unused), and 1–5 ⊂ 0–10, so widening the bound is non-destructive.
-- =============================================================

alter table books drop constraint if exists books_rating_check;
alter table books add  constraint books_rating_check check (rating between 0 and 10);
