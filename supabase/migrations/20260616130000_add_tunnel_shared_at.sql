alter table public.opportunities
add column if not exists tunnel_shared_at timestamptz null;
