export type OpportunityType = "camp" | "huck_jam";

export type OpportunityStatus = "draft" | "published" | "full" | "cancelled";

export type BookingMode = "approval_required" | "direct_time_booking";

export type InterestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "waitlist"
  | "withdrawn";

export type InterestType = "application" | "timetable_reminder";

export type ContactMethod = "whatsapp" | "instagram" | "email";

export type Athlete = {
  id: string;
  name: string;
  country: string;
  phone: string;
  instagram: string;
  homeTunnelId: string;
  disciplines: string[];
};

export type Coach = {
  id: string;
  name: string;
  country: string;
  avatarUrl: string;
  headline: string;
  bio: string;
  languages: string[];
  disciplines: string[];
  instagram: string;
  whatsapp: string;
  followers: number;
};

export type Tunnel = {
  id: string;
  name: string;
  city: string;
  country: string;
  distanceKm: number;
  imageUrl: string;
  followers: number;
  amenities: string[];
};

export type Opportunity = {
  id: string;
  type: OpportunityType;
  bookingMode: BookingMode;
  title: string;
  coachId?: string;
  coachName?: string;
  coachFollowId?: string;
  tunnelId: string;
  tunnelName?: string;
  tunnelCity?: string;
  tunnelCountry?: string;
  tunnelRegion?: string;
  tunnelDistanceKm?: number;
  locationLabel?: string;
  isLastMinute?: boolean;
  startDate: string;
  endDate: string;
  registrationDeadline: string | null;
  sessionStart?: string | null;
  sessionEnd?: string | null;
  price: number;
  currency: string;
  totalCapacity: number;
  availableSpots: number;
  hasPublishedTimetable?: boolean;
  remainingTimetableMinutes?: number;
  minMinutesOrHours?: string;
  description: string;
  languages: string[];
  disciplines: string[];
  skillLevel: string | null;
  status: OpportunityStatus;
  viewerInterestStatus?: InterestStatus;
  unreadNotificationCount?: number;
  contactMethod: ContactMethod;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Interest = {
  id: string;
  opportunityId: string;
  athleteId: string;
  status: InterestStatus;
  message?: string;
  createdAt: string;
  updatedAt?: string;
};

export type FollowTargetType = "coach" | "tunnel";

export type Follow = {
  id: string;
  followerId: string;
  targetType: FollowTargetType;
  targetId: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  opportunityId?: string;
  read: boolean;
  createdAt: string;
};
