"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Clock3,
  Mail,
  Phone,
  RefreshCw,
  UserRound,
  Users,
} from "lucide-react";
import type {
  TunnelDashboardData,
  TunnelDashboardEvent,
  TunnelDashboardParticipant,
} from "@/lib/tunnel-dashboard";

type TunnelOperationsDashboardProps = {
  data: TunnelDashboardData;
};

type ChangeEntry =
  | {
      id: string;
      type: "booked";
      participantId: string;
      participantName: string;
      day: string;
      sortTime: string;
      text: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "removed";
      participantId: string;
      participantName: string;
      day: string;
      sortTime: string;
      text: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "moved";
      participantId: string;
      participantName: string;
      day: string;
      sortTime: string;
      text: string;
      createdAt: string;
    };

const participantColors = [
  { bg: "#0369a1", soft: "#e0f2fe", text: "#075985" },
  { bg: "#047857", soft: "#d1fae5", text: "#065f46" },
  { bg: "#b45309", soft: "#fef3c7", text: "#92400e" },
  { bg: "#7c3aed", soft: "#ede9fe", text: "#5b21b6" },
  { bg: "#be123c", soft: "#ffe4e6", text: "#9f1239" },
  { bg: "#0f766e", soft: "#ccfbf1", text: "#115e59" },
  { bg: "#4338ca", soft: "#e0e7ff", text: "#3730a3" },
  { bg: "#c2410c", soft: "#ffedd5", text: "#9a3412" },
];

export function TunnelOperationsDashboard({ data }: TunnelOperationsDashboardProps) {
  const storageKey = `flyloop:tunnel-dashboard:${data.opportunity.id}:last-viewed`;
  const [selectedParticipantId, setSelectedParticipantId] = useState(
    data.participants[0]?.id ?? "",
  );
  const [lastViewedAt] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(storageKey),
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [pollSince] = useState(data.latestEventAt ?? data.loadedAt);
  const participantColorMap = useMemo(
    () => buildParticipantColorMap(data.participants),
    [data.participants],
  );
  const slotsByDay = useMemo(() => groupSlotsByDay(data.slots), [data.slots]);
  const selectedParticipant =
    data.participants.find((participant) => participant.id === selectedParticipantId) ??
    data.participants[0] ??
    null;
  const visibleEvents = useMemo(
    () =>
      lastViewedAt
        ? data.events.filter(
            (event) => new Date(event.createdAt).getTime() > new Date(lastViewedAt).getTime(),
          )
        : [],
    [data.events, lastViewedAt],
  );
  const changeGroups = useMemo(
    () => groupChangeEntries(detectMoves(visibleEvents)),
    [visibleEvents],
  );

  useEffect(() => {
    window.localStorage.setItem(storageKey, data.loadedAt);
  }, [data.loadedAt, storageKey]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/tunnel-dashboard/${data.secret}/changes?since=${encodeURIComponent(
            pollSince,
          )}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as { hasChanges?: boolean };

        if (result.hasChanges) {
          setHasChanges(true);
        }
      } catch (error) {
        console.error("Tunnel dashboard polling failed", error);
      }
    }, 20_000);

    return () => window.clearInterval(interval);
  }, [data.secret, pollSince]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      {hasChanges ? (
        <div className="sticky top-0 z-30 border-b border-amber-200 bg-amber-50 px-5 py-3 shadow-sm">
          <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4">
            <p className="text-sm font-black text-amber-900">
              New changes available
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-600 px-3 text-sm font-black text-white hover:bg-amber-700"
            >
              <RefreshCw size={15} />
              Refresh view
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-[96rem] gap-4 p-4 xl:p-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Image
                  src="/flyloop-icon-192.png"
                  alt="Flyloop"
                  width={32}
                  height={32}
                  className="size-8 rounded-lg"
                />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">
                    Tunnel Operations Dashboard
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    Powered by Flyloop
                  </p>
                </div>
              </div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">
                {data.opportunity.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
                <InfoPill icon={<UserRound size={15} />} label={data.coach.name} />
                <InfoPill
                  icon={<CalendarDays size={15} />}
                  label={`${formatDay(data.opportunity.startDate)} - ${formatDay(
                    data.opportunity.endDate,
                  )}`}
                />
                <InfoPill
                  icon={<Clock3 size={15} />}
                  label={`Loaded ${formatTimeFromIso(data.loadedAt)}`}
                />
              </div>
            </div>
            <div className="grid gap-1 rounded-xl bg-slate-950 px-4 py-3 text-white">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-200">
                Tunnel
              </p>
              <p className="text-lg font-black">{data.tunnel.name}</p>
              <p className="text-sm font-bold text-slate-300">
                {[data.tunnel.city, data.tunnel.country].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <StatCard label="Total participants" value={data.stats.totalParticipants} />
            <StatCard
              label="Total booked minutes"
              value={`${data.stats.totalBookedMinutes} min`}
            />
            <StatCard
              label="Total booked hours"
              value={`${data.stats.totalBookedHours} h`}
            />
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black tracking-tight">Live Timetable</h2>
                <p className="text-sm font-bold text-slate-500">
                  Polling every 20 seconds
                </p>
              </div>
              <div
                className="mt-4 grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(slotsByDay.length, 1)}, minmax(14rem, 1fr))`,
                }}
              >
                {slotsByDay.map((day) => (
                  <section
                    key={day.date}
                    className="min-w-0 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <div className="border-b border-slate-200 px-3 py-2">
                      <h3 className="text-sm font-black text-slate-950">
                        {formatLongDay(day.date)}
                      </h3>
                    </div>
                    <div className="grid gap-2 p-2">
                      {day.slots.map((slot) => (
                        <article
                          key={slot.id}
                          className="rounded-lg border border-slate-200 bg-white p-2"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-sm font-black">
                              {formatTime(slot.startTime)}
                            </p>
                          </div>
                          <div className="grid gap-1">
                            {slot.bookings.length > 0 ? (
                              slot.bookings.map((booking) => {
                                const colors = participantColorMap.get(booking.userId);

                                return (
                                  <button
                                    key={booking.id}
                                    type="button"
                                    onClick={() => setSelectedParticipantId(booking.userId)}
                                    className="grid rounded-md px-2.5 py-2 text-left text-white shadow-sm"
                                    style={{ backgroundColor: colors?.bg }}
                                  >
                                    <span className="truncate text-sm font-black">
                                      {booking.participantName}
                                    </span>
                                    <span className="text-xs font-bold text-white/80">
                                      {booking.minutes} min
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              <p className="rounded-md border border-dashed border-slate-300 px-2.5 py-2 text-xs font-bold text-slate-400">
                                Open
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>

            <ChangeLog
              lastViewedAt={lastViewedAt}
              groups={changeGroups}
            />
          </div>

          <aside className="grid gap-4">
            <ParticipantList
              participants={data.participants}
              selectedParticipantId={selectedParticipant?.id ?? ""}
              participantColorMap={participantColorMap}
              onSelect={setSelectedParticipantId}
            />
            <ParticipantPanel
              participant={selectedParticipant}
              participantColorMap={participantColorMap}
            />
          </aside>
        </section>
      </div>
    </main>
  );
}

function InfoPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
      {icon}
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function ParticipantList({
  participants,
  selectedParticipantId,
  participantColorMap,
  onSelect,
}: {
  participants: TunnelDashboardParticipant[];
  selectedParticipantId: string;
  participantColorMap: Map<string, (typeof participantColors)[number]>;
  onSelect: (participantId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight">Participants</h2>
        <Users size={18} className="text-sky-700" />
      </div>
      <div className="mt-3 grid gap-2">
        {participants.map((participant) => {
          const colors = participantColorMap.get(participant.id);
          const isSelected = participant.id === selectedParticipantId;

          return (
            <button
              key={participant.id}
              type="button"
              onClick={() => onSelect(participant.id)}
              className={`grid rounded-xl border px-3 py-2 text-left transition ${
                isSelected ? "border-sky-300 bg-sky-50" : "border-slate-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: colors?.bg }}
                />
                <span className="truncate text-sm font-black text-slate-950">
                  {participant.name}
                </span>
              </span>
              <span className="pl-5 text-xs font-bold text-slate-500">
                {participant.totalBookedMinutes} min booked
              </span>
            </button>
          );
        })}
        {participants.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">
            No participants have booked slots yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ParticipantPanel({
  participant,
  participantColorMap,
}: {
  participant: TunnelDashboardParticipant | null;
  participantColorMap: Map<string, (typeof participantColors)[number]>;
}) {
  if (!participant) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-500">
          Select a participant to see details.
        </p>
      </section>
    );
  }

  const colors = participantColorMap.get(participant.id);
  const slotsByDay = groupParticipantSlotsByDay(participant.slots);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl text-base font-black text-white"
          style={{ backgroundColor: colors?.bg }}
        >
          {participant.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-black tracking-tight">
            {participant.name}
          </h2>
          <p className="text-sm font-bold text-slate-500">
            {participant.totalBookedMinutes} min total
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
        <p className="flex items-center gap-2">
          <Mail size={15} className="text-sky-700" />
          {participant.email || "Email not available"}
        </p>
        <p className="flex items-center gap-2">
          <Phone size={15} className="text-sky-700" />
          {participant.phone || "Phone not available"}
        </p>
      </div>
      <div className="mt-4 grid gap-3">
        {slotsByDay.map((day) => (
          <section key={day.date}>
            <h3 className="text-sm font-black text-slate-950">
              {formatLongDay(day.date)}
            </h3>
            <div className="mt-1 grid gap-1">
              {day.slots.map((slot) => (
                <p
                  key={slot.id}
                  className="rounded-lg bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-700"
                >
                  {formatTime(slot.startTime)} - {slot.minutes} min
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function ChangeLog({
  lastViewedAt,
  groups,
}: {
  lastViewedAt: string | null;
  groups: ReturnType<typeof groupChangeEntries>;
}) {
  if (!lastViewedAt) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight">Change Log</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            Changes since your last visit on this device
          </p>
        </div>
        <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
          {lastViewedAt ? formatVisitTimestamp(lastViewedAt) : "First visit on this device"}
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
        {groups.map((day) => (
          <section key={day.date} className="grid gap-2">
            <h3 className="text-base font-black text-slate-950">
              {formatLongDay(day.date)}
            </h3>
            {day.participants.map((participant) => (
              <div
                key={`${day.date}-${participant.participantId}`}
                className="rounded-xl bg-slate-50 p-3"
              >
                <p className="text-sm font-black text-slate-900">
                  {participant.participantName}
                </p>
                <ul className="mt-2 grid gap-1">
                  {participant.changes.map((change) => (
                    <li
                      key={change.id}
                      className="text-sm font-semibold text-slate-700"
                    >
                      {change.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
        {groups.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">
            No changes since the last visit on this device.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function buildParticipantColorMap(participants: TunnelDashboardParticipant[]) {
  const map = new Map<string, (typeof participantColors)[number]>();

  participants.forEach((participant, index) => {
    map.set(participant.id, participantColors[index % participantColors.length]);
  });

  return map;
}

function groupSlotsByDay(slots: TunnelDashboardData["slots"]) {
  const groups = new Map<string, TunnelDashboardData["slots"]>();

  for (const slot of slots) {
    const daySlots = groups.get(slot.slotDate) ?? [];
    daySlots.push(slot);
    groups.set(slot.slotDate, daySlots);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
}

function groupParticipantSlotsByDay(
  slots: TunnelDashboardParticipant["slots"],
) {
  const groups = new Map<string, TunnelDashboardParticipant["slots"]>();

  for (const slot of slots) {
    const daySlots = groups.get(slot.slotDate) ?? [];
    daySlots.push(slot);
    groups.set(slot.slotDate, daySlots);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
}

function detectMoves(events: TunnelDashboardEvent[]) {
  const sortedEvents = [...events].sort((a, b) =>
    `${a.createdAt} ${a.slotDate} ${a.startTime}`.localeCompare(
      `${b.createdAt} ${b.slotDate} ${b.startTime}`,
    ),
  );
  const removedPool: TunnelDashboardEvent[] = [];
  const entries: ChangeEntry[] = [];

  for (const event of sortedEvents) {
    if (event.eventType === "removed") {
      removedPool.push(event);
      continue;
    }

    const movedFromIndex = removedPool.findIndex(
      (removedEvent) =>
        removedEvent.participantId === event.participantId &&
        removedEvent.minutes === event.minutes,
    );

    if (movedFromIndex >= 0) {
      const removedEvent = removedPool.splice(movedFromIndex, 1)[0];
      entries.push({
        id: `${removedEvent.id}-${event.id}`,
        type: "moved",
        participantId: event.participantId,
        participantName: event.participantName,
        day: event.slotDate,
        sortTime: event.startTime,
        text: `Moved ${event.minutes} min from ${formatTime(
          removedEvent.startTime,
        )} to ${formatTime(event.startTime)}`,
        createdAt: event.createdAt,
      });
      continue;
    }

    entries.push({
      id: event.id,
      type: "booked",
      participantId: event.participantId,
      participantName: event.participantName,
      day: event.slotDate,
      sortTime: event.startTime,
      text: `Booked ${event.minutes} min at ${formatTime(event.startTime)}`,
      createdAt: event.createdAt,
    });
  }

  for (const event of removedPool) {
    entries.push({
      id: event.id,
      type: "removed",
      participantId: event.participantId,
      participantName: event.participantName,
      day: event.slotDate,
      sortTime: event.startTime,
      text: `Removed ${event.minutes} min from ${formatTime(event.startTime)}`,
      createdAt: event.createdAt,
    });
  }

  return entries.sort((a, b) =>
    `${a.day} ${a.sortTime} ${a.createdAt}`.localeCompare(
      `${b.day} ${b.sortTime} ${b.createdAt}`,
    ),
  );
}

function groupChangeEntries(entries: ChangeEntry[]) {
  const dayGroups = new Map<
    string,
    Map<string, { participantId: string; participantName: string; changes: ChangeEntry[] }>
  >();

  for (const entry of entries) {
    const participantGroups = dayGroups.get(entry.day) ?? new Map();
    const participantGroup =
      participantGroups.get(entry.participantId) ??
      ({
        participantId: entry.participantId,
        participantName: entry.participantName,
        changes: [],
      });

    participantGroup.changes.push(entry);
    participantGroups.set(entry.participantId, participantGroup);
    dayGroups.set(entry.day, participantGroups);
  }

  return [...dayGroups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, participantGroups]) => ({
      date,
      participants: [...participantGroups.values()]
        .map((participant) => ({
          ...participant,
          changes: participant.changes.sort((a, b) =>
            `${a.sortTime} ${a.createdAt}`.localeCompare(`${b.sortTime} ${b.createdAt}`),
          ),
        }))
        .sort((a, b) => a.participantName.localeCompare(b.participantName)),
    }));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatLongDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatTimeFromIso(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatVisitTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
