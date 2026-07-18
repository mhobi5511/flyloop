-- Tunnel dashboards need participant contact emails. Resolve the requested
-- users in one service-role-only database call instead of one Auth Admin HTTP
-- request per participant.
create or replace function public.get_auth_user_emails(target_user_ids uuid[])
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select auth_user.id, auth_user.email::text
  from auth.users as auth_user
  where auth_user.id = any(coalesce(target_user_ids, '{}'::uuid[]));
$$;

comment on function public.get_auth_user_emails(uuid[])
is 'Returns auth emails for a bounded set of user IDs; callable only by the service role.';

revoke execute on function public.get_auth_user_emails(uuid[]) from public;
revoke execute on function public.get_auth_user_emails(uuid[]) from anon;
revoke execute on function public.get_auth_user_emails(uuid[]) from authenticated;
grant execute on function public.get_auth_user_emails(uuid[]) to service_role;
