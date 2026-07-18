import Link from "next/link";
import { Suspense } from "react";
import Image from "next/image";
import { SignupForm } from "@/components/SignupForm";

type SignupPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {};
  const loginHref = params.next
    ? `/login?next=${encodeURIComponent(params.next)}`
    : "/login";

  return (
    <main className="min-h-dvh bg-slate-50 px-3 py-4 text-slate-950 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-lg font-black tracking-tight sm:gap-3"
        >
          <Image
            src="/flyloop-icon-512.png"
            alt="Flyloop"
            width={40}
            height={40}
            preload
            className="size-9 rounded-xl shadow-sm sm:size-10"
          />
          <span className="text-base sm:text-lg">Flyloop</span>
        </Link>
        <section className="mt-5 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:mt-8 sm:rounded-[2rem] sm:p-6">
          <Suspense fallback={null}>
            <SignupForm />
          </Suspense>
          <p className="mt-4 text-center text-sm text-slate-600 sm:mt-5">
            Already have an account?{" "}
            <Link href={loginHref} className="font-bold text-sky-700">
              Log in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
