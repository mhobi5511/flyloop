alter table public.profiles
  add column if not exists push_notifications_enabled boolean not null default false,
  add column if not exists push_prompt_answered_at timestamptz;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions(user_id);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users read own push subscriptions" on public.push_subscriptions;
create policy "Users read own push subscriptions"
on public.push_subscriptions for select
using (user_id = auth.uid());

drop policy if exists "Users create own push subscriptions" on public.push_subscriptions;
create policy "Users create own push subscriptions"
on public.push_subscriptions for insert
with check (user_id = auth.uid());

drop policy if exists "Users update own push subscriptions" on public.push_subscriptions;
create policy "Users update own push subscriptions"
on public.push_subscriptions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users delete own push subscriptions" on public.push_subscriptions;
create policy "Users delete own push subscriptions"
on public.push_subscriptions for delete
using (user_id = auth.uid());

alter table public.notifications
  add column if not exists push_sent_at timestamptz;

create index if not exists notifications_user_push_pending_idx
on public.notifications(user_id, push_sent_at, created_at desc)
where push_sent_at is null;

grant select, insert, update, delete on public.push_subscriptions to authenticated;
