import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { ShareOpportunityButton } from "@/components/ShareOpportunityButton";
import {
  formatDateRange,
  formatOpportunityType,
  formatPrice,
  formatPriceLabel,
  getOpportunityShareText,
  getPublicOpportunityPath,
  getPublicOpportunityUrl,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapOpportunity, type HomeFeedRow } from "@/lib/supabase/mappers";

type PublicOpportunityRow = HomeFeedRow & {
  coach_profile_image_url?: string | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const row = await getPublicOpportunityRow(id);

  if (!row) {
    return {
      title: "Opportunity on Flyloop",
      description: "Discover indoor skydiving opportunities on Flyloop.",
    };
  }

  const opportunity = mapOpportunity(row);
  const typeLabel = formatOpportunityType(opportunity.type);
  const description = `${opportunity.title} at ${opportunity.tunnelName ?? "the tunnel"} on ${formatDateRange(
    opportunity.startDate,
    opportunity.endDate,
  )}.`;
  const url = getPublicOpportunityUrl(opportunity.id);

  return {
    title: `${opportunity.title} | Flyloop`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${opportunity.title} | Flyloop`,
      description,
      url,
      type: "website",
      images: row.coach_profile_image_url
        ? [{ url: row.coach_profile_image_url, alt: `${typeLabel} coach` }]
        : [{ url: "https://flyloop.one/flyloop-icon-512.png", alt: "Flyloop" }],
    },
  };
}

export default async function PublicOpportunityPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(`/app/opportunities/${id}`);
  }

  const row = await getPublicOpportunityRow(id);

  if (!row) {
    notFound();
  }

  const opportunity = mapOpportunity(row);
  const typeLabel = formatOpportunityType(opportunity.type);
  const publicPath = getPublicOpportunityPath(opportunity.id);
  const absoluteUrl = getPublicOpportunityUrl(opportunity.id);
  const shareText = getOpportunityShareText(opportunity, absoluteUrl);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-5 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-lg font-black tracking-tight">
          Flyloop
        </Link>

        <article className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-sky-50 p-4 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
                {typeLabel}
              </Badge>
              <Badge tone={opportunity.availableSpots > 0 ? "slate" : "red"}>
                {opportunity.availableSpots > 0 ? "Open" : "Fully booked"}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              {opportunity.title}
            </h1>
            <div className="mt-4 flex items-center gap-3">
              <Avatar
                name={opportunity.coachName ?? "Coach"}
                imageUrl={row.coach_profile_image_url}
                size="md"
              />
              <div>
                <p className="text-xs font-bold uppercase text-sky-700">Coach</p>
                <p className="font-black text-slate-950">
                  {opportunity.coachName ?? "Flyloop organizer"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6">
            <div className="grid gap-2 sm:grid-cols-3">
              <Info icon={<CalendarDays size={16} />} label="Dates">
                {formatDateRange(opportunity.startDate, opportunity.endDate)}
              </Info>
              <Info icon={<Users size={16} />} label="Availability">
                {opportunity.availableSpots}/{opportunity.totalCapacity} spots
              </Info>
              <Info icon={<MapPin size={16} />} label="Tunnel">
                {opportunity.tunnelName ?? "Tunnel"}
              </Info>
            </div>

            <section className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Price</p>
              <p className="mt-1 text-2xl font-black">
                {formatPrice(opportunity.price, opportunity.currency)}
              </p>
              <p className="text-xs font-semibold text-slate-600">
                {formatPriceLabel(opportunity.type)}
              </p>
            </section>

            <section>
              <h2 className="text-sm font-black uppercase text-slate-500">
                Description
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {opportunity.description || "Details will be shared by the organizer."}
              </p>
            </section>

            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href={`/login?next=${encodeURIComponent(publicPath)}`}
                className="flex h-12 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-sky-700"
              >
                Join {typeLabel}
              </Link>
              <ShareOpportunityButton
                label={`Share ${typeLabel}`}
                shareText={shareText}
                url={absoluteUrl}
              />
            </div>

            <p className="text-center text-sm text-slate-600">
              New to Flyloop?{" "}
              <Link
                href={`/signup?next=${encodeURIComponent(publicPath)}`}
                className="font-bold text-sky-700"
              >
                Create an account
              </Link>
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}

async function getPublicOpportunityRow(id: string) {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("published_opportunities_with_context")
    .select("*")
    .eq("id", id)
    .gte("end_date", today)
    .maybeSingle();

  return data as PublicOpportunityRow | null;
}

function Info({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className="flex items-center gap-2 text-sky-700">{icon}</div>
      <p className="mt-1 text-xs font-bold uppercase text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-bold text-slate-800">{children}</div>
    </div>
  );
}
