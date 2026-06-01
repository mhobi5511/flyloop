create or replace function public.delete_opportunity_with_notification_cleanup(target_opportunity_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  opportunity_kind text;
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

  delete from public.notifications
  where opportunity_id = target_opportunity_id;

  delete from public.opportunity_interests
  where opportunity_id = target_opportunity_id;

  delete from public.opportunities
  where id = target_opportunity_id;

  return true;
end;
$$;

revoke execute on function public.delete_opportunity_with_notification_cleanup(uuid) from public;
revoke execute on function public.delete_opportunity_with_notification_cleanup(uuid) from anon;
grant execute on function public.delete_opportunity_with_notification_cleanup(uuid) to authenticated;
