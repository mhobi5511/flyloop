import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimParticipantProfileForm } from "@/components/ClaimParticipantProfileForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Claim Participant Profile",
};

export default async function ClaimParticipantProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const claimPath = `/claim-participant/${encodeURIComponent(token)}`;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(claimPath)}`);
  }

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-8 text-slate-950">
      <section className="mx-auto grid max-w-xl gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">
            Flyloop
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">
            Claim your participant profile
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            This profile may contain previous Camps, Huckjams and assigned flying
            times. Claiming connects that history to your Flyloop account.
          </p>
        </div>

        <ClaimParticipantProfileForm token={token} />

        <Link
          href="/app/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </Link>
      </section>
    </main>
  );
}
