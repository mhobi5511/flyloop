import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock3,
  Compass,
  Download,
  Dumbbell,
  Globe2,
  Handshake,
  ListChecks,
  RadioTower,
  Sparkles,
  Users,
} from "lucide-react";

const problemChannels = [
  "WhatsApp groups",
  "Instagram stories",
  "Facebook posts",
  "Personal contacts",
];

const flowSteps = [
  "Discover",
  "Apply",
  "Get Accepted",
  "Book Times",
  "Fly",
  "Stay Connected",
];

const athleteFeatures = [
  "Discover Camps",
  "Find Huck Jams",
  "Follow Coaches",
  "Follow Tunnels",
  "Apply in Seconds",
  "Book Your Flying Times",
  "Track Upcoming Sessions",
  "Build Your Profile",
];

const coachFeatures = [
  "Create Camps",
  "Manage Applications",
  "Accept Participants",
  "Publish Timetables",
  "Manage Time Slots",
  "Export Schedules",
  "Build Your Community",
];

const timetableFeatures = [
  { label: "Published Timetables", icon: CalendarCheck },
  { label: "Slot Booking", icon: Clock3 },
  { label: "Participant Management", icon: Users },
  { label: "Schedule Exports", icon: Download },
  { label: "Booking Overview", icon: ListChecks },
];

const profileFeatures = [
  { label: "Athlete Profiles", icon: Dumbbell },
  { label: "Coach Profiles", icon: Users },
  { label: "Disciplines", icon: Sparkles },
  { label: "Home Tunnel", icon: RadioTower },
  { label: "Instagram Integration", icon: Camera },
  { label: "Community Discovery", icon: Globe2 },
];

const reasons = [
  {
    title: "Discover Faster",
    copy: "Find camps, coaches and opportunities without searching endless group chats.",
    icon: Compass,
  },
  {
    title: "Stay Organized",
    copy: "Applications, timetables and schedules in one place.",
    icon: ListChecks,
  },
  {
    title: "Grow Your Network",
    copy: "Connect with athletes, coaches and tunnels across the community.",
    icon: Handshake,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-white text-slate-950">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/flyloop-icon-512.png"
            alt=""
            width={40}
            height={40}
            priority
            className="size-10 rounded-xl shadow-sm"
          />
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
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-7 lg:grid-cols-[1fr_0.88fr] lg:items-center lg:pb-20">
        <div>
          <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-bold text-sky-700">
            Free during the early growth phase.
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-6xl">
            The Home of Indoor Skydiving Camps
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Discover camps. Manage camps. Connect with the community. Flyloop
            brings athletes, coaches and tunnels together in one place.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup" variant="primary">
              Get Started <ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="/app" variant="secondary">
              Explore Camps
            </ButtonLink>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl">
          <Image
            src="/flyloop-icon-512.png"
            alt=""
            width={112}
            height={112}
            priority
            className="absolute right-4 top-4 size-28 rounded-3xl opacity-20"
          />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
              Community loop
            </p>
            <h2 className="mt-2 max-w-sm text-3xl font-black tracking-tight">
              Discovery, applications and timetables moving together.
            </h2>
            <div className="mt-7 grid gap-3">
              {[
                ["Athletes", "Find opportunities and book flying times"],
                ["Coaches", "Manage applications and schedules"],
                ["Tunnels", "Stay visible in the community"],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-4"
                >
                  <CheckCircle2 className="mt-0.5 text-sky-300" size={18} />
                  <div>
                    <p className="font-black">{title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-300">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeading
            eyebrow="Social proof"
            title="Built by the community."
            copy="Flyloop is developed together with athletes, coaches and tunnels across Europe. Every feature is shaped by real community feedback."
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <SectionHeading
          eyebrow="The problem"
          title="The community is everywhere."
          copy="Finding the right camp often means searching through dozens of messages. Managing participants and schedules creates even more work."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {problemChannels.map((channel) => (
            <div
              key={channel}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-black text-slate-500">Shared through</p>
              <h3 className="mt-2 text-xl font-black tracking-tight">{channel}</h3>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeading
            eyebrow="The solution"
            title="Everything in one place."
            copy="Flyloop helps athletes find opportunities and helps coaches keep everything organized."
            dark
          />
          <div className="grid gap-2">
            {flowSteps.map((step, index) => (
              <div key={step}>
                <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-slate-950">
                  <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sm font-black text-sky-700">
                    {index + 1}
                  </span>
                  <p className="font-black">{step}</p>
                </div>
                {index < flowSteps.length - 1 ? (
                  <div className="grid h-6 place-items-center text-sky-300">
                    <ArrowDown size={18} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-16 lg:grid-cols-2">
        <AudiencePanel
          eyebrow="For athletes"
          title="Find your next opportunity."
          features={athleteFeatures}
          cta="Find Your Next Camp"
          href="/app"
          accent="sky"
        />
        <AudiencePanel
          eyebrow="For coaches"
          title="Spend less time organizing."
          features={coachFeatures}
          cta="Create Your First Camp"
          href="/app/create"
          accent="emerald"
        />
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <SectionHeading
            eyebrow="Timetables"
            title="From announcement to flight schedule."
            copy="Create your timetable once. Participants select their preferred times. Flyloop keeps everything organized."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {timetableFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.label}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
                    <Icon size={19} />
                  </span>
                  <p className="font-black">{feature.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <SectionHeading
            eyebrow="Community"
            title="Built for athletes. Built for coaches."
            copy="The more people join Flyloop, the more valuable it becomes. More coaches create more camps. More athletes create more opportunities. More tunnels strengthen the ecosystem. Flyloop is community-driven."
          />
          <div className="grid gap-3">
            {[
              "Not owned by a tunnel.",
              "Not built for a single coach.",
              "Built for everyone.",
            ].map((line) => (
              <div
                key={line}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Handshake size={19} className="text-emerald-600" />
                <p className="font-black">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-sky-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <SectionHeading
            eyebrow="Profiles"
            title="Show who you are."
            copy="Let people discover your flying journey."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profileFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.label} className="rounded-2xl bg-white p-5 shadow-sm">
                  <span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white">
                    <Icon size={18} />
                  </span>
                  <p className="mt-4 font-black">{feature.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading eyebrow="Why Flyloop" title="Why people use Flyloop." />
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {reasons.map((reason) => {
            const Icon = reason.icon;
            return (
              <div
                key={reason.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-700">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-xl font-black tracking-tight">
                  {reason.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{reason.copy}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-[2rem] bg-slate-950 p-7 text-white md:p-9">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-200">
            Early adopter
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
            Join early. Help shape the future.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Flyloop is growing rapidly. The platform is actively developed based
            on feedback from real athletes and coaches. Join now and help build
            the community together.
          </p>
          <div className="mt-7">
            <ButtonLink href="/signup" variant="light">
              Create Your Free Account <ArrowRight size={18} />
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            Ready for your next camp?
          </h2>
          <p className="mt-4 text-lg font-semibold text-slate-600">
            Join the growing indoor skydiving community.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/signup" variant="primary">
              Get Started
            </ButtonLink>
            <ButtonLink href="/app" variant="secondary">
              Explore Camps
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-slate-200 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-black text-slate-950">Flyloop</p>
        <p>Discover. Manage. Connect. Fly.</p>
      </footer>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  dark?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-sm font-bold uppercase tracking-[0.18em] ${
          dark ? "text-sky-200" : "text-sky-700"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-3xl font-black tracking-tight sm:text-4xl ${
          dark ? "text-white" : "text-slate-950"
        }`}
      >
        {title}
      </h2>
      {copy ? (
        <p
          className={`mt-4 max-w-2xl text-base leading-7 ${
            dark ? "text-slate-300" : "text-slate-600"
          }`}
        >
          {copy}
        </p>
      ) : null}
    </div>
  );
}

function AudiencePanel({
  eyebrow,
  title,
  features,
  cta,
  href,
  accent,
}: {
  eyebrow: string;
  title: string;
  features: string[];
  cta: string;
  href: string;
  accent: "sky" | "emerald";
}) {
  const tone =
    accent === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight">{title}</h2>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black ${tone}`}
          >
            <CheckCircle2 size={17} />
            <span>{feature}</span>
          </div>
        ))}
      </div>
      <Link
        href={href}
        className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
      >
        {cta} <ArrowRight size={18} />
      </Link>
    </div>
  );
}

function ButtonLink({
  href,
  variant,
  children,
}: {
  href: string;
  variant: "primary" | "secondary" | "light";
  children: React.ReactNode;
}) {
  const className = {
    primary:
      "bg-slate-950 text-white shadow-sm hover:bg-slate-800",
    secondary:
      "border border-slate-200 bg-white text-slate-800 hover:border-slate-300",
    light: "bg-white text-slate-950 shadow-sm hover:bg-slate-100",
  }[variant];

  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold ${className}`}
    >
      {children}
    </Link>
  );
}
