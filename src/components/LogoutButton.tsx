"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
      aria-label="Log out"
    >
      <LogOut size={18} />
    </button>
  );
}
