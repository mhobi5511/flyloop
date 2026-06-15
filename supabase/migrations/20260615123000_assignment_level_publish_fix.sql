create or replace function public.publish_opportunity_timetable_state(target_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  publish_timestamp timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to publish this timetable'
      using errcode = '42501';
  end if;

  if opportunity_record.type = 'huck_jam' then
    raise exception 'Huck Jams do not use timetables';
  end if;

  update public.opportunity_time_slots
  set
    is_published = true,
    published_at = coalesce(published_at, publish_timestamp)
  where opportunity_id = target_opportunity_id;
end;
$$;

revoke execute on function public.publish_opportunity_timetable_state(uuid) from public;
revoke execute on function public.publish_opportunity_timetable_state(uuid) from anon;
grant execute on function public.publish_opportunity_timetable_state(uuid) to authenticated;

create or replace function public.notify_timetable_published(target_opportunity_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  inserted_count integer := 0;
  copy record;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if auth.uid() is null or opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to publish this timetable'
      using errcode = '42501';
  end if;

  select *
  into copy
  from public.flyloop_notification_copy(
    notification_type := 'timetable_published',
    opportunity_title := opportunity_record.title
  );

  with updated_users as (
    update public.opportunity_slot_bookings osb
    set
      is_final = true,
      finalized_at = coalesce(osb.finalized_at, now())
    where osb.opportunity_id = target_opportunity_id
      and osb.is_final = false
    returning osb.user_id
  )
  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select distinct
    updated_users.user_id,
    copy.title,
    copy.body,
    'timetable_published',
    target_opportunity_id
  from updated_users
  where updated_users.user_id <> opportunity_record.created_by
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = updated_users.user_id
        and n.opportunity_id = target_opportunity_id
        and n.type = 'timetable_published'
        and n.read = false
    );

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.notify_timetable_published(uuid) from public;
revoke execute on function public.notify_timetable_published(uuid) from anon;
grant execute on function public.notify_timetable_published(uuid) to authenticated;
