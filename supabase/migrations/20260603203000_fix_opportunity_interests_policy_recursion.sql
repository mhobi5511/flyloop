create or replace function public.user_can_join_opportunities(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and p.wants_to_join_opportunities = true
  );
$$;

revoke execute on function public.user_can_join_opportunities(uuid) from public;
revoke execute on function public.user_can_join_opportunities(uuid) from anon;
grant execute on function public.user_can_join_opportunities(uuid) to authenticated;

drop policy if exists "Users create interests for published opportunities" on public.opportunity_interests;

create policy "Users create interests for published opportunities"
on public.opportunity_interests for insert
with check (
  athlete_id = auth.uid()
  and public.user_can_join_opportunities(auth.uid())
  and exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_interests.opportunity_id
      and o.status = 'published'
      and o.available_spots > 0
      and (
        (
          o.booking_mode = 'approval_required'
          and opportunity_interests.status = 'pending'
          and opportunity_interests.interest_type = 'application'
        )
        or (
          o.booking_mode = 'direct_time_booking'
          and opportunity_interests.status = 'pending'
          and opportunity_interests.interest_type = 'timetable_reminder'
        )
      )
  )
);
