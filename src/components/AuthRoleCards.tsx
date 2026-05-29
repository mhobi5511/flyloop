"use client";

import Link from "next/link";
import { setDemoRole } from "@/lib/demo-store";
import { useDemoState } from "@/lib/use-demo-state";
import type { UserRole } from "@/lib/types";

const roles: Array<{ label: string; role: UserRole; href: string }> = [
  { label: "Athlete", role: "athlete", href: "/app/onboarding" },
  { label: "Coach", role: "coach", href: "/app/dashboard" },
  { label: "Admin", role: "admin", href: "/app/admin" },
];

export function AuthRoleCards() {
  const [, setState] = useDemoState();

  return (
    <div className="mt-6 grid gap-3">
      {roles.map((item) => (
        <Link
          key={item.role}
          href={item.href}
          onClick={() => setState(setDemoRole(item.role))}
          className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-left font-bold text-slate-800 hover:border-sky-300 hover:bg-sky-50"
        >
          Continue as {item.label}
          <span className="text-sky-700">Go</span>
        </Link>
      ))}
    </div>
  );
}
