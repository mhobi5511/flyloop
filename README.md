# Flyloop

Flyloop is a mobile-first web app for indoor skydiving opportunities. Flyers can follow coaches and tunnels, discover camps and Huck Jams, and send interest when spots are still available.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase-ready schema and client
- Local test mode with browser storage and auth cookies
- PWA-ready manifest

## Local Setup

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open:

```bash
http://localhost:3000
```

The app runs locally without Supabase. To connect Supabase, copy `.env.example` to `.env.local` and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Apply Supabase migrations from `supabase/migrations` in order. See `supabase/README.md`.

## Route Structure

- `/` Public landing page
- `/login` Login
- `/signup` Signup
- `/app` Logged-in opportunities feed
- `/app/opportunities/opp-rafa-last-minute` Opportunity detail
- `/app/coaches/coach-rafa` Coach profile
- `/app/tunnels/tunnel-jochen` Tunnel profile
- `/app/dashboard` Coach dashboard
- `/app/admin` Admin tools

## Testing Checklist

### Public and auth boundary

- Open `/` and confirm only marketing content is visible
- Confirm the landing page CTAs go to `/signup` and `/login`
- Open `/app` in a fresh browser session and confirm it redirects to `/login`
- Log in as Athlete and confirm `/login` redirects to `/app` afterward

### Flow 1: Athlete discovers opportunity

- Go to `/login`
- Continue as Athlete
- Confirm `/app` shows last-minute opportunities first when available
- Open `Rafa Last-Minute Dynamic Camp`
- Click `I'm interested`
- Confirm the success message appears
- Click `Follow coach`
- Click `Follow tunnel`
- Open the notification bell and confirm notifications are listed

### Flow 2: Coach posts opportunity

- Go to `/login`
- Continue as Coach
- Open `/app/dashboard`
- Click `Post Opportunity`
- Select `Camp` or `Huck Jam`
- Fill or keep the minimal fields
- Click `Publish opportunity`
- Confirm the opportunity appears on `/app`
- Use a start date within 10 days and open spots greater than 0 to confirm it appears as last-minute

### Flow 3: Coach handles interest

- Open `/app/dashboard`
- Confirm incoming interests show athlete name, country, phone, WhatsApp and Instagram
- Change status to `Accepted`, `Declined` or `Waitlist`
- Refresh the page and confirm the status persists locally

### Flow 4: Admin tools

- Go to `/login`
- Continue as Admin
- Open `/app/admin`
- Switch visual mode between Athlete, Coach and Admin
- View all opportunities
- View all interests
- Click `Reset demo data`
- Confirm the app returns to seeded state

## Verification

Run:

```bash
npm run lint
npm run build
```

Last-minute is never stored as a separate opportunity type. It is derived in frontend logic and in Supabase with `public.is_last_minute_opportunity(...)`.
