-- Submit all of a self-booking participant's slot release requests in one
-- transaction. The slots remain booked until the coach approves the request.
create or replace function public.request_own_opportunity_slot_releases(
  target_opportunity_id uuid,
  target_slot_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_slot_ids uuid[];
  matched_booking_count integer;
  updated_count integer;
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(slot_id order by slot_id), '{}'::uuid[])
  into normalized_slot_ids
  from (
    select distinct requested_slot_id as slot_id
    from unnest(coalesce(target_slot_ids, '{}'::uuid[]))
      as requested_slots(requested_slot_id)
    where requested_slot_id is not null
  ) requested_slots;

  if cardinality(normalized_slot_ids) = 0 then
    raise exception 'Choose at least one slot to release';
  end if;

  if cardinality(normalized_slot_ids) > 100 then
    raise exception 'Choose no more than 100 slots at once';
  end if;

  perform opportunities.id
  from public.opportunities
  where opportunities.id = target_opportunity_id
    and opportunities.type = 'camp'
  for share;

  if not found then
    raise exception 'This camp is no longer available';
  end if;

  perform interests.id
  from public.opportunity_interests as interests
  where interests.opportunity_id = target_opportunity_id
    and interests.athlete_id = current_user_id
    and interests.status = 'accepted'
    and coalesce(interests.self_booking_enabled, false)
  for update;

  if not found then
    raise exception 'Self-booking is not enabled for this participant'
      using errcode = '42501';
  end if;

  -- Serialize requests for this participant and validate the whole selection
  -- before updating any row, so a stale client cannot partially succeed.
  perform bookings.id
  from public.opportunity_slot_bookings as bookings
  where bookings.opportunity_id = target_opportunity_id
    and bookings.user_id = current_user_id
    and bookings.slot_id = any(normalized_slot_ids)
  order by bookings.slot_id
  for update;

  select count(distinct bookings.slot_id)::integer
  into matched_booking_count
  from public.opportunity_slot_bookings as bookings
  where bookings.opportunity_id = target_opportunity_id
    and bookings.user_id = current_user_id
    and bookings.slot_id = any(normalized_slot_ids);

  if matched_booking_count <> cardinality(normalized_slot_ids) then
    raise exception 'One or more booked slots could not be found';
  end if;

  update public.opportunity_slot_bookings as bookings
  set
    release_requested_at = now(),
    release_requested_by = current_user_id
  where bookings.opportunity_id = target_opportunity_id
    and bookings.user_id = current_user_id
    and bookings.slot_id = any(normalized_slot_ids)
    and bookings.release_requested_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

comment on function public.request_own_opportunity_slot_releases(uuid, uuid[])
is 'Atomically submits a bounded batch of slot-release requests for the current accepted self-booking participant.';

revoke execute on function public.request_own_opportunity_slot_releases(uuid, uuid[]) from public;
revoke execute on function public.request_own_opportunity_slot_releases(uuid, uuid[]) from anon;
grant execute on function public.request_own_opportunity_slot_releases(uuid, uuid[]) to authenticated;
