"use client";

import { useState } from "react";
import type { InterestStatus } from "@/lib/types";

type InterestStatusSelectProps = {
  value: InterestStatus;
};

export function InterestStatusSelect({ value }: InterestStatusSelectProps) {
  const [status, setStatus] = useState(value);

  return (
    <select
      value={status}
      onChange={(event) => setStatus(event.target.value as InterestStatus)}
      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400"
    >
      <option value="pending">Pending</option>
      <option value="accepted">Accepted</option>
      <option value="declined">Declined</option>
      <option value="waitlist">Waitlist</option>
    </select>
  );
}
