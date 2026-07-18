import webpush, { type PushSubscription } from "web-push";
import { after } from "next/server";

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

type ClaimedNotificationRow = NotificationRow & {
  push_claim_token: string;
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
const pushAttemptConcurrency = 8;
const pushUserConcurrency = 4;

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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function sendPendingPushNotificationsWithClient(
  supabase: SupabaseServerClient,
  claimSupabase: SupabaseServerClient,
  userId: string,
  filter: PushSendFilter = {},
) {
  if (!isPushConfigured()) {
    logPush("skipped: not configured", { userId });
    return { sent: 0, skipped: "not_configured" as const };
  }

  configureVapid();

  const [profileResult, subscriptionResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("push_notifications_enabled")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", userId),
  ]);
  const { data: profile, error: profileError } = profileResult;

  if (profileError) {
    console.error("Push profile lookup failed", profileError);
    return { sent: 0, error: profileError.message };
  }

  if (profile?.push_notifications_enabled !== true) {
    logPush("skipped: disabled", { userId });
    return { sent: 0, skipped: "disabled" as const };
  }

  const { data: subscriptions, error: subscriptionError } = subscriptionResult;

  if (subscriptionError) {
    console.error("Push subscription lookup failed", subscriptionError);
    return { sent: 0, error: subscriptionError.message };
  }

  if (!subscriptions || subscriptions.length === 0) {
    logPush("skipped: no subscriptions", { userId });
    return { sent: 0, skipped: "no_subscriptions" as const };
  }

  const { data: notifications, error: notificationError } = await claimSupabase.rpc(
    "claim_pending_push_notifications",
    {
      target_user_id: userId,
      target_opportunity_id: filter.opportunityId ?? null,
      target_types: filter.types?.length
        ? filter.types
        : [...relevantPushTypes],
      target_limit: 10,
    },
  );

  if (notificationError) {
    console.error("Push notification claim failed", notificationError);
    return { sent: 0, error: notificationError.message };
  }

  const claimedRows = (notifications ?? []) as ClaimedNotificationRow[];
  const claimToken = claimedRows[0]?.push_claim_token ?? null;
  const notificationRows = claimedRows as NotificationRow[];
  const subscriptionRows = [
    ...new Map(
      (subscriptions as PushSubscriptionRow[]).map((subscription) => [
        subscription.endpoint,
        subscription,
      ] as const),
    ).values(),
  ];

  if (notificationRows.length === 0) {
    return { sent: 0, skipped: "no_notifications" as const };
  }

  if (!claimToken) {
    console.error("Push notification claim returned without a token", {
      notificationIds: notificationRows.map((notification) => notification.id),
      userId,
    });
    return { sent: 0, error: "missing_claim_token" };
  }

  logPush("pending notifications loaded", {
    userId,
    subscriptionCount: subscriptionRows.length,
    notificationCount: notificationRows.length,
    opportunityId: filter.opportunityId ?? null,
    types: filter.types ?? relevantPushTypes,
  });

  try {
    const attempts = notificationRows.flatMap((notification) => {
      const payload = JSON.stringify(toPushPayload(notification));
      return subscriptionRows.map((subscription) => ({
        notification,
        payload,
        subscription,
      }));
    });
    const attemptResults = await mapWithConcurrency(
      attempts,
      pushAttemptConcurrency,
      async ({ notification, payload, subscription }) => {
        logPush("attempt", {
          notificationId: notification.id,
          userId,
          subscriptionCount: subscriptionRows.length,
          endpoint: subscription.endpoint,
        });

        try {
          await webpush.sendNotification(
            toWebPushSubscription(subscription),
            payload,
          );
          logPush("success", {
            notificationId: notification.id,
            userId,
            endpoint: subscription.endpoint,
          });
          return {
            delivered: true,
            expired: false,
            notificationId: notification.id,
            subscriptionEndpoint: subscription.endpoint,
          };
        } catch (error) {
          console.error("[push] failure", {
            ...pushErrorDetails(error),
            endpoint: subscription.endpoint,
            notificationId: notification.id,
            userId,
          });
          return {
            delivered: false,
            expired: isExpiredSubscriptionError(error),
            notificationId: notification.id,
            subscriptionEndpoint: subscription.endpoint,
          };
        }
      },
    );
    const sent = attemptResults.filter((result) => result.delivered).length;
    const deliveredNotificationIds = [
      ...new Set(
        attemptResults
          .filter((result) => result.delivered)
          .map((result) => result.notificationId),
      ),
    ];
    const deliveredNotificationIdSet = new Set(deliveredNotificationIds);
    const failedNotificationIds = notificationRows
      .map((notification) => notification.id)
      .filter((notificationId) => !deliveredNotificationIdSet.has(notificationId));
    const expiredSubscriptionEndpoints = [
      ...new Set(
        attemptResults
          .filter((result) => result.expired)
          .map((result) => result.subscriptionEndpoint),
      ),
    ];
    const [expiredCleanupResult, resolveClaimResult] = await Promise.all([
        expiredSubscriptionEndpoints.length > 0
          ? claimSupabase
              .from("push_subscriptions")
              .delete()
              .eq("user_id", userId)
              .in("endpoint", expiredSubscriptionEndpoints)
          : Promise.resolve({ error: null }),
        resolvePushClaims(
          claimSupabase,
          userId,
          claimToken,
          deliveredNotificationIds,
          failedNotificationIds,
        ),
      ]);

    if (expiredCleanupResult.error) {
      console.error(
        "Expired push subscription cleanup failed",
        expiredCleanupResult.error,
      );
    }

    if (resolveClaimResult.error) {
      console.error("Push claim resolution failed", resolveClaimResult.error);
    } else if (deliveredNotificationIds.length > 0) {
      logPush("marked sent", {
        claimToken,
        notificationIds: deliveredNotificationIds,
        userId,
      });
    }

    return { sent };
  } catch (error) {
    const releaseResult = await releasePushClaims(
      claimSupabase,
      userId,
      claimToken,
      notificationRows.map((notification) => notification.id),
    );

    if (releaseResult.error) {
      console.error("Unexpected push claim release failed", releaseResult.error);
    }

    throw error;
  }
}

async function releasePushClaims(
  supabase: SupabaseServerClient,
  userId: string,
  claimToken: string,
  notificationIds: string[],
) {
  if (notificationIds.length === 0) {
    return { error: null };
  }

  return resolvePushClaims(supabase, userId, claimToken, [], notificationIds);
}

async function resolvePushClaims(
  supabase: SupabaseServerClient,
  userId: string,
  claimToken: string,
  sentNotificationIds: string[],
  releasedNotificationIds: string[],
) {
  return supabase.rpc("resolve_push_notification_claim", {
    target_user_id: userId,
    target_claim_token: claimToken,
    target_sent_notification_ids: sentNotificationIds,
    target_released_notification_ids: releasedNotificationIds,
  });
}

export async function sendPendingPushNotifications(
  supabase: SupabaseServerClient,
  userId: string,
  filter: PushSendFilter = {},
) {
  const claimSupabase = createSupabaseAdminClient() ?? supabase;

  return sendPendingPushNotificationsWithClient(
    supabase,
    claimSupabase as SupabaseServerClient,
    userId,
    filter,
  );
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

  const results = await mapWithConcurrency(
    uniqueUserIds,
    pushUserConcurrency,
    async (userId) => {
      try {
        return await sendPendingPushNotificationsWithClient(
          supabase as SupabaseServerClient,
          supabase as SupabaseServerClient,
          userId,
          filter,
        );
      } catch (error) {
        console.error("[push] user delivery failed", {
          ...pushErrorDetails(error),
          userId,
        });
        return { sent: 0, error: "unexpected_delivery_failure" };
      }
    },
  );
  const sent = results.reduce((total, result) => total + result.sent, 0);

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
    .eq("read", false)
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

function schedulePushDelivery(
  context: string,
  details: Record<string, unknown>,
  delivery: () => Promise<unknown>,
) {
  const scheduledAt = Date.now();

  try {
    after(async () => {
      try {
        const result = await delivery();
        logPush("scheduled delivery completed", {
          ...details,
          context,
          durationMs: Date.now() - scheduledAt,
          result,
        });
      } catch (error) {
        console.error("[push] scheduled delivery failed", {
          ...details,
          ...pushErrorDetails(error),
          context,
        });
      }
    });
  } catch (error) {
    console.error("[push] could not schedule delivery", {
      ...details,
      ...pushErrorDetails(error),
      context,
    });
  }
}

export function schedulePendingPushNotificationsForUsers(
  userIds: string[],
  filter: PushSendFilter = {},
  context = "server_action",
) {
  const scheduledUserIds = [...new Set(userIds.filter(Boolean))];
  const scheduledFilter = {
    ...filter,
    types: filter.types ? [...filter.types] : undefined,
  };

  if (scheduledUserIds.length === 0) {
    return;
  }

  schedulePushDelivery(
    context,
    { filter: scheduledFilter, userIds: scheduledUserIds },
    () => sendPendingPushNotificationsForUsers(scheduledUserIds, scheduledFilter),
  );
}

export function schedulePendingPushNotificationsForOpportunity(
  opportunityId: string,
  types: string[],
  context = "server_action",
) {
  const scheduledTypes = [...types];

  schedulePushDelivery(
    context,
    { opportunityId, types: scheduledTypes },
    () => sendPendingPushNotificationsForOpportunity(opportunityId, scheduledTypes),
  );
}
