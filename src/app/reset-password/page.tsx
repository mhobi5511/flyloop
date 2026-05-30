import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-lg font-black tracking-tight">
          Flyloop
        </Link>
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-sky-700">Password reset</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Choose a new password.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Save a new password to continue to Flyloop.
          </p>
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
