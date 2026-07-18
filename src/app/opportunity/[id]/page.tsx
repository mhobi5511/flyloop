import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  formatOpportunityDate,
  formatOpportunityType,
  formatSessionTimeRange,
  getPublicOpportunityPath,
  getPublicOpportunityUrl,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PublicOpportunityRow = {
  id: string;
  type: "camp" | "huck_jam";
  title: string;
  start_date: string;
  end_date: string;
  session_start: string | null;
  session_end: string | null;
  tunnel_name: string | null;
  coach_profile_image_url: string | null;
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

  const typeLabel = formatOpportunityType(row.type);
  const dateLabel = formatOpportunityDate(
    row.type,
    row.start_date,
    row.end_date,
  );
  const sessionRange =
    row.type === "huck_jam"
      ? formatSessionTimeRange(row.session_start, row.session_end)
      : "";
  const description = `${row.title} at ${
    row.tunnel_name ?? "the tunnel"
  } on ${sessionRange ? `${dateLabel}, ${sessionRange}` : dateLabel}.`;
  const url = getPublicOpportunityUrl(row.id);

  return {
    title: `${row.title} | Flyloop`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${row.title} | Flyloop`,
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
    .select("id,type,title,start_date,end_date,session_start,session_end,tunnel_name,coach_profile_image_url")
    .eq("id", id)
    .gte("end_date", today)
    .maybeSingle();

  return data as PublicOpportunityRow | null;
}
