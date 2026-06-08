"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Settings,
  Share2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  publishDraftOpportunity,
  updateOpportunity,
  type OpportunityFormInput,
} from "@/app/app/create/actions";
import { deleteOpportunity } from "@/app/app/opportunities/actions";
import {
  sendCoachDashboardSlotReminder,
  saveCampTimetable,
  type TimetableSlotInput,
} from "@/app/app/organizer/opportunities/actions";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import {
  AssignSlotButton,
  type AssignSlotParticipant,
} from "@/components/AssignSlotButton";
import { Avatar } from "@/components/Avatar";
import {
  CreateOpportunityForm,
  type InheritedCoachProfile,
} from "@/components/CreateOpportunityForm";
import { ReleaseSlotBookingButton } from "@/components/ReleaseSlotBookingButton";
import { NotificationCountBadge } from "@/components/NotificationCountBadge";
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
  tunnelDashboardUrl: string;
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

type HeaderPanel = "share" | "activity" | null;
type TabletPanel = "participants" | "participant" | null;
type CreationType = OpportunityType | null;
type AttentionItem = {
  label: string;
  tone: "amber" | "slate";
  target: "applicants" | "participant" | "timetable";
  count: number;
  participantId?: string;
};

type CoachDashboardWorkspaceProps = {
  coachName: string;
  selectedCampId: string;
  camps: CampWorkspace[];
  tunnels: TunnelOption[];
  inheritedCoachProfile?: InheritedCoachProfile;
  activity: ActivityItem[];
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

export function CoachDashboardWorkspace({
  coachName,
  selectedCampId,
  camps,
  tunnels,
  inheritedCoachProfile,
  activity,
}: CoachDashboardWorkspaceProps) {
  const router = useRouter();
  const [activeCampId, setActiveCampId] = useState(selectedCampId);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [headerPanel, setHeaderPanel] = useState<HeaderPanel>(null);
  const [tabletPanel, setTabletPanel] = useState<TabletPanel>(null);
  const [creationType, setCreationType] = useState<CreationType>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [desktopDayStart, setDesktopDayStart] = useState(0);
  const [activeBookingActionId, setActiveBookingActionId] = useState("");
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
    setHeaderPanel(null);
    setTabletPanel(null);
    setDesktopDayStart(0);
    router.replace(`/app/coach-dashboard?camp=${campId}`, { scroll: false });
  }

  function focusApplicants() {
    setSelectedParticipantId("");
    setIsSidebarCollapsed(false);
    setTabletPanel("participants");
  }

  function handleOpportunityCreated(opportunityId: string) {
    setCreationType(null);
    setActiveCampId(opportunityId);
    setSelectedParticipantId("");
    setHeaderPanel(null);
    setTabletPanel(null);
    setDesktopDayStart(0);
    router.replace(`/app/coach-dashboard?camp=${opportunityId}`, { scroll: false });
    router.refresh();
  }

  function handleAttentionClick(item: AttentionItem) {
    if (item.target === "applicants") {
      focusApplicants();
      return;
    }

    if (item.target === "participant" && item.participantId) {
      setSelectedParticipantId(item.participantId);
      setIsSidebarCollapsed(false);
      setTabletPanel("participant");
      return;
    }

    setTabletPanel(null);
    document
      .getElementById("coach-live-timetable")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!activeCamp) {
    return (
      <div className="min-h-dvh bg-slate-100 p-6 text-slate-950">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-700">
            Coach Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-black">No workspaces yet</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Create your first Camp or Huck Jam to start running your coaching
            workspace.
          </p>
          <button
            type="button"
            onClick={() => setCreationType("camp")}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-black text-white"
          >
            <Plus size={17} /> New Camp
          </button>
        </div>
        {creationType ? (
          <CreationPanel
            type={creationType}
            tunnels={tunnels}
            inheritedCoachProfile={inheritedCoachProfile}
            organizerName={coachName}
            onCancel={() => setCreationType(null)}
            onSuccess={handleOpportunityCreated}
          />
        ) : null}
      </div>
    );
  }

  const visibleDays = getVisibleTimetableDays(activeCamp, activeCamp.timetableSlots);
  const desktopDayCount = isSidebarCollapsed ? 5 : 4;
  const clampedDesktopDayStart = Math.min(
    desktopDayStart,
    Math.max(visibleDays.length - desktopDayCount, 0),
  );
  const desktopDays = visibleDays.slice(
    clampedDesktopDayStart,
    clampedDesktopDayStart + desktopDayCount,
  );
  const canPageBack = clampedDesktopDayStart > 0;
  const canPageForward = clampedDesktopDayStart + desktopDayCount < visibleDays.length;
  const participantColorMap = buildParticipantColorMap(activeCamp.participants);
  const attention = getAttentionItems(activeCamp);
  const activityBadgeCount = getActivityBadgeCount(attention);
  const assignableParticipants = getAssignableParticipants(activeCamp);
  const scopedActivity = activity
    .filter((item) => !item.opportunityId || item.opportunityId === activeCamp.id);

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950">
      <div className="mx-auto grid max-w-[96rem] gap-4 p-3 sm:p-4 xl:p-5">
        <header className="hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 xl:block">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-stretch">
            <div className="grid content-start">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Image
                    src="/flyloop-icon-192.png"
                    alt="Flyloop"
                    width={40}
                    height={40}
                    className="size-10 rounded-xl"
                  />
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">
                      Coach Operations Workspace
                    </p>
                    <p className="text-sm font-bold text-slate-500">
                      Powered by Flyloop
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
                <div className="min-w-0">
                  <h1 className="truncate text-3xl font-black tracking-tight">
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
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-sky-700">
                  Active workspace
                  <select
                    value={activeCamp.id}
                    onChange={(event) => selectCamp(event.target.value)}
                    className="h-11 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-black normal-case tracking-normal text-slate-950 outline-none focus:border-sky-400"
                  >
                    {camps.map((camp) => (
                      <option key={camp.id} value={camp.id}>
                        {camp.type === "huck_jam" ? "Huck Jam" : "Camp"} - {camp.title}
                      </option>
                    ))}
                  </select>
                </label>
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
            <div className="relative grid h-full content-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950">
              <div className="grid gap-1.5">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                  Utilities
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHeaderPanel((current) =>
                        current === "share" ? null : "share",
                      )
                    }
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    <Share2 size={17} /> Share
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHeaderPanel((current) =>
                        current === "activity" ? null : "activity",
                      )
                    }
                    className="relative inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    <Activity size={17} /> Activity
                    {headerPanel !== "activity" && activityBadgeCount > 0 ? (
                      <NotificationCountBadge
                        count={activityBadgeCount}
                        className="right-0 top-0 translate-x-1/2 -translate-y-1/2"
                      />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    <Settings size={17} /> Settings
                  </button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                  Create
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreationType("camp")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white transition hover:bg-sky-700"
                  >
                    <Plus size={17} /> New Camp
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationType("huck_jam")}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white transition hover:bg-sky-700"
                  >
                    <Plus size={17} /> New Huck Jam
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <header className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:flex xl:hidden">
          <button
            type="button"
            onClick={() => setTabletPanel("participants")}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700"
            aria-label="Open participant sidebar"
          >
            <Menu size={19} />
          </button>
          <select
            value={activeCamp.id}
            onChange={(event) => selectCamp(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 outline-none focus:border-sky-400"
          >
            {camps.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {camp.type === "huck_jam" ? "Huck Jam" : "Camp"} - {camp.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              setHeaderPanel((current) => (current === "share" ? null : "share"))
            }
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700"
          >
            <Share2 size={16} /> Share
          </button>
          <button
            type="button"
            onClick={() =>
              setHeaderPanel((current) =>
                current === "activity" ? null : "activity",
              )
            }
            className="relative inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700"
          >
            <Activity size={16} /> Activity
            {headerPanel !== "activity" && activityBadgeCount > 0 ? (
              <NotificationCountBadge
                count={activityBadgeCount}
                className="right-0 top-0 translate-x-1/2 -translate-y-1/2"
              />
            ) : null}
          </button>
        </header>

      <div id="coach-live-timetable" className="hidden md:block" />
      <main className="hidden gap-4 xl:grid">
        <section
          className={`grid items-start gap-4 ${
            isSidebarCollapsed
              ? "xl:grid-cols-[3.25rem_minmax(0,1fr)]"
              : "xl:grid-cols-[19rem_minmax(0,1fr)]"
          }`}
        >
          <aside className="grid content-start gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <>
                  <PanelLeftClose size={18} />
                  <span>Collapse sidebar</span>
                </>
              )}
            </button>
            {isSidebarCollapsed ? (
              <div className="grid justify-items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-center shadow-sm">
                <p className="[writing-mode:vertical-rl] text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Participants
                </p>
                <p className="[writing-mode:vertical-rl] text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {activeCamp.participants.length} total
                </p>
              </div>
            ) : (
              <>
                <ParticipantColumns
                  participants={activeCamp.participants}
                  selectedParticipantId={selectedParticipantId}
                  onSelectParticipant={setSelectedParticipantId}
                  onSelectApplicants={focusApplicants}
                  participantColorMap={participantColorMap}
                />
                {participant ? (
                  <ParticipantPanel
                    participant={participant}
                    camp={activeCamp}
                    onClear={() => setSelectedParticipantId("")}
                  />
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-sm font-bold text-slate-500">
                      Select a participant to see details and booked slots.
                    </p>
                  </section>
                )}
              </>
            )}
          </aside>

          <div className="grid min-w-0 gap-4">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <h2 className="shrink-0 text-xl font-black tracking-tight">Schedule</h2>
                  <p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                    {visibleDays.length > desktopDays.length
                      ? `${clampedDesktopDayStart + 1}-${clampedDesktopDayStart + desktopDays.length} days of ${visibleDays.length} days`
                      : `${visibleDays.length} day${visibleDays.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDesktopDayStart((current) => Math.max(current - 1, 0))
                    }
                    disabled={!canPageBack}
                    className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label="Previous day"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDesktopDayStart((current) =>
                        Math.min(
                          current + 1,
                          Math.max(visibleDays.length - desktopDayCount, 0),
                        ),
                      )
                    }
                    disabled={!canPageForward}
                    className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                    aria-label="Next day"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </div>
            <div className="pb-2">
              <div
                className="grid min-h-[34rem] gap-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(desktopDays.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                {desktopDays.map((day) => (
                  <section
                    key={day.date}
                    className="min-w-0 rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
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
                          const isSelectedSlot = slot.bookings.some(
                            (booking) => booking.id === activeBookingActionId,
                          );

                          return (
                            <article
                              key={slot.id}
                              className={`relative rounded-xl border bg-white p-2 shadow-sm transition ${
                                isSelectedSlot
                                  ? "border-sky-300 bg-sky-50/60 ring-2 ring-sky-100"
                                  : isFull
                                  ? "border-emerald-200"
                                  : "border-slate-200"
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                                <p className="inline-flex items-center gap-1.5 text-base font-black text-slate-950">
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
                                  const matchingParticipant = activeCamp.participants.find(
                                    (item) => item.userId === booking.userId,
                                  );

                                  return (
                                    <div key={booking.id} className="relative">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveBookingActionId((current) =>
                                            current === booking.id ? "" : booking.id,
                                          )
                                        }
                                        className="grid w-full rounded-md border-l-4 px-2.5 py-2 text-left shadow-sm"
                                        style={{
                                          backgroundColor: colors?.soft,
                                          borderColor: colors?.bg,
                                          color: colors?.text,
                                        }}
                                      >
                                        <span className="block truncate text-sm font-black">
                                          {booking.athleteName}
                                        </span>
                                        <span className="text-xs font-bold opacity-80">
                                          {booking.minutes} min
                                        </span>
                                      </button>
                                      {activeBookingActionId === booking.id ? (
                                        <>
                                          <button
                                            type="button"
                                            className="fixed inset-0 z-10 cursor-default"
                                            aria-label="Close slot actions"
                                            onClick={() => setActiveBookingActionId("")}
                                          />
                                          <div className="absolute left-0 top-[calc(100%+0.25rem)] z-20 grid w-56 gap-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-950 shadow-xl">
                                            <p className="px-2 pb-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-400">
                                              Slot actions
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (matchingParticipant) {
                                                  setSelectedParticipantId(matchingParticipant.id);
                                                  setIsSidebarCollapsed(false);
                                                }
                                                setActiveBookingActionId("");
                                              }}
                                              className="inline-flex h-9 items-center gap-2 rounded-lg px-2 text-left text-xs font-black text-slate-700 hover:bg-slate-50"
                                            >
                                              <UserRound size={15} className="text-sky-700" />
                                              Show Participant Info
                                            </button>
                                            <ReleaseSlotBookingButton
                                              opportunityId={activeCamp.id}
                                              bookingId={booking.id}
                                            />
                                          </div>
                                        </>
                                      ) : null}
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

          </div>
        </section>
      </main>

      <main className="hidden gap-3 md:grid xl:hidden">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black tracking-tight">Schedule</h2>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                {activeCamp.dateLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTabletPanel("participants")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700"
            >
              <Menu size={15} /> Participants
            </button>
          </div>
          <div className="mt-3 overflow-x-auto pb-2">
            <div
              className="grid min-h-[34rem] gap-3"
              style={{
                gridTemplateColumns: `repeat(${Math.max(visibleDays.length, 1)}, minmax(14rem, 1fr))`,
              }}
            >
              {visibleDays.map((day) => (
                <section
                  key={day.date}
                  className="min-w-0 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2">
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
                        <AddSlotButton camp={activeCamp} date={day.date} />
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
                              isFull ? "border-emerald-200" : "border-slate-200"
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
                                  <button
                                    key={booking.id}
                                    type="button"
                                    onClick={() => {
                                      const match = activeCamp.participants.find(
                                        (item) => item.userId === booking.userId,
                                      );
                                      if (match) {
                                        setSelectedParticipantId(match.id);
                                        setTabletPanel("participant");
                                      }
                                    }}
                                    className="grid rounded-md px-2.5 py-2 text-left text-white shadow-sm"
                                    style={{ backgroundColor: colors?.bg }}
                                  >
                                    <span className="block truncate text-sm font-black">
                                      {booking.athleteName}
                                    </span>
                                    <span className="text-xs font-bold text-white/80">
                                      {booking.minutes} min
                                    </span>
                                  </button>
                                );
                              })}
                              {Array.from({
                                length: Math.max(slot.capacity - slot.bookings.length, 0),
                              }).map((_, index) => (
                                <div
                                  key={`${slot.id}-tablet-open-${index}`}
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
        <CampSettingsPanel
          key={`tablet-${activeCamp.id}`}
          camp={activeCamp}
          tunnels={tunnels}
        />
      </main>

      {tabletPanel ? (
        <TabletSlideOver
          title={tabletPanel === "participant" ? "Participant" : "Participants"}
          onClose={() => setTabletPanel(null)}
        >
          {tabletPanel === "participant" && participant ? (
            <ParticipantPanel
              participant={participant}
              camp={activeCamp}
              onClear={() => {
                setSelectedParticipantId("");
                setTabletPanel("participants");
              }}
            />
          ) : (
            <div className="grid gap-3">
              <AttentionPanel items={attention} onAction={handleAttentionClick} />
              <ParticipantColumns
                participants={activeCamp.participants}
                selectedParticipantId={selectedParticipantId}
                onSelectParticipant={(id) => {
                  setSelectedParticipantId(id);
                  setTabletPanel("participant");
                }}
                onSelectApplicants={focusApplicants}
                participantColorMap={participantColorMap}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTabletPanel(null);
                    setCreationType("camp");
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white"
                >
                  <Plus size={16} /> New Camp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTabletPanel(null);
                    setCreationType("huck_jam");
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700"
                >
                  <Plus size={16} /> Huck Jam
                </button>
              </div>
            </div>
          )}
        </TabletSlideOver>
      ) : null}

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
      {creationType ? (
        <CreationPanel
          type={creationType}
          tunnels={tunnels}
          inheritedCoachProfile={inheritedCoachProfile}
          organizerName={coachName}
          onCancel={() => setCreationType(null)}
          onSuccess={handleOpportunityCreated}
        />
      ) : null}
      {headerPanel === "share" ? (
        <CenteredModal title="Share" onClose={() => setHeaderPanel(null)}>
          <SharePanel
            publicUrl={publicUrl}
            shareText={shareText}
            tunnelDashboardUrl={activeCamp.tunnelDashboardUrl}
          />
        </CenteredModal>
      ) : null}
      {headerPanel === "activity" ? (
        <CenteredModal title="Activity" onClose={() => setHeaderPanel(null)}>
          <ActivityPanel activity={scopedActivity} />
        </CenteredModal>
      ) : null}
      {isSettingsOpen ? (
        <CenteredModal title="Camp Settings" onClose={() => setIsSettingsOpen(false)}>
          <CampSettingsPanel
            key={`modal-${activeCamp.id}`}
            camp={activeCamp}
            tunnels={tunnels}
            onDeleteComplete={() => setIsSettingsOpen(false)}
          />
        </CenteredModal>
      ) : null}
      </div>
    </div>
  );
}

function CenteredModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <section
        className="grid max-h-[calc(100dvh-2rem)] w-full max-w-xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-black tracking-tight">
            {title === "Camp Settings" ? <Settings size={18} /> : null}
            {title === "Share" ? <Share2 size={18} /> : null}
            {title === "Activity" ? <Activity size={18} /> : null}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
            aria-label="Close settings"
          >
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </section>
    </div>
  );
}

function CreationPanel({
  type,
  tunnels,
  inheritedCoachProfile,
  organizerName,
  onCancel,
  onSuccess,
}: {
  type: OpportunityType;
  tunnels: TunnelOption[];
  inheritedCoachProfile?: InheritedCoachProfile;
  organizerName: string;
  onCancel: () => void;
  onSuccess: (opportunityId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid bg-slate-950/40 p-3 md:place-items-center md:p-5">
      <section className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:max-h-[calc(100dvh-2.5rem)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
              Create inside Coach Dashboard
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight">
              New {type === "huck_jam" ? "Huck Jam" : "Camp"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            aria-label="Close creation panel"
          >
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">
          <CreateOpportunityForm
            tunnels={tunnels.map((tunnel) => ({
              id: tunnel.id,
              name: tunnel.name,
              city: tunnel.city ?? "",
              country: tunnel.country ?? "",
            }))}
            inheritedCoachProfile={inheritedCoachProfile}
            organizerName={organizerName}
            initialType={type}
            onCancel={onCancel}
            onSuccess={onSuccess}
          />
        </div>
      </section>
    </div>
  );
}

function TabletSlideOver({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/30 xl:hidden">
      <aside className="ml-auto grid h-full w-[min(26rem,92vw)] grid-rows-[auto_minmax(0,1fr)] border-l border-slate-200 bg-slate-100 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="text-lg font-black tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
            aria-label="Close tablet panel"
          >
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </aside>
    </div>
  );
}

function AttentionPanel({
  items,
  onAction,
}: {
  items: AttentionItem[];
  onAction: (item: AttentionItem) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Needs attention
        </h2>
        {items.length > 0 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-800">
            {items.length}
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid gap-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAction(item)}
              className={`flex min-h-9 items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left text-sm font-black transition ${
                item.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 text-xs opacity-70">
                {item.target === "timetable" ? "View" : "Open"}
              </span>
            </button>
          ))
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-black text-emerald-700">
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
  onSelectApplicants,
  participantColorMap,
}: {
  participants: Participant[];
  selectedParticipantId: string;
  onSelectParticipant: (id: string) => void;
  onSelectApplicants: () => void;
  participantColorMap: Map<string, (typeof participantColors)[number]>;
}) {
  const pending = participants.filter((participant) => participant.status === "pending");
  const accepted = participants.filter((participant) => participant.status === "accepted");
  const waitlist = participants.filter((participant) => participant.status === "waitlist");
  const statusColumns: Array<{
    status: InterestStatus;
    label: string;
    participants: Participant[];
  }> = [
    ...(pending.length > 0
      ? [
          {
            status: "pending" as InterestStatus,
            label: `Applicants (${pending.length})`,
            participants: pending,
          },
        ]
      : []),
    { status: "accepted", label: "Participants", participants: accepted },
    ...(waitlist.length > 0
      ? [{ status: "waitlist" as InterestStatus, label: "Waitlist", participants: waitlist }]
      : []),
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3">
        {statusColumns.map((column) => {
          return (
            <div key={column.status}>
              {column.status === "pending" ? (
                <button
                  type="button"
                  onClick={onSelectApplicants}
                  className="flex w-full items-center justify-between text-left"
                >
                  <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {column.label}
                  </h2>
                </button>
              ) : (
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {column.label}
                  </h2>
                  <span className="text-xs font-black text-slate-400">
                    {column.participants.length}
                  </span>
                </div>
              )}
              <div className="mt-2 grid gap-1.5">
                {column.participants.map((participant) => {
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
                {column.participants.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-2 py-2 text-sm font-bold text-slate-400">
                    No accepted participants yet
                  </p>
                ) : null}
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
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const capacity = getSlotCapacity(durationMinutes);

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
      const result = await saveCampTimetable(camp.id, nextSlots, true, {
        redirectOnPublish: false,
      });

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
      {isOpen && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4">
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
                </select>
              </DashboardField>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                  Capacity
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {capacity} athletes
                </p>
              </div>
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
        </div>,
        document.body,
      )
        : null}
    </>
  );
}

function CampSettingsPanel({
  camp,
  tunnels,
  onDeleteComplete,
}: {
  camp: CampWorkspace;
  tunnels: TunnelOption[];
  onDeleteComplete?: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
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

  function openDeleteConfirm() {
    setDeleteError("");
    setIsDeleteConfirmOpen(true);
  }

  function closeDeleteConfirm() {
    if (isPending) {
      return;
    }

    setDeleteError("");
    setIsDeleteConfirmOpen(false);
  }

  function deleteCamp() {
    setDeleteError("");

    startTransition(async () => {
      const result = await deleteOpportunity(camp.id);

      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }

      setIsDeleteConfirmOpen(false);
      onDeleteComplete?.();
      router.replace("/app/coach-dashboard");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      {camp.status === "draft" ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={publish}
            disabled={isPending}
            className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:bg-slate-300"
          >
            Publish
          </button>
        </div>
      ) : null}
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
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-black text-white disabled:bg-slate-300"
        >
          <Save size={16} /> {isPending ? "Saving..." : "Save immediately"}
        </button>
        <button
          type="button"
          onClick={openDeleteConfirm}
          disabled={isPending}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
        >
          Delete Camp
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
      {isDeleteConfirmOpen ? (
        <CenteredModal title="Delete Camp?" onClose={closeDeleteConfirm}>
          <div className="grid gap-4">
            <p className="text-sm font-semibold leading-6 text-slate-600">
              This action cannot be undone.
            </p>
            {deleteError ? (
              <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
                {deleteError}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteCamp}
                disabled={isPending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-700 disabled:bg-slate-300"
              >
                {isPending ? "Deleting..." : "Delete Camp"}
              </button>
            </div>
          </div>
        </CenteredModal>
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
  const bookedSlotsByDay = groupBookedSlotsByDay(bookedSlots);

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
        <InfoTile label="Booked Hours" value={formatDuration(bookedMinutes)} />
        <InfoTile
          label="Tunnel Time"
          value={formatTunnelTimeAvailability(participant.tunnelTimeStatus)}
        />
      </div>
      <div className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-600">
        <p>Phone: {participant.phone || "Not provided"}</p>
        <p>Country: {participant.country || "Not provided"}</p>
        <p>{formatTunnelTimeAvailability(participant.tunnelTimeStatus)}</p>
      </div>
      <div className="mt-3">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Booked Slots
        </h3>
        <div className="mt-2 grid gap-1.5">
          {bookedSlotsByDay.length > 0 ? (
            bookedSlotsByDay.map((day) => (
              <section key={day.date} className="rounded-xl bg-slate-50 p-2.5">
                <h4 className="text-sm font-black text-slate-950">
                  {formatTimetableDate(day.date)}
                </h4>
                <div className="mt-1 grid gap-0.5">
                  {day.slots.map((slot) => (
                    <p
                      key={slot.id}
                      className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-700"
                    >
                      {formatTimetableTime(slot.time)} - {slot.minutes} min
                    </p>
                  ))}
                </div>
              </section>
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
      {participant.status === "accepted" &&
      bookedSlots.length === 0 &&
      participant.userId ? (
        <div className="mt-2">
          <ParticipantSlotReminderButton
            opportunityId={camp.id}
            participantId={participant.userId}
          />
        </div>
      ) : null}
    </section>
  );
}

function ParticipantSlotReminderButton({
  opportunityId,
  participantId,
}: {
  opportunityId: string;
  participantId: string;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function sendReminder() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await sendCoachDashboardSlotReminder(
        opportunityId,
        participantId,
      );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
    });
  }

  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        onClick={sendReminder}
        disabled={isPending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 text-sm font-black text-amber-800 transition hover:bg-amber-100 disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-400"
      >
        <Clock3 size={16} />
        {isPending ? "Sending..." : "Send reminder"}
      </button>
      {message ? (
        <p className="text-center text-xs font-bold text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="text-center text-xs font-bold text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}

function SharePanel({
  publicUrl,
  shareText,
  tunnelDashboardUrl = "",
}: {
  publicUrl: string;
  shareText: string;
  tunnelDashboardUrl?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-2">
        <ShareOpportunityButton
          label="Invite Athlete"
          shareText={shareText}
          url={publicUrl}
          compact
          fill
        />
        {tunnelDashboardUrl ? (
          <ShareOpportunityButton
            label="Tunnel Operations Dashboard"
            shareText={tunnelDashboardUrl}
            url={tunnelDashboardUrl}
            compact
            fill
          />
        ) : null}
      </div>
    </section>
  );
}

function ActivityPanel({ activity }: { activity: ActivityItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-2">
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

function getSlotCapacity(durationMinutes: number) {
  return durationMinutes === 10 ? 3 : 2;
}

function getVisibleTimetableDays(
  camp: CampWorkspace,
  slots: TimetableSlot[],
) {
  const slotsByDate = new Map(
    groupTimetableSlotsByDay(slots).map((day) => [day.date, day.slots]),
  );
  const dates = getDateRange(camp.startDate, camp.endDate);

  return dates.map((date) => ({
    date,
    slots: (slotsByDate.get(date) ?? []).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    ),
  }));
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

function groupBookedSlotsByDay<T extends { date: string; time: string }>(
  slots: T[],
) {
  const groups = new Map<string, T[]>();

  for (const slot of slots) {
    const daySlots = groups.get(slot.date) ?? [];
    daySlots.push(slot);
    groups.set(slot.date, daySlots);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots.sort((a, b) => a.time.localeCompare(b.time)),
    }));
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
  const items: AttentionItem[] = [];
  const pendingParticipants = camp.participants.filter(
    (item) => item.status === "pending",
  );
  const accepted = camp.participants.filter((item) => item.status === "accepted");
  const participantsWithSlots = new Set(
    camp.timetableSlots.flatMap((slot) =>
      slot.bookings.map((booking) => booking.userId),
    ),
  );
  const participantsMissingSlots = accepted.filter(
    (item) => item.userId && !participantsWithSlots.has(item.userId),
  );
  const participantsMissingTunnelTime = accepted.filter(
    (item) => !item.tunnelTimeStatus,
  );
  const waitlistParticipants = camp.participants.filter(
    (item) => item.status === "waitlist",
  );
  const openSlots = camp.summary.openSlots;

  if (pendingParticipants.length > 0) {
    items.push({
      label: `${pendingParticipants.length} new applicants`,
      tone: "amber",
      target: "applicants",
      count: pendingParticipants.length,
      participantId: pendingParticipants[0]?.id,
    });
  }
  if (participantsMissingSlots.length > 0) {
    items.push({
      label: `${participantsMissingSlots.length} participants missing slots`,
      tone: "amber",
      target: "participant",
      count: participantsMissingSlots.length,
      participantId: participantsMissingSlots[0]?.id,
    });
  }
  if (participantsMissingTunnelTime.length > 0) {
    items.push({
      label: `${participantsMissingTunnelTime.length} participants missing tunnel time`,
      tone: "amber",
      target: "participant",
      count: participantsMissingTunnelTime.length,
      participantId: participantsMissingTunnelTime[0]?.id,
    });
  }
  if (openSlots > 0) {
    items.push({
      label: `${openSlots} open slots`,
      tone: "slate",
      target: "timetable",
      count: openSlots,
    });
  }
  if (waitlistParticipants.length > 0) {
    items.push({
      label: `${waitlistParticipants.length} waitlist items`,
      tone: "slate",
      target: "participant",
      count: waitlistParticipants.length,
      participantId: waitlistParticipants[0]?.id,
    });
  }

  return items;
}

function getActivityBadgeCount(attention: AttentionItem[]) {
  return attention.reduce((total, item) => total + item.count, 0);
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

function formatTunnelTimeAvailability(status: string | null) {
  if (status === "owns_tunnel_time") {
    return "✓ Own tunnel time available";
  }

  return "✕ Tunnel time still required";
}

function formatDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder} min`;
  }

  if (remainder === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainder} min`;
}

function formatLongDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
