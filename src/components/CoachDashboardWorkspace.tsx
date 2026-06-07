"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  CalendarDays,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  Plane,
  Plus,
  Save,
  Settings,
  Share2,
  UserCircle,
  WalletCards,
} from "lucide-react";
import {
  publishDraftOpportunity,
  updateOpportunity,
  type OpportunityFormInput,
} from "@/app/app/create/actions";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import {
  AssignSlotButton,
  type AssignSlotParticipant,
} from "@/components/AssignSlotButton";
import { Avatar } from "@/components/Avatar";
import { CampTimetableEditor } from "@/components/CampTimetableEditor";
import { ReleaseSlotBookingButton } from "@/components/ReleaseSlotBookingButton";
import { ShareOpportunityButton } from "@/components/ShareOpportunityButton";
import {
  formatPrice,
  getOpportunityShareText,
  getPublicOpportunityUrl,
} from "@/lib/opportunities";
import {
  formatTimetableDate,
  formatTimetableMoney,
  formatTimetableTime,
  groupTimetableSlotsByDay,
  type TimetableSlot,
} from "@/lib/timetable";
import type {
  BookingMode,
  InterestStatus,
  OpportunityStatus,
  OpportunityType,
} from "@/lib/types";

type Participant = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  profileImageUrl: string;
  status: InterestStatus;
  createdAt: string;
  removalRequestedAt: string | null;
  tunnelTimeStatus: string | null;
  tunnelAccountEmail: string | null;
};

type CampWorkspace = {
  id: string;
  title: string;
  type: OpportunityType;
  bookingMode: BookingMode;
  status: OpportunityStatus;
  startDate: string;
  endDate: string;
  registrationDeadline: string | null;
  sessionStart: string | null;
  sessionEnd: string | null;
  totalCapacity: number;
  availableSpots: number;
  price: number;
  currency: string;
  priceAppliesToMinutes: string;
  description: string;
  tunnelId: string;
  tunnelName: string;
  tunnelLocation: string;
  dateLabel: string;
  participants: Participant[];
  timetableSlots: TimetableSlot[];
  summary: {
    totalSlots: number;
    bookedSlots: number;
    openSlots: number;
    totalTimetableMinutes: number;
    totalBookedMinutes: number;
    totalAvailableMinutes: number;
    estimatedRevenue: number;
  };
};

type TunnelOption = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

type ActivityItem = {
  id: string;
  title: string;
  body: string;
  opportunityId: string;
  createdAt: string;
};

type WorkspaceRange = "today" | "tomorrow" | "entire";

type CoachDashboardWorkspaceProps = {
  coachName: string;
  selectedCampId: string;
  camps: CampWorkspace[];
  tunnels: TunnelOption[];
  activity: ActivityItem[];
};

const statusColumns: Array<{ status: InterestStatus; label: string }> = [
  { status: "pending", label: "Applicants" },
  { status: "accepted", label: "Accepted" },
  { status: "waitlist", label: "Waitlist" },
  { status: "declined", label: "Declined" },
];

export function CoachDashboardWorkspace({
  coachName,
  selectedCampId,
  camps,
  tunnels,
  activity,
}: CoachDashboardWorkspaceProps) {
  const router = useRouter();
  const [activeCampId, setActiveCampId] = useState(selectedCampId);
  const [range, setRange] = useState<WorkspaceRange>("today");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const activeCamp = camps.find((camp) => camp.id === activeCampId) ?? camps[0];
  const participant =
    activeCamp?.participants.find((item) => item.id === selectedParticipantId) ??
    null;
  const publicUrl = activeCamp ? getPublicOpportunityUrl(activeCamp.id) : "";
  const shareText = activeCamp
    ? getOpportunityShareText(
        {
          id: activeCamp.id,
          type: activeCamp.type,
          bookingMode: activeCamp.bookingMode,
          title: activeCamp.title,
          tunnelId: activeCamp.tunnelId,
          tunnelName: activeCamp.tunnelName,
          startDate: activeCamp.startDate,
          endDate: activeCamp.endDate,
          registrationDeadline: activeCamp.registrationDeadline,
          price: activeCamp.price,
          currency: activeCamp.currency,
          totalCapacity: activeCamp.totalCapacity,
          availableSpots: activeCamp.availableSpots,
          sessionStart: activeCamp.sessionStart,
          sessionEnd: activeCamp.sessionEnd,
          description: activeCamp.description,
          languages: [],
          disciplines: [],
          skillLevel: null,
          status: activeCamp.status,
          contactMethod: "whatsapp",
          createdBy: "",
        },
        publicUrl,
      )
    : "";

  function selectCamp(campId: string) {
    setActiveCampId(campId);
    setSelectedParticipantId("");
    router.replace(`/app/coach-dashboard?camp=${campId}`, { scroll: false });
  }

  if (!activeCamp) {
    return (
      <div className="min-h-dvh bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-300">
            Coach Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-black">No workspaces yet</h1>
          <p className="mt-2 text-sm font-semibold text-slate-300">
            Create your first Camp or Huck Jam to start running your coaching
            workspace.
          </p>
          <Link
            href="/app/create"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-black text-white"
          >
            <Plus size={17} /> New Camp
          </Link>
        </div>
      </div>
    );
  }

  const visibleSlots = filterSlots(activeCamp.timetableSlots, range);
  const visibleDays = groupTimetableSlotsByDay(visibleSlots);
  const attention = getAttentionItems(activeCamp);
  const assignableParticipants = getAssignableParticipants(activeCamp);
  const scopedActivity = activity
    .filter((item) => !item.opportunityId || item.opportunityId === activeCamp.id)
    .slice(0, 8);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-950">
      <div className="border-b border-white/10 bg-slate-950 text-white">
        <header className="mx-auto flex max-w-[1720px] items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-sky-500">
              <Plane size={22} />
            </div>
            <div>
              <p className="text-lg font-black leading-none">Flyloop</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Coach Dashboard
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm font-bold text-slate-300 md:flex">
            <button className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5">
              <Bell size={18} />
            </button>
            <Link
              href="/app/profile"
              className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5"
            >
              <UserCircle size={19} />
            </Link>
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              {coachName}
            </span>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1720px] flex-col gap-3 px-5 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-2">
            <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Workspace
            </label>
            <select
              value={activeCamp.id}
              onChange={(event) => selectCamp(event.target.value)}
              className="h-12 rounded-xl border border-white/10 bg-white px-3 text-base font-black text-slate-950 outline-none"
            >
              {camps.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/create"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              <Plus size={16} /> New Camp
            </Link>
            <Link
              href="/app/create"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              <Plus size={16} /> New Huck Jam
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto hidden max-w-[1720px] gap-4 p-5 md:grid">
        <section className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_340px_300px]">
          <aside className="grid content-start gap-3">
            <RangeControl range={range} onRangeChange={setRange} />
            <AttentionPanel items={attention} />
            <ParticipantColumns
              participants={activeCamp.participants}
              selectedParticipantId={selectedParticipantId}
              onSelectParticipant={setSelectedParticipantId}
            />
          </aside>

          <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-100 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  <span>{activeCamp.type === "camp" ? "Camp" : "Huck Jam"}</span>
                  <span>{activeCamp.status}</span>
                </div>
                <h1 className="mt-1 truncate text-2xl font-black tracking-tight">
                  {activeCamp.title}
                </h1>
                <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} /> {activeCamp.tunnelName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={15} /> {activeCamp.dateLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <WalletCards size={15} />{" "}
                    {formatPrice(activeCamp.price, activeCamp.currency)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Booked" value={`${activeCamp.summary.totalBookedMinutes}m`} />
                <Metric label="Open" value={`${activeCamp.summary.totalAvailableMinutes}m`} />
                <Metric
                  label="Est."
                  value={formatTimetableMoney(
                    activeCamp.summary.estimatedRevenue,
                    activeCamp.currency,
                  )}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {visibleDays.length > 0 ? (
                visibleDays.map((day) => (
                  <section key={day.date} className="rounded-2xl bg-white p-3 shadow-sm">
                    <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                      {formatTimetableDate(day.date)}
                    </h2>
                    <div className="mt-3 grid gap-2">
                      {day.slots.map((slot) => (
                        <article
                          key={slot.id}
                          className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="inline-flex items-center gap-2 text-base font-black">
                              <Clock3 size={17} className="text-sky-700" />
                              {formatTimetableTime(slot.startTime)}
                            </p>
                            <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-black text-white">
                              {slot.bookings.length}/{slot.capacity}
                            </span>
                          </div>
                          <div className="grid gap-1.5">
                            {slot.bookings.map((booking) => (
                              <div
                                key={booking.id}
                                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg bg-white px-2.5 py-2"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const match = activeCamp.participants.find(
                                      (item) => item.userId === booking.userId,
                                    );
                                    if (match) {
                                      setSelectedParticipantId(match.id);
                                    }
                                  }}
                                  className="min-w-0 text-left"
                                >
                                  <p className="truncate text-sm font-black">
                                    {booking.athleteName}
                                  </p>
                                  <p className="text-xs font-bold text-slate-500">
                                    {booking.minutes} minutes
                                  </p>
                                </button>
                                <span className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-black text-sky-700">
                                  booked
                                </span>
                                <ReleaseSlotBookingButton
                                  opportunityId={activeCamp.id}
                                  bookingId={booking.id}
                                />
                              </div>
                            ))}
                            {Array.from({
                              length: Math.max(slot.capacity - slot.bookings.length, 0),
                            }).map((_, index) => (
                              <div
                                key={`${slot.id}-open-${index}`}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-2"
                              >
                                <p className="text-sm font-black text-slate-400">
                                  Open slot
                                </p>
                                <AssignSlotButton
                                  opportunityId={activeCamp.id}
                                  slotId={slot.id}
                                  participants={assignableParticipants.filter(
                                    (item) =>
                                      !slot.bookings.some(
                                        (booking) => booking.userId === item.id,
                                      ),
                                  )}
                                />
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                  <p className="text-lg font-black">No slots in this view</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Use the timetable editor to create the first flying blocks.
                  </p>
                </div>
              )}
            </div>
            {activeCamp.type === "camp" ? (
              <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black">Timetable Editor</h2>
                      <p className="text-sm font-semibold text-slate-500">
                        Create, edit and delete flying slots without leaving the
                        dashboard.
                      </p>
                    </div>
                    <span className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-black text-white">
                      Open
                    </span>
                  </div>
                </summary>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <CampTimetableEditor
                    opportunityId={activeCamp.id}
                    opportunityStartDate={activeCamp.startDate}
                    initialSlots={activeCamp.timetableSlots.map((slot) => ({
                      id: slot.id,
                      slotDate: slot.slotDate,
                      startTime: slot.startTime,
                      durationMinutes: slot.durationMinutes,
                      capacity: slot.capacity,
                    }))}
                  />
                </div>
              </details>
            ) : null}
          </section>

          <aside className="min-w-0">
            {participant ? (
              <ParticipantPanel
                participant={participant}
                camp={activeCamp}
                onClear={() => setSelectedParticipantId("")}
              />
            ) : (
              <CampSettingsPanel
                camp={activeCamp}
                tunnels={tunnels}
                publicUrl={publicUrl}
                shareText={shareText}
              />
            )}
          </aside>

          <aside className="grid content-start gap-3">
            <SharePanel publicUrl={publicUrl} shareText={shareText} />
            <ActivityPanel activity={scopedActivity} />
          </aside>
        </section>
      </main>

      <main className="p-4 md:hidden">
        <div className="rounded-2xl border border-white/10 bg-white p-5">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">
            Desktop workspace available
          </p>
          <h1 className="mt-2 text-2xl font-black">Coach Dashboard</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            This control-tower workspace is optimized for desktop and tablet.
            Your mobile coaching pages stay available as usual.
          </p>
          <Link
            href="/app/dashboard"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-sky-600 px-3 text-sm font-black text-white"
          >
            Back to Coaching
          </Link>
        </div>
      </main>
    </div>
  );
}

function RangeControl({
  range,
  onRangeChange,
}: {
  range: WorkspaceRange;
  onRangeChange: (range: WorkspaceRange) => void;
}) {
  const options: Array<{ value: WorkspaceRange; label: string }> = [
    { value: "today", label: "Today" },
    { value: "tomorrow", label: "Tomorrow" },
    { value: "entire", label: "Entire Camp" },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onRangeChange(option.value)}
          className={`h-9 rounded-xl text-xs font-black transition ${
            range === option.value
              ? "bg-white text-slate-950"
              : "text-slate-400 hover:bg-white/5"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AttentionPanel({ items }: { items: Array<{ label: string; tone: string }> }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-white">
      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">
        Needs attention
      </h2>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black"
            >
              {item.label}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-black text-emerald-200">
            Everything is clear
          </p>
        )}
      </div>
    </section>
  );
}

function ParticipantColumns({
  participants,
  selectedParticipantId,
  onSelectParticipant,
}: {
  participants: Participant[];
  selectedParticipantId: string;
  onSelectParticipant: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-white">
      <div className="grid gap-3">
        {statusColumns.map((column) => {
          const columnParticipants = participants.filter(
            (participant) => participant.status === column.status,
          );

          return (
            <div key={column.status}>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {column.label}
                </h2>
                <span className="text-xs font-black text-slate-500">
                  {columnParticipants.length}
                </span>
              </div>
              <div className="mt-2 grid gap-1.5">
                {columnParticipants.map((participant) => (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => onSelectParticipant(participant.id)}
                    className={`flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-left transition ${
                      selectedParticipantId === participant.id
                        ? "bg-sky-500 text-white"
                        : "bg-white/5 text-slate-200 hover:bg-white/10"
                    }`}
                  >
                    <Avatar
                      name={participant.name}
                      imageUrl={participant.profileImageUrl}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">
                        {participant.name}
                      </span>
                      <span className="block truncate text-xs font-bold opacity-70">
                        {formatTunnelTimeStatus(participant.tunnelTimeStatus)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CampSettingsPanel({
  camp,
  tunnels,
  publicUrl,
  shareText,
}: {
  camp: CampWorkspace;
  tunnels: TunnelOption[];
  publicUrl: string;
  shareText: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: camp.title,
    description: camp.description,
    tunnelId: camp.tunnelId,
    startDate: camp.startDate,
    endDate: camp.endDate,
    registrationDeadline: camp.registrationDeadline ?? "",
    sessionStart: camp.sessionStart?.slice(0, 5) ?? "18:00",
    sessionEnd: camp.sessionEnd?.slice(0, 5) ?? "20:00",
    bookingMode: camp.bookingMode,
    price: String(camp.price),
    currency: camp.currency,
    totalCapacity: String(camp.totalCapacity),
    priceAppliesToMinutes: camp.priceAppliesToMinutes,
  });

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function save() {
    setMessage("");
    setError("");

    const payload: OpportunityFormInput = {
      type: camp.type,
      bookingMode: form.bookingMode as BookingMode,
      title: form.title,
      tunnelId: form.tunnelId,
      startDate: form.startDate,
      endDate: camp.type === "huck_jam" ? form.startDate : form.endDate,
      registrationDeadline: form.registrationDeadline,
      sessionStart: form.sessionStart,
      sessionEnd: form.sessionEnd,
      price: Number(form.price),
      currency: form.currency,
      totalCapacity: Number(form.totalCapacity),
      minMinutesOrHours: form.priceAppliesToMinutes,
      description: form.description,
      languages: "",
      disciplines: "",
      skillLevel: "",
    };

    startTransition(async () => {
      const result = await updateOpportunity(camp.id, payload);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage("Camp settings saved.");
      router.refresh();
    });
  }

  function publish() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await publishDraftOpportunity(camp.id);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage("Camp published.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-base font-black">
          <Settings size={17} /> Camp settings
        </h2>
        {camp.status === "draft" ? (
          <button
            type="button"
            onClick={publish}
            disabled={isPending}
            className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:bg-slate-300"
          >
            Publish
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        <DashboardField label="Camp Name">
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            className={dashboardInputClass}
          />
        </DashboardField>
        <DashboardField label="Description">
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            className={`${dashboardInputClass} h-20 py-2`}
          />
        </DashboardField>
        <DashboardField label="Tunnel">
          <select
            value={form.tunnelId}
            onChange={(event) => updateField("tunnelId", event.target.value)}
            className={dashboardInputClass}
          >
            {tunnels.map((tunnel) => (
              <option key={tunnel.id} value={tunnel.id}>
                {tunnel.name} {[tunnel.city, tunnel.country].filter(Boolean).join(", ")}
              </option>
            ))}
          </select>
        </DashboardField>
        <div className="grid grid-cols-2 gap-2">
          <DashboardField label="Start">
            <input
              type="date"
              value={form.startDate}
              onChange={(event) => updateField("startDate", event.target.value)}
              className={dashboardInputClass}
            />
          </DashboardField>
          <DashboardField label="End">
            <input
              type="date"
              value={form.endDate}
              onChange={(event) => updateField("endDate", event.target.value)}
              className={dashboardInputClass}
            />
          </DashboardField>
        </div>
        <DashboardField label="Registration Deadline">
          <input
            type="date"
            value={form.registrationDeadline}
            onChange={(event) =>
              updateField("registrationDeadline", event.target.value)
            }
            className={dashboardInputClass}
          />
        </DashboardField>
        {camp.type === "huck_jam" ? (
          <div className="grid grid-cols-2 gap-2">
            <DashboardField label="Start Time">
              <input
                type="time"
                value={form.sessionStart}
                onChange={(event) => updateField("sessionStart", event.target.value)}
                className={dashboardInputClass}
              />
            </DashboardField>
            <DashboardField label="End Time">
              <input
                type="time"
                value={form.sessionEnd}
                onChange={(event) => updateField("sessionEnd", event.target.value)}
                className={dashboardInputClass}
              />
            </DashboardField>
          </div>
        ) : null}
        <DashboardField label="Booking Mode">
          <select
            value={form.bookingMode}
            onChange={(event) => updateField("bookingMode", event.target.value)}
            className={dashboardInputClass}
          >
            <option value="approval_required">Coach approves participants</option>
            <option value="direct_time_booking">Direct booking</option>
          </select>
        </DashboardField>
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <DashboardField label="Price">
            <input
              inputMode="decimal"
              value={form.price}
              onChange={(event) => updateField("price", event.target.value)}
              className={dashboardInputClass}
            />
          </DashboardField>
          <DashboardField label="Currency">
            <select
              value={form.currency}
              onChange={(event) => updateField("currency", event.target.value)}
              className={dashboardInputClass}
            >
              {["EUR", "CHF", "USD", "PLN", "GBP"].map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </DashboardField>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DashboardField label="Capacity">
            <input
              inputMode="numeric"
              value={form.totalCapacity}
              onChange={(event) => updateField("totalCapacity", event.target.value)}
              className={dashboardInputClass}
            />
          </DashboardField>
          <DashboardField label="Price Minutes">
            <input
              inputMode="numeric"
              value={form.priceAppliesToMinutes}
              onChange={(event) =>
                updateField("priceAppliesToMinutes", event.target.value)
              }
              className={dashboardInputClass}
            />
          </DashboardField>
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-black text-white disabled:bg-slate-300"
      >
        <Save size={16} /> {isPending ? "Saving..." : "Save immediately"}
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <ShareOpportunityButton
          label="Share"
          shareText={shareText}
          url={publicUrl}
          compact
          fill
        />
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(publicUrl)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-black text-slate-700"
        >
          <Copy size={16} /> Copy Link
        </button>
      </div>
      {message ? (
        <p className="mt-2 rounded-xl bg-emerald-50 p-2 text-sm font-bold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-xl bg-rose-50 p-2 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ParticipantPanel({
  participant,
  camp,
  onClear,
}: {
  participant: Participant;
  camp: CampWorkspace;
  onClear: () => void;
}) {
  const bookedSlots = camp.timetableSlots.flatMap((slot) =>
    slot.bookings
      .filter((booking) => booking.userId === participant.userId)
      .map((booking) => ({
        id: booking.id,
        date: slot.slotDate,
        time: slot.startTime,
        minutes: booking.minutes,
      })),
  );
  const bookedMinutes = bookedSlots.reduce((total, slot) => total + slot.minutes, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            name={participant.name}
            imageUrl={participant.profileImageUrl}
            size="md"
          />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black">{participant.name}</h2>
            <p className="truncate text-sm font-bold text-slate-500">
              {participant.email || "No email"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-500"
        >
          Close
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <InfoTile label="Status" value={participant.status} />
        <InfoTile label="Booked Minutes" value={`${bookedMinutes} min`} />
        <InfoTile label="Booked Hours" value={`${(bookedMinutes / 60).toFixed(2)} h`} />
        <InfoTile
          label="Tunnel Time"
          value={formatTunnelTimeStatus(participant.tunnelTimeStatus)}
        />
      </div>
      <div className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-600">
        <p>Phone: {participant.phone || "Not provided"}</p>
        <p>Country: {participant.country || "Not provided"}</p>
        <p>
          Tunnel account email:{" "}
          {participant.tunnelAccountEmail || "Not provided"}
        </p>
      </div>
      <div className="mt-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Booked Slots
        </h3>
        <div className="mt-2 grid gap-1.5">
          {bookedSlots.length > 0 ? (
            bookedSlots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-black"
              >
                {formatTimetableDate(slot.date)} at {formatTimetableTime(slot.time)} -{" "}
                {slot.minutes} min
              </div>
            ))
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">
              No slots assigned
            </p>
          )}
        </div>
      </div>
      <div className="mt-3">
        <ApplicantStatusActions
          interestId={participant.id}
          currentStatus={participant.status}
        />
      </div>
    </section>
  );
}

function SharePanel({
  publicUrl,
  shareText,
}: {
  publicUrl: string;
  shareText: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="inline-flex items-center gap-2 text-base font-black">
        <Share2 size={17} /> Share
      </h2>
      <div className="mt-3 grid gap-2">
        <ShareOpportunityButton
          label="Athlete Link"
          shareText={shareText}
          url={publicUrl}
          compact
          fill
        />
        <Link
          href={publicUrl}
          target="_blank"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-black text-slate-700"
        >
          <ExternalLink size={16} /> Open Camp Link
        </Link>
      </div>
    </section>
  );
}

function ActivityPanel({ activity }: { activity: ActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="inline-flex items-center gap-2 text-base font-black">
        <Activity size={17} /> Activity
      </h2>
      <div className="mt-3 grid gap-2">
        {activity.length > 0 ? (
          activity.map((item) => (
            <article key={item.id} className="rounded-xl bg-slate-50 p-2">
              <p className="text-sm font-black">{item.title}</p>
              {item.body ? (
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                  {item.body}
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">
            No recent activity.
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-xl bg-white px-3 py-2 text-right shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <p className="text-[0.68rem] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black capitalize">{value}</p>
    </div>
  );
}

function DashboardField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
      {label}
      {children}
    </label>
  );
}

const dashboardInputClass =
  "min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400";

function filterSlots(slots: TimetableSlot[], range: WorkspaceRange) {
  if (range === "entire") {
    return slots;
  }

  const date = new Date();
  if (range === "tomorrow") {
    date.setDate(date.getDate() + 1);
  }
  const target = date.toISOString().slice(0, 10);

  return slots.filter((slot) => slot.slotDate === target);
}

function getAttentionItems(camp: CampWorkspace) {
  const items: Array<{ label: string; tone: string }> = [];
  const pending = camp.participants.filter((item) => item.status === "pending").length;
  const accepted = camp.participants.filter((item) => item.status === "accepted");
  const participantsWithSlots = new Set(
    camp.timetableSlots.flatMap((slot) =>
      slot.bookings.map((booking) => booking.userId),
    ),
  );
  const missingSlots = accepted.filter(
    (item) => item.userId && !participantsWithSlots.has(item.userId),
  ).length;
  const missingTunnelTime = accepted.filter(
    (item) => !item.tunnelTimeStatus,
  ).length;
  const openSlots = camp.summary.openSlots;

  if (pending > 0) {
    items.push({ label: `${pending} new applicants`, tone: "amber" });
  }
  if (missingSlots > 0) {
    items.push({ label: `${missingSlots} participants missing slots`, tone: "amber" });
  }
  if (missingTunnelTime > 0) {
    items.push({
      label: `${missingTunnelTime} participants missing tunnel time`,
      tone: "amber",
    });
  }
  if (openSlots > 0) {
    items.push({ label: `${openSlots} open slots`, tone: "slate" });
  }

  return items;
}

function getAssignableParticipants(camp: CampWorkspace): AssignSlotParticipant[] {
  const bookedMinutesByUserId = new Map<string, number>();

  for (const slot of camp.timetableSlots) {
    for (const booking of slot.bookings) {
      bookedMinutesByUserId.set(
        booking.userId,
        (bookedMinutesByUserId.get(booking.userId) ?? 0) + booking.minutes,
      );
    }
  }

  return camp.participants
    .filter((participant) => participant.status === "accepted" && participant.userId)
    .map((participant) => ({
      id: participant.userId,
      name: participant.name,
      bookedMinutes: bookedMinutesByUserId.get(participant.userId) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatTunnelTimeStatus(status: string | null) {
  if (status === "owns_tunnel_time") {
    return "Own tunnel time";
  }

  if (status === "needs_tunnel_time") {
    return "Needs tunnel time";
  }

  return "Not provided";
}
