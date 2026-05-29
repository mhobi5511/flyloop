import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { currentAthlete, tunnels } from "@/lib/demo-data";

export default function OnboardingPage() {
  return (
    <AppShell active="profile">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight">Athlete onboarding</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Enough profile data for coaches to contact athletes externally.
        </p>
        <form className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Name
            <input
              defaultValue={currentAthlete.name}
              className="h-12 rounded-xl border border-slate-200 px-3 font-medium outline-none focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Country
            <input
              defaultValue={currentAthlete.country}
              className="h-12 rounded-xl border border-slate-200 px-3 font-medium outline-none focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Phone / WhatsApp
            <input
              defaultValue={currentAthlete.phone}
              className="h-12 rounded-xl border border-slate-200 px-3 font-medium outline-none focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Instagram
            <input
              defaultValue={currentAthlete.instagram}
              className="h-12 rounded-xl border border-slate-200 px-3 font-medium outline-none focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Home tunnel
            <select
              defaultValue={currentAthlete.homeTunnelId}
              className="h-12 rounded-xl border border-slate-200 px-3 font-medium outline-none focus:border-sky-400"
            >
              {tunnels.map((tunnel) => (
                <option key={tunnel.id} value={tunnel.id}>
                  {tunnel.name}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/app"
            className="mt-2 flex h-12 items-center justify-center rounded-xl bg-sky-600 text-sm font-bold text-white"
          >
            Finish onboarding
          </Link>
        </form>
      </div>
    </AppShell>
  );
}
