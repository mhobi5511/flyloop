import type { ReactNode } from "react";
import {
  NotificationCenterProvider,
  type NotificationCenterItem,
} from "./NotificationCenter";
import { AppTabNavigation } from "./AppTabNavigation";
import { calculateProfileCompleteness } from "@/lib/profile-completeness";
import { parseNotificationSnapshot } from "@/lib/notification-center";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { unstable_rethrow } from "next/navigation";
import { isAdmin } from "@/lib/admin";

type AppShellProps = {
  children: ReactNode;
  active?: "home" | "create" | "dashboard" | "applications" | "profile" | "admin";
  canCreate?: boolean;
  canJoin?: boolean;
};

async function getShellState() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await getCurrentUser();

    if (!user) {
      return {
        canCreate: false,
        canJoin: true,
        isAdmin: false,
        organizerUnreadCount: 0,
        participantUnreadCount: 0,
        bellUnreadCount: 0,
        notifications: [] as NotificationCenterItem[],
        profileIncomplete: true,
        pushNotificationsEnabled: false,
        pushPromptAnsweredAt: null,
        isAuthenticated: false,
        userId: null,
      };
    }

    const [{ data: profile, error: profileError }, notificationResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("is_organizer,wants_to_create_opportunities,full_name,country,city,disciplines,home_tunnel_id,instagram_handle,profile_image_url,push_notifications_enabled,push_prompt_answered_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("get_notification_center_snapshot", { target_limit: 20 }),
      ]);

    if (profileError) {
      console.error("App shell profile lookup failed", profileError);
    }

    if (notificationResult.error) {
      console.error("App shell notification snapshot failed", notificationResult.error);
    }

    const notificationSnapshot = notificationResult.error
      ? parseNotificationSnapshot(null)
      : parseNotificationSnapshot(notificationResult.data);

    const canCreate =
      profile?.is_organizer === true ||
      profile?.wants_to_create_opportunities === true;
    const profileIncomplete = !calculateProfileCompleteness(profile).isComplete;

    return {
      canCreate,
      canJoin: true,
      isAdmin: isAdmin(user),
      organizerUnreadCount: notificationSnapshot.organizerUnreadCount,
      participantUnreadCount: notificationSnapshot.participantUnreadCount,
      bellUnreadCount: notificationSnapshot.bellUnreadCount,
      notifications: notificationSnapshot.notifications,
      profileIncomplete,
      pushNotificationsEnabled: profile?.push_notifications_enabled === true,
      pushPromptAnsweredAt: profile?.push_prompt_answered_at ?? null,
      isAuthenticated: true,
      userId: user.id,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("App shell state failed", error);
    return {
      canCreate: false,
      canJoin: true,
      isAdmin: false,
      organizerUnreadCount: 0,
      participantUnreadCount: 0,
      bellUnreadCount: 0,
      notifications: [] as NotificationCenterItem[],
      profileIncomplete: true,
      pushNotificationsEnabled: false,
      pushPromptAnsweredAt: null,
      isAuthenticated: false,
      userId: null,
    };
  }
}

export async function AppShell({
  children,
  active = "home",
  canCreate,
  canJoin,
}: AppShellProps) {
  const shellState = await getShellState();
  const userCanCreate = canCreate ?? shellState.canCreate;
  const userCanJoin = canJoin ?? shellState.canJoin;

  return (
    <NotificationCenterProvider
      key={shellState.userId ?? "signed-out"}
      userId={shellState.userId}
      initialNotifications={shellState.notifications}
      initialBellUnreadCount={shellState.bellUnreadCount}
      initialOrganizerUnreadCount={shellState.organizerUnreadCount}
      initialParticipantUnreadCount={shellState.participantUnreadCount}
    >
      <AppTabNavigation
        canCreate={userCanCreate}
        canJoin={userCanJoin}
        isAdmin={shellState.isAdmin}
        profileIncomplete={shellState.profileIncomplete}
        activeFallback={active}
        pushNotificationsEnabled={shellState.pushNotificationsEnabled}
        pushPromptAnsweredAt={shellState.pushPromptAnsweredAt}
        isAuthenticated={shellState.isAuthenticated}
      >
        {children}
      </AppTabNavigation>
    </NotificationCenterProvider>
  );
}
