import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPushConfigured } from "@/lib/push";

export const runtime = "nodejs";

type SubscribeRequest = {
  subscription?: PushSubscriptionJSON;
  userAgent?: string;
};

export async function POST(request: Request) {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push notifications are not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SubscribeRequest;
  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const { error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: body.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );

  if (subscriptionError) {
    console.error("Push subscription save failed", subscriptionError);
    return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      push_notifications_enabled: true,
      push_prompt_answered_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    console.error("Push preference save failed", profileError);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
