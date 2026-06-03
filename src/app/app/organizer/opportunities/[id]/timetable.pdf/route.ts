import {
  formatTimetableDate,
  formatTimetableTime,
  groupTimetableSlotsByDay,
  type TimetableSlot,
} from "@/lib/timetable";
import {
  filenameFor,
  getOrganizerTimetableExport,
} from "../timetable-export";

type PdfLine = {
  text: string;
  size: number;
  font: "regular" | "bold";
  gap: number;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { opportunity, slots } = await getOrganizerTimetableExport(id);
  const pdf = buildTimetablePdf({
    opportunityTitle: opportunity.title,
    tunnelName: opportunity.tunnelName,
    slots,
  });

  return new Response(pdf, {
    headers: {
      "Content-Disposition": `attachment; filename="${filenameFor(opportunity.title)}-timetable.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}

function buildTimetablePdf({
  opportunityTitle,
  tunnelName,
  slots,
}: {
  opportunityTitle: string;
  tunnelName: string;
  slots: TimetableSlot[];
}) {
  const lines = getPdfLines({ opportunityTitle, tunnelName, slots });
  const pages: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let y = 792;

  for (const line of lines) {
    if (y - line.gap < 60 && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      y = 792;
    }

    currentPage.push(line);
    y -= line.gap;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return createPdfDocument(pages);
}

function getPdfLines({
  opportunityTitle,
  tunnelName,
  slots,
}: {
  opportunityTitle: string;
  tunnelName: string;
  slots: TimetableSlot[];
}): PdfLine[] {
  const lines: PdfLine[] = [
    { text: `Camp: ${opportunityTitle}`, size: 18, font: "bold", gap: 24 },
    { text: `Tunnel: ${tunnelName}`, size: 12, font: "regular", gap: 26 },
  ];

  for (const day of groupTimetableSlotsByDay(slots)) {
    lines.push({
      text: formatTimetableDate(day.date),
      size: 14,
      font: "bold",
      gap: 22,
    });

    for (const slot of day.slots) {
      lines.push({
        text: `${formatTimetableTime(slot.startTime)} (${slot.bookings.length} / ${slot.capacity} booked)`,
        size: 12,
        font: "bold",
        gap: 18,
      });

      for (const booking of slot.bookings) {
        lines.push({
          text: `- ${booking.athleteName || "Participant"} (${booking.minutes} min)`,
          size: 11,
          font: "regular",
          gap: 15,
        });
      }

      for (let index = 0; index < slot.openSpots; index += 1) {
        lines.push({
          text: "- Open",
          size: 11,
          font: "regular",
          gap: 15,
        });
      }

      lines.push({ text: "", size: 8, font: "regular", gap: 8 });
    }
  }

  return lines;
}

function createPdfDocument(pages: PdfLine[][]) {
  const encoder = new TextEncoder();
  const objects: string[] = [];
  const pageRefs: number[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let nextObjectId = 5;

  for (const page of pages) {
    const contentObjectId = nextObjectId;
    nextObjectId += 1;
    const pageObjectId = nextObjectId;
    nextObjectId += 1;
    const stream = getPageContent(page);

    pageRefs.push(pageObjectId);
    objects[contentObjectId] = `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`;
    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
      `/Contents ${contentObjectId} 0 R >>`;
  }

  objects[2] =
    `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] ` +
    `/Count ${pageRefs.length} >>`;

  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) {
      continue;
    }

    offsets[id] = encoder.encode(output).length;
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(output).length;
  output += `xref\n0 ${objects.length}\n`;
  output += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }

  output +=
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(output);
}

function getPageContent(lines: PdfLine[]) {
  let y = 760;
  const commands: string[] = [];

  for (const line of lines) {
    if (line.text) {
      const fontName = line.font === "bold" ? "F2" : "F1";
      commands.push(
        `BT /${fontName} ${line.size} Tf 50 ${y} Td (${escapePdfText(line.text)}) Tj ET`,
      );
    }

    y -= line.gap;
  }

  return commands.join("\n");
}

function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
