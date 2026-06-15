import webpush, { type PushSubscription } from "web-push";

import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import {
  bellNotificationTypes,
  isCoachNotificationType,
} from "@/lib/notifications";
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

type PushSendFilter = {
  opportunityId?: string;
  types?: string[];
};

const relevantPushTypes = bellNotificationTypes;

let vapidConfigured = false;

function logPush(message: string, details: Record<string, unknown>) {
  console.log(`[push] ${message}`, details);
}

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
  const path = notification.opportunity_id
    ? isCoachNotificationType(notification.type)
      ? "/app/coach-dashboard"
      : `/app/opportunities/${notification.opportunity_id}`
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

function pushErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { error };
  }

  const record = error as {
    statusCode?: unknown;
    body?: unknown;
    message?: unknown;
    headers?: unknown;
  };

  return {
    statusCode: record.statusCode,
    body: record.body,
    message: record.message,
    headers: record.headers,
  };
}

async function sendPendingPushNotificationsWithClient(
  supabase: SupabaseServerClient,
  userId: string,
  filter: PushSendFilter = {},
) {
  if (!isPushConfigured()) {
    logPush("skipped: not configured", { userId });
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
    logPush("skipped: disabled", { userId });
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
    logPush("skipped: no subscriptions", { userId });
    return { sent: 0, skipped: "no_subscriptions" as const };
  }

  let notificationQuery = supabase
    .from("notifications")
    .select("id,user_id,title,body,type,opportunity_id,created_at")
    .eq("user_id", userId)
    .eq("read", false)
    .is("push_sent_at", null)
    .in("type", filter.types?.length ? filter.types : [...relevantPushTypes]);

  if (filter.opportunityId) {
    notificationQuery = notificationQuery.eq("opportunity_id", filter.opportunityId);
  }

  const { data: notifications, error: notificationError } =
    await notificationQuery.order("created_at", { ascending: true }).limit(10);

  if (notificationError) {
    console.error("Push notification lookup failed", notificationError);
    return { sent: 0, error: notificationError.message };
  }

  let sent = 0;
  const subscriptionRows = subscriptions as PushSubscriptionRow[];

  logPush("pending notifications loaded", {
    userId,
    subscriptionCount: subscriptionRows.length,
    notificationCount: notifications?.length ?? 0,
    opportunityId: filter.opportunityId ?? null,
    types: filter.types ?? relevantPushTypes,
  });

  for (const notification of (notifications ?? []) as NotificationRow[]) {
    let sentToAtLeastOneSubscription = false;
    const payload = JSON.stringify(toPushPayload(notification));

    for (const subscription of subscriptionRows) {
      logPush("attempt", {
        notificationId: notification.id,
        userId,
        subscriptionCount: subscriptionRows.length,
        endpoint: subscription.endpoint,
      });

      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), payload);
        sent += 1;
        sentToAtLeastOneSubscription = true;
        logPush("success", {
          notificationId: notification.id,
          userId,
          endpoint: subscription.endpoint,
        });
      } catch (error) {
        console.error("[push] failure", {
          ...pushErrorDetails(error),
          endpoint: subscription.endpoint,
          notificationId: notification.id,
          userId,
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
      const pushSentAt = new Date().toISOString();
      const { error: markSentError } = await supabase
        .from("notifications")
        .update({ push_sent_at: pushSentAt })
        .eq("user_id", userId)
        .eq("id", notification.id);

      if (markSentError) {
        console.error("Push sent marker update failed", markSentError);
      } else {
        logPush("marked sent", {
          notificationId: notification.id,
          userId,
          pushSentAt,
        });
      }
    }
  }

  return { sent };
}

export async function sendPendingPushNotifications(
  supabase: SupabaseServerClient,
  userId: string,
  filter: PushSendFilter = {},
) {
  return sendPendingPushNotificationsWithClient(supabase, userId, filter);
}

export async function sendPendingPushNotificationsForUsers(
  userIds: string[],
  filter: PushSendFilter = {},
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueUserIds.length === 0) {
    return { sent: 0, skipped: "no_users" as const };
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    logPush("skipped: missing service role", { userIds: uniqueUserIds });
    return { sent: 0, skipped: "missing_service_role" as const };
  }

  let sent = 0;

  for (const userId of uniqueUserIds) {
    const result = await sendPendingPushNotificationsWithClient(
      supabase as SupabaseServerClient,
      userId,
      filter,
    );
    sent += result.sent;
  }

  return { sent };
}

export async function sendPendingPushNotificationsForOpportunity(
  opportunityId: string,
  types: string[],
) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    logPush("skipped opportunity push: missing service role", {
      opportunityId,
      types,
    });
    return { sent: 0, skipped: "missing_service_role" as const };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("user_id")
    .eq("opportunity_id", opportunityId)
    .is("push_sent_at", null)
    .in("type", types);

  if (error) {
    console.error("[push] opportunity notification lookup failed", {
      opportunityId,
      types,
      error,
    });
    return { sent: 0, error: error.message };
  }

  return sendPendingPushNotificationsForUsers(
    ((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
    { opportunityId, types },
  );
}
