export type TimetableBooking = {
  id: string;
  minutes: number;
  rotationMinutes: number | null;
  userId: string;
  athleteName: string;
  athletePhone: string;
  isFinal?: boolean;
  finalizedAt?: string | null;
  releaseRequestedAt?: string | null;
};

export type TimetableSlot = {
  id: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  isPublished?: boolean;
  bookings: TimetableBooking[];
};

export type TimetableOverviewRow = {
  id: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  athleteName: string;
  athleteEmail: string;
  athletePhone: string;
  status: "booked" | "open";
  estimatedPrice: number;
};

export type TimetableSlotGroup = {
  id: string;
  slotDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  isPublished?: boolean;
  bookings: TimetableBooking[];
  openSpots: number;
};

export function getPriceAppliesToMinutesNumber(minutes?: string | number | null) {
  const parsed =
    typeof minutes === "number" ? minutes : Number(String(minutes ?? "").trim());

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export function calculateEstimatedCost(
  price: number,
  bookedMinutes: number,
  priceAppliesToMinutes?: string | number | null,
) {
  const appliesToMinutes = getPriceAppliesToMinutesNumber(priceAppliesToMinutes);
  return bookedMinutes * (price / appliesToMinutes);
}

export function getTimetableSummary(
  slots: TimetableSlot[],
  price: number,
  priceAppliesToMinutes?: string | number | null,
) {
  const totalSlots = slots.reduce((total, slot) => total + slot.capacity, 0);
  const bookedSlots = slots.reduce(
    (total, slot) => total + slot.bookings.length,
    0,
  );
  const totalBookedMinutes = slots.reduce(
    (total, slot) =>
      total +
      slot.bookings.reduce((bookingTotal, booking) => bookingTotal + booking.minutes, 0),
    0,
  );
  const totalTimetableMinutes = slots.reduce(
    (total, slot) => total + slot.durationMinutes * slot.capacity,
    0,
  );

  return {
    totalSlots,
    bookedSlots,
    openSlots: Math.max(totalSlots - bookedSlots, 0),
    totalTimetableMinutes,
    totalBookedMinutes,
    totalAvailableMinutes: Math.max(totalTimetableMinutes - totalBookedMinutes, 0),
    estimatedRevenue: calculateEstimatedCost(
      price,
      totalBookedMinutes,
      priceAppliesToMinutes,
    ),
  };
}

export function getTimetableSlotGroups(slots: TimetableSlot[]) {
  return slots
    .map((slot): TimetableSlotGroup => ({
      ...slot,
      openSpots: Math.max(slot.capacity - slot.bookings.length, 0),
    }))
    .sort((a, b) =>
      `${a.slotDate} ${a.startTime}`.localeCompare(`${b.slotDate} ${b.startTime}`),
    );
}

export function getTimetableOverviewRows(
  slots: TimetableSlot[],
  price: number,
  priceAppliesToMinutes?: string | number | null,
) {
  const rows: TimetableOverviewRow[] = [];

  for (const slot of slots) {
    for (const booking of slot.bookings) {
      rows.push({
        id: booking.id,
        slotDate: slot.slotDate,
        startTime: slot.startTime,
        durationMinutes: booking.minutes,
        athleteName: booking.athleteName,
        athleteEmail: "",
        athletePhone: booking.athletePhone,
        status: "booked",
        estimatedPrice: calculateEstimatedCost(
          price,
          booking.minutes,
          priceAppliesToMinutes,
        ),
      });
    }

    const openCount = Math.max(slot.capacity - slot.bookings.length, 0);

    for (let index = 0; index < openCount; index += 1) {
      rows.push({
        id: `${slot.id}-open-${index}`,
        slotDate: slot.slotDate,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        athleteName: "",
        athleteEmail: "",
        athletePhone: "",
        status: "open",
        estimatedPrice: 0,
      });
    }
  }

  return rows.sort((a, b) =>
    `${a.slotDate} ${a.startTime} ${a.status}`.localeCompare(
      `${b.slotDate} ${b.startTime} ${b.status}`,
    ),
  );
}

export function groupTimetableSlotsByDay(slots: TimetableSlot[]) {
  const groups = new Map<string, TimetableSlotGroup[]>();

  for (const slot of getTimetableSlotGroups(slots)) {
    const daySlots = groups.get(slot.slotDate) ?? [];
    daySlots.push(slot);
    groups.set(slot.slotDate, daySlots);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots,
    }));
}

export function groupTimetableRowsByDay(rows: TimetableOverviewRow[]) {
  const groups = new Map<string, TimetableOverviewRow[]>();

  for (const row of rows) {
    const dayRows = groups.get(row.slotDate) ?? [];
    dayRows.push(row);
    groups.set(row.slotDate, dayRows);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, dayRows]) => ({
      date,
      rows: dayRows.sort((a, b) =>
        `${a.startTime} ${a.status}`.localeCompare(`${b.startTime} ${b.status}`),
      ),
    }));
}

export function formatTimetableDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatTimetableTime(value: string) {
  return value.slice(0, 5);
}

export function formatTimetableMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

export function formatTimetablePlainText({
  opportunityTitle,
  tunnelName,
  price,
  currency,
  priceAppliesToMinutes,
  slots,
}: {
  opportunityTitle: string;
  tunnelName: string;
  price?: number;
  currency?: string;
  priceAppliesToMinutes?: string | number | null;
  slots: TimetableSlot[];
}) {
  const lines = [`Camp: ${opportunityTitle}`, `Tunnel: ${tunnelName}`];

  if (price !== undefined && currency) {
    lines.push(
      `Pricing: ${formatTimetableMoney(price, currency)} per ${getPriceAppliesToMinutesNumber(
        priceAppliesToMinutes,
      )} min`,
    );
  }

  lines.push("");

  for (const day of groupTimetableSlotsByDay(slots)) {
    lines.push(formatTimetableDate(day.date), "");

    for (const slot of day.slots) {
      lines.push(formatTimetableTime(slot.startTime));

      for (const booking of slot.bookings) {
        lines.push(`- ${booking.athleteName || "Participant"} (${booking.minutes} min)`);
      }

      for (let index = 0; index < slot.openSpots; index += 1) {
        lines.push("- Open");
      }

      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
