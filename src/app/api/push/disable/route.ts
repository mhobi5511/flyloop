import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      push_notifications_enabled: false,
      push_prompt_answered_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    console.error("Push preference disable failed", profileError);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Push subscription delete failed", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
