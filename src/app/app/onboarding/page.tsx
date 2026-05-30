import { AppShell } from "@/components/AppShell";
import { ProfileForm } from "@/components/ProfileForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,country,phone,whatsapp_number,instagram_handle,wants_to_join_opportunities,wants_to_create_opportunities")
    .eq("id", user?.id)
    .maybeSingle();

  return (
    <AppShell active="profile">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight">Profile</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Keep your contact details current so organizers can reach you.
        </p>
        <ProfileForm
          profile={
            profile ?? {
              full_name: "",
              country: "",
              phone: "",
              whatsapp_number: "",
              instagram_handle: "",
              wants_to_join_opportunities: true,
              wants_to_create_opportunities: false,
            }
          }
        />
      </div>
    </AppShell>
  );
}
