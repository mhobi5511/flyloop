-- Prevent concurrent workers from delivering the same notification by leasing
-- a small batch before any network calls are made.
alter table public.notifications
  add column if not exists push_claim_token uuid,
  add column if not exists push_claimed_at timestamptz;

alter table public.notifications
  drop constraint if exists notifications_push_claim_pair_check;

alter table public.notifications
  add constraint notifications_push_claim_pair_check
  check (
    (push_claim_token is null and push_claimed_at is null)
    or (push_claim_token is not null and push_claimed_at is not null)
  );

comment on column public.notifications.push_claim_token
is 'Opaque worker lease used to prevent duplicate Web Push delivery.';

comment on column public.notifications.push_claimed_at
is 'Time at which a Web Push worker leased the notification; leases expire after five minutes.';

-- Replace the earlier broad pending index with the unread-only access path used
-- by per-user claims. The opportunity-first fan-out index is defined separately.
drop index if exists public.notifications_user_push_pending_idx;

create index notifications_user_push_pending_idx
on public.notifications(user_id, created_at asc)
where push_sent_at is null and read = false;

create or replace function public.claim_pending_push_notifications(
  target_user_id uuid,
  target_opportunity_id uuid default null,
  target_types text[] default null,
  target_limit integer default 10
)
returns table (
  id uuid,
  user_id uuid,
  title text,
  body text,
  type text,
  opportunity_id uuid,
  created_at timestamptz,
  push_claim_token uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_claim_token uuid := gen_random_uuid();
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and auth.uid() is distinct from target_user_id then
    raise exception 'Push claims may only target the authenticated user'
      using errcode = '42501';
  end if;

  if target_user_id is null then
    raise exception 'A push claim requires a user';
  end if;

  return query
  with candidates as materialized (
    select notification.id
    from public.notifications as notification
    where notification.user_id = target_user_id
      and notification.read = false
      and notification.push_sent_at is null
      and (
        notification.push_claimed_at is null
        or notification.push_claimed_at < statement_timestamp() - interval '5 minutes'
      )
      and (
        target_opportunity_id is null
        or notification.opportunity_id = target_opportunity_id
      )
      and (
        target_types is null
        or cardinality(target_types) = 0
        or notification.type = any(target_types)
      )
    order by notification.created_at asc, notification.id asc
    limit least(greatest(coalesce(target_limit, 10), 1), 10)
    for update of notification skip locked
  ),
  claimed as (
    update public.notifications as notification
    set
      push_claim_token = new_claim_token,
      push_claimed_at = statement_timestamp()
    from candidates
    where notification.id = candidates.id
    returning
      notification.id,
      notification.user_id,
      notification.title,
      notification.body,
      notification.type,
      notification.opportunity_id,
      notification.created_at,
      notification.push_claim_token
  )
  select
    claimed.id,
    claimed.user_id,
    claimed.title,
    claimed.body,
    claimed.type,
    claimed.opportunity_id,
    claimed.created_at,
    claimed.push_claim_token
  from claimed
  order by claimed.created_at asc, claimed.id asc;
end;
$$;

comment on function public.claim_pending_push_notifications(uuid, uuid, text[], integer)
is 'Atomically leases up to ten unread, unsent notifications for the authenticated user or a service-role worker.';

revoke execute on function public.claim_pending_push_notifications(uuid, uuid, text[], integer) from public;
revoke execute on function public.claim_pending_push_notifications(uuid, uuid, text[], integer) from anon;
grant execute on function public.claim_pending_push_notifications(uuid, uuid, text[], integer) to authenticated;
grant execute on function public.claim_pending_push_notifications(uuid, uuid, text[], integer) to service_role;

-- Resolve a lease through a token-scoped function so authenticated callers do
-- not need direct write access to the delivery metadata. A user may only
-- resolve their own lease; scheduled fan-out continues to use the service role.
create or replace function public.resolve_push_notification_claim(
  target_user_id uuid,
  target_claim_token uuid,
  target_sent_notification_ids uuid[] default null,
  target_released_notification_ids uuid[] default null
)
returns table (
  sent_count integer,
  released_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and auth.uid() is distinct from target_user_id then
    raise exception 'Push claims may only be resolved for the authenticated user'
      using errcode = '42501';
  end if;

  if target_user_id is null or target_claim_token is null then
    raise exception 'A push claim resolution requires a user and claim token';
  end if;

  if coalesce(cardinality(target_sent_notification_ids), 0) > 10
    or coalesce(cardinality(target_released_notification_ids), 0) > 10 then
    raise exception 'A push claim resolution is limited to ten notification ids';
  end if;

  update public.notifications as notification
  set
    push_sent_at = statement_timestamp(),
    push_claim_token = null,
    push_claimed_at = null
  where notification.user_id = target_user_id
    and notification.push_claim_token = target_claim_token
    and notification.push_sent_at is null
    and notification.id = any(
      coalesce(target_sent_notification_ids, '{}'::uuid[])
    );

  get diagnostics sent_count = row_count;

  update public.notifications as notification
  set
    push_claim_token = null,
    push_claimed_at = null
  where notification.user_id = target_user_id
    and notification.push_claim_token = target_claim_token
    and notification.push_sent_at is null
    and notification.id = any(
      coalesce(target_released_notification_ids, '{}'::uuid[])
    );

  get diagnostics released_count = row_count;
  return next;
end;
$$;

comment on function public.resolve_push_notification_claim(uuid, uuid, uuid[], uuid[])
is 'Marks delivered notifications sent and releases failed notifications for one token-scoped Web Push lease.';

revoke execute on function public.resolve_push_notification_claim(uuid, uuid, uuid[], uuid[]) from public;
revoke execute on function public.resolve_push_notification_claim(uuid, uuid, uuid[], uuid[]) from anon;
grant execute on function public.resolve_push_notification_claim(uuid, uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.resolve_push_notification_claim(uuid, uuid, uuid[], uuid[]) to service_role;

-- Authenticated clients only need to mark their own notifications read. Keep
-- worker lease and delivery columns service-side even though users own the row.
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;
