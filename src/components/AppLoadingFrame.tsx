import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AppLoadingFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh bg-slate-50 text-slate-950"
      aria-busy="true"
      aria-label="Loading page"
    >
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <Image
              src="/flyloop-icon-192.png"
              alt=""
              width={36}
              height={36}
              preload
              className="size-9 rounded-xl shadow-sm"
            />
            <span className="text-lg font-bold tracking-tight">Flyloop</span>
          </Link>
          <div className="flex gap-2" aria-hidden="true">
            <div className="size-10 animate-pulse rounded-full bg-slate-100" />
            <div className="size-10 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100dvh-65px)] max-w-5xl px-4 pb-28 pt-5 md:pb-8">
        {children}
      </main>
    </div>
  );
}
