# Flyloop Supabase Setup

Apply the migrations in order:

```bash
supabase db reset
```

Or paste the SQL files into the Supabase SQL editor in this order:

1. `supabase/migrations/20260529120000_flyloop_schema.sql`
2. `supabase/migrations/20260529121000_flyloop_seed.sql`
3. `supabase/migrations/20260529123000_auth_profile_trigger.sql`
4. `supabase/migrations/20260529230000_capability_profiles.sql`

Then copy `.env.example` to `.env.local` and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The app uses Supabase Auth and Database for protected app routes. Public marketing routes still render without a session.

Last-minute opportunities are derived by `public.is_last_minute_opportunity(...)` and exposed through `public.published_opportunities_with_context` / `public.get_home_feed(...)`. They are not stored as a separate opportunity type.
