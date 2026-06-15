"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
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
  Send,
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
import { SlotReleaseRequestActions } from "@/components/SlotReleaseRequestActions";
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
import {
  formatCampDayPreferenceLabel,
  formatCampPreferenceMinutes,
} from "@/lib/camp-days";
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
  preferences: CampPreference[];
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

type CampPreference = {
  opportunityId: string;
  participantId: string;
  dayId: number;
  preferredMinutes: number;
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

type SlotActionPopoverState = {
  bookingId: string;
  top: number;
  left: number;
  placement: "bottom" | "top";
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
  const [activeBookingAction, setActiveBookingAction] =
    useState<SlotActionPopoverState | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [lastSeenActivityCount, setLastSeenActivityCount] = useState(0);
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

  function openActivityPanel() {
    setLastSeenActivityCount(activityBadgeCount);
    setHeaderPanel((current) => (current === "activity" ? null : "activity"));
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

  useEffect(() => {
    if (!activeBookingAction) {
      return;
    }

    function handleViewportChange() {
      setActiveBookingAction(null);
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [activeBookingAction]);

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
  const showActivityBadge = activityBadgeCount > lastSeenActivityCount;
  const unpublishedChangeCount = getUnpublishedChangeCount(activeCamp.timetableSlots);
  const hasUnpublishedChanges = unpublishedChangeCount > 0;
  const hasPublishedTimetable = activeCamp.timetableSlots.some(
    (slot) => slot.isPublished === true,
  );
  const showTimetableStatus = hasPublishedTimetable || hasUnpublishedChanges;
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
                    onClick={openActivityPanel}
                    className="relative inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    <Activity size={17} /> Activity
                    {headerPanel !== "activity" && showActivityBadge ? (
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
            onClick={openActivityPanel}
            className="relative inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700"
          >
            <Activity size={16} /> Activity
            {headerPanel !== "activity" && showActivityBadge ? (
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
                  {showTimetableStatus ? (
                    <span
                      className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black ${
                        hasUnpublishedChanges
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {hasUnpublishedChanges
                        ? `Draft changes pending (${unpublishedChangeCount})`
                        : "Timetable fully published"}
                    </span>
                  ) : null}
                  {activeCamp.type === "camp" ? (
                    <PublishTimetableButton camp={activeCamp} />
                  ) : null}
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
                          <EditDayButton
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
                            (booking) => booking.id === activeBookingAction?.bookingId,
                          );
                          const isDraftSlot = slot.isPublished === false;

                          return (
                            <article
                              key={slot.id}
                              className={`relative overflow-hidden rounded-xl border bg-white p-2 shadow-sm transition ${
                                isSelectedSlot
                                  ? "border-sky-300 bg-sky-50/60 ring-2 ring-sky-100"
                                  : isDraftSlot
                                    ? "border-dashed border-orange-300 bg-orange-50/35"
                                    : isFull
                                      ? "border-emerald-200"
                                      : "border-slate-200"
                              }`}
                            >
                              <div
                                className={`mb-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                                  isDraftSlot ? "bg-white" : "bg-slate-50"
                                }`}
                              >
                                <p className="inline-flex items-center gap-1.5 text-base font-black text-slate-950">
                                  <Clock3 size={15} className="text-sky-700" />
                                  {formatTimetableTime(slot.startTime)}
                                  {isDraftSlot ? (
                                    <span className="text-slate-300">|</span>
                                  ) : null}
                                  {isDraftSlot ? (
                                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                      Draft
                                    </span>
                                  ) : null}
                                </p>
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black ${
                                      isFull
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {slot.bookings.length}/{slot.capacity}
                                  </span>
                                </span>
                              </div>
                              <div className="grid gap-1">
                              {slot.bookings.map((booking) => {
                                  const colors = participantColorMap.get(booking.userId);
                                  const matchingParticipant = activeCamp.participants.find(
                                    (item) => item.userId === booking.userId,
                                  );
                                  const releaseRequested = Boolean(
                                    booking.releaseRequestedAt,
                                  );

                                  return (
                                    <div key={booking.id} className="relative">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          const rect =
                                            event.currentTarget.getBoundingClientRect();
                                          const viewportWidth = window.innerWidth;
                                          const viewportHeight = window.innerHeight;
                                          const popoverWidth = Math.min(
                                            288,
                                            viewportWidth - 24,
                                          );
                                          const popoverEstimatedHeight = 180;
                                          const gap = 8;
                                          const horizontalMargin = 8;
                                          const preferredLeft = rect.left;
                                          const clampedLeft = Math.min(
                                            Math.max(preferredLeft, horizontalMargin),
                                            Math.max(
                                              horizontalMargin,
                                              viewportWidth - horizontalMargin - popoverWidth,
                                            ),
                                          );
                                          const openBelow =
                                            rect.bottom + gap + popoverEstimatedHeight;
                                          const placement: "bottom" | "top" =
                                            openBelow <= viewportHeight - horizontalMargin
                                              ? "bottom"
                                              : "top";
                                          const preferredTop =
                                            placement === "bottom"
                                              ? rect.bottom + gap
                                              : rect.top - gap - popoverEstimatedHeight;
                                          const clampedTop = Math.min(
                                            Math.max(preferredTop, horizontalMargin),
                                            Math.max(
                                              horizontalMargin,
                                              viewportHeight -
                                                horizontalMargin -
                                                popoverEstimatedHeight,
                                            ),
                                          );

                                          setActiveBookingAction((current) => {
                                            if (current?.bookingId === booking.id) {
                                              return null;
                                            }

                                            return {
                                              bookingId: booking.id,
                                              top: clampedTop,
                                              left: clampedLeft,
                                              placement,
                                            };
                                          });
                                        }}
                                        className="grid w-full rounded-md border-l-4 px-2.5 py-2 text-left shadow-sm"
                                        style={{
                                          backgroundColor: colors?.soft,
                                          borderColor: booking.isFinal
                                            ? colors?.bg
                                            : "#f97316",
                                          color: colors?.text,
                                        }}
                                      >
                                        <span className="block truncate text-sm font-black">
                                          {booking.athleteName}
                                        </span>
                                        <span className="flex items-center gap-2 text-xs font-bold opacity-80">
                                          <span>{booking.minutes} min</span>
                                          {!booking.isFinal ? (
                                            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                              Draft
                                            </span>
                                          ) : null}
                                          {releaseRequested ? (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-black uppercase text-amber-800">
                                              Release requested
                                            </span>
                                          ) : null}
                                        </span>
                                      </button>
                                      {activeBookingAction?.bookingId === booking.id ? (
                                        <>
                                          <button
                                            type="button"
                                            className="fixed inset-0 z-40 cursor-default"
                                            aria-label="Close slot actions"
                                            onClick={() => setActiveBookingAction(null)}
                                          />
                                          {typeof document !== "undefined"
                                            ? createPortal(
                                                <div
                                                  className="fixed z-50 grid w-[min(18rem,calc(100vw-1rem))] gap-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-950 shadow-2xl"
                                                  style={{
                                                    top: activeBookingAction.top,
                                                    left: activeBookingAction.left,
                                                    maxHeight: "calc(100vh - 1rem)",
                                                    overflowY: "auto",
                                                  }}
                                                >
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
                                                      setActiveBookingAction(null);
                                                    }}
                                                    className="inline-flex h-9 items-center gap-2 rounded-lg px-2 text-left text-xs font-black text-slate-700 hover:bg-slate-50"
                                                  >
                                                    <UserRound size={15} className="text-sky-700" />
                                                    Show Participant Info
                                                  </button>
                                                  {releaseRequested ? (
                                                    <SlotReleaseRequestActions
                                                      opportunityId={activeCamp.id}
                                                      bookingId={booking.id}
                                                    />
                                                  ) : (
                                                    <ReleaseSlotBookingButton
                                                      opportunityId={activeCamp.id}
                                                      bookingId={booking.id}
                                                    />
                                                  )}
                                                </div>,
                                                document.body,
                                              )
                                            : null}
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
                                      participants={getAssignableParticipantsForDay(
                                        activeCamp,
                                        slot.slotDate,
                                      ).filter(
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
            <div className="flex items-center gap-2">
              {showTimetableStatus ? (
                <span
                  className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black ${
                    hasUnpublishedChanges
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {hasUnpublishedChanges
                    ? `Draft changes pending (${unpublishedChangeCount})`
                    : "Timetable fully published"}
                </span>
              ) : null}
              {activeCamp.type === "camp" ? (
                <PublishTimetableButton camp={activeCamp} compact />
              ) : null}
              <button
                type="button"
                onClick={() => setTabletPanel("participants")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700"
              >
                <Menu size={15} /> Participants
              </button>
            </div>
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
                        <EditDayButton camp={activeCamp} date={day.date} />
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 p-2">
                    {day.slots.length > 0 ? (
                      day.slots.map((slot) => {
                        const isFull = slot.bookings.length >= slot.capacity;
                        const isDraftSlot = slot.isPublished === false;

                        return (
                          <article
                            key={slot.id}
                            className={`relative rounded-lg border bg-white p-2 ${
                              isDraftSlot
                                ? "border-dashed border-orange-300 bg-orange-50/35"
                                : isFull
                                  ? "border-emerald-200"
                                  : "border-slate-200"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="inline-flex items-center gap-1.5 text-sm font-black">
                                <Clock3 size={15} className="text-sky-700" />
                                {formatTimetableTime(slot.startTime)}
                                {isDraftSlot ? (
                                  <span className="text-slate-300">|</span>
                                ) : null}
                                {isDraftSlot ? (
                                  <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                    Draft
                                  </span>
                                ) : null}
                              </p>
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black ${
                                    isFull
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {slot.bookings.length}/{slot.capacity}
                                </span>
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
                                    className="grid rounded-md border-l-4 px-2.5 py-2 text-left text-white shadow-sm"
                                    style={{
                                      backgroundColor: colors?.bg,
                                      borderColor: booking.isFinal
                                        ? colors?.bg
                                        : "#f97316",
                                    }}
                                  >
                                    <span className="block truncate text-sm font-black">
                                      {booking.athleteName}
                                    </span>
                                    <span className="flex items-center gap-2 text-xs font-bold text-white/80">
                                      <span>{booking.minutes} min</span>
                                      {!booking.isFinal ? (
                                        <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                          Draft
                                        </span>
                                      ) : null}
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
                                    participants={getAssignableParticipantsForDay(
                                      activeCamp,
                                      slot.slotDate,
                                    ).filter(
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
                    <div
                      key={participant.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectParticipant(participant.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectParticipant(participant.id);
                        }
                      }}
                      className={`grid min-w-0 rounded-xl border px-2 py-2 text-left transition ${
                        selectedParticipantId === participant.id
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5">
                          <Avatar
                            name={participant.name}
                            imageUrl={participant.profileImageUrl}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">
                              {participant.name}
                            </p>
                            <p className="truncate text-xs font-semibold text-slate-500">
                              Select to open sidebar
                            </p>
                          </div>
                        </div>
                        <span
                          className="mt-0.5 size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: colors?.bg ?? "#cbd5e1" }}
                          aria-hidden="true"
                        />
                      </div>
                      <div
                        className="mt-2 flex items-center justify-between gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="truncate text-xs font-bold text-slate-500">
                          {formatInterestStatusLabel(participant.status)}
                        </span>
                        <ApplicantStatusActions
                          interestId={participant.id}
                          currentStatus={participant.status}
                          compact
                        />
                      </div>
                    </div>
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

function getUnpublishedChangeCount(slots: TimetableSlot[]) {
  return slots.reduce((count, slot) => {
    const draftBookings = slot.bookings.filter((booking) => booking.isFinal === false).length;
    return count + (slot.isPublished === false ? 1 : 0) + draftBookings;
  }, 0);
}

function roundTimeToHalfHour(value: string) {
  if (!/^\d{2}:\d{2}/.test(value)) {
    return "15:00";
  }

  const [hourPart, minutePart] = value.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return "15:00";
  }

  const totalMinutes = hours * 60 + minutes;
  const roundedMinutes = Math.ceil(totalMinutes / 30) * 30;
  const normalizedMinutes = ((roundedMinutes % 1440) + 1440) % 1440;
  const roundedHours = Math.floor(normalizedMinutes / 60);
  const roundedMinutePart = normalizedMinutes % 60;

  return `${String(roundedHours).padStart(2, "0")}:${String(
    roundedMinutePart,
  ).padStart(2, "0")}`;
}

function roundHoursToHalfHour(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 2) / 2;
}

function buildCampBuilderPreview({
  date,
  startTime,
  rotationLength,
  middayBreakHours,
  maxTunnelHours,
}: {
  date: string;
  startTime: string;
  rotationLength: number;
  middayBreakHours: string;
  maxTunnelHours: string;
}): CampBuilderPreviewSlot[] {
  const capacity = getSlotCapacity(rotationLength);
  const totalBlocks = Math.max(0, Math.round(roundHoursToHalfHour(maxTunnelHours) * 2));
  const morningBlocks = Math.ceil(totalBlocks / 2);
  const afternoonBlocks = totalBlocks - morningBlocks;
  const middayBreakMinutes = Math.round(roundHoursToHalfHour(middayBreakHours) * 60);
  const morning = buildCampBuilderSection({
    date,
    startMinutes: timeToMinutes(roundTimeToHalfHour(startTime)),
    blockCount: morningBlocks,
    durationMinutes: rotationLength,
    capacity,
  });
  const lastMorningStart =
    morning.length > 0 ? morning[morning.length - 1].startTime : undefined;
  const afternoonStartMinutes =
    lastMorningStart === undefined
      ? timeToMinutes(roundTimeToHalfHour(startTime)) + middayBreakMinutes
      : timeToMinutes(lastMorningStart) + 30 + middayBreakMinutes;
  const afternoon = buildCampBuilderSection({
    date,
    startMinutes: afternoonStartMinutes,
    blockCount: afternoonBlocks,
    durationMinutes: rotationLength,
    capacity,
  });

  return [...morning, ...afternoon];
}

function buildCampBuilderSection({
  date,
  startMinutes,
  blockCount,
  durationMinutes,
  capacity,
}: {
  date: string;
  startMinutes: number;
  blockCount: number;
  durationMinutes: number;
  capacity: number;
}) {
  const slots: CampBuilderPreviewSlot[] = [];
  let currentMinutes = startMinutes;

  for (let index = 0; index < blockCount; index += 1) {
    slots.push({
      slotDate: date,
      startTime: minutesToTime(currentMinutes),
      durationMinutes,
      capacity,
    });

    if (index < blockCount - 1) {
      currentMinutes += index % 2 === 0 ? 30 : 90;
    }
  }

  return slots;
}

function timeToMinutes(value: string) {
  const normalized = value.slice(0, 5);
  const [hourPart, minutePart] = normalized.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const normalizedMinutes = ((value % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

type EditDayTab = "manual" | "camp-builder";

type CampBuilderPreviewSlot = {
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

function EditDayButton({
  camp,
  date,
}: {
  camp: CampWorkspace;
  date: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EditDayTab>("manual");
  const [startTime, setStartTime] = useState("15:00");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [builderStartTime, setBuilderStartTime] = useState("09:00");
  const [builderRotationLength, setBuilderRotationLength] = useState(15);
  const [builderMiddayBreak, setBuilderMiddayBreak] = useState("2");
  const [builderMaxTunnelHours, setBuilderMaxTunnelHours] = useState("4");
  const [builderPreview, setBuilderPreview] =
    useState<CampBuilderPreviewSlot[] | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const capacity = getSlotCapacity(durationMinutes);

  function getExistingSlots(): TimetableSlotInput[] {
    return camp.timetableSlots.map((slot) => ({
      id: slot.id,
      slotDate: slot.slotDate,
      startTime: slot.startTime.slice(0, 5),
      durationMinutes: slot.durationMinutes,
      capacity: slot.capacity,
    }));
  }

  function getExistingSlotsOutsideDay(): TimetableSlotInput[] {
    return getExistingSlots().filter((slot) => slot.slotDate !== date);
  }

  function generateCampBuilderSlots() {
    const generatedSlots = buildCampBuilderPreview({
      date,
      startTime: builderStartTime,
      rotationLength: builderRotationLength,
      middayBreakHours: builderMiddayBreak,
      maxTunnelHours: builderMaxTunnelHours,
    });

    if (generatedSlots.length === 0) {
      setError("Add at least 30 minutes of tunnel time.");
      setBuilderPreview(null);
      return null;
    }

    return generatedSlots;
  }

  function save() {
    setError("");

    const existingSlots = getExistingSlots();
    const nextSlots: TimetableSlotInput[] = [
      ...existingSlots,
      {
        slotDate: date,
        startTime: roundTimeToHalfHour(startTime),
        durationMinutes,
        capacity,
      },
    ];

    startTransition(async () => {
      const result = await saveCampTimetable(camp.id, nextSlots, false, {
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

  function previewCampBuilder() {
    setError("");

    const preview = generateCampBuilderSlots();

    if (!preview) {
      return;
    }

    setBuilderPreview(preview);
  }

  function createCampBuilderDay() {
    setError("");

    const generatedSlots = generateCampBuilderSlots();

    if (!generatedSlots) {
      return;
    }

    setBuilderPreview(generatedSlots);

    const nextSlots: TimetableSlotInput[] = [
      ...getExistingSlotsOutsideDay(),
      ...generatedSlots,
    ];

    startTransition(async () => {
      const result = await saveCampTimetable(camp.id, nextSlots, false, {
        redirectOnPublish: false,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIsOpen(false);
      setBuilderPreview(null);
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
        <Plus size={14} /> Edit Day
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                {formatLongDay(date)}
              </p>
              <h3 className="mt-1 text-lg font-black tracking-tight">
                Edit Day
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("manual");
                  setError("");
                }}
                className={`h-10 rounded-lg text-sm font-black transition ${
                  activeTab === "manual"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Manual Slots
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("camp-builder");
                  setError("");
                }}
                className={`h-10 rounded-lg text-sm font-black transition ${
                  activeTab === "camp-builder"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Camp Builder
              </button>
            </div>

            {activeTab === "manual" ? (
              <div className="mt-4 grid gap-3">
                <DashboardField label="Time">
                  <input
                    type="time"
                    step="1800"
                    value={startTime}
                    onChange={(event) =>
                      setStartTime(roundTimeToHalfHour(event.target.value))
                    }
                    onBlur={(event) =>
                      setStartTime(roundTimeToHalfHour(event.target.value))
                    }
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
            ) : (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DashboardField label="Start Time">
                    <input
                      type="time"
                      step="1800"
                      value={builderStartTime}
                      onChange={(event) => {
                        setBuilderStartTime(roundTimeToHalfHour(event.target.value));
                        setBuilderPreview(null);
                      }}
                      onBlur={(event) => {
                        setBuilderStartTime(roundTimeToHalfHour(event.target.value));
                        setBuilderPreview(null);
                      }}
                      className={dashboardInputClass}
                    />
                  </DashboardField>
                  <DashboardField label="Rotation Length">
                    <select
                      value={builderRotationLength}
                      onChange={(event) => {
                        setBuilderRotationLength(Number(event.target.value));
                        setBuilderPreview(null);
                      }}
                      className={dashboardInputClass}
                    >
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                    </select>
                  </DashboardField>
                  <DashboardField label="Midday Break Duration (hours)">
                    <input
                      type="number"
                      min="0"
                      max="3"
                      step="0.5"
                      value={builderMiddayBreak}
                      onChange={(event) => {
                        setBuilderMiddayBreak(event.target.value);
                        setBuilderPreview(null);
                      }}
                      onBlur={(event) =>
                        setBuilderMiddayBreak(
                          String(roundHoursToHalfHour(event.target.value)),
                        )
                      }
                      className={dashboardInputClass}
                    />
                  </DashboardField>
                  <DashboardField label="Maximum Tunnel Time (hours)">
                    <input
                      type="number"
                      min="0.5"
                      max="12"
                      step="0.5"
                      value={builderMaxTunnelHours}
                      onChange={(event) => {
                        setBuilderMaxTunnelHours(event.target.value);
                        setBuilderPreview(null);
                      }}
                      onBlur={(event) =>
                        setBuilderMaxTunnelHours(
                          String(roundHoursToHalfHour(event.target.value)),
                        )
                      }
                      className={dashboardInputClass}
                    />
                  </DashboardField>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                        Day Generator
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        Maximum tunnel time is the total operating hours for this day.
                        Create Day replaces the existing schedule for this day with draft
                        slots.
                      </p>
                    </div>
                  </div>
                  {builderPreview ? (
                    <div className="mt-3 grid gap-2">
                      <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg bg-white p-2">
                        {builderPreview.map((slot) => (
                          <div
                            key={`${slot.slotDate}-${slot.startTime}`}
                            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
                          >
                            <span className="font-black text-slate-950">
                              {formatTimetableTime(slot.startTime)}
                            </span>
                            <span className="font-bold text-slate-500">
                              {slot.capacity} slots
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
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
              {activeTab === "manual" ? (
                <button
                  type="button"
                  onClick={save}
                  disabled={isPending}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white disabled:bg-slate-300"
                >
                  <Save size={16} /> {isPending ? "Saving..." : "Save Draft"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={previewCampBuilder}
                    disabled={isPending}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 disabled:text-slate-300"
                  >
                    <Clock3 size={16} /> Preview Day
                  </button>
                  <button
                    type="button"
                    onClick={createCampBuilderDay}
                    disabled={isPending}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-black text-white disabled:bg-slate-300"
                  >
                    <Save size={16} /> {isPending ? "Creating..." : "Create Day"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}

function PublishTimetableButton({
  camp,
  compact = false,
}: {
  camp: CampWorkspace;
  compact?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function publish() {
    setMessage("");
    setError("");

    const nextSlots: TimetableSlotInput[] = camp.timetableSlots.map((slot) => ({
      id: slot.id,
      slotDate: slot.slotDate,
      startTime: slot.startTime.slice(0, 5),
      durationMinutes: slot.durationMinutes,
      capacity: slot.capacity,
    }));

    startTransition(async () => {
      const result = await saveCampTimetable(camp.id, nextSlots, true, {
        redirectOnPublish: false,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={publish}
        disabled={isPending}
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300 ${
          compact ? "whitespace-nowrap" : ""
        }`}
      >
        <Send size={15} /> {isPending ? "Publishing..." : "Publish Timetable"}
      </button>
      {error ? (
        <p className="max-w-52 text-xs font-semibold text-rose-700">{error}</p>
      ) : null}
      {message ? (
        <p className="max-w-52 text-xs font-semibold text-emerald-700">{message}</p>
      ) : null}
    </div>
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
        isFinal: booking.isFinal ?? false,
        releaseRequestedAt: booking.releaseRequestedAt ?? null,
      })),
  );
  const bookedMinutes = bookedSlots.reduce((total, slot) => total + slot.minutes, 0);
  const bookedSlotsByDay = groupBookedSlotsByDay(bookedSlots);
  const preferencesByDay = camp.preferences
    .filter((preference) => preference.participantId === participant.userId)
    .sort((a, b) => a.dayId - b.dayId);
  const profileHref = participant.userId ? `/app/users/${participant.userId}` : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {profileHref ? (
          <Link
            href={profileHref}
            className="flex min-w-0 items-center gap-3 rounded-2xl px-1 py-1 transition hover:bg-slate-50"
          >
            <Avatar
              name={participant.name}
              imageUrl={participant.profileImageUrl}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-950">
                {participant.name}
              </h2>
              <p className="truncate text-sm font-bold text-sky-700">View profile</p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={participant.name}
              imageUrl={participant.profileImageUrl}
              size="md"
            />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-950">
                {participant.name}
              </h2>
              <p className="truncate text-sm font-bold text-slate-500">
                No profile available
              </p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-500"
        >
          Close
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 items-stretch gap-2">
        <SummaryMetricCard
          label="Status"
          value={formatInterestStatusLabel(participant.status)}
        />
        <SummaryMetricCard
          label="Booked Time"
          value={formatBookedTimeSummary(bookedMinutes)}
        />
        <SummaryMetricCard
          label="Tunnel Time"
          value={participant.tunnelTimeStatus === "owns_tunnel_time" ? "✅ Available" : "❌ Not Available"}
          tone={participant.tunnelTimeStatus === "owns_tunnel_time" ? "success" : "slate"}
        />
        <SummaryMetricCard
          label="Country"
          value={participant.country || "Not provided"}
        />
      </div>
      <div className="mt-3">
        <details className="group rounded-2xl border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-black text-slate-700 [&::-webkit-details-marker]:hidden">
            <span>Participant Details</span>
            <ChevronRight
              size={16}
              className="shrink-0 text-slate-400 transition group-open:rotate-90"
            />
          </summary>
          <div className="grid gap-1.5 border-t border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600">
            <p>Email: {participant.email || "No email"}</p>
            <p>Phone: {participant.phone || "Not provided"}</p>
            <p>
              Tunnel Time:{" "}
              {participant.tunnelTimeStatus === "owns_tunnel_time"
                ? "Available"
                : participant.tunnelTimeStatus === "needs_tunnel_time"
                  ? "Not available"
                  : "Not provided"}
            </p>
            <p>
              Tunnel Account Email: {participant.tunnelAccountEmail || "Not provided"}
            </p>
          </div>
        </details>
      </div>
      <div className="mt-3 grid gap-3">
        {camp.type === "camp" ? (
          <details className="group rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-black text-slate-700 [&::-webkit-details-marker]:hidden">
              <span>Preferences ({preferencesByDay.length})</span>
              <ChevronRight
                size={16}
                className="shrink-0 text-slate-400 transition group-open:rotate-90"
              />
            </summary>
            <div className="grid gap-1.5 border-t border-slate-200 px-3 py-2.5">
              {preferencesByDay.length > 0 ? (
                preferencesByDay.map((preference) => (
                  <p
                    key={`${preference.participantId}-${preference.dayId}`}
                    className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {formatCampDayPreferenceLabel(
                      camp.startDate,
                      camp.endDate,
                      preference.dayId,
                    )}
                    : {formatCampPreferenceMinutes(preference.preferredMinutes)}
                  </p>
                ))
              ) : (
                <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-500">
                  No preferences submitted.
                </p>
              )}
            </div>
          </details>
        ) : null}
        <details className="group rounded-2xl border border-slate-200 bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-black text-slate-700 [&::-webkit-details-marker]:hidden">
            <span>Booked Slots ({bookedSlots.length})</span>
            <ChevronRight
              size={16}
              className="shrink-0 text-slate-400 transition group-open:rotate-90"
            />
          </summary>
          <div className="grid gap-1.5 border-t border-slate-200 px-3 py-2.5">
            {bookedSlotsByDay.length > 0 ? (
              bookedSlotsByDay.map((day) => (
                <section key={day.date} className="grid gap-1.5 rounded-xl bg-white p-2.5">
                  <h4 className="text-sm font-black text-slate-950">
                    {formatTimetableDate(day.date)}
                  </h4>
                  <div className="grid gap-0.5">
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
              <p className="rounded-xl bg-white px-3 py-2 text-sm font-black text-amber-700">
                No slots assigned
              </p>
            )}
          </div>
        </details>
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

function SummaryMetricCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  tone?: "slate" | "success";
}) {
  const toneStyles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : "border-slate-200 bg-slate-50";

  return (
    <div className={`flex h-full min-h-28 flex-col justify-between rounded-2xl border p-3 ${toneStyles}`}>
      <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
      {detail ? <div className="mt-1.5">{detail}</div> : null}
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

function getAssignableParticipantsForDay(
  camp: CampWorkspace,
  slotDate: string,
): AssignSlotParticipant[] {
  const bookedMinutesByUserId = new Map<string, number>();
  const dayBookedMinutesByUserId = new Map<string, number>();
  const dayId = getDateRange(camp.startDate, camp.endDate).indexOf(slotDate) + 1;
  const dayLabel =
    dayId > 0
      ? formatCampDayPreferenceLabel(camp.startDate, camp.endDate, dayId)
      : formatTimetableDate(slotDate);

  for (const slot of camp.timetableSlots) {
    for (const booking of slot.bookings) {
      bookedMinutesByUserId.set(
        booking.userId,
        (bookedMinutesByUserId.get(booking.userId) ?? 0) + booking.minutes,
      );

      if (slot.slotDate === slotDate) {
        dayBookedMinutesByUserId.set(
          booking.userId,
          (dayBookedMinutesByUserId.get(booking.userId) ?? 0) + booking.minutes,
        );
      }
    }
  }

  return camp.participants
    .filter((participant) => participant.status === "accepted" && participant.userId)
    .map((participant) => {
      const preference =
        dayId > 0
          ? camp.preferences.find(
              (item) =>
                item.participantId === participant.userId &&
                item.dayId === dayId,
            )
          : undefined;
      const preferredMinutes = preference?.preferredMinutes;
      const assignedMinutes =
        dayBookedMinutesByUserId.get(participant.userId) ?? 0;
      const remainingMinutes =
        typeof preferredMinutes === "number"
          ? Math.max(preferredMinutes - assignedMinutes, 0)
          : null;
      const dayStatus: AssignSlotParticipant["dayStatus"] =
        typeof preferredMinutes !== "number"
          ? "no_preference"
          : preferredMinutes <= 0
            ? "no_flying"
            : remainingMinutes === 0
              ? "complete"
              : "needs_time";

      return {
        id: participant.userId,
        name: participant.name,
        bookedMinutes: bookedMinutesByUserId.get(participant.userId) ?? 0,
        dayLabel,
        dayAssignedMinutes: assignedMinutes,
        dayPreferredMinutes:
          typeof preferredMinutes === "number" ? preferredMinutes : null,
        dayRemainingMinutes: remainingMinutes,
        dayStatus,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatBookedTimeSummary(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  const compact =
    hours === 0
      ? `${remainder}min`
      : remainder === 0
        ? `${hours}h`
        : `${hours}h ${remainder}min`;

  return `${compact} (${minutes}min)`;
}

function formatInterestStatusLabel(status: InterestStatus) {
  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "waitlist") {
    return "Waitlist";
  }

  return "Pending";
}

function formatLongDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}


