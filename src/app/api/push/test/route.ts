import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin";
import { sendPendingPushNotifications } from "@/lib/push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
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

  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const adminSupabase = createSupabaseAdminClient();

  if (!adminSupabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is required for test push." },
      { status: 503 },
    );
  }

  const { data: notification, error: notificationError } = await adminSupabase
    .from("notifications")
    .insert({
      user_id: user.id,
      title: "Flyloop test push",
      body: "If you see this while Flyloop is closed, true Web Push is working.",
      type: "push_test",
    })
    .select("id")
    .single();

  if (notificationError) {
    console.error("[push] test notification creation failed", notificationError);
    return NextResponse.json({ error: notificationError.message }, { status: 500 });
  }

  const result = await sendPendingPushNotifications(adminSupabase as typeof supabase, user.id, {
    types: ["push_test"],
  });

  return NextResponse.json({
    ok: true,
    notificationId: notification.id,
    result,
  });
}
