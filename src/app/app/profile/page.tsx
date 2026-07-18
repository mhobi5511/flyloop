import { ProfileForm } from "@/components/ProfileForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";

type TunnelOption = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await getCurrentUser();
  const [{ data: profile }, { data: tunnels }] = await Promise.all([
    supabase
      .from("profiles")
      .select("created_at,full_name,country,city,bio,disciplines,home_tunnel_id,website_url,youtube_url,mobile_country_code,phone,whatsapp_number,instagram_handle,profile_image_url,is_organizer,wants_to_create_opportunities,use_location_recommendations,latitude,longitude,preferred_radius_km,push_notifications_enabled,push_prompt_answered_at")
      .eq("id", user?.id)
      .maybeSingle(),
    supabase
      .from("tunnel_profiles")
      .select("id,name,city,country")
      .order("name", { ascending: true }),
  ]);

  return (
    <>
      <ProfileForm
        tunnels={(tunnels ?? []) as TunnelOption[]}
        profile={
          profile ?? {
            created_at: null,
            full_name: "",
            country: "",
            city: "",
            bio: "",
            disciplines: [],
            home_tunnel_id: null,
            website_url: "",
            youtube_url: "",
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
            push_notifications_enabled: false,
            push_prompt_answered_at: null,
          }
        }
      />
    </>
  );
}
