import { AppLoadingFrame } from "@/components/AppLoadingFrame";

export default function CreateLoading() {
  return (
    <AppLoadingFrame>
      <div className="mx-auto max-w-3xl">
        <div className="h-9 w-56 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-3 h-5 w-full max-w-lg animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-5 grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid gap-3">
              <div className="h-4 w-24 animate-pulse rounded bg-sky-100" />
              <div className="h-6 w-64 animate-pulse rounded bg-slate-200" />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLoadingFrame>
  );
}
