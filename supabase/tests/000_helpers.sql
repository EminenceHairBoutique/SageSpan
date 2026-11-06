-- Shared helpers for pgTAP tests. Each test file is wrapped in a transaction
-- and rolled back; fixtures are synthetic and created inline.
-- Run with: supabase test db   (requires the Supabase local stack / Docker)

create or replace function tests.make_user(p_id uuid, p_email text) returns uuid
language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  on conflict (id) do nothing;
  return p_id;
end $$;

create or replace function tests.authenticate_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.clear_auth() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- Tests switch to the anon/authenticated roles mid-file and then call these
-- helpers again, so those roles need to reach the tests schema.
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;
