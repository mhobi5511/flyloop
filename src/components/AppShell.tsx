import Link from "next/link";
import type { ReactNode } from "react";
import {
  ClipboardList,
  CalendarPlus,
  Compass,
  Home,
  LayoutDashboard,
  User,
} from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";
import { OrganizerNavBadge } from "./OrganizerNavBadge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unstable_rethrow } from "next/navigation";

type AppShellProps = {
  children: ReactNode;
  active?: "home" | "create" | "dashboard" | "applications" | "profile";
  canCreate?: boolean;
  canJoin?: boolean;
};

const baseNavItems = [
  { href: "/app", label: "Home", id: "home", icon: Home },
] as const;

const organizerNavItems = [
  { href: "/app/create", label: "Create", id: "create", icon: CalendarPlus },
  { href: "/app/dashboard", label: "Organizer", id: "dashboard", icon: LayoutDashboard },
] as const;

const applicationNavItem = {
  href: "/app/applications",
  label: "Applications",
  id: "applications",
  icon: ClipboardList,
} as const;

const profileNavItem = {
  href: "/app/onboarding",
  label: "Profile",
  id: "profile",
  icon: User,
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
        organizerUnreadCount: 0,
      };
    }

    const [{ data: profile, error: profileError }, notificationResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("wants_to_join_opportunities,wants_to_create_opportunities")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("read", false)
          .eq("type", "new_interest"),
      ]);

    if (profileError) {
      console.error("App shell profile lookup failed", profileError);
    }

    if (notificationResult.error) {
      console.error("App shell notification count failed", notificationResult.error);
    }

    return {
      canCreate: profile?.wants_to_create_opportunities === true,
      canJoin: profile?.wants_to_join_opportunities !== false,
      organizerUnreadCount: notificationResult.count ?? 0,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("App shell state failed", error);
    return {
      canCreate: false,
      canJoin: true,
      organizerUnreadCount: 0,
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
    profileNavItem,
  ];

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-600 text-white">
              <Compass size={18} />
            </span>
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
                  <Icon size={17} />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.id === "dashboard" ? (
                    <OrganizerNavBadge initialCount={shellState.organizerUnreadCount} />
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100dvh-138px)] max-w-5xl px-4 pb-28 pt-5 md:pb-8">
        {children}
      </main>
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
                <Icon size={19} />
                <span className="max-w-full whitespace-nowrap leading-none">{item.label}</span>
                {item.id === "dashboard" ? (
                  <OrganizerNavBadge initialCount={shellState.organizerUnreadCount} compact />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
