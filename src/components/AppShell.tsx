import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarPlus, Compass, Home, LayoutDashboard, User } from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import { NotificationBell } from "./NotificationBell";

type AppShellProps = {
  children: ReactNode;
  active?: "home" | "create" | "dashboard" | "profile";
};

const navItems = [
  { href: "/app", label: "Home", id: "home", icon: Home },
  { href: "/app/create", label: "Create", id: "create", icon: CalendarPlus },
  { href: "/app/dashboard", label: "Organizer", id: "dashboard", icon: LayoutDashboard },
  { href: "/app/onboarding", label: "Profile", id: "profile", icon: User },
] as const;

export function AppShell({ children, active = "home" }: AppShellProps) {
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
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100dvh-138px)] max-w-5xl px-4 pb-28 pt-5">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold ${
                  selected ? "bg-sky-50 text-sky-700" : "text-slate-500"
                }`}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
