with expected_tables(table_name) as (
  values
    ('incomes'),
    ('expenses'),
    ('cards'),
    ('transactions')
),
table_status as (
  select
    expected_tables.table_name,
    tables.table_schema = 'public' as exists_in_public,
    pg_tables.rowsecurity as rls_enabled
  from expected_tables
  left join information_schema.tables as tables
    on tables.table_schema = 'public'
   and tables.table_name = expected_tables.table_name
  left join pg_tables
    on pg_tables.schemaname = 'public'
   and pg_tables.tablename = expected_tables.table_name
),
grant_status as (
  select
    table_name,
    case
      when to_regclass(format('public.%I', table_name)) is null then false
      else has_table_privilege('authenticated', format('public.%I', table_name), 'select')
    end as can_select,
    case
      when to_regclass(format('public.%I', table_name)) is null then false
      else has_table_privilege('authenticated', format('public.%I', table_name), 'insert')
    end as can_insert,
    case
      when to_regclass(format('public.%I', table_name)) is null then false
      else has_table_privilege('authenticated', format('public.%I', table_name), 'update')
    end as can_update,
    case
      when to_regclass(format('public.%I', table_name)) is null then false
      else has_table_privilege('authenticated', format('public.%I', table_name), 'delete')
    end as can_delete
  from expected_tables
),
policy_status as (
  select
    tablename as table_name,
    count(*) filter (where cmd = 'SELECT') as select_policies,
    count(*) filter (where cmd = 'INSERT') as insert_policies,
    count(*) filter (where cmd = 'UPDATE') as update_policies,
    count(*) filter (where cmd = 'DELETE') as delete_policies
  from pg_policies
  where schemaname = 'public'
    and tablename in (select table_name from expected_tables)
  group by tablename
)
select
  table_status.table_name,
  table_status.exists_in_public,
  coalesce(table_status.rls_enabled, false) as rls_enabled,
  grant_status.can_select,
  grant_status.can_insert,
  grant_status.can_update,
  grant_status.can_delete,
  coalesce(policy_status.select_policies, 0) as select_policies,
  coalesce(policy_status.insert_policies, 0) as insert_policies,
  coalesce(policy_status.update_policies, 0) as update_policies,
  coalesce(policy_status.delete_policies, 0) as delete_policies
from table_status
join grant_status using (table_name)
left join policy_status using (table_name)
order by table_status.table_name;

notify pgrst, 'reload schema';
