import type { FlyloopProfileStats } from "@/lib/flyloop-history";
import type { TimetableSlot } from "@/lib/timetable";
import type {
  BookingMode,
  InterestStatus,
  OpportunityStatus,
  OpportunityType,
} from "@/lib/types";

export type Participant = {
  id: string;
  interestId: string;
  userId: string;
  accountUserId: string | null;
  participantProfileId: string;
  participantStatus: "registered" | "guest" | "claim_pending" | "archived";
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string | null;
  bio: string | null;
  instagramHandle: string | null;
  websiteUrl: string | null;
  youtubeUrl: string | null;
  homeTunnelName: string | null;
  homeTunnelCity: string | null;
  homeTunnelCountry: string | null;
  profileImageUrl: string;
  status: InterestStatus;
  createdAt: string;
  removalRequestedAt: string | null;
  tunnelTimeStatus: string | null;
  tunnelAccountEmail: string | null;
  selfBookingEnabled: boolean;
  profileStats: FlyloopProfileStats | null;
};

export type CampPreference = {
  opportunityId: string;
  participantId: string;
  dayId: number;
  preferredMinutes: number;
};

export type CampWorkspace = {
  id: string;
  title: string;
  type: OpportunityType;
  bookingMode: BookingMode;
  status: OpportunityStatus;
  startDate: string;
  endDate: string;
  registrationDeadline: string | null;
  tunnelTimeMode:
    | "athletes_may_use_own_tunnel_time"
    | "tunnel_time_must_be_purchased_through_coach";
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

export function getDateRange(startDate: string, endDate: string) {
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

export function formatInterestStatusLabel(status: InterestStatus) {
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

export function formatLongDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
