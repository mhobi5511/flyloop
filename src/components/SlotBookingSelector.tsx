"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  bookOpportunitySlots,
  releaseOwnOpportunitySlot,
  setCampTunnelTimeStatus,
} from "@/app/app/opportunities/actions";
import {
  calculateEstimatedCost,
  getPriceAppliesToMinutesNumber,
} from "@/lib/timetable";
import type { TunnelTimeStatus } from "@/lib/types";

type SlotOption = {
  id: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  remainingCapacity: number;
  userHasBooking: boolean;
};

type SlotBookingSelectorProps = {
  opportunityId: string;
  price: number;
  priceAppliesToMinutes?: string | null;
  currency: string;
  slots: SlotOption[];
  initialTunnelTimeStatus?: TunnelTimeStatus | null;
  initialTunnelAccountEmail?: string | null;
  changesClosed?: boolean;
};

export function SlotBookingSelector({
  opportunityId,
  price,
  priceAppliesToMinutes,
  currency,
  slots,
  initialTunnelTimeStatus = null,
  initialTunnelAccountEmail = null,
  changesClosed = false,
}: SlotBookingSelectorProps) {
  const router = useRouter();
  const bookedSlotIds = useMemo(
    () => slots.filter((slot) => slot.userHasBooking).map((slot) => slot.id),
    [slots],
  );
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(bookedSlotIds);
  const [tunnelTimeStatus, setTunnelTimeStatus] = useState<TunnelTimeStatus | "">(
    initialTunnelTimeStatus ?? "",
  );
  const [tunnelAccountEmail, setTunnelAccountEmail] = useState(
    initialTunnelAccountEmail ?? "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const selectedSlots = slots.filter((slot) => selectedSlotIds.includes(slot.id));
  const newSelectedSlotIds = selectedSlotIds.filter(
    (slotId) => !bookedSlotIds.includes(slotId),
  );
  const removedBookedSlotIds = bookedSlotIds.filter(
    (slotId) => !selectedSlotIds.includes(slotId),
  );
  const hasPendingChanges =
    newSelectedSlotIds.length > 0 || removedBookedSlotIds.length > 0;
  const hasTunnelTimeStatusChange =
    selectedSlotIds.length > 0 &&
    (tunnelTimeStatus !== (initialTunnelTimeStatus ?? "") ||
      normalizedEmail(tunnelAccountEmail) !==
        normalizedEmail(initialTunnelAccountEmail ?? ""));
  const canSave =
    hasPendingChanges || (hasTunnelTimeStatusChange && selectedSlotIds.length > 0);
  const selectedCount = selectedSlotIds.length;
  const totalMinutes = selectedSlots.reduce(
    (sum, slot) => sum + slot.durationMinutes,
    0,
  );
  const priceBasisMinutes = getPriceAppliesToMinutesNumber(priceAppliesToMinutes);
  const estimatedTotal = calculateEstimatedCost(
    price,
    totalMinutes,
    priceBasisMinutes,
  );
  const groupedSlots = useMemo(() => groupSlotsByDay(slots), [slots]);

  function toggleSlot(slot: SlotOption) {
    if (changesClosed || isPending) {
      return;
    }

    if (!slot.userHasBooking && slot.remainingCapacity <= 0) {
      return;
    }

    setMessage("");
    setError("");
    setSelectedSlotIds((current) =>
      current.includes(slot.id)
        ? current.filter((slotId) => slotId !== slot.id)
        : [...current, slot.id],
    );
  }

  function saveSlotChanges() {
    setMessage("");
    setError("");

    if (selectedSlotIds.length > 0) {
      const tunnelTimeError = getTunnelTimeError(
        tunnelTimeStatus,
        tunnelAccountEmail,
      );

      if (tunnelTimeError) {
        setError(tunnelTimeError);
        return;
      }
    }

    startTransition(async () => {
      let statusResult: Awaited<ReturnType<typeof setCampTunnelTimeStatus>> | null =
        null;

      if (selectedSlotIds.length > 0) {
        statusResult = await setCampTunnelTimeStatus(opportunityId, {
          status: tunnelTimeStatus,
          accountEmail: tunnelAccountEmail,
        });

        if (!statusResult.ok) {
          setError(statusResult.message);
          return;
        }
      }

      for (const slotId of removedBookedSlotIds) {
        const releaseResult = await releaseOwnOpportunitySlot(opportunityId, slotId);

        if (!releaseResult.ok) {
          setError(releaseResult.message);
          return;
        }
      }

      const result =
        newSelectedSlotIds.length > 0
          ? await bookOpportunitySlots(opportunityId, newSelectedSlotIds, {
              status: tunnelTimeStatus,
              accountEmail: tunnelAccountEmail,
            })
          : statusResult ?? { ok: true as const, message: "Your slots were updated." };

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(
        removedBookedSlotIds.length > 0 && newSelectedSlotIds.length === 0
          ? "Slot released."
          : result.message,
      );
      window.setTimeout(() => {
        router.refresh();
      }, 700);
    });
  }

  return (
    <div className="grid gap-3">
      {groupedSlots.length > 0 ? (
        groupedSlots.map((day) => (
          <section
            key={day.date}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="rounded-t-2xl border-b border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-black uppercase text-slate-500">
                {formatSlotDate(day.date)}
              </p>
            </header>
            <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
              {day.slots.map((slot) => {
                const isSelected = selectedSlotIds.includes(slot.id);
                const isFull = slot.remainingCapacity <= 0;
                const disabled =
                  changesClosed || isPending || (!slot.userHasBooking && isFull);

                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleSlot(slot)}
                    className={`min-h-20 rounded-xl border px-2.5 py-2 text-left transition ${
                      slot.userHasBooking
                        ? isSelected
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-300 bg-white"
                        : isSelected
                          ? "border-sky-300 bg-sky-50"
                          : isFull
                            ? "border-slate-200 bg-slate-100 opacity-60"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:text-slate-400`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-lg font-black leading-5 text-slate-950">
                          {formatSlotTime(slot.startTime)}
                        </span>
                        <span className="mt-1 block text-xs font-black text-slate-600">
                          {slot.durationMinutes} min
                        </span>
                      </span>
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                          slot.userHasBooking
                            ? "border-emerald-500 bg-emerald-600 text-white"
                            : isSelected
                              ? "border-sky-500 bg-sky-600 text-white"
                              : "border-slate-200 bg-white text-transparent"
                        }`}
                      >
                        <Check size={14} />
                      </span>
                    </span>
                    <span className="mt-2 block text-[0.68rem] font-black uppercase text-slate-500">
                      {slot.userHasBooking && isSelected
                        ? "Booked"
                        : slot.userHasBooking
                          ? "Will release"
                        : isFull
                          ? "Full"
                          : `${slot.remainingCapacity} open`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
          No published slots are available yet.
        </p>
      )}

      <section className="sticky bottom-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {changesClosed ? (
          <p className="mb-3 rounded-xl bg-slate-100 p-3 text-center text-sm font-black text-slate-600">
            Booking changes are no longer available.
          </p>
        ) : null}
        <p className="mb-2 text-center text-xs font-bold text-slate-500">
          {formatMoney(price, currency)} per {priceBasisMinutes} min
        </p>
        {selectedSlotIds.length > 0 ? (
          <section className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
            <h2 className="text-sm font-black text-slate-950">Tunnel Time</h2>
            <div className="mt-2 grid gap-2">
              <label className="flex gap-2 rounded-lg bg-white px-2.5 py-2 text-sm font-bold text-slate-700">
                <input
                  type="radio"
                  name="tunnel-time-status"
                  value="owns_tunnel_time"
                  checked={tunnelTimeStatus === "owns_tunnel_time"}
                  onChange={() => setTunnelTimeStatus("owns_tunnel_time")}
                  className="mt-1"
                />
                <span>I already have tunnel time at this tunnel</span>
              </label>
              <label className="flex gap-2 rounded-lg bg-white px-2.5 py-2 text-sm font-bold text-slate-700">
                <input
                  type="radio"
                  name="tunnel-time-status"
                  value="needs_tunnel_time"
                  checked={tunnelTimeStatus === "needs_tunnel_time"}
                  onChange={() => setTunnelTimeStatus("needs_tunnel_time")}
                  className="mt-1"
                />
                <span>I need to purchase tunnel time</span>
              </label>
            </div>
            {tunnelTimeStatus === "owns_tunnel_time" ? (
              <label className="mt-3 grid gap-1 text-sm font-bold text-slate-700">
                Email address used for the tunnel account
                <input
                  type="email"
                  value={tunnelAccountEmail}
                  onChange={(event) => setTunnelAccountEmail(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-semibold outline-none focus:border-sky-400"
                  placeholder="name@example.com"
                />
                <span className="text-xs font-semibold text-slate-500">
                  Please enter the email address that you used to purchase or
                  manage your tunnel time at this tunnel.
                </span>
              </label>
            ) : null}
          </section>
        ) : null}
        <div className="grid grid-cols-3 gap-2 text-center">
          <SummaryValue label="Slots" value={String(selectedCount)} />
          <SummaryValue label="Minutes" value={String(totalMinutes)} />
          <SummaryValue
            label="Estimate"
            value={formatMoney(estimatedTotal, currency)}
          />
        </div>
        <button
          type="button"
          disabled={changesClosed || isPending || !canSave}
          onClick={saveSlotChanges}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
        >
          <Send size={17} /> {isPending ? "Saving..." : "Save Times"}
        </button>
        {message ? (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <p className="text-[0.68rem] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function groupSlotsByDay(slots: SlotOption[]) {
  const groups = new Map<string, SlotOption[]>();

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

function formatSlotDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatSlotTime(value: string) {
  return value.slice(0, 5);
}

function formatMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function getTunnelTimeError(
  status: TunnelTimeStatus | "",
  accountEmail: string,
) {
  if (!status) {
    return "Choose your tunnel time status.";
  }

  if (status === "owns_tunnel_time") {
    const email = normalizedEmail(accountEmail);

    if (!email) {
      return "Enter the email address used for your tunnel account.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Enter a valid tunnel account email address.";
    }
  }

  return "";
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}
