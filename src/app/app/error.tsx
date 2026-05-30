"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Authenticated app failed", error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4 py-10 text-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-700">
          <RotateCw size={20} />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight">
          Flyloop could not load your app.
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your login worked, but something failed while loading your dashboard.
          Please try again or return to login.
        </p>
        {error.digest ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">
            Error ID: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="h-11 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="grid h-11 place-items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
