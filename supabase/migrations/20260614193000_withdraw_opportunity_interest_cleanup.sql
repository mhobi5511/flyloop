create or replace function public.withdraw_opportunity_interest(target_interest_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  interest_record public.opportunity_interests%rowtype;
  affected_opportunity_id uuid;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select *
  into interest_record
  from public.opportunity_interests
  where id = target_interest_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  if interest_record.athlete_id <> current_user_id then
    raise exception 'Application not found';
  end if;

  if interest_record.status = 'declined' then
    raise exception 'This application was already declined.';
  end if;

  affected_opportunity_id := interest_record.opportunity_id;

  delete from public.camp_day_preferences
  where opportunity_id = affected_opportunity_id
    and participant_id = current_user_id;

  delete from public.opportunity_slot_bookings
  where opportunity_id = affected_opportunity_id
    and user_id = current_user_id;

  delete from public.notifications
  where user_id = current_user_id
    and opportunity_id = affected_opportunity_id
    and type in (
      'application_status',
      'timetable_published',
      'timetable_booking_reminder',
      'timetable_booking_changed',
      'slot_bookings_released',
      'slot_bookings_released_by_organizer',
      'slot_booking_released_by_organizer',
      'slot_booking_assigned_by_organizer',
      'participant_removed_from_camp',
      'participant_removal_kept'
    );

  delete from public.opportunity_interests
  where id = target_interest_id
    and athlete_id = current_user_id;

  return affected_opportunity_id;
end;
$$;

revoke execute on function public.withdraw_opportunity_interest(uuid) from public;
revoke execute on function public.withdraw_opportunity_interest(uuid) from anon;
grant execute on function public.withdraw_opportunity_interest(uuid) to authenticated;
