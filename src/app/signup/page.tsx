import Link from "next/link";
import { AuthRoleCards } from "@/components/AuthRoleCards";

export default function SignupPage() {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-lg font-black tracking-tight">
          Flyloop
        </Link>
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-sky-700">Create account</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Start discovering opportunities.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Create your Flyloop account as an athlete, coach or admin.
          </p>
          <AuthRoleCards />
          <p className="mt-5 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-sky-700">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
