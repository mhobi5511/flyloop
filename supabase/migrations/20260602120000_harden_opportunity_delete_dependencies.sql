create or replace function public.delete_opportunity_with_notification_cleanup(target_opportunity_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  opportunity_kind text;
  dependent_fk record;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    return false;
  end if;

  if auth.uid() is null or (
    opportunity_record.created_by <> auth.uid()
    and not public.is_admin()
  ) then
    raise exception 'Not authorized to delete this opportunity'
      using errcode = '42501';
  end if;

  opportunity_kind := case opportunity_record.type
    when 'huck_jam' then 'Huck Jam'
    else 'Camp'
  end;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    oi.athlete_id,
    opportunity_kind || ' deleted',
    'The ' || opportunity_kind || ' "' || opportunity_record.title || '" was deleted by the organizer.',
    'opportunity_deleted',
    null
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'notification_recipients'
      and c.relkind in ('r', 'p')
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_recipients'
      and column_name = 'notification_id'
  ) then
    execute $delete_recipients$
      delete from public.notification_recipients nr
      using public.notifications n
      where nr.notification_id = n.id
        and n.opportunity_id = $1
    $delete_recipients$
    using target_opportunity_id;
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'applications'
      and c.relkind in ('r', 'p')
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'applications'
      and column_name = 'opportunity_id'
  ) then
    execute 'delete from public.applications where opportunity_id = $1'
    using target_opportunity_id;
  end if;

  for dependent_fk in
    select
      child_namespace.nspname as schema_name,
      child_table.relname as table_name,
      child_column.attname as column_name
    from pg_constraint constraint_info
    join pg_class child_table
      on child_table.oid = constraint_info.conrelid
    join pg_namespace child_namespace
      on child_namespace.oid = child_table.relnamespace
    join pg_attribute child_column
      on child_column.attrelid = child_table.oid
      and child_column.attnum = constraint_info.conkey[1]
    where constraint_info.contype = 'f'
      and constraint_info.confrelid = 'public.opportunities'::regclass
      and child_namespace.nspname = 'public'
      and child_table.relkind in ('r', 'p')
      and array_length(constraint_info.conkey, 1) = 1
  loop
    execute format(
      'delete from %I.%I where %I = $1',
      dependent_fk.schema_name,
      dependent_fk.table_name,
      dependent_fk.column_name
    )
    using target_opportunity_id;
  end loop;

  delete from public.opportunities
  where id = target_opportunity_id;

  return true;
end;
$$;

revoke execute on function public.delete_opportunity_with_notification_cleanup(uuid) from public;
revoke execute on function public.delete_opportunity_with_notification_cleanup(uuid) from anon;
grant execute on function public.delete_opportunity_with_notification_cleanup(uuid) to authenticated;
