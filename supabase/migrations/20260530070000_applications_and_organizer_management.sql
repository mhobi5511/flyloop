drop policy if exists "Users delete own pending applications" on public.opportunity_interests;

create policy "Users delete own pending applications"
on public.opportunity_interests for delete
using (
  athlete_id = auth.uid()
  and status in ('pending', 'waitlist')
);

grant delete on public.opportunity_interests to authenticated;
