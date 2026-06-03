import { Badge } from "./Badge";
import type { InterestStatus } from "@/lib/types";

const labels: Record<InterestStatus, string> = {
  accepted: "Accepted",
  pending: "Pending",
  waitlist: "Waitlist",
  declined: "Declined",
  withdrawn: "Withdrawn",
  timetable_reminder: "Reminder Set",
};

const icons: Record<InterestStatus, string> = {
  accepted: "+",
  pending: "!",
  waitlist: "i",
  declined: "x",
  withdrawn: "-",
  timetable_reminder: "i",
};

export function ApplicationStatusBadge({ status }: { status: InterestStatus }) {
  return (
    <Badge tone={applicationStatusTone(status)}>
      <span className="mr-1 font-black">{icons[status]}</span>
      {labels[status]}
    </Badge>
  );
}

export function applicationStatusTone(status: InterestStatus) {
  if (status === "accepted") {
    return "green";
  }

  if (status === "declined") {
    return "red";
  }

  if (status === "waitlist" || status === "timetable_reminder") {
    return "blue";
  }

  if (status === "withdrawn") {
    return "slate";
  }

  return "amber";
}

export function applicationStatusLabel(status: InterestStatus) {
  return labels[status];
}

export function applicantBorderClass(status: InterestStatus) {
  if (status === "accepted") {
    return "border-l-4 border-l-emerald-500";
  }

  if (status === "declined") {
    return "border-l-4 border-l-rose-500";
  }

  if (status === "waitlist" || status === "timetable_reminder") {
    return "border-l-4 border-l-sky-500";
  }

  if (status === "withdrawn") {
    return "border-l-4 border-l-slate-400";
  }

  return "border-l-4 border-l-amber-400";
}
