-- Minimal pgTAP-compatible assertions for environments without the pgTAP
-- extension. Failures RAISE (so psql -v ON_ERROR_STOP=1 fails the run) instead
-- of emitting "not ok" TAP lines. Covers the subset the repository's tests
-- use: plan, finish, is, lives_ok, throws_ok, results_eq.
-- On a real Supabase stack the genuine pgTAP extension is used instead.

create schema if not exists extensions;

create or replace function extensions.plan(n int) returns text language sql as $$ select format('1..%s', n) $$;
create or replace function extensions.finish() returns setof text language sql as $$ select 'finished'::text where false $$;

create or replace function extensions.is(got anyelement, want anyelement, descr text default '') returns text
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'not ok - %: got % want %', descr, got, want using errcode = 'P0999';
  end if;
  return 'ok - ' || descr;
end $$;

create or replace function extensions.lives_ok(sql text, descr text default '') returns text
language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise exception 'not ok - % (died: % %)', descr, sqlstate, sqlerrm using errcode = 'P0999';
  end;
  return 'ok - ' || descr;
end $$;

create or replace function extensions.throws_ok(sql text, errcode text default null, errmsg text default null, descr text default '') returns text
language plpgsql as $$
declare got_state text; got_msg text;
begin
  begin
    execute sql;
  exception when others then
    got_state := sqlstate; got_msg := sqlerrm;
    if errcode is not null and got_state <> errcode then
      raise exception 'not ok - %: expected sqlstate % got % (%)', descr, errcode, got_state, got_msg using errcode = 'P0999';
    end if;
    if errmsg is not null and got_msg <> errmsg then
      raise exception 'not ok - %: expected message % got %', descr, errmsg, got_msg using errcode = 'P0999';
    end if;
    return 'ok - ' || descr;
  end;
  raise exception 'not ok - %: expected an error, statement succeeded', descr using errcode = 'P0999';
end $$;

-- Mirrors real pgTAP: two cursors, row by row, compared as records with IS DISTINCT FROM. Comparing
-- records (not text arrays) is what makes implicit-collation mismatches raise here as they do on Supabase.
create or replace function extensions.results_eq(have text, want text, descr text default '') returns text
language plpgsql as $$
declare c1 refcursor; c2 refcursor; r1 record; r2 record; f1 boolean; f2 boolean; i int := 0;
begin
  open c1 for execute have;
  open c2 for execute want;
  loop
    fetch c1 into r1; f1 := found;
    fetch c2 into r2; f2 := found;
    exit when not f1 and not f2;
    i := i + 1;
    if f1 <> f2 then
      raise exception 'not ok - %: row counts differ at row % (have % want %)', descr, i, case when f1 then r1::text else '<none>' end, case when f2 then r2::text else '<none>' end using errcode = 'P0999';
    end if;
    if r1 is distinct from r2 then
      raise exception 'not ok - %: row % differs: have % want %', descr, i, r1::text, r2::text using errcode = 'P0999';
    end if;
  end loop;
  close c1; close c2;
  return 'ok - ' || descr;
end $$;

grant execute on all functions in schema extensions to public;
