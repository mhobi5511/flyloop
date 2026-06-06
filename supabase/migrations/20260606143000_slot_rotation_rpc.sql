create or replace function public.set_opportunity_slot_booking_rotation(
  target_opportunity_id uuid,
  target_booking_id uuid,
  target_rotation_minutes numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  booking_record public.opportunity_slot_bookings%rowtype;
  clean_rotation numeric(5,2);
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id;

  if not found then
    raise exception 'Opportunity not found';
  end if;

  if opportunity_record.type <> 'camp' then
    raise exception 'Rotation is only available for Camps';
  end if;

  if opportunity_record.created_by <> current_user_id then
    raise exception 'Only the coach can set slot rotation'
      using errcode = '42501';
  end if;

  select *
  into booking_record
  from public.opportunity_slot_bookings
  where id = target_booking_id
    and opportunity_id = target_opportunity_id;

  if not found then
    raise exception 'Booking not found';
  end if;

  if target_rotation_minutes is null then
    clean_rotation := null;
  elsif target_rotation_minutes > 0 then
    clean_rotation := round(target_rotation_minutes, 2);
  else
    raise exception 'Choose a rotation above 0 minutes';
  end if;

  update public.opportunity_slot_bookings
  set rotation_minutes = clean_rotation
  where id = target_booking_id
    and opportunity_id = target_opportunity_id;

  return true;
end;
$$;

revoke execute on function public.set_opportunity_slot_booking_rotation(uuid, uuid, numeric) from public;
revoke execute on function public.set_opportunity_slot_booking_rotation(uuid, uuid, numeric) from anon;
grant execute on function public.set_opportunity_slot_booking_rotation(uuid, uuid, numeric) to authenticated;
