"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CircleDollarSign,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Settings,
  Share2,
  Send,
  Users,
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
import { saveCampTimetable, type TimetableSlotInput } from "@/app/app/organizer/opportunities/actions";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import {
  AssignSlotButton,
  type AssignSlotParticipant,
} from "@/components/AssignSlotButton";
import { Avatar } from "@/components/Avatar";
import { ReleaseSlotBookingButton } from "@/components/ReleaseSlotBookingButton";
import { SlotReleaseRequestActions } from "@/components/SlotReleaseRequestActions";
import { ShareOpportunityButton } from "@/components/ShareOpportunityButton";
import { TunnelDashboardShareButton } from "@/components/TunnelDashboardShareButton";
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
import { setCampParticipantSelfBooking } from "@/app/app/organizer/opportunities/actions";
import type {
  BookingMode,
  InterestStatus,
  OpportunityStatus,
  OpportunityType,
} from "@/lib/types";

type Participant = {
  id: string;
  interestId: string;
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
  selfBookingEnabled: boolean;
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
  tunnelSharedAt: string | null;
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

type TabletPanel = "participants" | "participant" | null;
type AttentionItem = {
  label: string;
  tone: "amber" | "slate";
  target: "applicants" | "participant" | "timetable" | "share";
  count: number;
  participantId?: string;
};

type HuckjamRegistration = {
  id: string;
  name: string;
  profileImageUrl: string;
  createdAt: string;
  relativeTime: string;
  status: InterestStatus;
};

type SlotActionPopoverState = {
  bookingId: string;
  top: number;
  left: number;
  placement: "bottom" | "top";
};

type CoachDashboardWorkspaceProps = {
  selectedCampId: string;
  camps: CampWorkspace[];
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
  selectedCampId,
  camps,
}: CoachDashboardWorkspaceProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [headerPanel, setHeaderPanel] = useState<"share" | null>(null);
  const [tabletPanel, setTabletPanel] = useState<TabletPanel>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [desktopDayStart, setDesktopDayStart] = useState(0);
  const [activeBookingAction, setActiveBookingAction] =
    useState<SlotActionPopoverState | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const activeCamp = camps.find((camp) => camp.id === selectedCampId) ?? camps[0];
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
  const tunnelDashboardShared = Boolean(activeCamp?.tunnelSharedAt);

  function focusApplicants() {
    setSelectedParticipantId("");
    setIsSidebarCollapsed(false);
    setTabletPanel("participants");
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

    if (item.target === "share") {
      setHeaderPanel("share");
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
        </div>
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
  const unpublishedChangeCount = getUnpublishedChangeCount(activeCamp.timetableSlots);
  const hasUnpublishedChanges = unpublishedChangeCount > 0;
  const hasPublishedTimetable = activeCamp.timetableSlots.some(
    (slot) => slot.isPublished === true,
  );
  const showTimetableStatus = hasPublishedTimetable || hasUnpublishedChanges;
  const isHuckJam = activeCamp.type === "huck_jam";

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950">
      <div className="mx-auto grid max-w-[96rem] gap-4 p-3 sm:p-4 xl:p-5">
        <header className="hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 xl:block">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] xl:items-stretch">
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
              </div>
              {!isHuckJam ? (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <FlightCapacityCard
                    hasTimetable={activeCamp.timetableSlots.length > 0}
                    bookedMinutes={activeCamp.summary.totalBookedMinutes}
                    availableMinutes={activeCamp.summary.totalAvailableMinutes}
                  />
                  <StatCard label="Open Slots" value={activeCamp.summary.openSlots} />
                  <StatCard
                    label="Estimated Revenue"
                    value={formatTimetableMoney(
                      activeCamp.summary.estimatedRevenue,
                      activeCamp.currency,
                    )}
                  />
                </div>
              ) : null}
            </div>
            <div className="grid h-full gap-3 self-stretch xl:grid-cols-3">
              <UtilityCard
                tone="sky"
                icon={<Share2 size={19} />}
                title="Invite Athletes"
                description="Share this opportunity with athletes."
              >
                <ShareOpportunityButton
                  label="Invite"
                  shareText={shareText}
                  url={publicUrl}
                  copyUrlOnly
                  compact
                  fill
                  variant="primary"
                />
              </UtilityCard>
              <UtilityCard
                tone={tunnelDashboardShared ? "amber" : "slate"}
                icon={<Users size={19} />}
                title="Tunnel Dashboard"
                description="Share live schedules with the tunnel."
                status={
                  tunnelDashboardShared
                    ? "✅ Shared With Tunnel"
                    : "⚠ Not Shared Yet"
                }
              >
                <TunnelDashboardShareButton
                  opportunityId={activeCamp.id}
                  opportunityTitle={activeCamp.title}
                  tunnelSharedAt={activeCamp.tunnelSharedAt}
                  label="Share"
                  compact
                  fill
                />
              </UtilityCard>
              <UtilityCard
                tone="slate"
                icon={<Settings size={19} />}
                title="Opportunity Settings"
                description="Edit dates, pricing, capacity and details."
              >
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Open Settings
                </button>
              </UtilityCard>
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
          <button
            type="button"
            onClick={() =>
              setHeaderPanel((current) => (current === "share" ? null : "share"))
            }
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700"
          >
            <Share2 size={16} /> Share
          </button>
        </header>

        <nav className="hidden rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm md:block">
          <Link
            href="/app/coach-dashboard"
            className="inline-flex items-center gap-2 text-lg font-black text-sky-800 transition hover:text-sky-900"
          >
            <ChevronLeft size={19} /> Back to Coach Command Center
          </Link>
        </nav>

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
                {isHuckJam ? <HuckjamSidebarSummary camp={activeCamp} /> : null}
                <ParticipantColumns
                  participants={activeCamp.participants}
                  selectedParticipantId={selectedParticipantId}
                  onSelectParticipant={setSelectedParticipantId}
                  onSelectApplicants={focusApplicants}
                  participantColorMap={participantColorMap}
                  isCamp={activeCamp.type === "camp"}
                />
                {participant ? (
                  <ParticipantPanel
                    key={participant.id}
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
            {isHuckJam ? (
              <HuckjamOverviewPanel camp={activeCamp} />
            ) : (
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
                                          borderColor:
                                            booking.isFinal === false
                                              ? "#f97316"
                                              : colors?.bg,
                                          color: colors?.text,
                                        }}
                                      >
                                        <span className="block truncate text-sm font-black">
                                          {booking.athleteName}
                                        </span>
                                        <span className="flex items-center gap-2 text-xs font-bold opacity-80">
                                          <span>{booking.minutes} min</span>
                                          {booking.isFinal === false ? (
                                            <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-black uppercase tracking-[0.08em] text-orange-700">
                                              Draft
                                            </span>
                                          ) : null}
                                          {releaseRequested ? (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-black uppercase text-amber-800">
                                              Pending Coach Approval
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
            )}
          </div>
        </section>
      </main>

      <main className="hidden gap-3 md:grid xl:hidden">
        {isHuckJam ? (
          <HuckjamOverviewPanel camp={activeCamp} compact />
        ) : (
          <>
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
                                          borderColor:
                                            booking.isFinal === false
                                              ? "#f97316"
                                              : colors?.bg,
                                        }}
                                      >
                                        <span className="block truncate text-sm font-black">
                                          {booking.athleteName}
                                        </span>
                                        <span className="flex items-center gap-2 text-xs font-bold text-white/80">
                                          <span>{booking.minutes} min</span>
                                          {booking.isFinal === false ? (
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
            />
          </>
        )}
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
              {isHuckJam ? (
                <HuckjamSidebarSummary camp={activeCamp} />
              ) : (
                <AttentionPanel items={attention} onAction={handleAttentionClick} />
              )}
              <ParticipantColumns
                participants={activeCamp.participants}
                selectedParticipantId={selectedParticipantId}
                onSelectParticipant={(id) => {
                  setSelectedParticipantId(id);
                  setTabletPanel("participant");
                }}
                onSelectApplicants={focusApplicants}
                participantColorMap={participantColorMap}
                isCamp={activeCamp.type === "camp"}
              />
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
        </div>
      </main>
      {headerPanel === "share" ? (
        <CenteredModal title="Utilities" onClose={() => setHeaderPanel(null)}>
          <div className="grid gap-2">
            <UtilityCard
              tone="sky"
              icon={<Share2 size={19} />}
              title="Invite Athletes"
              description="Share this opportunity with athletes."
            >
              <ShareOpportunityButton
                label="Invite"
                shareText={shareText}
                url={publicUrl}
                copyUrlOnly
                compact
                fill
                variant="primary"
              />
            </UtilityCard>
            <UtilityCard
              tone={tunnelDashboardShared ? "amber" : "slate"}
              icon={<Users size={19} />}
              title="Tunnel Dashboard"
              description="Share live schedules with the tunnel."
              status={
                tunnelDashboardShared ? "✅ Shared With Tunnel" : "⚠ Not Shared Yet"
              }
            >
              <TunnelDashboardShareButton
                opportunityId={activeCamp.id}
                opportunityTitle={activeCamp.title}
                tunnelSharedAt={activeCamp.tunnelSharedAt}
                label="Share"
                compact
                fill
              />
            </UtilityCard>
            <UtilityCard
              tone="slate"
              icon={<Settings size={19} />}
              title="Opportunity Settings"
              description="Edit pricing, capacity and details."
            >
              <button
                type="button"
                onClick={() => {
                  setHeaderPanel(null);
                  setIsSettingsOpen(true);
                }}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                Open Settings
              </button>
            </UtilityCard>
          </div>
        </CenteredModal>
      ) : null}
      {isSettingsOpen ? (
        <CenteredModal title="Opportunity Settings" onClose={() => setIsSettingsOpen(false)}>
          <CampSettingsPanel
            key={`modal-${activeCamp.id}`}
            camp={activeCamp}
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
            {title === "Opportunity Settings" ? <Settings size={18} /> : null}
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

function UtilityCard({
  tone,
  icon,
  title,
  description,
  status,
  children,
}: {
  tone: "sky" | "amber" | "slate";
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: string;
  children: React.ReactNode;
}) {
  const toneStyles =
    tone === "amber"
      ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
      : tone === "sky"
        ? "border-sky-200 bg-gradient-to-br from-sky-50 to-white"
        : "border-slate-200 bg-gradient-to-br from-slate-50 to-white";

  const iconStyles =
    tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "sky"
        ? "bg-sky-100 text-sky-700"
        : "bg-slate-100 text-slate-700";

  return (
    <section className={`grid h-full min-h-0 gap-2 rounded-2xl border p-3 text-left shadow-sm ${toneStyles}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${iconStyles}`}>
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-xs font-semibold leading-4 text-slate-600">{description}</p>
        {status ? (
          <p className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[0.7rem] font-black text-slate-600">
            {status}
          </p>
        ) : null}
      </div>
      <div className="mt-auto">{children}</div>
    </section>
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
  isCamp,
}: {
  participants: Participant[];
  selectedParticipantId: string;
  onSelectParticipant: (id: string) => void;
  onSelectApplicants: () => void;
  participantColorMap: Map<string, (typeof participantColors)[number]>;
  isCamp: boolean;
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
                            {isCamp &&
                            participant.status === "accepted" &&
                            participant.selfBookingEnabled ? (
                              <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.08em] text-sky-700">
                                Self-booking enabled
                              </span>
                            ) : null}
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
                          interestId={participant.interestId}
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
  const [activeTab, setActiveTab] = useState<EditDayTab>("camp-builder");
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
        onClick={() => {
          setActiveTab("camp-builder");
          setError("");
          setBuilderPreview(null);
          setIsOpen(true);
        }}
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
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                      Camp Builder
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      Hour In – Hour Out
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      Maximum tunnel time is the total operating hours for this day.
                      Create Day replaces the existing schedule for this day with draft
                      slots.
                    </p>
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
  onDeleteComplete,
}: {
  camp: CampWorkspace;
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
    registrationDeadline: camp.registrationDeadline ?? "",
    price: String(camp.price),
    totalCapacity: String(camp.totalCapacity),
  });

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function save() {
    setMessage("");
    setError("");

    const payload: OpportunityFormInput = {
      type: camp.type,
      bookingMode: "approval_required",
      title: form.title,
      tunnelId: camp.tunnelId,
      startDate: camp.startDate,
      endDate: camp.endDate,
      registrationDeadline: form.registrationDeadline,
      sessionStart: camp.sessionStart ?? "",
      sessionEnd: camp.sessionEnd ?? "",
      price: Number(form.price),
      currency: camp.currency,
      totalCapacity: Number(form.totalCapacity),
      minMinutesOrHours: camp.priceAppliesToMinutes,
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
        <DashboardField label="Price">
          <input
            inputMode="decimal"
            value={form.price}
            onChange={(event) => updateField("price", event.target.value)}
            className={dashboardInputClass}
          />
        </DashboardField>
        <DashboardField label="Capacity">
          <input
            inputMode="numeric"
            value={form.totalCapacity}
            onChange={(event) => updateField("totalCapacity", event.target.value)}
            className={dashboardInputClass}
          />
        </DashboardField>
      </div>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-black text-white disabled:bg-slate-300"
        >
          <Save size={16} /> {isPending ? "Saving..." : "Save Immediately"}
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
  const router = useRouter();
  const [selfBookingEnabled, setSelfBookingEnabled] = useState(
    participant.selfBookingEnabled,
  );
  const [toggleMessage, setToggleMessage] = useState("");
  const [toggleError, setToggleError] = useState("");
  const [isTogglePending, startToggleTransition] = useTransition();

  const bookedSlots = camp.timetableSlots.flatMap((slot) =>
    slot.bookings
      .filter((booking) => booking.userId === participant.userId)
      .map((booking) => ({
        id: booking.id,
        date: slot.slotDate,
        time: slot.startTime,
        minutes: booking.minutes,
        isFinal: booking.isFinal === true,
        releaseRequestedAt: booking.releaseRequestedAt ?? null,
      })),
  );
  const bookedMinutes = bookedSlots.reduce((total, slot) => total + slot.minutes, 0);
  const bookedSlotsByDay = groupBookedSlotsByDay(bookedSlots);
  const preferencesByDay = camp.preferences
    .filter((preference) => preference.participantId === participant.userId)
    .sort((a, b) => a.dayId - b.dayId);
  const profileHref = participant.userId ? `/app/users/${participant.userId}` : null;

  function updateSelfBooking(nextEnabled: boolean) {
    if (isTogglePending || selfBookingEnabled === nextEnabled) {
      return;
    }

    setToggleMessage("");
    setToggleError("");

    startToggleTransition(async () => {
      const result = await setCampParticipantSelfBooking(
        participant.interestId,
        nextEnabled,
      );

      if (!result.ok) {
        setToggleError(result.message);
        return;
      }

      setSelfBookingEnabled(nextEnabled);
      setToggleMessage(result.message);
      router.refresh();
    });
  }

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
      {camp.type === "camp" && participant.status === "accepted" ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                Self-booking
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                Allow this accepted athlete to choose their own flight times.
              </p>
            </div>
            <span
              className={`inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[0.68rem] font-black uppercase tracking-[0.08em] ${
                selfBookingEnabled
                  ? "bg-sky-100 text-sky-700"
                  : "bg-white text-slate-500"
              }`}
            >
              {selfBookingEnabled ? "Enabled" : "Off"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={isTogglePending || selfBookingEnabled}
              onClick={() => updateSelfBooking(true)}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-600 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
            >
              {isTogglePending && !selfBookingEnabled ? "Enabling..." : "Enable"}
            </button>
            <button
              type="button"
              disabled={isTogglePending || !selfBookingEnabled}
              onClick={() => updateSelfBooking(false)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:text-slate-400"
            >
              {isTogglePending && selfBookingEnabled ? "Disabling..." : "Disable"}
            </button>
          </div>
          <p className="mt-2 text-[0.7rem] font-black uppercase tracking-[0.08em] text-slate-400">
            When enabled, the athlete can select published slots themselves.
          </p>
          {selfBookingEnabled ? (
            <span className="mt-2 inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[0.64rem] font-black uppercase tracking-[0.08em] text-sky-700">
              SELF-BOOKING ENABLED
            </span>
          ) : null}
          {toggleMessage ? (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {toggleMessage}
            </p>
          ) : null}
          {toggleError ? (
            <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {toggleError}
            </p>
          ) : null}
        </div>
      ) : null}
      {participant.status !== "accepted" ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                Application Actions
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Restore the applicant to any workflow state.
              </p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500">
              {formatInterestStatusLabel(participant.status)}
            </span>
          </div>
          <div className="mt-3">
            <ApplicantStatusActions
              key={`${participant.id}-${participant.status}`}
              interestId={participant.interestId}
              currentStatus={participant.status}
            />
          </div>
        </div>
      ) : null}
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
        {camp.type === "camp" ? (
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
        ) : null}
      </div>
      {camp.type === "camp" &&
      participant.status === "accepted" &&
      bookedSlots.length === 0 &&
      participant.userId ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">
            Requires attention
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-amber-900">
            This athlete has no booked times yet. The task now lives in the
            Command Center instead of generating a reminder notification.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function HuckjamOverviewPanel({
  camp,
  compact = false,
}: {
  camp: CampWorkspace;
  compact?: boolean;
}) {
  const overview = getHuckjamOverview(camp);

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`grid gap-4 ${compact ? "p-3" : "p-4 sm:p-5"}`}>
        <div className="rounded-[1.75rem] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_42%,#ecfeff_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-sky-700">
                Huckjam Overview
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">
                How full is the event?
              </h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                Keep an eye on registrations, revenue, and remaining capacity
                without any timetable noise.
              </p>
            </div>
            <div className="grid min-w-[12rem] gap-1.5 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-slate-950 shadow-sm backdrop-blur">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
                Start countdown
              </p>
              <p className="text-2xl font-black tracking-tight">
                {overview.daysRemaining} days
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-bold text-sky-700">
                <CalendarClock size={16} />
                Until Huckjam starts
              </div>
            </div>
          </div>

          <div
            className={`mt-5 grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4"}`}
          >
            <HuckjamMetricCard
              label="Registered Participants"
              value={`${overview.confirmedCount} / ${camp.totalCapacity}`}
              icon={<Users size={18} />}
              detail={`${overview.capacityPercent}% of capacity`}
            />
            <HuckjamMetricCard
              label="Revenue"
              value={formatPrice(overview.revenue, camp.currency)}
              icon={<CircleDollarSign size={18} />}
              detail="Confirmed participants x participation fee"
            />
            <HuckjamMetricCard
              label="Available Spots"
              value={overview.availableSpots}
              icon={<CalendarDays size={18} />}
              detail="Remaining places to fill"
            />
            <HuckjamMetricCard
              label="Days Remaining"
              value={overview.daysRemaining}
              icon={<CalendarClock size={18} />}
              detail="Until the Huckjam begins"
            />
          </div>
        </div>

        <div className={`grid gap-4 ${compact ? "" : "xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"}`}>
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                  Capacity Progress
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  {overview.confirmedCount} of {camp.totalCapacity} spots filled
                </h3>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">
                {overview.capacityPercent}% Full
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-500">
                <span>{overview.confirmedCount} registered participants</span>
                <span>{overview.availableSpots} spots left</span>
              </div>
              <div className="mt-3 h-5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 transition-[width] duration-500"
                  style={{ width: `${overview.capacityPercent}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-700">
                  {overview.capacityPercent}% Full
                </p>
                <p className="text-sm font-semibold text-slate-500">
                  Capacity is the story here
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
                  Recent Registrations
                </p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Who just signed up?
                </h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                {overview.recentRegistrations.length}
              </span>
            </div>

            <div className="mt-4 grid gap-2">
              {overview.recentRegistrations.length > 0 ? (
                overview.recentRegistrations.map((registration) => (
                  <article
                    key={`${registration.id}-${registration.createdAt}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <Avatar
                      name={registration.name}
                      imageUrl={registration.profileImageUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">
                        {registration.name}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {registration.relativeTime}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-slate-500">
                      {formatInterestStatusLabel(registration.status)}
                    </span>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">
                  No recent registrations yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function HuckjamSidebarSummary({ camp }: { camp: CampWorkspace }) {
  const overview = getHuckjamOverview(camp);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
        Huckjam Summary
      </p>
      <div className="mt-3 grid gap-2">
        <div className="grid grid-cols-3 gap-2">
          <HuckjamSidebarMetric label="Confirmed" value={overview.confirmedCount} />
          <HuckjamSidebarMetric label="Waitlist" value={overview.waitlistCount} />
          <HuckjamSidebarMetric label="Declined" value={overview.declinedCount} />
        </div>
      </div>
    </section>
  );
}

function HuckjamMetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>
        <div className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-sky-700">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function HuckjamSidebarMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
      <p className="text-[0.64rem] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-black tracking-tight text-slate-950">
        {value}
      </p>
    </div>
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

function FlightCapacityCard({
  hasTimetable,
  bookedMinutes,
  availableMinutes,
}: {
  hasTimetable: boolean;
  bookedMinutes: number;
  availableMinutes: number;
}) {
  if (!hasTimetable) {
    return (
      <div className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
          Flight Capacity
        </p>
        <p className="mt-1 text-2xl font-black text-slate-950">N/A</p>
        <p className="mt-2 text-xs font-black text-slate-500">
          No timetable created yet.
        </p>
      </div>
    );
  }

  const totalMinutes = bookedMinutes + availableMinutes;
  const bookedPercent =
    totalMinutes > 0 ? Math.min((bookedMinutes / totalMinutes) * 100, 100) : 0;
  const bookedLabel = `${bookedPercent.toFixed(bookedPercent % 1 === 0 ? 0 : 1)}% booked`;

  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
        Flight Capacity
      </p>
      <p className="mt-1 text-2xl font-black text-slate-950">
        {bookedMinutes} / {totalMinutes} min
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div
          className="h-full rounded-full bg-sky-600"
          style={{ width: `${bookedPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-black text-slate-500">{bookedLabel}</p>
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
  const waitlistParticipants = camp.participants.filter(
    (item) => item.status === "waitlist",
  );

  if (camp.type === "huck_jam") {
    const declinedParticipants = camp.participants.filter(
      (item) => item.status === "declined",
    );

    if (pendingParticipants.length > 0) {
      items.push({
        label: `${pendingParticipants.length} new applicants`,
        tone: "amber",
        target: "applicants",
        count: pendingParticipants.length,
        participantId: pendingParticipants[0]?.id,
      });
    }
    if (waitlistParticipants.length > 0) {
      items.push({
        label: `${waitlistParticipants.length} waitlist registrations`,
        tone: "slate",
        target: "participant",
        count: waitlistParticipants.length,
        participantId: waitlistParticipants[0]?.id,
      });
    }
    if (declinedParticipants.length > 0) {
      items.push({
        label: `${declinedParticipants.length} declined registrations`,
        tone: "slate",
        target: "participant",
        count: declinedParticipants.length,
        participantId: declinedParticipants[0]?.id,
      });
    }

    return items;
  }

  const participantsWithSlots = new Set(
    camp.timetableSlots.flatMap((slot) =>
      slot.bookings.map((booking) => booking.userId),
    ),
  );
  const participantsMissingSlots = accepted.filter(
    (item) => !item.selfBookingEnabled,
  ).filter(
    (item) => item.userId && !participantsWithSlots.has(item.userId),
  );
  const participantsMissingTunnelTime = accepted.filter(
    (item) => !item.tunnelTimeStatus,
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
  if (camp.status === "published" && !camp.tunnelSharedAt) {
    items.push({
      label: "Tunnel not informed",
      tone: "amber",
      target: "share",
      count: 1,
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

function getHuckjamOverview(camp: CampWorkspace) {
  const confirmedParticipants = camp.participants.filter(
    (participant) => participant.status === "accepted",
  );
  const waitlistCount = camp.participants.filter(
    (participant) => participant.status === "waitlist",
  ).length;
  const declinedCount = camp.participants.filter(
    (participant) => participant.status === "declined",
  ).length;
  const confirmedCount = confirmedParticipants.length;
  const availableSpots = Math.max(camp.totalCapacity - confirmedCount, 0);
  const revenue = confirmedCount * camp.price;
  const capacityPercent =
    camp.totalCapacity > 0
      ? Math.min(Math.round((confirmedCount / camp.totalCapacity) * 100), 100)
      : 0;

  return {
    confirmedCount,
    waitlistCount,
    declinedCount,
    availableSpots,
    revenue,
    capacityPercent,
    daysRemaining: getDaysRemainingUntil(camp.startDate),
    recentRegistrations: getRecentRegistrations(camp.participants),
  };
}

function getRecentRegistrations(participants: Participant[]): HuckjamRegistration[] {
  const activeRegistrations = participants.filter(
    (participant) =>
      participant.status !== "declined" && participant.status !== "withdrawn",
  );
  const source = activeRegistrations.length > 0 ? activeRegistrations : participants;

  return [...source]
    .sort((a, b) => {
      const left = new Date(b.createdAt).getTime();
      const right = new Date(a.createdAt).getTime();
      return left - right;
    })
    .slice(0, 3)
    .map((participant) => ({
      id: participant.id,
      name: participant.name,
      profileImageUrl: participant.profileImageUrl,
      createdAt: participant.createdAt,
      relativeTime: formatRelativeTime(participant.createdAt),
      status: participant.status,
    }));
}

function getDaysRemainingUntil(dateValue: string, now = new Date()) {
  const target = new Date(`${dateValue}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  if (Number.isNaN(target.getTime())) {
    return 0;
  }

  return Math.max(
    Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    0,
  );
}

function formatRelativeTime(value: string, now = new Date()) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const deltaMs = timestamp - now.getTime();
  const absMinutes = Math.abs(deltaMs) / (1000 * 60);

  if (absMinutes < 60) {
    const rounded = Math.max(1, Math.round(absMinutes));
    return `${rounded} minute${rounded === 1 ? "" : "s"} ${
      deltaMs < 0 ? "ago" : "from now"
    }`;
  }

  const absHours = absMinutes / 60;
  if (absHours < 24) {
    const rounded = Math.max(1, Math.round(absHours));
    return `${rounded} hour${rounded === 1 ? "" : "s"} ${
      deltaMs < 0 ? "ago" : "from now"
    }`;
  }

  const absDays = absHours / 24;
  if (absDays < 7) {
    const rounded = Math.max(1, Math.round(absDays));
    return `${rounded} day${rounded === 1 ? "" : "s"} ${
      deltaMs < 0 ? "ago" : "from now"
    }`;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
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


