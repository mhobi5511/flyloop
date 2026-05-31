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
    .select("full_name,country,mobile_country_code,phone,whatsapp_number,instagram_handle,profile_image_url,is_organizer,wants_to_create_opportunities,use_location_recommendations,latitude,longitude,preferred_radius_km")
    .eq("id", user?.id)
    .maybeSingle();

  return (
    <AppShell active="profile">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-black tracking-tight">Profile</h1>
        <ProfileForm
          profile={
            profile ?? {
              full_name: "",
              country: "",
              mobile_country_code: null,
              phone: "",
              whatsapp_number: "",
              instagram_handle: "",
              profile_image_url: "",
              is_organizer: false,
              wants_to_create_opportunities: false,
              use_location_recommendations: false,
              latitude: null,
              longitude: null,
              preferred_radius_km: 1000,
            }
          }
        />
      </div>
    </AppShell>
  );
}
