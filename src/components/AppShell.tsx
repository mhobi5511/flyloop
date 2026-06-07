import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  ClipboardList,
  CalendarPlus,
  Home,
  LayoutDashboard,
  ShieldCheck,
  User,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { OrganizerNavBadge } from "./OrganizerNavBadge";
import { ProfileNavDot } from "./ProfileNavDot";
import { PwaInstallGuidance } from "./PwaInstallGuidance";
import { PushNotificationPrompt } from "./PushNotificationPrompt";
import { calculateProfileCompleteness } from "@/lib/profile-completeness";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unstable_rethrow } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import {
  countBadgeNotifications,
  organizerActivityNotificationTypes,
  participantActivityNotificationTypes,
} from "@/lib/notifications";

type AppShellProps = {
  children: ReactNode;
  active?: "home" | "create" | "dashboard" | "applications" | "profile" | "admin";
  canCreate?: boolean;
  canJoin?: boolean;
};

const baseNavItems = [
  { href: "/app", label: "Discover", id: "home", icon: Home },
] as const;

const organizerNavItems = [
  { href: "/app/create", label: "Create", id: "create", icon: CalendarPlus },
  { href: "/app/dashboard", label: "Coaching", id: "dashboard", icon: LayoutDashboard },
] as const;

const applicationNavItem = {
  href: "/app/applications",
  label: "My Flying",
  id: "applications",
  icon: ClipboardList,
} as const;

const profileNavItem = {
  href: "/app/profile",
  label: "Profile",
  id: "profile",
  icon: User,
} as const;

const adminNavItem = {
  href: "/admin",
  label: "Admin",
  id: "admin",
  icon: ShieldCheck,
} as const;

async function getShellState() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        canCreate: false,
        canJoin: true,
        isAdmin: false,
        organizerUnreadCount: 0,
        participantUnreadCount: 0,
        profileIncomplete: true,
        pushNotificationsEnabled: false,
        pushPromptAnsweredAt: null,
        isAuthenticated: false,
      };
    }

    const [
      { data: profile, error: profileError },
      organizerNotificationResult,
      participantNotificationResult,
    ] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("is_organizer,wants_to_create_opportunities,full_name,country,city,disciplines,home_tunnel_id,instagram_handle,profile_image_url,push_notifications_enabled,push_prompt_answered_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false)
          .in("type", [...organizerActivityNotificationTypes]),
        supabase
          .from("notifications")
          .select("type,body")
          .eq("user_id", user.id)
          .eq("read", false)
          .in("type", [...participantActivityNotificationTypes]),
      ]);

    if (profileError) {
      console.error("App shell profile lookup failed", profileError);
    }

    if (organizerNotificationResult.error) {
      console.error(
        "App shell organizer notification count failed",
        organizerNotificationResult.error,
      );
    }

    if (participantNotificationResult.error) {
      console.error(
        "App shell participant notification count failed",
        participantNotificationResult.error,
      );
    }

    const canCreate =
      profile?.is_organizer === true ||
      profile?.wants_to_create_opportunities === true;
    const profileIncomplete = !calculateProfileCompleteness(profile).isComplete;

    return {
      canCreate,
      canJoin: true,
      isAdmin: isAdmin(user),
      organizerUnreadCount: organizerNotificationResult.count ?? 0,
      participantUnreadCount: countBadgeNotifications(
        participantNotificationResult.error
          ? []
          : (participantNotificationResult.data ?? []),
      ),
      profileIncomplete,
      pushNotificationsEnabled: profile?.push_notifications_enabled === true,
      pushPromptAnsweredAt: profile?.push_prompt_answered_at ?? null,
      isAuthenticated: true,
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
      profileIncomplete: true,
      pushNotificationsEnabled: false,
      pushPromptAnsweredAt: null,
      isAuthenticated: false,
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
  const navItems = [
    ...baseNavItems,
    ...(userCanCreate ? organizerNavItems : []),
    ...(userCanJoin ? [applicationNavItem] : []),
    ...(shellState.isAdmin ? [adminNavItem] : []),
  ];
  const profileSelected = active === profileNavItem.id;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <Image
              src="/flyloop-icon-192.png"
              alt=""
              width={36}
              height={36}
              priority
              className="size-9 rounded-xl shadow-sm"
            />
            <span className="text-lg font-bold tracking-tight">Flyloop</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold ${
                    selected ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="relative grid size-[17px] place-items-center">
                    <Icon size={17} />
                    {item.id === "dashboard" ? (
                      <OrganizerNavBadge
                        initialCount={shellState.organizerUnreadCount}
                        notificationTypes={organizerActivityNotificationTypes}
                      />
                    ) : null}
                    {item.id === "applications" ? (
                      <OrganizerNavBadge
                        initialCount={shellState.participantUnreadCount}
                        notificationTypes={participantActivityNotificationTypes}
                      />
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              href={profileNavItem.href}
              aria-label={profileNavItem.label}
              aria-current={profileSelected ? "page" : undefined}
              className={`relative grid size-10 place-items-center rounded-full border shadow-sm ${
                profileSelected
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <User size={18} />
              <ProfileNavDot initialIncomplete={shellState.profileIncomplete} />
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100dvh-138px)] max-w-5xl px-4 pb-28 pt-5 md:pb-8">
        {children}
      </main>
      {shellState.isAuthenticated ? (
        <>
          <PwaInstallGuidance active={active} />
          <PushNotificationPrompt
            enabled={shellState.pushNotificationsEnabled}
            answeredAt={shellState.pushPromptAnsweredAt}
          />
        </>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div
          className="mx-auto grid max-w-md px-2 py-2"
          style={{
            gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-[0.68rem] font-semibold ${
                  selected ? "bg-sky-50 text-sky-700" : "text-slate-500"
                }`}
              >
                <span className="relative grid size-[19px] place-items-center">
                  <Icon size={19} />
                  {item.id === "dashboard" ? (
                    <OrganizerNavBadge
                      initialCount={shellState.organizerUnreadCount}
                      notificationTypes={organizerActivityNotificationTypes}
                      compact
                    />
                  ) : null}
                  {item.id === "applications" ? (
                    <OrganizerNavBadge
                      initialCount={shellState.participantUnreadCount}
                      notificationTypes={participantActivityNotificationTypes}
                      compact
                    />
                  ) : null}
                </span>
                <span className="max-w-full whitespace-nowrap leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
