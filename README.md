# Flyloop

Flyloop is a production-first web app for indoor skydiving opportunities. Flyers can follow coaches and tunnels, discover camps and Huck Jams, and send interest when spots are still available.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Database and Row Level Security
- Vercel deployment

## Production Environment

Set these variables in Vercel for the production deployment:

```bash
NEXT_PUBLIC_SITE_URL=https://YOUR-PRODUCTION-FLYLOOP-DOMAIN
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

`NEXT_PUBLIC_SITE_URL` must be the canonical Flyloop production HTTPS origin configured in Vercel. Auth links are generated from this value, and the app rejects non-HTTPS site URLs.

## Supabase Auth Checklist

- Site URL: the exact `NEXT_PUBLIC_SITE_URL` production origin.
- Redirect URLs:
  - `${NEXT_PUBLIC_SITE_URL}/auth/callback`
  - `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/app`
  - `${NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`
- Email provider: enabled.
- Confirm email: enabled for production signups.
- Confirm signup email template: uses Supabase's `{{ .ConfirmationURL }}`.
- Password recovery email template: uses Supabase's recovery link and redirects to the production callback URL.
- Magic link email template, if enabled: uses Supabase's magic link and redirects to the production callback URL.
- Additional redirect origins for preview or development deployments: none.
- Admin accounts: created manually in Supabase only.
- Tunnel records: created and managed by admins only.

## Database Checklist

Apply the SQL migrations in `supabase/migrations` in filename order through Supabase SQL tooling.

- `profiles.is_admin` is protected by trigger and RLS.
- Users can update their own profile capability fields.
- `wants_to_join_opportunities` and `wants_to_create_opportunities` can both be true.
- Users can create opportunities only when `wants_to_create_opportunities = true`.
- Regular users cannot insert, update or delete tunnel records.

## Route Structure

- `/` Public landing page
- `/login` Login
- `/signup` Signup
- `/auth/callback` Supabase email confirmation, recovery and magic-link callback
- `/reset-password` Password recovery completion
- `/app` Logged-in opportunities feed
- `/app/opportunities/[id]` Opportunity detail
- `/app/coaches/[id]` Coach profile
- `/app/tunnels/[id]` Tunnel profile
- `/app/create` Create an opportunity
- `/app/dashboard` Organizer dashboard
- `/app/onboarding` Profile
- `/app/admin` Admin tools

## Production Verification

- Create account.
- Receive confirmation email.
- Confirm email.
- Land on the production Flyloop URL and enter the authenticated app.
- Open Profile.
- Enable joining opportunities.
- Enable creating opportunities.
- Save and confirm `Profile saved successfully.`
- Refresh Profile and confirm both settings remain enabled.
- Open Create.
- Open Organizer.
- Create an opportunity.
- Log out.
- Log in again.
- Confirm Create and Organizer access still work.
- Confirm desktop, tablet and mobile authenticated navigation are visible and highlight the active page.
- Confirm the landing page does not show authenticated navigation.
- Confirm regular users cannot select or set admin status.
- Confirm regular users cannot create, edit or delete tunnels.

## Verification Commands

Run before deployment:

```bash
npm run lint
npm run build
```

Last-minute is never stored as a separate opportunity type. It is derived in frontend logic and in Supabase with `public.is_last_minute_opportunity(...)`.
