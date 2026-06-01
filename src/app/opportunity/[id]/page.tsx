import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  formatDateRange,
  formatOpportunityType,
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

  redirect(`/login?next=${encodeURIComponent(getPublicOpportunityPath(id))}`);
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
