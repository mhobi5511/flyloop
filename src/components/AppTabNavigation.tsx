"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useEffect, useMemo } from "react";
import {
  CalendarPlus,
  ClipboardList,
  Home,
  LayoutDashboard,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";

import { NotificationBell } from "./NotificationBell";
import { OrganizerNavBadge } from "./OrganizerNavBadge";
import { ProfileNavDot } from "./ProfileNavDot";
import { PwaInstallGuidance } from "./PwaInstallGuidance";
import { PushNotificationPrompt } from "./PushNotificationPrompt";

type AppNavId =
  | "home"
  | "create"
  | "dashboard"
  | "applications"
  | "profile"
  | "admin";

type AppNavItem = {
  href: string;
  label: string;
  id: AppNavId;
  icon: LucideIcon;
};

const baseNavItems = [
  { href: "/app", label: "Discover", id: "home", icon: Home },
] satisfies AppNavItem[];

const organizerNavItems = [
  { href: "/app/create", label: "Create", id: "create", icon: CalendarPlus },
  { href: "/app/coach-dashboard", label: "Coaching", id: "dashboard", icon: LayoutDashboard },
] satisfies AppNavItem[];

const mobileOrganizerNavItems = [
  { href: "/app/create", label: "Create", id: "create", icon: CalendarPlus },
  { href: "/app/dashboard", label: "Coaching", id: "dashboard", icon: LayoutDashboard },
] satisfies AppNavItem[];

const applicationNavItem = {
  href: "/app/applications",
  label: "My Flying",
  id: "applications",
  icon: ClipboardList,
} satisfies AppNavItem;

const profileNavItem = {
  href: "/app/profile",
  label: "Profile",
  id: "profile",
  icon: User,
} satisfies AppNavItem;

const adminNavItem = {
  href: "/admin",
  label: "Admin",
  id: "admin",
  icon: ShieldCheck,
} satisfies AppNavItem;

type AppTabNavigationProps = {
  canCreate: boolean;
  canJoin: boolean;
  isAdmin: boolean;
  profileIncomplete: boolean;
  activeFallback?: AppNavId;
  pushNotificationsEnabled: boolean;
  pushPromptAnsweredAt: string | null;
  isAuthenticated: boolean;
  children: React.ReactNode;
};

export function AppTabNavigation({
  canCreate,
  canJoin,
  isAdmin,
  profileIncomplete,
  activeFallback = "home",
  pushNotificationsEnabled,
  pushPromptAnsweredAt,
  isAuthenticated,
  children,
}: AppTabNavigationProps) {
  const pathname = usePathname();
  const active = getActiveNavId(pathname) ?? activeFallback;
  const navItems = useMemo(
    () => [
      ...baseNavItems,
      ...(canCreate ? organizerNavItems : []),
      ...(canJoin ? [applicationNavItem] : []),
      ...(isAdmin ? [adminNavItem] : []),
    ],
    [canCreate, canJoin, isAdmin],
  );
  const mobileNavItems = useMemo(
    () => [
      ...baseNavItems,
      ...(canCreate ? mobileOrganizerNavItems : []),
      ...(canJoin ? [applicationNavItem] : []),
      ...(isAdmin ? [adminNavItem] : []),
    ],
    [canCreate, canJoin, isAdmin],
  );
  const prefetchHrefs = useMemo(
    () => [
      ...new Set(
        [...navItems, profileNavItem]
          .map((item) => item.href)
          .filter((href) => href.startsWith("/app")),
      ),
    ],
    [navItems],
  );
  const profileSelected = active === profileNavItem.id;
  const isWideWorkspaceRoute =
    pathname.startsWith("/app/coach-dashboard") ||
    pathname.startsWith("/app/organizer/opportunities");

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <PrimaryTabPrefetcher hrefs={prefetchHrefs} />
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/app" prefetch className="flex items-center gap-2">
            <Image
              src="/flyloop-icon-192.png"
              alt=""
              width={36}
              height={36}
              preload
              className="size-9 rounded-xl shadow-sm"
            />
            <span className="text-lg font-bold tracking-tight">Flyloop</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} selected={active === item.id} />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              href={profileNavItem.href}
              prefetch
              aria-label={profileNavItem.label}
              aria-current={profileSelected ? "page" : undefined}
              className={`relative grid size-10 place-items-center rounded-full border shadow-sm ${
                profileSelected
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <User size={18} />
              <ProfileNavDot initialIncomplete={profileIncomplete} />
            </Link>
          </div>
        </div>
      </header>
      <main
        className={
          isWideWorkspaceRoute
            ? "min-h-[calc(100dvh-138px)] pb-28 md:pb-8"
            : "mx-auto min-h-[calc(100dvh-138px)] max-w-5xl px-4 pb-28 pt-5 md:pb-8"
        }
      >
        {children}
      </main>
      {isAuthenticated ? (
        <>
          <PwaInstallGuidance active={active} />
          <PushNotificationPrompt
            enabled={pushNotificationsEnabled}
            answeredAt={pushPromptAnsweredAt}
          />
        </>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div
          className="mx-auto grid max-w-md px-2 py-2"
          style={{
            gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))`,
          }}
        >
          {mobileNavItems.map((item) => (
            <MobileNavLink
              key={item.href}
              item={item}
              selected={active === item.id}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

function NavLink({ item, selected }: { item: AppNavItem; selected: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch
      aria-current={selected ? "page" : undefined}
      className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold ${
        selected ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className="relative grid size-[17px] place-items-center">
        <Icon size={17} />
        {item.id === "dashboard" ? <OrganizerNavBadge kind="organizer" /> : null}
        {item.id === "applications" ? <OrganizerNavBadge kind="participant" /> : null}
      </span>
      <span className="whitespace-nowrap">{item.label}</span>
    </Link>
  );
}

function MobileNavLink({
  item,
  selected,
}: {
  item: AppNavItem;
  selected: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch
      aria-current={selected ? "page" : undefined}
      className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-[0.68rem] font-semibold ${
        selected ? "bg-sky-50 text-sky-700" : "text-slate-500"
      }`}
    >
      <span className="relative grid size-[19px] place-items-center">
        <Icon size={19} />
        {item.id === "dashboard" ? <OrganizerNavBadge kind="organizer" /> : null}
        {item.id === "applications" ? <OrganizerNavBadge kind="participant" /> : null}
      </span>
      <span className="max-w-full whitespace-nowrap leading-none">{item.label}</span>
    </Link>
  );
}

function PrimaryTabPrefetcher({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function warm(href: string) {
      if (cancelled) {
        return;
      }

      router.prefetch(href, {
        kind: PrefetchKind.FULL,
        onInvalidate() {
          if (cancelled) {
            return;
          }

          const timer = setTimeout(() => {
            timers.delete(timer);
            warm(href);
          }, 1_000);
          timers.add(timer);
        },
      });
    }

    let cancelIdle: () => void;

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => hrefs.forEach(warm));
      cancelIdle = () => window.cancelIdleCallback(idleId);
    } else {
      const idleId = setTimeout(() => hrefs.forEach(warm), 1);
      cancelIdle = () => clearTimeout(idleId);
    }

    return () => {
      cancelled = true;
      cancelIdle();
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [hrefs, router]);

  return null;
}

function getActiveNavId(pathname: string): AppNavId | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }

  if (pathname === "/app") {
    return "home";
  }

  if (pathname.startsWith("/app/create")) {
    return "create";
  }

  if (
    pathname.startsWith("/app/dashboard") ||
    pathname.startsWith("/app/coach-dashboard") ||
    pathname.startsWith("/app/organizer")
  ) {
    return "dashboard";
  }

  if (pathname.startsWith("/app/applications")) {
    return "applications";
  }

  if (pathname.startsWith("/app/profile") || pathname.startsWith("/app/coaches")) {
    return "profile";
  }

  return "home";
}
