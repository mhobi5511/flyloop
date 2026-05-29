import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Compass,
  RadioTower,
  Send,
  Sparkles,
  Wind,
} from "lucide-react";

const steps = [
  {
    title: "Coaches post opportunities",
    copy: "Camps, Huck Jams and open flying sessions become easy to find.",
    icon: CalendarPlus,
  },
  {
    title: "Flyers discover what is available",
    copy: "Follow the coaches and tunnels you care about and see open spots first.",
    icon: Compass,
  },
  {
    title: "Interest is sent directly to the organizer",
    copy: "Flyloop helps demand reach the right person without adding noise.",
    icon: Send,
  },
];

const audiences = [
  {
    title: "Stop missing camps.",
    copy: "Instagram shows that something exists. Flyloop shows what is available and how to join.",
  },
  {
    title: "Fill your camps faster.",
    copy: "Post once and reach active flyers who are already looking for coaching, camps and last-minute opportunities.",
  },
  {
    title: "Reach the flyers who matter.",
    copy: "Promote camps, Huck Jams and open flying opportunities directly to the indoor skydiving community.",
  },
];

const pricing = [
  ["Athletes", "Free"],
  ["Coaches", "Free during beta"],
  ["Tunnels", "Free during beta"],
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-white text-slate-950">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-sky-600 text-white">
            <Wind size={20} />
          </span>
          <span className="text-xl font-black tracking-tight">Flyloop</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-bold text-slate-700"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            Create free account
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:pb-24">
        <div>
          <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-bold text-sky-700">
            Indoor skydiving discovery
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-6xl">
            Find your next indoor skydiving opportunity.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Follow coaches and tunnels, discover camps and Huck Jams, and never
            miss an open spot.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-sky-700"
            >
              Create free account <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-4 shadow-xl">
          <div className="rounded-[1.5rem] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
                  Availability signal
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  Camps, Huck Jams and open spots in one place.
                </h2>
              </div>
              <span className="grid size-12 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                <RadioTower size={22} />
              </span>
            </div>
            <div className="mt-6 grid gap-3">
              {["Coach availability", "Tunnel opportunities", "Open spots"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <CheckCircle2 size={18} className="text-sky-600" />
                    <span className="font-bold text-slate-800">{item}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-black tracking-tight">How it works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-xl font-black tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.copy}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 md:grid-cols-3">
        {audiences.map((item) => (
          <div
            key={item.title}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
          >
            <h2 className="text-2xl font-black tracking-tight">{item.title}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">{item.copy}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-[2rem] bg-sky-50 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-sky-700">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className="text-3xl font-black tracking-tight">
                Private beta pricing
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Flyloop is currently in private beta. Coaches and tunnels can use
                all core features for free during the beta phase.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {pricing.map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white p-5">
                <p className="text-sm font-bold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-[2rem] bg-slate-950 p-8 text-white">
          <h2 className="max-w-2xl text-3xl font-black tracking-tight">
            Join the indoor skydiving community as opportunities open.
          </h2>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="flex h-12 items-center justify-center rounded-xl bg-sky-500 px-5 text-sm font-bold text-white"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-slate-200 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Flyloop</p>
        <p>Indoor skydiving opportunities, easier to find.</p>
      </footer>
    </main>
  );
}
