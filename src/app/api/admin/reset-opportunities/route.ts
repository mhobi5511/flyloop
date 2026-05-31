import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ResetSummary = {
  notifications_deleted: number;
  interests_deleted: number;
  opportunities_deleted: number;
};

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .rpc("reset_opportunity_test_data")
    .single();

  if (error) {
    console.error("Opportunity reset failed", error);
    return NextResponse.json(
      { message: "Could not reset opportunities." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    summary: data as ResetSummary,
  });
}
