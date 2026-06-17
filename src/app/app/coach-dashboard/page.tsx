import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationReadSignal } from "@/components/NotificationReadSignal";
import {
  CoachCommandCenterWorkspace,
  type CoachWorkspaceActivityItem,
  type CoachWorkspaceAttentionItem,
  type CoachWorkspaceCamp,
  type CoachWorkspaceNotificationItem,
} from "@/components/CoachCommandCenterWorkspace";
import { isOpportunityCompleted } from "@/lib/opportunity-lifecycle";
import {
  activityFeedTypes,
  coachNotificationTypes,
} from "@/lib/notifications";
import { formatOpportunityDate } from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterestStatus, OpportunityStatus, OpportunityType } from "@/lib/types";

export const metadata: Metadata = {
  title: "Coach Command Center",
};

type CoachProfileRow = {
  full_name: string | null;
  is_organizer: boolean | null;
  wants_to_create_opportunities: boolean | null;
};

type CoachProfileDetailsRow = {
  languages: string[] | null;
  disciplines: string[] | null;
};

type CoachOpportunityRow = {
  id: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  start_date: string;
  end_date: string;
  registration_deadline: string | null;
  tunnel_shared_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  tunnel_profiles:
    | { name: string; city: string | null; country: string | null }
    | Array<{ name: string; city: string | null; country: string | null }>
    | null;
  opportunity_interests:
    | Array<{
        id: string;
        status: InterestStatus;
        self_booking_enabled: boolean | null;
        created_at: string | null;
        removal_requested_at: string | null;
        profiles:
          | { id: string; full_name: string | null }
          | Array<{ id: string; full_name: string | null }>
          | null;
      }>
    | null;
  opportunity_time_slots:
    | Array<{
        id: string;
        is_published: boolean;
        opportunity_slot_bookings:
          | Array<{
              id: string;
              user_id: string;
              release_requested_at: string | null;
              profiles:
                | { id: string; full_name: string | null }
                | Array<{ id: string; full_name: string | null }>
                | null;
            }>
          | null;
      }>
    | null;
};

type NotificationRow = {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
  opportunity_id: string | null;
  type: string;
};

export default async function CoachDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app/coach-dashboard");
  }

  const [profileResult, opportunityResult, unreadNotificationResult, activityNotificationResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,is_organizer,wants_to_create_opportunities")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("opportunities")
        .select(
          "id,title,type,status,start_date,end_date,registration_deadline,tunnel_shared_at,created_at,updated_at,tunnel_profiles(name,city,country),opportunity_interests(id,status,self_booking_enabled,created_at,removal_requested_at,profiles!opportunity_interests_athlete_id_fkey(id,full_name)),opportunity_time_slots(id,is_published,opportunity_slot_bookings(id,user_id,release_requested_at,profiles!opportunity_slot_bookings_user_id_fkey(id,full_name)))",
        )
        .eq("created_by", user.id)
        .neq("status", "cancelled")
        .order("start_date", { ascending: true }),
      supabase
        .from("notifications")
        .select("id,title,body,created_at,opportunity_id,type")
        .eq("user_id", user.id)
        .eq("read", false)
        .in("type", [...coachNotificationTypes])
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("notifications")
        .select("id,title,body,created_at,opportunity_id,type")
        .eq("user_id", user.id)
        .in("type", [...activityFeedTypes])
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  if (profileResult.error) {
    console.error("Coach dashboard profile lookup failed", profileResult.error);
  }

  if (opportunityResult.error) {
    console.error("Coach dashboard opportunity lookup failed", opportunityResult.error);
  }

  if (unreadNotificationResult.error) {
    console.error(
      "Coach dashboard unread notification lookup failed",
      unreadNotificationResult.error,
    );
  }

  if (activityNotificationResult.error) {
    console.error(
      "Coach dashboard activity notification lookup failed",
      activityNotificationResult.error,
    );
  }

  const profile = (profileResult.data ?? null) as CoachProfileRow | null;
  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;

  if (!canCreate) {
    redirect("/app/dashboard");
  }

  const { error: markReadError } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false)
    .in("type", [...coachNotificationTypes]);

  if (markReadError) {
    console.error("Coach dashboard read-state update failed", markReadError);
  }

  const [coachProfileResult, tunnelResult] = await Promise.all([
    supabase
      .from("coach_profiles")
      .select("languages,disciplines")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("tunnel_profiles")
      .select("id,name,city,country")
      .order("name", { ascending: true }),
  ]);

  if (coachProfileResult.error) {
    console.error("Coach dashboard coach profile lookup failed", coachProfileResult.error);
  }

  if (tunnelResult.error) {
    console.error("Coach dashboard tunnel lookup failed", tunnelResult.error);
  }

  const now = new Date();
  const opportunityRows = ((opportunityResult.data ?? []) as CoachOpportunityRow[])
    .filter((row) =>
      !isOpportunityCompleted(
        { endDate: row.end_date, registrationDeadline: row.registration_deadline },
        now,
      ),
    );
  const campRows = opportunityRows.filter((row) => row.type === "camp");
  const huckJamRows = opportunityRows.filter((row) => row.type === "huck_jam");
  const camps = campRows.map((row) => toCampModel(row)).sort((a, b) => {
    return (
      Number(b.hasAttention) - Number(a.hasAttention) ||
      b.actionScore - a.actionScore ||
      a.startDate.localeCompare(b.startDate) ||
      a.title.localeCompare(b.title)
    );
  });
  const huckJams = huckJamRows.map((row) => toCampModel(row)).sort((a, b) => {
    return (
      Number(b.hasAttention) - Number(a.hasAttention) ||
      b.actionScore - a.actionScore ||
      a.startDate.localeCompare(b.startDate) ||
      a.title.localeCompare(b.title)
    );
  });
  const attentionItems = buildAttentionItems(opportunityRows);
  const activityItems = buildActivityItems(
    (activityNotificationResult.data ?? []) as NotificationRow[],
    opportunityRows,
    profile?.full_name ?? "Coach",
  );
  const notifications = buildNotificationItems(
    (unreadNotificationResult.data ?? []) as NotificationRow[],
  );
  const inheritedCoachProfile = {
    languages: (coachProfileResult.data as CoachProfileDetailsRow | null)?.languages ?? [],
    disciplines:
      (coachProfileResult.data as CoachProfileDetailsRow | null)?.disciplines ?? [],
  };
  const tunnels = ((tunnelResult.data ?? []) as Array<{
    id: string;
    name: string;
    city: string | null;
    country: string | null;
  }>).map((tunnel) => ({
    id: tunnel.id,
    name: tunnel.name,
    city: tunnel.city ?? "",
    country: tunnel.country ?? "",
  }));

  return (
    <>
      <CoachCommandCenterWorkspace
        coachName={profile?.full_name?.trim() || "Coach"}
        camps={camps}
        huckJams={huckJams}
        attentionItems={attentionItems}
        activityItems={activityItems}
        notifications={notifications}
        tunnels={tunnels}
        inheritedCoachProfile={inheritedCoachProfile}
      />
      <NotificationReadSignal />
    </>
  );
}

function toCampModel(row: CoachOpportunityRow): CoachWorkspaceCamp {
  const tunnel = firstRelation(row.tunnel_profiles);
  const interests = (row.opportunity_interests ?? []).filter(
    (interest) => interest.status !== "withdrawn",
  );
  const applicants = interests
    .map((interest) => {
      const profile = firstRelation(interest.profiles);
      return {
        id: profile?.id ?? interest.id,
        interestId: interest.id,
        name: profile?.full_name?.trim() || "Participant",
        status: interest.status,
        selfBookingEnabled: interest.self_booking_enabled === true,
        removalRequestedAt: interest.removal_requested_at,
        tunnelTimeStatus: null,
        campTitle: row.title,
      };
    })
    .sort((a, b) => {
      const rankA = statusRank(a.status);
      const rankB = statusRank(b.status);
      return rankA - rankB || a.name.localeCompare(b.name);
    });

  const acceptedApplicants = applicants.filter(
    (applicant) => applicant.status === "accepted",
  );
  const waitlistApplications = applicants.filter(
    (applicant) => applicant.status === "waitlist",
  ).length;
  const pendingApplications = applicants.filter(
    (applicant) => applicant.status === "pending",
  ).length;
  const draftChanges = (row.opportunity_time_slots ?? []).filter(
    (slot) => !slot.is_published,
  ).length;
  const hasPublishedTimetable = (row.opportunity_time_slots ?? []).some(
    (slot) => slot.is_published,
  );
  const bookedUserIds = new Set(
    (row.opportunity_time_slots ?? []).flatMap((slot) =>
      (slot.opportunity_slot_bookings ?? [])
        .map((booking) => booking.user_id)
        .filter(Boolean),
    ),
  );
  const unassignedAthletes = acceptedApplicants.filter(
    (applicant) => !applicant.selfBookingEnabled && !bookedUserIds.has(applicant.id),
  ).length;
  const releaseRequests = buildReleaseRequests(row);
  const actionScore =
    pendingApplications * 4 +
    waitlistApplications * 3 +
    (hasPublishedTimetable && !row.tunnel_shared_at ? 4 : 0) +
    draftChanges * 3 +
    unassignedAthletes * 3 +
    releaseRequests.length * 4;

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    dateLabel: formatOpportunityDate(row.type, row.start_date, row.end_date),
    tunnelLabel: formatTunnelLabel(tunnel?.name ?? "Tunnel", tunnel?.city, tunnel?.country),
    tunnelSharedAt: row.tunnel_shared_at,
    athleteCount: acceptedApplicants.length,
    pendingApplications,
    waitlistApplications,
    draftChanges,
    unassignedAthletes,
    actionScore,
    hasAttention:
      pendingApplications > 0 ||
      waitlistApplications > 0 ||
      (hasPublishedTimetable && !row.tunnel_shared_at) ||
      draftChanges > 0 ||
      unassignedAthletes > 0 ||
      releaseRequests.length > 0,
    applicants,
    releaseRequests,
    createdAt: row.created_at,
  };
}

function buildAttentionItems(rows: CoachOpportunityRow[]): CoachWorkspaceAttentionItem[] {
  const items: CoachWorkspaceAttentionItem[] = [];

  for (const row of rows) {
    const campTitle = row.title;
    const campId = row.id;
    const interests = (row.opportunity_interests ?? []).filter(
      (interest) => interest.status !== "withdrawn",
    );
    const applicants = interests.map((interest) => {
      const profile = firstRelation(interest.profiles);
      return {
        id: profile?.id ?? interest.id,
        interestId: interest.id,
        name: profile?.full_name?.trim() || "An athlete",
        status: interest.status,
        selfBookingEnabled: interest.self_booking_enabled === true,
      };
    });

    const waitlistApplicants = applicants.filter(
      (applicant) => applicant.status === "waitlist",
    );
    const hasPublishedTimetable = (row.opportunity_time_slots ?? []).some(
      (slot) => slot.is_published,
    );

    for (const applicant of applicants.filter((item) => item.status === "pending")) {
      items.push({
        id: `application-${applicant.interestId}`,
        group: "Applications Waiting",
        kind: "application",
        title: `${applicant.name} applied to ${campTitle}`,
        description: `Review the application for ${campTitle} and decide what happens next.`,
        campId,
        campTitle,
        interestId: applicant.interestId,
      });
    }

    if (waitlistApplicants.length > 0) {
      const label = `${waitlistApplicants.length} athlete${waitlistApplicants.length === 1 ? "" : "s"} currently on the waitlist for ${campTitle}.`;
      items.push({
        id: `waitlist-${campId}`,
        group: "Waitlist",
        kind: "waitlist",
        title: waitlistApplicants.length === 1 ? `1 athlete is waiting for a spot in ${campTitle}.` : label,
        description:
          waitlistApplicants.length === 1
            ? `Open ${campTitle} to review the waitlisted participant and decide what happens next.`
            : `Open ${campTitle} to review the waitlisted participants and decide what happens next.`,
        campId,
        campTitle,
        workshopLabel: "Open Workspace",
      });
    }

    if (hasPublishedTimetable && !row.tunnel_shared_at) {
      const tunnel = firstRelation(row.tunnel_profiles);
      const tunnelName = tunnel?.name?.trim() || "the tunnel";

      items.push({
        id: `tunnel-${campId}`,
        group: "Tunnel Not Informed",
        kind: "tunnel",
        title: "Tunnel not informed",
        description: `${campTitle}: timetable published but not yet shared with ${tunnelName}.`,
        campId,
        campTitle,
      });
    }

    for (const request of buildReleaseRequests(row)) {
      items.push({
        id: `release-${request.bookingId}`,
        group: "Slot Removal Requests",
        kind: "release",
        title: "Slot Removal Request",
        description: `${request.name} wants to release a booked slot.\nOpportunity: ${campTitle}`,
        campId,
        campTitle,
        bookingId: request.bookingId,
      });
    }

    const draftChanges = (row.opportunity_time_slots ?? []).filter(
      (slot) => !slot.is_published,
    ).length;
    if (draftChanges > 0) {
      items.push({
        id: `draft-${campId}`,
        group: "Draft Changes Pending",
        kind: "draft",
        title: `${campTitle} has unpublished timetable changes`,
        description: `${draftChanges} slot${draftChanges === 1 ? "" : "s"} are still in draft.`,
        campId,
        campTitle,
      });
    }

    const acceptedApplicants = applicants.filter((item) => item.status === "accepted");
    const bookedIds = new Set(
      (row.opportunity_time_slots ?? []).flatMap((slot) =>
        (slot.opportunity_slot_bookings ?? [])
          .map((booking) => booking.user_id)
          .filter(Boolean),
      ),
    );
    const unassignedCount = acceptedApplicants.filter(
      (applicant) => !applicant.selfBookingEnabled && !bookedIds.has(applicant.id),
    ).length;

    if (unassignedCount > 0) {
      items.push({
        id: `unassigned-${campId}`,
        group: "Unassigned Athletes",
        kind: "unassigned",
        title: `${campTitle} has accepted athletes without assigned slots`,
        description: `${unassignedCount} accepted athlete${unassignedCount === 1 ? "" : "s"} still need assigned time.`,
        campId,
        campTitle,
      });
    }
  }

  return items;
}

function buildReleaseRequests(row: CoachOpportunityRow) {
  const requests: CoachWorkspaceCamp["releaseRequests"] = [];

  for (const slot of row.opportunity_time_slots ?? []) {
    for (const booking of slot.opportunity_slot_bookings ?? []) {
      if (!booking.release_requested_at) {
        continue;
      }

      const profile = firstRelation(booking.profiles);
      requests.push({
        id: booking.id,
        bookingId: booking.id,
        name: profile?.full_name?.trim() || "An athlete",
        campTitle: row.title,
      });
    }
  }

  return requests;
}

function buildNotificationItems(rows: NotificationRow[]): CoachWorkspaceNotificationItem[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title?.trim() || "Unread notification",
    body: row.body?.trim() || "",
    timestamp: row.created_at,
  }));
}

function buildActivityItems(
  rows: NotificationRow[],
  opportunities: CoachOpportunityRow[],
  coachName: string,
): CoachWorkspaceActivityItem[] {
  const items: CoachWorkspaceActivityItem[] = [];
  const campLookup = new Map(opportunities.map((row) => [row.id, row]));

  for (const row of rows) {
    const camp = row.opportunity_id ? campLookup.get(row.opportunity_id) : null;
    const campTitle = camp?.title ?? "a camp";
    const title = row.title?.trim() || "Activity update";
    const body = row.body?.trim() || getActivityBody(row.type, campTitle);

    items.push({
      id: `notification-${row.id}`,
      title,
      body,
      timestamp: row.created_at,
    });
  }

  for (const camp of opportunities) {
    if (!camp.created_at) {
      continue;
    }

    items.push({
      id: `created-${camp.id}`,
      title: `${coachName} created ${camp.title}`,
      body: `${camp.title} is now in the workspace.`,
      timestamp: camp.created_at,
    });
  }

  return items
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 5);
}

function getActivityBody(type: string, campTitle: string) {
  if (type === "new_interest") {
    return `${campTitle} received a new application.`;
  }

  if (type === "slot_release_requested") {
    return `A slot release was requested for ${campTitle}.`;
  }

  if (type === "timetable_published") {
    return `The timetable was published for ${campTitle}.`;
  }

  return campTitle;
}

function statusRank(status: InterestStatus) {
  if (status === "pending") {
    return 0;
  }

  if (status === "accepted") {
    return 1;
  }

  if (status === "waitlist") {
    return 2;
  }

  return 3;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatTunnelLabel(
  name: string,
  city: string | null | undefined,
  country: string | null | undefined,
) {
  const location = [city, country].filter(Boolean).join(", ");
  return location ? `${name} - ${location}` : name;
}
