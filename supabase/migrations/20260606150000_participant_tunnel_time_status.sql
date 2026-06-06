alter table public.opportunity_interests
add column if not exists tunnel_time_status text;

alter table public.opportunity_interests
add column if not exists tunnel_account_email text;

alter table public.opportunity_interests
drop constraint if exists opportunity_interests_tunnel_time_status_check;

alter table public.opportunity_interests
add constraint opportunity_interests_tunnel_time_status_check
check (
  tunnel_time_status is null
  or tunnel_time_status in ('owns_tunnel_time', 'needs_tunnel_time')
);

alter table public.opportunity_interests
drop constraint if exists opportunity_interests_tunnel_account_email_check;

alter table public.opportunity_interests
add constraint opportunity_interests_tunnel_account_email_check
check (
  tunnel_account_email is null
  or tunnel_account_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
);

create index if not exists opportunity_interests_tunnel_time_status_idx
on public.opportunity_interests(opportunity_id, tunnel_time_status);

create or replace function public.set_opportunity_participant_tunnel_time_status(
  target_opportunity_id uuid,
  target_tunnel_time_status text,
  target_tunnel_account_email text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  opportunity_record public.opportunities%rowtype;
  interest_record public.opportunity_interests%rowtype;
  clean_email text := nullif(lower(trim(coalesce(target_tunnel_account_email, ''))), '');
begin
  if current_user_id is null then
    raise exception 'Please log in again'
      using errcode = '42501';
  end if;

  if target_tunnel_time_status not in ('owns_tunnel_time', 'needs_tunnel_time') then
    raise exception 'Choose your tunnel time status';
  end if;

  if target_tunnel_time_status = 'owns_tunnel_time' then
    if clean_email is null then
      raise exception 'Enter the email address used for your tunnel account';
    end if;

    if clean_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
      raise exception 'Enter a valid tunnel account email address';
    end if;
  else
    clean_email := null;
  end if;

  select *
  into opportunity_record
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    raise exception 'This opportunity is no longer available';
  end if;

  if opportunity_record.type <> 'camp' then
    raise exception 'Tunnel time status is only available for Camps'
      using errcode = '42501';
  end if;

  if opportunity_record.created_by = current_user_id then
    raise exception 'You manage this opportunity from the organizer dashboard'
      using errcode = '42501';
  end if;

  select *
  into interest_record
  from public.opportunity_interests oi
  where oi.opportunity_id = target_opportunity_id
    and oi.athlete_id = current_user_id
  for update;

  if opportunity_record.booking_mode = 'approval_required' then
    if not found
      or interest_record.status <> 'accepted'
      or interest_record.interest_type = 'timetable_reminder'
    then
      raise exception 'Only accepted participants can set tunnel time status'
        using errcode = '42501';
    end if;

    update public.opportunity_interests
    set
      tunnel_time_status = target_tunnel_time_status,
      tunnel_account_email = clean_email
    where id = interest_record.id;
  else
    if found
      and interest_record.status <> 'accepted'
      and interest_record.interest_type <> 'timetable_reminder'
    then
      raise exception 'This participation cannot book slots'
        using errcode = '42501';
    end if;

    if not found then
      insert into public.opportunity_interests (
        opportunity_id,
        athlete_id,
        status,
        interest_type,
        tunnel_time_status,
        tunnel_account_email
      ) values (
        target_opportunity_id,
        current_user_id,
        'accepted',
        'application',
        target_tunnel_time_status,
        clean_email
      );
    else
      update public.opportunity_interests
      set
        status = 'accepted',
        interest_type = 'application',
        tunnel_time_status = target_tunnel_time_status,
        tunnel_account_email = clean_email
      where id = interest_record.id;
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.set_opportunity_participant_tunnel_time_status(uuid, text, text) from public;
revoke execute on function public.set_opportunity_participant_tunnel_time_status(uuid, text, text) from anon;
grant execute on function public.set_opportunity_participant_tunnel_time_status(uuid, text, text) to authenticated;
