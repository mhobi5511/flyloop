import { formatTimetablePlainText } from "@/lib/timetable";
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
  const text = formatTimetablePlainText({
    opportunityTitle: opportunity.title,
    tunnelName: opportunity.tunnelName,
    price: Number(opportunity.price),
    currency: opportunity.currency,
    priceAppliesToMinutes: opportunity.priceAppliesToMinutes,
    slots,
  });

  return new Response(text, {
    headers: {
      "Content-Disposition": `attachment; filename="${filenameFor(opportunity.title)}-timetable.txt"`,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
