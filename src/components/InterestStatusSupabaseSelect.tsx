"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { InterestStatus } from "@/lib/types";

export function InterestStatusSupabaseSelect({
  id,
  value,
}: {
  id: string;
  value: InterestStatus;
}) {
  const [status, setStatus] = useState(value);

  async function update(nextStatus: InterestStatus) {
    setStatus(nextStatus);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("opportunity_interests")
      .update({ status: nextStatus })
      .eq("id", id);

    if (error) {
      setStatus(status);
    }
  }

  return (
    <select
      value={status}
      onChange={(event) => update(event.target.value as InterestStatus)}
      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
    >
      <option value="pending">Pending</option>
      <option value="accepted">Accepted</option>
      <option value="declined">Declined</option>
      <option value="waitlist">Waitlist</option>
    </select>
  );
}
