"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, CheckCircle2, Send, ShoppingCart, X } from "lucide-react";
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
  const [isTunnelTimeModalOpen, setIsTunnelTimeModalOpen] = useState(false);
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
  const needsTunnelTimePrompt =
    selectedSlotIds.length > 0 && !initialTunnelTimeStatus;
  const canSave = hasPendingChanges;
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

  function handleSaveRequest() {
    setMessage("");
    setError("");

    if (needsTunnelTimePrompt) {
      setIsTunnelTimeModalOpen(true);
      return;
    }

    saveSlotChanges();
  }

  function saveSlotChanges() {
    setMessage("");
    setError("");

    if (needsTunnelTimePrompt) {
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

      if (needsTunnelTimePrompt) {
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
              status: tunnelTimeStatus || initialTunnelTimeStatus || "",
              accountEmail: tunnelAccountEmail || initialTunnelAccountEmail || "",
            })
          : statusResult ?? { ok: true as const, message: "Your slots were saved as draft." };

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setIsTunnelTimeModalOpen(false);
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
                        ? "Draft"
                        : slot.userHasBooking
                          ? "Draft"
                          : isSelected
                            ? "Selected"
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
          onClick={handleSaveRequest}
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

      {isTunnelTimeModalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tunnel-time-title"
        >
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="tunnel-time-title"
                  className="text-lg font-black text-slate-950"
                >
                  Do you already have tunnel time at this tunnel?
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  This is needed before your selected times are saved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTunnelTimeModalOpen(false)}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                aria-pressed={tunnelTimeStatus === "owns_tunnel_time"}
                onClick={() => setTunnelTimeStatus("owns_tunnel_time")}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  tunnelTimeStatus === "owns_tunnel_time"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 size={22} className="shrink-0" />
                <span className="text-base font-black">
                  I already have tunnel time
                </span>
              </button>
              <button
                type="button"
                aria-pressed={tunnelTimeStatus === "needs_tunnel_time"}
                onClick={() => setTunnelTimeStatus("needs_tunnel_time")}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  tunnelTimeStatus === "needs_tunnel_time"
                    ? "border-sky-300 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <ShoppingCart size={22} className="shrink-0" />
                <span className="text-base font-black">
                  I need to buy tunnel time
                </span>
              </button>
            </div>

            {tunnelTimeStatus === "owns_tunnel_time" ? (
              <label className="mt-4 grid gap-1 text-sm font-bold text-slate-700">
                Email address used for your tunnel account
                <input
                  type="email"
                  required
                  value={tunnelAccountEmail}
                  onChange={(event) => setTunnelAccountEmail(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold outline-none focus:border-sky-400"
                  placeholder="name@example.com"
                />
                <span className="text-xs font-semibold leading-5 text-slate-500">
                  Please enter the email address you used to buy or manage your
                  tunnel time at this tunnel.
                </span>
              </label>
            ) : null}

            {error ? (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsTunnelTimeModalOpen(false)}
                className="h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={saveSlotChanges}
                className="h-11 rounded-xl bg-sky-600 px-4 text-sm font-black text-white hover:bg-sky-700 disabled:bg-slate-300"
              >
                {isPending ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
  const currencyLabel = currency === "EUR" ? "€" : currency;
  return `${new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currencyLabel}`;
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
