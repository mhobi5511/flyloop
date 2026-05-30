# Flyloop Supabase Setup

Apply the migrations in `supabase/migrations` in filename order through Supabase SQL tooling.

Production requirements:

- Do not seed demo auth users.
- Do not run data wipe operations.
- Create admin accounts manually in Supabase.
- Create and maintain tunnel records only through an admin-controlled process.
- Keep Supabase Auth Site URL and Redirect URLs aligned with the production Flyloop URL documented in the root README.

The app uses Supabase Auth and Database for protected app routes. Public marketing routes still render without a session.

Last-minute opportunities are derived by `public.is_last_minute_opportunity(...)` and exposed through `public.published_opportunities_with_context` / `public.get_home_feed(...)`. They are not stored as a separate opportunity type.
