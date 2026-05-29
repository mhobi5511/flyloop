# Flyloop

Flyloop is a mobile-first web app for indoor skydiving opportunities. Flyers can follow coaches and tunnels, discover camps and Huck Jams, and send interest when spots are still available.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, Database and Row Level Security
- PWA-ready manifest

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Run the app:

```bash
npm run dev
```

Open:

```bash
http://localhost:3000
```

## Supabase Setup

1. Create a Supabase project.
2. Open `Project Settings` -> `API`.
3. Copy the Project URL and anon public key into `.env.local`.
4. Open the Supabase SQL editor.
5. Run every SQL file in `supabase/migrations` in filename order.
6. In `Authentication` -> `Providers` -> `Email`, decide whether email confirmation should be enabled.

For local testing, disabling email confirmation is easier because Signup immediately creates a session.

## Route Structure

- `/` Public landing page
- `/login` Login
- `/signup` Signup
- `/app` Logged-in opportunities feed
- `/app/opportunities/[id]` Opportunity detail
- `/app/coaches/[id]` Coach profile
- `/app/tunnels/[id]` Tunnel profile
- `/app/dashboard` Coach dashboard
- `/app/admin` Admin tools

## Testing Checklist

### Public and auth boundary

- Open `/` and confirm only marketing content is visible
- Confirm the landing page CTAs go to `/signup` and `/login`
- Open `/app` logged out and confirm it redirects to `/login`
- Log in and confirm `/login` redirects to `/app` afterward

### Athlete flow

- Sign up or log in as an athlete
- Open `/app`
- Confirm published opportunities appear
- Open an opportunity detail page
- Click `I'm interested`
- Confirm the success message appears
- Follow a coach
- Follow a tunnel

### Coach flow

- Sign up or log in as a coach
- Open `/app/dashboard`
- Click `Post Opportunity`
- Select `Camp` or `Huck Jam`
- Fill the minimal fields
- Set capacity only; open spots are created automatically from capacity
- Publish
- Confirm the opportunity appears on `/app`

### Interest handling

- Open `/app/dashboard` as the coach who created an opportunity
- Confirm incoming interests show athlete name, country, phone, WhatsApp and Instagram when provided
- Change status to `Accepted`, `Declined` or `Waitlist`
- Refresh and confirm the status persists in Supabase

## Verification

Run:

```bash
npm run lint
npm run build
```

Last-minute is never stored as a separate opportunity type. It is derived in frontend logic and in Supabase with `public.is_last_minute_opportunity(...)`.
