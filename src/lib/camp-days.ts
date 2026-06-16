export type CampDay = {
  dayId: number;
  date: string;
  label: string;
};

export function getCampDays(startDate: string, endDate: string): CampDay[] {
  const dates = getCampDayDates(startDate, endDate);

  if (dates.length === 0) {
    return [{ dayId: 1, date: "", label: "Day 1" }];
  }

  return dates.map((date, index) => ({
    dayId: index + 1,
    date,
    label: formatCampDayDate(date),
  }));
}

export function getCampDayDate(
  startDate: string,
  endDate: string,
  dayId: number,
) {
  return getCampDayDates(startDate, endDate)[Math.max(dayId - 1, 0)] ?? null;
}

export function formatCampDayPreferenceLabel(
  startDate: string,
  endDate: string,
  dayId: number,
) {
  const date = getCampDayDate(startDate, endDate, dayId);
  return date ? formatCampDayDate(date) : `Day ${dayId}`;
}

export function formatCampPreferenceMinutes(minutes: number) {
  return minutes <= 0 ? "No flying" : `${minutes} min`;
}

export function getCampDayDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate || startDate);

  if (!start || !end) {
    const fallbackDate = startDate || endDate;
    return fallbackDate ? [fallbackDate] : [];
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

export function formatCampDayDate(value: string) {
  const date = parseDate(value);

  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
