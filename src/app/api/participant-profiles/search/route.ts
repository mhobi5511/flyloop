import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ParticipantSearchRow = {
  participant_profile_id: string;
  user_id: string | null;
  full_name: string;
  normalized_email: string | null;
  phone: string | null;
  status: "registered" | "guest" | "claim_pending" | "archived";
  already_in_opportunity: boolean;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const opportunityId = searchParams.get("opportunityId")?.trim() ?? "";
  const query = searchParams.get("q")?.trim() ?? "";

  if (!opportunityId || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("search_participant_profiles", {
    target_opportunity_id: opportunityId,
    search_query: query,
    result_limit: 12,
  });

  if (error) {
    console.error("Participant profile search failed", {
      opportunityId,
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: error.message || "Search failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    results: ((data ?? []) as ParticipantSearchRow[]).map((row) => ({
      participantProfileId: row.participant_profile_id,
      userId: row.user_id,
      name: row.full_name,
      email: row.normalized_email ?? "",
      phone: row.phone ?? "",
      status: row.status,
      alreadyInOpportunity: row.already_in_opportunity,
    })),
  });
}
