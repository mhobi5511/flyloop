alter table public.camp_day_preferences
  drop constraint if exists camp_day_preferences_preferred_minutes_check;

alter table public.camp_day_preferences
  add constraint camp_day_preferences_preferred_minutes_check
  check (preferred_minutes in (0, 30, 45, 60, 75, 90));
