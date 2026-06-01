import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, CalendarDays, Globe2, MapPin, PlayCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PublicUserProfile = {
  id: string;
  full_name: string;
  country: string | null;
  city: string | null;
  bio: string | null;
  disciplines: string[] | null;
  profile_image_url: string | null;
  instagram_handle: string | null;
  home_tunnel_id: string | null;
  home_tunnel_name: string | null;
  home_tunnel_city: string | null;
  home_tunnel_country: string | null;
  website_url: string | null;
  youtube_url: string | null;
  wants_to_create_opportunities: boolean | null;
  created_at: string;
  camps_attended: number | null;
  camps_organized: number | null;
  active_camps: number | null;
  total_applicants: number | null;
  total_opportunities_organized: number | null;
};

export default async function PublicUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("public_user_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const profile = data as PublicUserProfile;
  const location = formatLocation(profile.city, profile.country);
  const homeTunnelLocation = formatLocation(
    profile.home_tunnel_city,
    profile.home_tunnel_country,
  );
  const organizerStats = profile.wants_to_create_opportunities
    ? {
        activeCamps: profile.active_camps ?? 0,
        totalApplicants: profile.total_applicants ?? 0,
        totalOpportunities:
          profile.total_opportunities_organized ?? profile.camps_organized ?? 0,
      }
    : null;

  return (
    <AppShell active="home">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-sky-50 px-4 py-5 sm:px-6">
          <div className="flex items-start gap-4">
            <Avatar
              name={profile.full_name}
              imageUrl={profile.profile_image_url}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-slate-950">
                  {profile.full_name}
                </h1>
                {profile.wants_to_create_opportunities ? (
                  <Badge tone="blue">Coach</Badge>
                ) : null}
              </div>
              {location ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                  <MapPin size={15} className="text-sky-700" />
                  {location}
                </p>
              ) : null}
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <CalendarDays size={14} className="text-sky-700" />
                Member since {formatMonthYear(profile.created_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-6">
          <section>
            <h2 className="text-sm font-black uppercase text-slate-500">About</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {profile.bio?.trim() || "This user has not added a bio yet."}
            </p>
          </section>

          <section className="grid gap-2 rounded-2xl bg-slate-50 p-3">
            <h2 className="text-sm font-black uppercase text-slate-500">
              Home Tunnel
            </h2>
            {profile.home_tunnel_id && profile.home_tunnel_name ? (
              <Link
                href={`/app/tunnels/${profile.home_tunnel_id}`}
                className="font-bold text-sky-700"
              >
                {profile.home_tunnel_name}
                {homeTunnelLocation ? `, ${homeTunnelLocation}` : ""}
              </Link>
            ) : (
              <p className="text-sm text-slate-600">No home tunnel set.</p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {organizerStats ? (
              <>
                <Stat label="Active Camps" value={organizerStats.activeCamps} />
                <Stat
                  label="Total Applicants"
                  value={organizerStats.totalApplicants}
                />
                <Stat
                  label="Total Organized"
                  value={organizerStats.totalOpportunities}
                />
              </>
            ) : null}
            <Stat
              label="Member Since"
              value={formatShortMonthYear(profile.created_at)}
            />
          </section>

          {profile.disciplines && profile.disciplines.length > 0 ? (
            <section>
              <h2 className="text-sm font-black uppercase text-slate-500">
                Disciplines
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.disciplines.map((discipline) => (
                  <Badge key={discipline} tone="slate">
                    {discipline}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-wrap gap-2">
            {profile.instagram_handle ? (
              <a
                href={`https://instagram.com/${cleanInstagram(profile.instagram_handle)}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"
              >
                <AtSign size={16} /> Instagram
              </a>
            ) : null}
            {profile.website_url ? (
              <a
                href={profile.website_url}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"
              >
                <Globe2 size={16} /> Website
              </a>
            ) : null}
            {profile.youtube_url ? (
              <a
                href={profile.youtube_url}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"
              >
                <PlayCircle size={16} /> YouTube
              </a>
            ) : null}
          </section>
        </div>
      </article>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase text-slate-500">{label}</p>
    </div>
  );
}

function formatLocation(city?: string | null, country?: string | null) {
  return [city, country].filter(Boolean).join(", ");
}

function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortMonthYear(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function cleanInstagram(value: string) {
  return value.replace(/^@/, "").trim();
}
