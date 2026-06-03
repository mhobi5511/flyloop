create or replace function public.release_opportunity_slot_booking(
  target_opportunity_id uuid,
  target_booking_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  opportunity_record public.opportunities%rowtype;
  booking_record public.opportunity_slot_bookings%rowtype;
  released_count integer;
begin
  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if auth.uid() is null or opportunity_record.created_by <> auth.uid() then
    raise exception 'Not authorized to release timetable bookings'
      using errcode = '42501';
  end if;

  select *
  into booking_record
  from public.opportunity_slot_bookings
  where id = target_booking_id
    and opportunity_id = target_opportunity_id;

  if not found then
    return 0;
  end if;

  if booking_record.user_id = opportunity_record.created_by then
    return 0;
  end if;

  delete from public.opportunity_slot_bookings osb
  where osb.id = target_booking_id
    and osb.opportunity_id = target_opportunity_id;

  get diagnostics released_count = row_count;

  if released_count > 0 then
    insert into public.notifications (user_id, title, body, type, opportunity_id)
    values (
      booking_record.user_id,
      'One of your booked times was released.',
      'One of your booked times for ' || coalesce(opportunity_record.title, 'this opportunity') || ' was released by the organizer. Please review your timetable.',
      'slot_booking_released_by_organizer',
      target_opportunity_id
    );
  end if;

  return released_count;
end;
$$;

revoke execute on function public.release_opportunity_slot_booking(uuid, uuid) from public;
revoke execute on function public.release_opportunity_slot_booking(uuid, uuid) from anon;
grant execute on function public.release_opportunity_slot_booking(uuid, uuid) to authenticated;
