import { NextResponse } from "next/server";

import { sendPendingPushNotifications } from "@/lib/push";
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

  const result = await sendPendingPushNotifications(supabase, user.id);

  return NextResponse.json(result);
}
