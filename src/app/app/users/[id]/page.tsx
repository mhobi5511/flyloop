import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, CalendarDays, Clock3, Globe2, MapPin, PlayCircle } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import {
  getFlyloopProfileHistory,
  type FlyloopProfileHistory,
} from "@/lib/flyloop-history";
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
};

export default async function PublicUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [profileResult, flyloopHistory] = await Promise.all([
    supabase
      .from("public_user_profiles")
      .select("id,full_name,country,city,bio,disciplines,profile_image_url,instagram_handle,home_tunnel_id,home_tunnel_name,home_tunnel_city,home_tunnel_country,website_url,youtube_url,wants_to_create_opportunities,created_at")
      .eq("id", id)
      .maybeSingle(),
    getFlyloopProfileHistory(supabase, id),
  ]);
  const data = profileResult.data;

  if (!data) {
    notFound();
  }

  const profile = data as PublicUserProfile;
  const location = formatLocation(profile.city, profile.country);
  const homeTunnelLocation = formatLocation(
    profile.home_tunnel_city,
    profile.home_tunnel_country,
  );

  return (
    <>
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

        <div className="grid gap-5 p-4 sm:p-6">
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

          <ProfileStats
            history={flyloopHistory}
            showCoachStats={profile.wants_to_create_opportunities === true}
          />

          <HistoryTimeline history={flyloopHistory} />

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
    </>
  );
}

function ProfileStats({
  history,
  showCoachStats,
}: {
  history: FlyloopProfileHistory;
  showCoachStats: boolean;
}) {
  const { stats } = history;

  return (
    <section>
      <h2 className="text-sm font-black uppercase text-slate-500">Stats</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Flyloop Minutes" value={stats.flyloopMinutes} />
        <Stat label="Flyloop Hours" value={stats.flyloopHours} />
        <Stat label="Camps Attended" value={stats.campsAttended} />
        <Stat label="Huck Jams Attended" value={stats.huckJamsAttended} />
        <Stat label="Visited Tunnels" value={stats.visitedTunnels} />
        <Stat label="Visited Countries" value={stats.visitedCountries} />
        <Stat label="Favorite Coach" value={stats.favoriteCoach ?? "Not yet"} />
        <Stat label="Favorite Tunnel" value={stats.favoriteTunnel ?? "Not yet"} />
        {showCoachStats ? (
          <>
            <Stat label="Camps Organized" value={stats.campsOrganized} />
            <Stat label="Huck Jams Organized" value={stats.huckJamsOrganized} />
            <Stat
              label="Athlete Minutes Coached"
              value={stats.athleteMinutesCoached}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function HistoryTimeline({ history }: { history: FlyloopProfileHistory }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase text-slate-500">History</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">
          Flyloop activity only
        </span>
      </div>
      {history.historyByYear.length > 0 ? (
        <div className="mt-3 grid gap-5">
          {history.historyByYear.map((group) => (
            <section key={group.year} className="grid gap-2">
              <h3 className="text-lg font-black text-slate-950">{group.year}</h3>
              <div className="grid gap-2 border-l-2 border-slate-200 pl-3">
                {group.entries.map((entry) => (
                  <article
                    key={entry.opportunityId}
                    className="relative rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <span className="absolute -left-[1.22rem] top-4 size-2.5 rounded-full bg-sky-600 ring-4 ring-white" />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-black text-slate-950">
                          {entry.title}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-600">
                          {entry.tunnelName}
                        </p>
                        <p className="text-sm font-semibold text-slate-500">
                          Coach {entry.coachName}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-xl bg-sky-50 px-3 py-2 text-right">
                        {entry.flyloopMinutes > 0 ? (
                          <>
                            <p className="text-lg font-black text-slate-950">
                              {entry.flyloopMinutes}
                            </p>
                            <p className="text-xs font-black uppercase text-sky-700">
                              Flyloop Minutes
                            </p>
                          </>
                        ) : (
                          <p className="text-xs font-black uppercase text-slate-600">
                            Completed
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <Clock3 size={14} className="text-sky-700" />
                      Completed {formatShortDate(entry.completedDate)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">
          No completed Flyloop activity yet.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: number | string; value: number | string }) {
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function cleanInstagram(value: string) {
  return value.replace(/^@/, "").trim();
}
