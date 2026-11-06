-- Local equivalent of the Supabase Security Advisor lints (splinter), run against the migrated
-- schema with supabase/tests/probes/run_probe.py. The hosted advisor needs the real Supabase
-- stack; this reproduces the catalog queries behind its security findings so the result can be
-- pasted into the PR with that caveat. Every PROBE line should end in <none>.
begin;

-- rls_disabled_in_public equivalent: tables in schema app without RLS enabled
select 'PROBE rls_disabled: ' || coalesce(string_agg(c.relname, ', ' order by c.relname), '<none>')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app' and c.relkind = 'r' and not c.relrowsecurity;

-- rls_enabled_no_policy equivalent
select 'PROBE rls_enabled_no_policy: ' || coalesce(string_agg(c.relname, ', ' order by c.relname), '<none>')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid);

-- function_search_path_mutable equivalent (SECURITY DEFINER functions without a fixed search_path)
select 'PROBE definer_search_path_mutable: ' || coalesce(string_agg(p.proname, ', ' order by p.proname), '<none>')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');

-- functions executable by PUBLIC or anon (not a splinter lint; PR-001 N-04)
select 'PROBE public_or_anon_executable: ' || coalesce(string_agg(p.proname, ', ' order by p.proname), '<none>')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app'
  and (p.proacl is null
       or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)
       or has_function_privilege('anon', p.oid, 'EXECUTE'));

-- anon table privileges in schema app
select 'PROBE anon_table_privileges: ' || coalesce(string_agg(distinct table_name::text, ', '), '<none>')
from information_schema.role_table_grants where table_schema = 'app' and grantee = 'anon';

-- security_definer_view equivalent
select 'PROBE security_definer_views: ' || coalesce(string_agg(c.relname, ', ' order by c.relname), '<none>')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app' and c.relkind = 'v'
  and coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') <> 'true';

-- auth_rls_initplan equivalent: policies calling auth.uid() per row instead of (select auth.uid())
select 'PROBE auth_rls_initplan: ' || coalesce(string_agg(distinct c.relname || '.' || p.polname, ', '), '<none>')
from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app'
  and (coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ 'auth\.uid\(\)' or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ 'auth\.uid\(\)')
  and not (coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ '\(\s*select auth\.uid\(\)');

-- extension_in_public equivalent
select 'PROBE extensions_in_public: ' || coalesce(string_agg(e.extname, ', ' order by e.extname), '<none>')
from pg_extension e join pg_namespace n on n.oid = e.extnamespace where n.nspname = 'public';

-- tables with FORCE ROW LEVEL SECURITY (documented decision: none after 0005)
select 'PROBE force_rls_tables: ' || coalesce(string_agg(c.relname, ', ' order by c.relname), '<none>')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app' and c.relkind = 'r' and c.relforcerowsecurity;

-- inventory: functions executable by authenticated (must equal the list asserted in 005)
select 'PROBE authenticated_executable: ' || coalesce(string_agg(distinct p.proname, ', ' order by p.proname), '<none>')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and has_function_privilege('authenticated', p.oid, 'EXECUTE');

rollback;
