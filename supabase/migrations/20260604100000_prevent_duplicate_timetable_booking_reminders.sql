delete from public.notifications n
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, opportunity_id, type
        order by created_at asc, id asc
      ) as duplicate_rank
    from public.notifications
    where type = 'timetable_booking_reminder'
      and opportunity_id is not null
  ) ranked
  where ranked.duplicate_rank > 1
) duplicates
where n.id = duplicates.id;

create unique index if not exists notifications_unique_timetable_booking_reminder_idx
on public.notifications(user_id, opportunity_id, type)
where type = 'timetable_booking_reminder'
  and opportunity_id is not null;

create or replace function public.notify_timetable_booking_reminder(
  target_opportunity_id uuid,
  target_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  inserted_count integer;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if auth.uid() is null or opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to send timetable reminders'
      using errcode = '42501';
  end if;

  if target_user_id = opportunity_record.created_by then
    return 0;
  end if;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = target_user_id
      and n.opportunity_id = target_opportunity_id
      and n.type = 'timetable_booking_reminder'
  ) then
    return 0;
  end if;

  if not exists (
    select 1
    from public.opportunity_time_slots ots
    where ots.opportunity_id = target_opportunity_id
      and ots.is_published = true
  ) then
    return 0;
  end if;

  if not exists (
    select 1
    from public.opportunity_interests oi
    where oi.opportunity_id = target_opportunity_id
      and oi.athlete_id = target_user_id
      and oi.status = 'accepted'
  ) then
    return 0;
  end if;

  if exists (
    select 1
    from public.opportunity_slot_bookings osb
    where osb.opportunity_id = target_opportunity_id
      and osb.user_id = target_user_id
  ) then
    return 0;
  end if;

  insert into public.notifications (user_id, title, body, type, opportunity_id)
  select
    target_user_id,
    'Your timetable is available. Please select your times.',
    'Your timetable is available. Please select your times.',
    'timetable_booking_reminder',
    target_opportunity_id
  where not exists (
    select 1
    from public.notifications n
    where n.user_id = target_user_id
      and n.opportunity_id = target_opportunity_id
      and n.type = 'timetable_booking_reminder'
  )
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke execute on function public.notify_timetable_booking_reminder(uuid, uuid) from public;
revoke execute on function public.notify_timetable_booking_reminder(uuid, uuid) from anon;
grant execute on function public.notify_timetable_booking_reminder(uuid, uuid) to authenticated;

drop policy if exists "Organizers read timetable reminder notifications for own opportunities" on public.notifications;
create policy "Organizers read timetable reminder notifications for own opportunities"
on public.notifications for select
using (
  type = 'timetable_booking_reminder'
  and opportunity_id is not null
  and exists (
    select 1
    from public.opportunities o
    where o.id = notifications.opportunity_id
      and o.created_by = auth.uid()
  )
);
