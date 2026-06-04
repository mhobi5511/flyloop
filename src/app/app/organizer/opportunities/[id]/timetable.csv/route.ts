import {
  getPriceAppliesToMinutesNumber,
  getTimetableOverviewRows,
} from "@/lib/timetable";
import {
  filenameFor,
  getOrganizerTimetableExport,
} from "../timetable-export";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { opportunity, slots } = await getOrganizerTimetableExport(id);
  const priceBasisMinutes = getPriceAppliesToMinutesNumber(
    opportunity.priceAppliesToMinutes,
  );
  const rows = getTimetableOverviewRows(
    slots,
    Number(opportunity.price),
    priceBasisMinutes,
  );
  const csv = [
    [
      "Opportunity Name",
      "Date",
      "Start Time",
      "Duration Minutes",
      "Athlete Name",
      "Athlete Email if available",
      "Athlete Phone if available",
      "Status",
      "Pricing Basis",
      "Estimated Price",
    ],
    ...rows.map((row) => [
      opportunity.title,
      row.slotDate,
      row.startTime.slice(0, 5),
      String(row.durationMinutes),
      row.athleteName,
      row.athleteEmail,
      row.athletePhone,
      row.status,
      `${formatCsvMoney(Number(opportunity.price))} ${opportunity.currency} per ${priceBasisMinutes} min`,
      row.status === "booked"
        ? `${formatCsvMoney(row.estimatedPrice)} ${opportunity.currency}`
        : "",
    ]),
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${filenameFor(opportunity.title)}-timetable.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatCsvMoney(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(value);
}
