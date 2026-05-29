"use client";

import { setDemoRole } from "@/lib/demo-store";
import { useDemoState } from "@/lib/use-demo-state";
import type { UserRole } from "@/lib/types";

export function DemoModePill() {
  const [state, setState] = useDemoState();

  function switchRole(role: UserRole) {
    setState(setDemoRole(role));
  }

  return (
    <select
      value={state.role}
      onChange={(event) => switchRole(event.target.value as UserRole)}
      className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none"
      aria-label="Visual mode"
    >
      <option value="athlete">Athlete</option>
      <option value="coach">Coach</option>
      <option value="admin">Admin</option>
    </select>
  );
}
