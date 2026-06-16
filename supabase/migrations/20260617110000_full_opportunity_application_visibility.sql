drop policy if exists "Users read published opportunities" on public.opportunities;

create policy "Users read published opportunities"
on public.opportunities for select
using (
  status in ('published', 'full')
  or created_by = auth.uid()
  or public.is_admin()
);

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
      and o.status in ('published', 'full')
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
