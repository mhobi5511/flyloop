create or replace function public.prevent_duplicate_unread_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.notifications n
    where n.user_id = new.user_id
      and n.type = new.type
      and n.read = false
      and n.opportunity_id is not distinct from new.opportunity_id
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_prevent_duplicate_unread on public.notifications;

create trigger notifications_prevent_duplicate_unread
before insert on public.notifications
for each row execute function public.prevent_duplicate_unread_notifications();

create index if not exists notifications_user_type_opportunity_unread_idx
on public.notifications(user_id, type, opportunity_id, created_at desc)
where read = false;
