-- Backfill legacy rows first so the column can safely become required again.
update public.opportunities
set registration_deadline = start_date
where registration_deadline is null;

alter table public.opportunities
  alter column registration_deadline set not null;

create or replace function public.sync_opportunity_registration_deadline()
returns trigger
language plpgsql
as $$
begin
  if new.registration_deadline is null then
    new.registration_deadline := new.start_date;
  end if;

  return new;
end;
$$;

drop trigger if exists opportunities_sync_registration_deadline on public.opportunities;

create trigger opportunities_sync_registration_deadline
before insert or update on public.opportunities
for each row execute function public.sync_opportunity_registration_deadline();
