import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  CheckCircle2,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Flyloop | The Operating System for Indoor Skydiving Camps",
  description:
    "Discover camps, manage athletes, and run your entire indoor skydiving operation from one place.",
};

const problemItems = ["Instagram", "WhatsApp", "Excel", "Google Sheets", "DMs"];
const solutionItems = ["Discover", "Apply", "Manage", "Publish", "Fly"];

const athleteFeatures = [
  {
    title: "Find Camps",
    copy: "Browse camps and Huck Jams in one clean feed.",
    icon: Search,
  },
  {
    title: "Apply in Seconds",
    copy: "Move from discovery to application without friction.",
    icon: ClipboardList,
  },
  {
    title: "Track Your Status",
    copy: "See whether you're pending, accepted, or waitlisted.",
    icon: BadgeCheck,
  },
];

const coachFeatures = [
  {
    title: "Create Camps",
    copy: "Publish opportunities once and keep them organized.",
    icon: Sparkles,
  },
  {
    title: "Manage Applications",
    copy: "Review athletes and move decisions forward quickly.",
    icon: ClipboardList,
  },
  {
    title: "Publish Timetables",
    copy: "Build the schedule and release it with confidence.",
    icon: CalendarClock,
  },
  {
    title: "Run Your Command Center",
    copy: "See next actions in one focused queue.",
    icon: Workflow,
  },
];

const lifecycleColumns = [
  {
    title: "Athlete Journey",
    steps: ["Discover Camp", "Apply", "Accepted", "Timetable Published", "Fly"],
  },
  {
    title: "Coach Journey",
    steps: ["Create Camp", "Review Applications", "Assign Times", "Publish Timetable", "Run Event"],
  },
];

const indoorSkydivingBlocks = ["Camps", "Huck Jams", "Coaches", "Athletes", "Tunnels"];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#eff8ff_0%,#ffffff_32%,#f8fafc_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/flyloop-icon-512.png"
              alt="Flyloop"
              width={40}
              height={40}
              preload
              className="size-10 rounded-2xl shadow-sm"
            />
            <div>
              <p className="text-[0.7rem] font-black uppercase tracking-[0.24em] text-sky-700">
                Flyloop
              </p>
              <p className="text-sm font-semibold text-slate-500">
                Operating system for camps
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-full bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700"
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-16">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-sky-700">
            Built for indoor skydiving camps
          </p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            The Operating System for Indoor Skydiving Camps
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">
            Discover camps. Manage athletes. Run your entire operation from one place.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 sm:w-auto"
            >
              Create Free Account <ArrowRight size={18} />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 sm:w-auto"
            >
              See How It Works
            </Link>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {["Replace WhatsApp groups", "Replace spreadsheets", "Replace manual administration"].map(
              (item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4"
                >
                  <p className="text-sm font-black leading-6 text-slate-950">{item}</p>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-sky-100/60 blur-3xl sm:-inset-6 sm:rounded-[3rem]" />
          <ScreenshotPanel
            src="/screenshots/discover.png"
            alt="Flyloop discover screen showing upcoming camps and recommended opportunities"
            title="Discover"
            subtitle="Everything starts here."
            description="This is the first place athletes see opportunities and the clearest entry point into Flyloop."
            frameClassName="max-w-[900px] mx-auto"
            mediaClassName="aspect-[1005/1122]"
            preload
          />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/75 py-12">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <SectionHeading
            eyebrow="Problem / Solution"
            title="Replace the stack of tools that keeps camps fragmented."
            copy="Flyloop turns scattered communication into one workflow."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CompactCompareCard title="Without Flyloop" tone="rose" items={problemItems} footer="Chaos" />
            <CompactCompareCard title="With Flyloop" tone="sky" items={solutionItems} footer="One workflow" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="For athletes"
          title="Never miss a camp again."
          copy="Flyloop gives athletes a fast path from discovery to flight day."
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div className="grid gap-3">
            {athleteFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="grid size-11 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.copy}</p>
                </div>
              );
            })}
          </div>

          <ScreenshotPanel
            src="/screenshots/discover.png"
            alt="Flyloop discover screen with camps and recommended opportunities"
            title="Find camps in a clean feed."
            subtitle="The hero view for athletes."
            description="Athletes can scan opportunities, compare camps, and move directly into action."
            frameClassName="max-w-[980px] mx-auto"
            mediaClassName="aspect-[1005/1122]"
          />
        </div>
      </section>

      <section className="bg-slate-950 py-16 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div className="max-w-xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">
                My Flying
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Everything in one place.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Track applications, accepted camps and upcoming flying time.
              </p>
            </div>
            <div className="flex justify-center">
              <ScreenshotPanel
                src="/screenshots/my-flying.png"
                alt="Flyloop my flying screen showing booked sessions and timetable"
                title="My Flying"
                subtitle="Mobile season view."
                description="A focused view of status, booked times, and what's next."
                dark
                frameClassName="max-w-[430px] w-full"
                mediaClassName="aspect-[429/932]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="For coaches"
          title="Stop running camps from spreadsheets."
          copy="Flyloop gives coaches a clear operational surface for applications, schedules, and publishing."
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-2">
            {coachFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-white">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{feature.copy}</p>
                </div>
              );
            })}
          </div>

          <ScreenshotPanel
            src="/screenshots/coach-command-center.png"
            alt="Flyloop coach command center dashboard showing attention items and opportunities"
            title="Coach Command Center"
            subtitle="A compact inbox for next actions."
            description="This is the highest-value coach surface: applications, issues, and next decisions in one place."
            dark
            frameClassName="max-w-[1040px] mx-auto"
            mediaClassName="aspect-[1502/1208]"
          />
        </div>
      </section>

      <section className="bg-white/80 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Operations workspace"
            title="From applications to flight time allocation."
            copy="Manage athletes, assign times and publish timetables."
          />
          <div className="mt-8">
            <ScreenshotPanel
              src="/screenshots/coach-workspace.png"
              alt="Flyloop coach operations workspace showing schedule, participants, and publishing controls"
              title="Coach Operations Workspace"
              subtitle="Full-season control."
              description="A large workspace for planning, scheduling, and publishing."
              dark
              frameClassName="max-w-[1180px] mx-auto"
              mediaClassName="aspect-[1503/1080]"
            />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Flyloop lifecycle"
          title="The workflow feels like a process, not a checklist."
          copy="Athletes and coaches move through clear steps with no confusion about what comes next."
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {lifecycleColumns.map((column) => (
            <WorkflowPanel key={column.title} title={column.title} steps={column.steps} />
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/80 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Built specifically"
            title="Not generic event software."
            copy="Flyloop is purpose-built around indoor skydiving operations."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {indoorSkydivingBlocks.map((block) => (
              <div
                key={block}
                className="flex items-center justify-center gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-5 text-center shadow-sm"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-700">
                  <CheckCircle2 size={16} />
                </span>
                <p className="text-sm font-black tracking-tight text-slate-950">{block}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2.25rem] bg-slate-950 px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">
              Final CTA
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Everything in one place.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
              Whether you&apos;re flying or organizing, Flyloop keeps your entire season together.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-sky-100 sm:w-auto"
              >
                Create Free Account <ArrowRight size={18} />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-slate-200 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="font-black text-slate-950">Flyloop</p>
        <p>Discover. Manage. Publish. Fly.</p>
      </footer>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      {copy ? <p className="mt-4 text-base leading-7 text-slate-600">{copy}</p> : null}
    </div>
  );
}

function CompactCompareCard({
  title,
  tone,
  items,
  footer,
}: {
  title: string;
  tone: "rose" | "sky";
  items: string[];
  footer: string;
}) {
  const toneClasses =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-sky-200 bg-sky-50 text-sky-800";

  const chipClasses =
    tone === "rose"
      ? "border-slate-200 bg-white text-slate-700"
      : "border-sky-200 bg-white text-sky-800";

  return (
    <div className={`rounded-[1.5rem] border p-4 shadow-sm ${toneClasses}`}>
      <p className="text-xs font-black uppercase tracking-[0.22em]">{title}</p>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item} className={`rounded-2xl border px-3 py-2.5 text-sm font-bold shadow-sm ${chipClasses}`}>
            {item}
          </div>
        ))}
      </div>
      <div
        className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-black ${
          tone === "rose"
            ? "border-rose-200 bg-rose-100 text-rose-800"
            : "border-sky-200 bg-sky-100 text-sky-800"
        }`}
      >
        {footer}
      </div>
    </div>
  );
}

function ScreenshotPanel({
  src,
  alt,
  title,
  subtitle,
  description,
  dark = false,
  frameClassName = "",
  mediaClassName = "",
  preload = false,
}: {
  src: string;
  alt: string;
  title: string;
  subtitle: string;
  description?: string;
  dark?: boolean;
  frameClassName?: string;
  mediaClassName?: string;
  preload?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[2rem] border shadow-2xl ${
        dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
      } ${frameClassName}`}
    >
      <div className={`border-b px-5 py-4 ${dark ? "border-white/10" : "border-slate-100"}`}>
        <p className={`text-xs font-black uppercase tracking-[0.24em] ${dark ? "text-sky-200" : "text-sky-700"}`}>
          {subtitle}
        </p>
        <h3 className={`mt-2 text-xl font-black tracking-tight ${dark ? "text-white" : "text-slate-950"}`}>
          {title}
        </h3>
        {description ? (
          <p className={`mt-2 text-sm leading-6 ${dark ? "text-slate-300" : "text-slate-600"}`}>
            {description}
          </p>
        ) : null}
      </div>
      <div className={`relative ${mediaClassName || "aspect-[16/10] sm:aspect-[16/9]"}`}>
        <Image
          src={src}
          alt={alt}
          fill
          preload={preload}
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-contain bg-slate-50 p-3"
        />
      </div>
    </div>
  );
}

function WorkflowPanel({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black tracking-tight text-slate-950">{title}</h3>
      <div className="mt-5 grid gap-3">
        {steps.map((step, index) => (
          <div key={step}>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">
                {index + 1}
              </span>
              <p className="font-black text-slate-950">{step}</p>
            </div>
            {index < steps.length - 1 ? (
              <div className="grid h-8 place-items-center text-sky-700">
                <ArrowDown size={18} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
