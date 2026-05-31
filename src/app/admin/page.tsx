import { redirect } from "next/navigation";
import { AdminDashboard, type AdminTunnel, type AdminUserOverview } from "@/components/AdminDashboard";
import { AppShell } from "@/components/AppShell";
import { isAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    redirect("/app");
  }

  const [{ data: tunnels, error: tunnelsError }, usersResult] = await Promise.all([
    supabase
      .from("tunnel_profiles")
      .select("id,name,country,city,address,website,description,wind_quality_notes,size,region,header_image_url")
      .order("name", { ascending: true }),
    supabase.rpc("get_admin_user_overview"),
  ]);

  if (tunnelsError) {
    console.error("Admin tunnel lookup failed", tunnelsError);
  }

  if (usersResult.error) {
    console.error("Admin user overview lookup failed", usersResult.error);
  }

  return (
    <AppShell active="admin">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black tracking-tight">Admin</h1>
        <div className="mt-4">
          <AdminDashboard
            initialTunnels={(tunnels ?? []) as AdminTunnel[]}
            users={(usersResult.data ?? []) as AdminUserOverview[]}
          />
        </div>
      </div>
    </AppShell>
  );
}
