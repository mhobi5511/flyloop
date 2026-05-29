"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { OpportunityType } from "@/lib/types";

type CoachOption = {
  id: string;
  name: string;
};

type TunnelOption = {
  id: string;
  name: string;
};

function isoDateFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CreateOpportunityForm() {
  const router = useRouter();
  const [type, setType] = useState<OpportunityType>("camp");
  const [title, setTitle] = useState("Dynamic Camp");
  const [coachId, setCoachId] = useState("");
  const [tunnelId, setTunnelId] = useState("");
  const [startDate, setStartDate] = useState(isoDateFromNow(5));
  const [endDate, setEndDate] = useState(isoDateFromNow(6));
  const [registrationDeadline, setRegistrationDeadline] = useState(
    isoDateFromNow(2),
  );
  const [price, setPrice] = useState(420);
  const [totalCapacity, setTotalCapacity] = useState(8);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [tunnels, setTunnels] = useState<TunnelOption[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function loadOptions() {
      const [{ data: coachRows }, { data: tunnelRows }] = await Promise.all([
        supabase
          .from("coach_profiles")
          .select("id, profiles(full_name)")
          .order("created_at", { ascending: true }),
        supabase
          .from("tunnel_profiles")
          .select("id, name")
          .order("name", { ascending: true }),
      ]);

      const mappedCoaches =
        coachRows?.map((row) => {
          const profileRows = row.profiles as
            | { full_name?: string }
            | Array<{ full_name?: string }>
            | null;

          return {
          id: row.id,
          name:
            Array.isArray(profileRows)
              ? profileRows[0]?.full_name ?? "Coach"
              : profileRows?.full_name ?? "Coach",
          };
        }) ?? [];

      const mappedTunnels =
        tunnelRows?.map((row) => ({ id: row.id, name: row.name })) ?? [];

      setCoaches(mappedCoaches);
      setTunnels(mappedTunnels);
      setCoachId((current) => current || mappedCoaches[0]?.id || "");
      setTunnelId((current) => current || mappedTunnels[0]?.id || "");
    }

    void loadOptions();
  }, []);

  const willBeLastMinute = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const now = new Date();
    const daysUntilStart =
      (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilStart >= 0 && daysUntilStart <= 10 && totalCapacity > 0;
  }, [startDate, totalCapacity]);

  async function publish() {
    setError("");
    setIsLoading(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Please log in again.");
      setIsLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !["coach", "admin"].includes(profile.role)) {
      setError("Only coaches and admins can publish opportunities.");
      setIsLoading(false);
      return;
    }

    const finalCoachId = type === "camp" ? coachId : coachId || null;
    if (type === "camp" && !finalCoachId) {
      setError("Please select a coach for this camp.");
      setIsLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("opportunities").insert({
      type,
      title: title.trim() || "Untitled opportunity",
      coach_id: finalCoachId,
      tunnel_id: tunnelId,
      start_date: startDate,
      end_date: endDate,
      registration_deadline: registrationDeadline,
      price,
      currency: "EUR",
      total_capacity: totalCapacity,
      available_spots: totalCapacity,
      min_minutes_or_hours:
        type === "camp" ? "45 min per athlete" : "10 min blocks",
      description:
        type === "camp"
          ? "Camp published by a Flyloop coach."
          : "Huck Jam published on Flyloop.",
      languages: ["English"],
      disciplines:
        type === "camp"
          ? ["Dynamic", "Angles"]
          : ["Belly", "Backfly", "Dynamic"],
      skill_level: type === "camp" ? "Intermediate" : "All levels",
      status: "published",
      contact_method: "whatsapp",
      created_by: user.id,
    });

    setIsLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <form className="mt-5 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-2xl bg-sky-50 p-4 text-sm font-semibold text-sky-800">
        {willBeLastMinute
          ? "This will appear as last-minute automatically after publishing."
          : "This will appear as an upcoming opportunity after publishing."}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <select
            className="field"
            value={type}
            onChange={(event) => setType(event.target.value as OpportunityType)}
          >
            <option value="camp">Camp</option>
            <option value="huck_jam">Huck Jam</option>
          </select>
        </Field>
        <Field label="Title">
          <input
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coach">
          <select
            className="field"
            value={coachId}
            onChange={(event) => setCoachId(event.target.value)}
          >
            {type === "huck_jam" ? <option value="">Organizer-led</option> : null}
            {coaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tunnel">
          <select
            className="field"
            value={tunnelId}
            onChange={(event) => setTunnelId(event.target.value)}
          >
            {tunnels.map((tunnel) => (
              <option key={tunnel.id} value={tunnel.id}>
                {tunnel.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Start date">
          <input
            type="date"
            className="field"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            className="field"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
        <Field label="Registration deadline">
          <input
            type="date"
            className="field"
            value={registrationDeadline}
            onChange={(event) => setRegistrationDeadline(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price">
          <input
            type="number"
            className="field"
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
          />
        </Field>
        <Field label="Capacity">
          <input
            type="number"
            className="field"
            value={totalCapacity}
            onChange={(event) => setTotalCapacity(Number(event.target.value))}
          />
        </Field>
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={publish}
        disabled={isLoading}
        className="mt-2 h-12 rounded-xl bg-sky-600 text-sm font-bold text-white disabled:bg-slate-300"
      >
        {isLoading ? "Publishing..." : "Publish opportunity"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      {children}
    </label>
  );
}
