import webpush, { type PushSubscription } from "web-push";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  opportunity_id: string | null;
  created_at: string;
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

const relevantPushTypes = [
  "new_interest",
  "application_status",
  "timetable_published",
  "timetable_booking_changed",
  "slot_bookings_released",
  "slot_bookings_released_by_organizer",
  "slot_booking_released_by_organizer",
  "new_opportunity",
] as const;

let vapidConfigured = false;

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function isPushConfigured() {
  return Boolean(
    getVapidPublicKey() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_EMAIL?.trim(),
  );
}

function configureVapid() {
  if (vapidConfigured || !isPushConfigured()) {
    return;
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL as string,
    getVapidPublicKey(),
    process.env.VAPID_PRIVATE_KEY as string,
  );
  vapidConfigured = true;
}

function notificationUrl(notification: NotificationRow) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const path =
    notification.opportunity_id && notification.type === "new_interest"
      ? `/app/organizer/opportunities/${notification.opportunity_id}`
      : notification.opportunity_id
        ? `/app/opportunities/${notification.opportunity_id}`
        : "/app";

  return siteUrl ? `${siteUrl}${path}` : path;
}

function toPushPayload(notification: NotificationRow) {
  return {
    title: notification.title || "Flyloop",
    body: notification.body,
    icon: "/flyloop-icon-192.png",
    url: notificationUrl(notification),
    opportunity_id: notification.opportunity_id,
    notification_id: notification.id,
  };
}

function toWebPushSubscription(row: PushSubscriptionRow): PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function isExpiredSubscriptionError(error: unknown) {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : null;

  return statusCode === 404 || statusCode === 410;
}

export async function sendPendingPushNotifications(
  supabase: SupabaseServerClient,
  userId: string,
) {
  if (!isPushConfigured()) {
    return { sent: 0, skipped: "not_configured" as const };
  }

  configureVapid();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("push_notifications_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Push profile lookup failed", profileError);
    return { sent: 0, error: profileError.message };
  }

  if (profile?.push_notifications_enabled !== true) {
    return { sent: 0, skipped: "disabled" as const };
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", userId);

  if (subscriptionError) {
    console.error("Push subscription lookup failed", subscriptionError);
    return { sent: 0, error: subscriptionError.message };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, skipped: "no_subscriptions" as const };
  }

  const { data: notifications, error: notificationError } = await supabase
    .from("notifications")
    .select("id,user_id,title,body,type,opportunity_id,created_at")
    .eq("user_id", userId)
    .eq("read", false)
    .is("push_sent_at", null)
    .in("type", [...relevantPushTypes])
    .order("created_at", { ascending: true })
    .limit(10);

  if (notificationError) {
    console.error("Push notification lookup failed", notificationError);
    return { sent: 0, error: notificationError.message };
  }

  let sent = 0;

  for (const notification of (notifications ?? []) as NotificationRow[]) {
    let sentToAtLeastOneSubscription = false;
    const payload = JSON.stringify(toPushPayload(notification));

    for (const subscription of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), payload);
        sent += 1;
        sentToAtLeastOneSubscription = true;
      } catch (error) {
        console.error("Push send failed", {
          error,
          endpoint: subscription.endpoint,
          notificationId: notification.id,
        });

        if (isExpiredSubscriptionError(error)) {
          const { error: deleteError } = await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userId)
            .eq("endpoint", subscription.endpoint);

          if (deleteError) {
            console.error("Expired push subscription cleanup failed", deleteError);
          }
        }
      }
    }

    if (sentToAtLeastOneSubscription) {
      const { error: markSentError } = await supabase
        .from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("id", notification.id);

      if (markSentError) {
        console.error("Push sent marker update failed", markSentError);
      }
    }
  }

  return { sent };
}
