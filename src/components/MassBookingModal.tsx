"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Save, X } from "lucide-react";

import { syncParticipantSlotBookingDraft } from "@/app/app/organizer/opportunities/actions";
import { Avatar } from "@/components/Avatar";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import {
  formatLongDay,
  getDateRange,
  type CampWorkspace,
  type Participant,
} from "@/components/coach-dashboard-shared";
import { formatTimetableTime } from "@/lib/timetable";

export function MassBookingModal({
  participant,
  camp,
  onClose,
}: {
  participant: Participant;
  camp: CampWorkspace;
  onClose: () => void;
}) {
  const router = useRouter();
  const participantBookedSlotIds = useMemo(
    () =>
      camp.timetableSlots.flatMap((slot) =>
        slot.bookings
          .filter((booking) => booking.userId === participant.userId)
          .map(() => slot.id),
      ),
    [camp.timetableSlots, participant.userId],
  );
  const campDays = useMemo(
    () =>
      getDateRange(camp.startDate, camp.endDate).map((date, index) => {
        const dayId = index + 1;
        const preference = camp.preferences.find(
          (item) => item.participantId === participant.userId && item.dayId === dayId,
        );
        const slots = camp.timetableSlots
          .filter((slot) => slot.slotDate === date)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        return {
          date,
          dayId,
          slots,
          requestedMinutes: preference?.preferredMinutes ?? 0,
        };
      }),
    [camp.endDate, camp.preferences, camp.startDate, camp.timetableSlots, participant.userId],
  );
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(
    () => participantBookedSlotIds,
  );
  const [dayWindowStart, setDayWindowStart] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const saveInFlightRef = useRef(false);
  const visibleDayCount = 3;

  const selectedSlotSet = useMemo(() => new Set(selectedSlotIds), [selectedSlotIds]);
  const dayColumns = useMemo(
    () =>
      campDays.map((day) => {
        const assignedMinutes = day.slots
          .filter((slot) => selectedSlotSet.has(slot.id))
          .reduce((total, slot) => total + slot.durationMinutes, 0);
        const status =
          day.requestedMinutes > 0
            ? assignedMinutes === day.requestedMinutes
              ? 'Fully Matched'
              : assignedMinutes < day.requestedMinutes
                ? `${day.requestedMinutes - assignedMinutes} min missing`
                : `${assignedMinutes - day.requestedMinutes} min extra`
            : assignedMinutes > 0
              ? `${assignedMinutes} min assigned`
              : 'No request';

        return {
          ...day,
          assignedMinutes,
          isMatched: day.requestedMinutes > 0 && assignedMinutes === day.requestedMinutes,
          status,
        };
      }),
    [campDays, selectedSlotSet],
  );
  const summaryTotals = useMemo(() => {
    const requestedMinutes = dayColumns.reduce((total, day) => total + day.requestedMinutes, 0);
    const assignedMinutes = dayColumns.reduce((total, day) => total + day.assignedMinutes, 0);
    const requestedDays = dayColumns.filter((day) => day.requestedMinutes > 0).length;
    const matchedDays = dayColumns.filter((day) => day.isMatched).length;
    const difference = assignedMinutes - requestedMinutes;
    const progressPercent =
      requestedMinutes > 0 ? Math.round((assignedMinutes / requestedMinutes) * 100) : 0;

    return {
      requestedMinutes,
      assignedMinutes,
      requestedDays,
      matchedDays,
      difference,
      progressPercent,
    };
  }, [dayColumns]);
  const maxDayWindowStart = Math.max(dayColumns.length - visibleDayCount, 0);
  const clampedDayWindowStart = Math.min(dayWindowStart, maxDayWindowStart);
  const visibleDays = dayColumns.slice(clampedDayWindowStart, clampedDayWindowStart + visibleDayCount);
  const canPageBack = clampedDayWindowStart > 0;
  const canPageForward = clampedDayWindowStart < maxDayWindowStart;

  function toggleSlot(slotId: string, isUnavailable: boolean) {
    if (isUnavailable) {
      return;
    }

    setSelectedSlotIds((current) =>
      current.includes(slotId)
        ? current.filter((value) => value !== slotId)
        : [...current, slotId],
    );
  }

  function moveDayWindow(direction: number) {
    setDayWindowStart((current) => {
      const next = current + direction * visibleDayCount;
      return Math.min(Math.max(next, 0), maxDayWindowStart);
    });
  }

  function saveAsDraft() {
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setError('');
    setMessage('');

    startTransition(async () => {
      try {
        const result = await syncParticipantSlotBookingDraft(
          camp.id,
          participant.userId,
          selectedSlotIds,
        );

        if (!result.ok) {
          setError(result.message);
          return;
        }

        setMessage(result.message);
        router.refresh();
        onClose();
      } catch (assignmentError) {
        console.error('Mass booking sync failed', assignmentError);
        setError('Could not save draft bookings.');
      } finally {
        saveInFlightRef.current = false;
      }
    });
  }

  return typeof document !== 'undefined'
    ? createPortal(
        <ModalBackdrop
          className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          onBackdropClick={onClose}
        >
          <section
            className="grid max-h-[calc(100dvh-2rem)] w-full max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-sky-700">
                  Mass Booking
                </p>
                <h2 className="mt-1 truncate text-lg font-black tracking-tight text-slate-950">
                  {participant.name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveDayWindow(-1)}
                  disabled={!canPageBack}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                >
                  <ChevronLeft size={14} />
                  Previous Days
                </button>
                <button
                  type="button"
                  onClick={() => moveDayWindow(1)}
                  disabled={!canPageForward}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                >
                  Next Days
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500"
                  aria-label="Close mass booking"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <aside className="grid content-start gap-3">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    Athlete
                  </h3>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar
                      name={participant.name}
                      imageUrl={participant.profileImageUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{participant.name}</p>
                      <p className="text-xs font-semibold text-slate-500">Draft bookings only</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                    Summary
                  </h3>
                  <div className="mt-3 grid gap-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white bg-white px-3 py-2">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">
                          Requested Time
                        </p>
                        <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
                          {summaryTotals.requestedMinutes} min
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white bg-white px-3 py-2">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">
                          Assigned Time
                        </p>
                        <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
                          {summaryTotals.assignedMinutes} min
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white bg-white px-3 py-2">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">
                          Progress
                        </p>
                        <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
                          {summaryTotals.progressPercent}%
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white bg-white px-3 py-2">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">
                          Days Matched
                        </p>
                        <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
                          {summaryTotals.matchedDays} / {summaryTotals.requestedDays}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">
                          Progress Bar
                        </p>
                        <p className="text-xs font-black text-slate-500">
                          {summaryTotals.progressPercent >= 100
                            ? 'Target reached'
                            : `${Math.max(0, 100 - summaryTotals.progressPercent)}% remaining`}
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            summaryTotals.difference === 0
                              ? 'bg-emerald-500'
                              : summaryTotals.difference < 0
                                ? 'bg-amber-500'
                                : 'bg-sky-600'
                          }`}
                          style={{ width: `${Math.min(summaryTotals.progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                    <p className="rounded-2xl border border-white bg-white px-3 py-2 text-sm font-bold text-slate-700">
                      {summaryTotals.difference === 0
                        ? 'Fully matched'
                        : summaryTotals.difference > 0
                          ? `${summaryTotals.difference} min extra`
                          : `${Math.abs(summaryTotals.difference)} min missing`}
                    </p>
                  </div>
                </section>
              </aside>

              <section className="min-h-0">
                <div className="flex items-end justify-between gap-3 pb-2">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
                      Assigned Days
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Showing days {clampedDayWindowStart + 1}
                      {visibleDays.length > 1 ? `-${clampedDayWindowStart + visibleDays.length}` : ''}
                      {' '}of {dayColumns.length}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleDays.map((day) => (
                    <article
                      key={day.date}
                      className={`rounded-2xl border p-4 ${
                        day.requestedMinutes > 0
                          ? 'border-sky-200 bg-sky-50/60'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-black text-slate-950">
                            {formatLongDay(day.date)}
                          </h4>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Requested {day.requestedMinutes} min
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500">
                          {day.slots.filter((slot) => selectedSlotSet.has(slot.id)).length} selected
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                          <span>Assigned</span>
                          <span className="font-black text-slate-950">{day.assignedMinutes} min</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                          <span>Status</span>
                          <span
                            className={`font-black ${
                              day.isMatched
                                ? 'text-emerald-700'
                                : day.requestedMinutes > day.assignedMinutes
                                  ? 'text-amber-700'
                                  : day.requestedMinutes < day.assignedMinutes
                                    ? 'text-sky-700'
                                    : 'text-slate-600'
                            }`}
                          >
                            {day.status}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        {day.slots.map((slot) => {
                          const hasOtherAthleteBooking = slot.bookings.some(
                            (booking) => booking.userId !== participant.userId,
                          );
                          const isAssigned = selectedSlotSet.has(slot.id);
                          const isUnavailable = !isAssigned && hasOtherAthleteBooking;

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => toggleSlot(slot.id, isUnavailable)}
                              className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                                isAssigned
                                  ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm'
                                  : isUnavailable
                                    ? 'border-slate-200 bg-slate-200 text-slate-500'
                                    : 'border-transparent bg-white text-slate-700 hover:border-sky-200 hover:bg-slate-50'
                              }`}
                              disabled={isPending || isUnavailable}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-950">
                                {formatTimetableTime(slot.startTime)}
                              </p>
                              <p className="text-xs font-bold text-slate-500">
                                {slot.durationMinutes} min
                              </p>
                            </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] ${
                                  isAssigned
                                    ? 'bg-sky-600 text-white'
                                    : isUnavailable
                                      ? 'bg-white text-slate-500'
                                      : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {isAssigned ? 'Assigned' : isUnavailable ? 'Unavailable' : 'Available'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            {error ? (
              <p className="mx-4 mb-0 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 sm:mx-6">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mx-4 mb-0 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 sm:mx-6">
                {message}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={saveAsDraft}
                disabled={isPending}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-3 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
              >
                <Save size={16} />
                {isPending ? 'Saving...' : 'Save As Draft'}
              </button>
            </div>
          </section>
        </ModalBackdrop>,
        document.body,
      )
    : null;
}
