import { CalendarDays, MapPin, Users } from "lucide-react";

export default function OpportunityDetailLoading() {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_300px]" aria-busy="true">
      <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          <div className="h-7 w-16 animate-pulse rounded-full bg-sky-100" />
          <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="mt-3 h-9 w-3/4 animate-pulse rounded-xl bg-slate-100 sm:h-12" />
        <div className="mt-2 grid gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500">
          <p className="flex items-center gap-2">
            <CalendarDays size={16} className="text-sky-700" />
            <span className="h-4 w-36 animate-pulse rounded bg-slate-200" />
          </p>
          <p className="flex items-center gap-2">
            <Users size={16} className="text-sky-700" />
            <span className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={16} className="text-sky-700" />
            <span className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          </p>
        </div>
        <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <div className="h-4 w-28 animate-pulse rounded bg-sky-100" />
          <div className="mt-2 h-5 w-2/3 animate-pulse rounded bg-sky-100" />
          <div className="mt-3 h-11 w-full animate-pulse rounded-xl bg-sky-200 sm:w-48" />
        </div>
        <div className="mt-4 grid gap-3">
          <div className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          <div className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
        </div>
      </article>
      <aside className="hidden content-start gap-4 lg:grid">
        <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </aside>
    </div>
  );
}
