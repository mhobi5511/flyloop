create or replace function public.reset_opportunity_test_data()
returns table (
  notifications_deleted integer,
  interests_deleted integer,
  opportunities_deleted integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt()->>'email', '')) <> 'marc.hobi@gmx.ch' then
    raise exception 'Only the Flyloop admin may reset opportunity test data.'
      using errcode = '42501';
  end if;

  with deleted_notifications as (
    delete from public.notifications
    where opportunity_id is not null
      or type in ('new_interest', 'new_opportunity', 'last_minute')
    returning 1
  )
  select count(*)::integer
  into notifications_deleted
  from deleted_notifications;

  with deleted_interests as (
    delete from public.opportunity_interests
    returning 1
  )
  select count(*)::integer
  into interests_deleted
  from deleted_interests;

  with deleted_opportunities as (
    delete from public.opportunities
    returning 1
  )
  select count(*)::integer
  into opportunities_deleted
  from deleted_opportunities;

  return next;
end;
$$;

revoke all on function public.reset_opportunity_test_data() from public;
grant execute on function public.reset_opportunity_test_data() to authenticated;
