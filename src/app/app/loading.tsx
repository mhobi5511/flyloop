import { AppLoadingFrame } from "@/components/AppLoadingFrame";

export default function AppLoading() {
  return (
    <AppLoadingFrame>
      <div className="grid gap-5">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </div>
    </AppLoadingFrame>
  );
}
