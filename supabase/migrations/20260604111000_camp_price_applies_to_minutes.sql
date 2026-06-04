update public.opportunities
set min_minutes_or_hours = case
  when type = 'camp'
    and min_minutes_or_hours ~ '^\s*\d+(\.\d+)?\s*$'
    and min_minutes_or_hours::numeric > 0
    then trim(min_minutes_or_hours)
  when type = 'camp'
    and min_minutes_or_hours ~ '^\s*\d+(\.\d+)?\s*min\s*$'
    and regexp_replace(min_minutes_or_hours, '[^0-9.]', '', 'g')::numeric > 0
    then regexp_replace(min_minutes_or_hours, '[^0-9.]', '', 'g')
  when type = 'camp'
    then '60'
  else null
end;

alter table public.opportunities
  drop constraint if exists opportunities_camp_price_applies_to_minutes_check;

alter table public.opportunities
  add constraint opportunities_camp_price_applies_to_minutes_check
  check (
    type <> 'camp'
    or (
      min_minutes_or_hours is not null
      and min_minutes_or_hours ~ '^\d+(\.\d+)?$'
      and min_minutes_or_hours !~ '^0+(\.0+)?$'
    )
  );
