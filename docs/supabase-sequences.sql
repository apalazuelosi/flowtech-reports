-- Optional add-on for HYDAC export: atomic counters for unique bottle # and
-- per-day sample numbers (YYMMDD-#). Run once in the Supabase SQL Editor.
-- (The export still works without this — it falls back to time-based numbers —
--  but running it gives clean sequential numbering.)

create table if not exists sequences (
  key text primary key,
  value bigint not null default 0
);

alter table sequences enable row level security; -- server-only, like the rest

-- Atomically increment and return the next value for a key.
create or replace function next_seq(seq_key text)
returns bigint
language plpgsql
as $$
declare v bigint;
begin
  insert into sequences(key, value) values (seq_key, 1)
    on conflict (key) do update set value = sequences.value + 1
    returning value into v;
  return v;
end;
$$;
