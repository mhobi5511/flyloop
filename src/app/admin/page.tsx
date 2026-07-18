import { redirect } from "next/navigation";
import {
  AdminDashboard,
  type AdminStats,
  type AdminTunnel,
  type AdminUserOverview,
} from "@/components/AdminDashboard";
import { AppShell } from "@/components/AppShell";
import { isAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await getCurrentUser();

  if (!isAdmin(user)) {
    redirect("/app");
  }

  const [
    { data: tunnels, error: tunnelsError },
    { count: missingCoordinateCount },
    usersResult,
    totalUsersResult,
    coachesResult,
    athletesOnlyResult,
    campsResult,
    huckJamsResult,
  ] = await Promise.all([
    supabase
      .from("tunnel_profiles")
      .select("id,name,country,city,address,website,description,wind_quality_notes,size,region,header_image_url")
      .order("name", { ascending: true }),
    supabase
      .from("tunnel_profiles")
      .select("id", { count: "exact", head: true })
      .or("latitude.is.null,longitude.is.null"),
    supabase.rpc("get_admin_user_overview"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("wants_to_create_opportunities", true),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("wants_to_create_opportunities", false),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("type", "camp"),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("type", "huck_jam"),
  ]);

  if (tunnelsError) {
    console.error("Admin tunnel lookup failed", tunnelsError);
  }

  if (usersResult.error) {
    console.error("Admin user overview lookup failed", usersResult.error);
  }

  for (const [label, result] of [
    ["total users", totalUsersResult],
    ["coaches", coachesResult],
    ["athletes only", athletesOnlyResult],
    ["camps", campsResult],
    ["huck jams", huckJamsResult],
  ] as const) {
    if (result.error) {
      console.error(`Admin ${label} count failed`, result.error);
    }
  }

  const stats: AdminStats = {
    totalUsers: totalUsersResult.count ?? 0,
    coaches: coachesResult.count ?? 0,
    athletesOnly: athletesOnlyResult.count ?? 0,
    campsCreated: campsResult.count ?? 0,
    huckJamsCreated: huckJamsResult.count ?? 0,
  };

  return (
    <AppShell active="admin">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black tracking-tight">Admin</h1>
        <div className="mt-4">
          <AdminDashboard
            initialTunnels={(tunnels ?? []) as AdminTunnel[]}
            initialMissingCoordinateCount={missingCoordinateCount ?? 0}
            stats={stats}
            users={(usersResult.data ?? []) as AdminUserOverview[]}
          />
        </div>
      </div>
    </AppShell>
  );
}
