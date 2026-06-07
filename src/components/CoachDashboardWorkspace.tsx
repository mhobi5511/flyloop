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
import {
  saveCampTimetable,
  type TimetableSlotInput,
} from "@/app/app/organizer/opportunities/actions";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import {
  AssignSlotButton,
  type AssignSlotParticipant,
} from "@/components/AssignSlotButton";
import { Avatar } from "@/components/Avatar";
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

export function CoachDashboardWorkspace({
  coachName,
  selectedCampId,
  camps,
  tunnels,
  activity,
}: CoachDashboardWorkspaceProps) {
  const router = useRouter();
  const [activeCampId, setActiveCampId] = useState(selectedCampId);
  const [range, setRange] = useState<WorkspaceRange>("entire");
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
  const visibleDays = getVisibleTimetableDays(activeCamp, visibleSlots, range);
  const participantColorMap = buildParticipantColorMap(activeCamp.participants);
  const attention = getAttentionItems(activeCamp);
  const assignableParticipants = getAssignableParticipants(activeCamp);
  const scopedActivity = activity
    .filter((item) => !item.opportunityId || item.opportunityId === activeCamp.id)
    .slice(0, 8);

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950">
      <div className="mx-auto grid max-w-[96rem] gap-4 p-3 sm:p-4 xl:p-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-stretch">
            <div className="grid content-start">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="grid size-10 place-items-center rounded-xl bg-sky-600 text-white">
                    <Plane size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">
                      Coach Operations Workspace
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      Powered by Flyloop
                    </p>
                  </div>
                </div>
                <div className="hidden items-center gap-2 text-sm font-bold text-slate-600 lg:flex">
                  <button className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Bell size={18} />
                  </button>
                  <Link
                    href="/app/profile"
                    className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <UserCircle size={19} />
                  </Link>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    <span>{activeCamp.type === "huck_jam" ? "Huck Jam" : "Camp"}</span>
                    <span>{activeCamp.status}</span>
                  </div>
                  <h1 className="mt-1 truncate text-3xl font-black tracking-tight">
                    {activeCamp.title}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                      <MapPin size={15} /> {activeCamp.tunnelName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                      <CalendarDays size={15} /> {activeCamp.dateLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                      <WalletCards size={15} />{" "}
                      {formatPrice(activeCamp.price, activeCamp.currency)}
                    </span>
                  </div>
                </div>
                <select
                  value={activeCamp.id}
                  onChange={(event) => selectCamp(event.target.value)}
                  className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 outline-none focus:border-sky-400"
                >
                  {camps.map((camp) => (
                    <option key={camp.id} value={camp.id}>
                      {camp.type === "huck_jam" ? "Huck Jam" : "Camp"} - {camp.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <StatCard label="Booked minutes" value={`${activeCamp.summary.totalBookedMinutes} min`} />
                <StatCard label="Open minutes" value={`${activeCamp.summary.totalAvailableMinutes} min`} />
                <StatCard label="Open slots" value={activeCamp.summary.openSlots} />
                <StatCard
                  label="Estimated total"
                  value={formatTimetableMoney(
                    activeCamp.summary.estimatedRevenue,
                    activeCamp.currency,
                  )}
                />
              </div>
            </div>
            <div className="grid h-full content-between gap-3 rounded-xl bg-slate-950 px-4 py-3 text-white">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-200">
                  Coach
                </p>
                <p className="text-lg font-black">{coachName}</p>
              </div>
              <div className="grid gap-2 border-t border-white/10 pt-3">
                <Link
                  href="/app/create"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 text-sm font-black text-white transition hover:bg-sky-600"
                >
                  <Plus size={16} /> New Camp
                </Link>
                <Link
                  href="/app/create"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  <Plus size={16} /> New Huck Jam
                </Link>
              </div>
            </div>
          </div>
        </header>

      <main className="hidden gap-4 md:grid">
        <section className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
          <aside className="grid content-start gap-3">
            <RangeControl range={range} onRangeChange={setRange} />
            <AttentionPanel items={attention} />
            <ParticipantColumns
              participants={activeCamp.participants}
              selectedParticipantId={selectedParticipantId}
              onSelectParticipant={setSelectedParticipantId}
              participantColorMap={participantColorMap}
            />
          </aside>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-tight">Live Timetable</h2>
                <p className="mt-0.5 text-sm font-bold text-slate-500">
                  Days side by side, slots chronological, actions in context.
                </p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto pb-2">
              <div
                className="grid min-h-[32rem] gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(visibleDays.length, 1)}, minmax(16rem, 1fr))`,
                }}
              >
                {visibleDays.map((day) => (
                  <section
                    key={day.date}
                    className="min-w-0 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <div className="border-b border-slate-200 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-black text-slate-950">
                            {formatLongDay(day.date)}
                          </h3>
                          <p className="text-xs font-bold text-slate-500">
                            {day.slots.length} slots
                          </p>
                        </div>
                        {activeCamp.type === "camp" ? (
                          <AddSlotButton
                            camp={activeCamp}
                            date={day.date}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-2 p-2">
                      {day.slots.length > 0 ? (
                        day.slots.map((slot) => {
                          const isFull = slot.bookings.length >= slot.capacity;

                          return (
                            <article
                              key={slot.id}
                              className={`relative rounded-lg border bg-white p-2 ${
                                isFull
                                  ? "border-emerald-200"
                                  : "border-slate-200"
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="inline-flex items-center gap-1.5 text-sm font-black">
                                  <Clock3 size={15} className="text-sky-700" />
                                  {formatTimetableTime(slot.startTime)}
                                </p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black ${
                                    isFull
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {slot.bookings.length}/{slot.capacity}
                                </span>
                              </div>
                              <div className="grid gap-1">
                                {slot.bookings.map((booking) => {
                                  const colors = participantColorMap.get(booking.userId);

                                  return (
                                    <div
                                      key={booking.id}
                                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md px-2.5 py-2 text-white shadow-sm"
                                      style={{ backgroundColor: colors?.bg }}
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
                                        <span className="block truncate text-sm font-black">
                                          {booking.athleteName}
                                        </span>
                                        <span className="text-xs font-bold text-white/80">
                                          {booking.minutes} min
                                        </span>
                                      </button>
                                      <ReleaseSlotBookingButton
                                        opportunityId={activeCamp.id}
                                        bookingId={booking.id}
                                      />
                                    </div>
                                  );
                                })}
                                {Array.from({
                                  length: Math.max(
                                    slot.capacity - slot.bookings.length,
                                    0,
                                  ),
                                }).map((_, index) => (
                                  <div
                                    key={`${slot.id}-open-${index}`}
                                    className="grid gap-2 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-2"
                                  >
                                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
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
                          );
                        })
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center">
                          <p className="text-sm font-black text-slate-500">
                            No slots yet
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </section>

          <aside className="grid min-w-0 content-start gap-3">
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
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onRangeChange(option.value)}
          className={`h-9 rounded-xl text-xs font-black transition ${
            range === option.value
              ? "bg-slate-950 text-white"
              : "text-slate-500 hover:bg-slate-50"
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
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
        Needs attention
      </h2>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-amber-900"
            >
              {item.label}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
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
  participantColorMap,
}: {
  participants: Participant[];
  selectedParticipantId: string;
  onSelectParticipant: (id: string) => void;
  participantColorMap: Map<string, (typeof participantColors)[number]>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3">
        {statusColumns.map((column) => {
          const columnParticipants = participants.filter(
            (participant) => participant.status === column.status,
          );

          return (
            <div key={column.status}>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  {column.label}
                </h2>
                <span className="text-xs font-black text-slate-400">
                  {columnParticipants.length}
                </span>
              </div>
              <div className="mt-2 grid gap-1.5">
                {columnParticipants.map((participant) => {
                  const colors = participantColorMap.get(participant.userId);

                  return (
                    <button
                      key={participant.id}
                      type="button"
                      onClick={() => onSelectParticipant(participant.id)}
                      className={`grid min-w-0 rounded-xl border px-2 py-2 text-left transition ${
                        selectedParticipantId === participant.id
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: colors?.bg ?? "#cbd5e1" }}
                        />
                        <span className="truncate text-sm font-black text-slate-950">
                          {participant.name}
                        </span>
                      </span>
                      <span className="truncate pl-5 text-xs font-bold text-slate-500">
                        {formatTunnelTimeStatus(participant.tunnelTimeStatus)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AddSlotButton({
  camp,
  date,
}: {
  camp: CampWorkspace;
  date: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [startTime, setStartTime] = useState("15:00");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [capacity, setCapacity] = useState(2);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    setError("");

    const existingSlots: TimetableSlotInput[] = camp.timetableSlots.map((slot) => ({
      id: slot.id,
      slotDate: slot.slotDate,
      startTime: slot.startTime.slice(0, 5),
      durationMinutes: slot.durationMinutes,
      capacity: slot.capacity,
    }));
    const nextSlots: TimetableSlotInput[] = [
      ...existingSlots,
      {
        slotDate: date,
        startTime,
        durationMinutes,
        capacity,
      },
    ];

    startTransition(async () => {
      const result = await saveCampTimetable(camp.id, nextSlots, false);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 text-xs font-black text-white transition hover:bg-sky-700"
      >
        <Plus size={14} /> Add Slot
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                {formatLongDay(date)}
              </p>
              <h3 className="mt-1 text-lg font-black tracking-tight">
                Add Slot
              </h3>
            </div>
            <div className="mt-4 grid gap-3">
              <DashboardField label="Time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className={dashboardInputClass}
                />
              </DashboardField>
              <DashboardField label="Duration">
                <select
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                  className={dashboardInputClass}
                >
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </DashboardField>
              <DashboardField label="Capacity">
                <input
                  inputMode="numeric"
                  value={capacity}
                  onChange={(event) =>
                    setCapacity(Math.max(1, Number(event.target.value) || 1))
                  }
                  className={dashboardInputClass}
                />
              </DashboardField>
            </div>
            {error ? (
              <p className="mt-3 rounded-xl bg-rose-50 p-2 text-sm font-bold text-rose-700">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white disabled:bg-slate-300"
              >
                <Save size={16} /> {isPending ? "Saving..." : "Save Slot"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
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

function getVisibleTimetableDays(
  camp: CampWorkspace,
  slots: TimetableSlot[],
  range: WorkspaceRange,
) {
  const slotsByDate = new Map(
    groupTimetableSlotsByDay(slots).map((day) => [day.date, day.slots]),
  );
  const dates =
    range === "entire"
      ? getDateRange(camp.startDate, camp.endDate)
      : [getRangeDate(range)];

  return dates.map((date) => ({
    date,
    slots: (slotsByDate.get(date) ?? []).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    ),
  }));
}

function getRangeDate(range: Exclude<WorkspaceRange, "entire">) {
  const date = new Date();
  if (range === "tomorrow") {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString().slice(0, 10);
}

function getDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate || startDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  for (
    const date = new Date(start);
    date.getTime() <= end.getTime();
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    dates.push(date.toISOString().slice(0, 10));
  }

  return dates;
}

function buildParticipantColorMap(participants: Participant[]) {
  const map = new Map<string, (typeof participantColors)[number]>();
  participants
    .filter((participant) => participant.status === "accepted" && participant.userId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((participant, index) => {
      map.set(participant.userId, participantColors[index % participantColors.length]);
    });

  return map;
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

function formatLongDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
