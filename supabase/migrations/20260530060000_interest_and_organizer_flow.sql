drop policy if exists "Users create interests for published opportunities" on public.opportunity_interests;
drop policy if exists "Athletes create interests for published opportunities" on public.opportunity_interests;

create policy "Users create interests for published opportunities"
on public.opportunity_interests for insert
with check (
  athlete_id = auth.uid()
  and exists (
    select 1
    from public.opportunities
    where id = opportunity_id
      and status = 'published'
      and available_spots > 0
      and created_by <> auth.uid()
  )
);
