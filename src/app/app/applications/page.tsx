import Link from "next/link";
import { applicantBorderClass } from "@/components/ApplicationStatusBadge";
import { Badge } from "@/components/Badge";
import { NotificationCountBadge } from "@/components/NotificationCountBadge";
import { PrefetchedOpportunityLink } from "@/components/PrefetchedOpportunityLink";
import { WithdrawApplicationButton } from "@/components/WithdrawApplicationButton";
import {
  countUnreadByOpportunity,
  participantActivityNotificationTypes,
} from "@/lib/notifications";
import { isOpportunityCompleted } from "@/lib/opportunity-lifecycle";
import {
  formatOpportunityDate,
  formatSessionTimeRange,
  formatOpportunityType,
  formatPrice,
  formatPriceLabel,
} from "@/lib/opportunities";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { calculateEstimatedCost } from "@/lib/timetable";
import type { InterestStatus, OpportunityType } from "@/lib/types";
import { redirect } from "next/navigation";

type ApplicationRow = {
  id: string;
  status: InterestStatus;
  interest_type: string | null;
  created_at: string;
  opportunities:
    | {
        id: string;
        title: string;
        type: OpportunityType;
        start_date: string;
        end_date: string;
        session_start: string | null;
        session_end: string | null;
        price: number | string;
        currency: string;
        min_minutes_or_hours: string | null;
        tunnel_profiles:
          | { id: string; name: string; city: string | null; country: string | null }
          | Array<{ id: string; name: string; city: string | null; country: string | null }>
          | null;
        coach_profiles:
          | {
              profiles: { full_name: string } | Array<{ full_name: string }> | null;
            }
          | Array<{
              profiles: { full_name: string } | Array<{ full_name: string }> | null;
            }>
          | null;
        profiles:
          | { full_name: string }
          | Array<{ full_name: string }>
          | null;
      }
    | Array<{
        id: string;
        title: string;
        type: OpportunityType;
        start_date: string;
        end_date: string;
        session_start: string | null;
        session_end: string | null;
        price: number | string;
        currency: string;
        min_minutes_or_hours: string | null;
        tunnel_profiles:
          | { id: string; name: string; city: string | null; country: string | null }
          | Array<{ id: string; name: string; city: string | null; country: string | null }>
          | null;
        coach_profiles:
          | {
              profiles: { full_name: string } | Array<{ full_name: string }> | null;
            }
          | Array<{
              profiles: { full_name: string } | Array<{ full_name: string }> | null;
            }>
          | null;
        profiles:
          | { full_name: string }
          | Array<{ full_name: string }>
          | null;
      }>;
};

type ApplicationsSearchParams = {
  month?: string;
  tunnel?: string;
};

type UserBookingRow = {
  id: string;
  opportunity_id: string;
  minutes: number;
  opportunity_time_slots:
    | { slot_date: string; start_time: string }
    | Array<{ slot_date: string; start_time: string }>
    | null;
};

const activeStatuses: InterestStatus[] = [
  "pending",
  "accepted",
  "waitlist",
];

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<ApplicationsSearchParams>;
}) {
  const filters = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/app/applications");
  }

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: applications },
    unreadNotificationsResult,
    bookingResult,
  ] = await Promise.all([
    supabase
      .from("opportunity_interests")
      .select("id,status,interest_type,created_at,opportunities(id,title,type,start_date,end_date,session_start,session_end,price,currency,min_minutes_or_hours,tunnel_profiles(id,name,city,country),coach_profiles(profiles(full_name)),profiles!opportunities_created_by_fkey(full_name))")
      .eq("athlete_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("opportunity_id,type,body")
      .eq("user_id", user.id)
      .eq("read", false)
      .in("type", [...participantActivityNotificationTypes]),
    supabase
      .from("opportunity_slot_bookings")
      .select(
        "id,opportunity_id,minutes,is_final,opportunity_time_slots(slot_date,start_time),opportunities!inner(type,end_date)",
      )
      .eq("user_id", user.id)
      .eq("is_final", true)
      .eq("opportunities.type", "camp")
      .gte("opportunities.end_date", today),
  ]);
  if (unreadNotificationsResult.error) {
    console.error(
      "Applications unread notification lookup failed",
      unreadNotificationsResult.error,
    );
  }
  const now = new Date();
  const unreadCountsByOpportunity = countUnreadByOpportunity(
    unreadNotificationsResult.error ? [] : (unreadNotificationsResult.data ?? []),
  );
  const allRows = ((applications ?? []) as ApplicationRow[]).filter(
    (application) => application.interest_type !== "timetable_reminder",
  );
  const currentRows = allRows.filter((application) => {
    const opportunity = getOpportunity(application);

    return (
      activeStatuses.includes(application.status) &&
      Boolean(opportunity) &&
      !isOpportunityCompleted(
        { endDate: opportunity?.end_date ?? "", registrationDeadline: null },
        now,
      )
    );
  });
  const pastRows = allRows.filter((application) => {
    const opportunity = getOpportunity(application);

    return (
      Boolean(opportunity) &&
      isOpportunityCompleted(
        { endDate: opportunity?.end_date ?? "", registrationDeadline: null },
        now,
      )
    );
  });
  if (bookingResult.error) {
    console.error("My Flying booking lookup failed", bookingResult.error);
  }

  const bookingRows = bookingResult.error ? [] : bookingResult.data ?? [];
  const bookingsByOpportunity = groupBookingsByOpportunity(
    (bookingRows ?? []) as UserBookingRow[],
  );
  const monthOptions = getMonthOptions(allRows);
  const tunnelOptions = getTunnelOptions(allRows);
  const selectedMonth = monthOptions.some((option) => option.value === filters.month)
    ? filters.month
    : "";
  const selectedTunnel = tunnelOptions.some((option) => option.id === filters.tunnel)
    ? filters.tunnel
    : "";
  const currentDisplayRows = currentRows.filter((application) => {
    const opportunity = getOpportunity(application);
    const tunnel = opportunity ? getTunnel(opportunity) : null;

    return (
      (!selectedMonth || opportunity?.start_date.slice(0, 7) === selectedMonth) &&
      (!selectedTunnel || tunnel?.id === selectedTunnel)
    );
  });
  const pastDisplayRows = pastRows.filter((application) => {
    const opportunity = getOpportunity(application);
    const tunnel = opportunity ? getTunnel(opportunity) : null;

    return (
      (!selectedMonth || opportunity?.start_date.slice(0, 7) === selectedMonth) &&
      (!selectedTunnel || tunnel?.id === selectedTunnel)
    );
  });
  return (
    <>
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">My Flights</h1>
      </div>

      <form className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:items-end" action="/app/applications">
        <label className="grid gap-1 text-xs font-bold text-slate-600 sm:w-44">
          Month
          <select
            name="month"
            defaultValue={selectedMonth}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm"
          >
            <option value="">All months</option>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-600 sm:w-56">
          Tunnel
          <select
            name="tunnel"
            defaultValue={selectedTunnel}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm"
          >
            <option value="">All tunnels</option>
            {tunnelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="col-span-2 h-10 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm sm:col-span-1"
        >
          Filter
        </button>
      </form>

      <div className="mt-4 grid gap-3">
        {currentDisplayRows.map((application) => {
          const opportunity = getOpportunity(application);

          if (!opportunity) {
            return null;
          }

          const tunnel = getTunnel(opportunity);
          const unreadCount = unreadCountsByOpportunity.get(opportunity.id) ?? 0;

          return (
            <article
              key={application.id}
              className={`relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${applicantBorderClass(application.status)}`}
            >
              <NotificationCountBadge count={unreadCount} />
              <PrefetchedOpportunityLink href={`/app/opportunities/${opportunity.id}`} className="block p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
                      {formatOpportunityType(opportunity.type)}
                    </Badge>
                  </div>
                  <h2 className="mt-2 line-clamp-2 text-base font-black tracking-tight text-slate-950">
                    {opportunity.title}
                  </h2>
                  <div className="mt-2 grid gap-0.5 text-sm text-slate-600">
                    <p className="font-semibold text-slate-700">
                      {tunnel?.name ?? "Tunnel"}
                    </p>
                    <p className="text-xs">
                      {formatOpportunityDate(
                        opportunity.type,
                        opportunity.start_date,
                        opportunity.end_date,
                      )}
                      {tunnel ? ` · ${formatLocation(tunnel.city, tunnel.country)}` : ""}
                    </p>
                    {opportunity.type === "huck_jam" ? (
                      <p className="text-xs font-semibold text-slate-700">
                        Session:{" "}
                        {formatSessionTimeRange(
                          opportunity.session_start,
                          opportunity.session_end,
                        ) || "Time to be confirmed"}
                      </p>
                    ) : null}
                    <p className="text-xs font-semibold text-slate-700">
                      {formatPrice(Number(opportunity.price), opportunity.currency)}{" "}
                      <span className="text-slate-500">
                        {formatPriceLabel(
                          opportunity.type,
                          opportunity.min_minutes_or_hours,
                        )}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              {opportunity.type === "camp" &&
              (bookingsByOpportunity.get(opportunity.id) ?? []).length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-black uppercase text-slate-500">
                    Booked times
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(bookingsByOpportunity.get(opportunity.id) ?? []).map(
                      (booking) => (
                        <span
                          key={booking.id}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700"
                        >
                          {formatBookedTime(booking.date, booking.time)}
                        </span>
                      ),
                    )}
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-600">
                    Estimated total:{" "}
                    {formatMoney(
                      calculateEstimatedCost(
                        Number(opportunity.price),
                        (bookingsByOpportunity.get(opportunity.id) ?? []).reduce(
                          (total, booking) => total + booking.minutes,
                          0,
                        ),
                        opportunity.min_minutes_or_hours,
                      ),
                      opportunity.currency,
                    )}
                  </p>
                </div>
              ) : null}
              </PrefetchedOpportunityLink>
              {application.status === "pending" || application.status === "waitlist" ? (
                <div className="px-3 pb-3">
                  <WithdrawApplicationButton interestId={application.id} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {pastDisplayRows.length > 0 ? (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-950">
                Past
              </h2>
              <p className="mt-0.5 text-sm font-semibold text-slate-500">
                Completed opportunities stay in your history.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3">
            {pastDisplayRows.map((application) => {
              const opportunity = getOpportunity(application);

              if (!opportunity) {
                return null;
              }

              const tunnel = getTunnel(opportunity);
              const unreadCount = unreadCountsByOpportunity.get(opportunity.id) ?? 0;

              return (
                <article
                  key={application.id}
                  className={`relative rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${applicantBorderClass(application.status)}`}
                >
                  <NotificationCountBadge count={unreadCount} />
                  <PrefetchedOpportunityLink href={`/app/opportunities/${opportunity.id}`} className="block p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={opportunity.type === "camp" ? "blue" : "green"}>
                            {formatOpportunityType(opportunity.type)}
                          </Badge>
                        </div>
                        <h2 className="mt-2 line-clamp-2 text-base font-black tracking-tight text-slate-950">
                          {opportunity.title}
                        </h2>
                        <div className="mt-2 grid gap-0.5 text-sm text-slate-600">
                          <p className="font-semibold text-slate-700">
                            {tunnel?.name ?? "Tunnel"}
                          </p>
                          <p className="text-xs">
                            {formatOpportunityDate(
                              opportunity.type,
                              opportunity.start_date,
                              opportunity.end_date,
                            )}
                            {tunnel ? ` Â· ${formatLocation(tunnel.city, tunnel.country)}` : ""}
                          </p>
                          <p className="text-xs font-semibold text-slate-700">
                            {formatPrice(Number(opportunity.price), opportunity.currency)}{" "}
                            <span className="text-slate-500">
                              {formatPriceLabel(
                                opportunity.type,
                                opportunity.min_minutes_or_hours,
                              )}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </PrefetchedOpportunityLink>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {currentDisplayRows.length === 0 && pastDisplayRows.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>You have not sent interest for any opportunities yet.</p>
          <Link
            href="/app"
            className="mt-3 inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white"
          >
            Find your next camp
          </Link>
        </div>
      ) : currentDisplayRows.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No current flights match those filters.
        </p>
      ) : null}
    </>
  );
}

function formatLocation(city?: string | null, country?: string | null) {
  if (city && country) {
    return `${city}, ${country}`;
  }

  return city ?? country ?? "Location to be confirmed";
}

function getOpportunity(application: ApplicationRow) {
  return Array.isArray(application.opportunities)
    ? application.opportunities[0]
    : application.opportunities;
}

function getTunnel(opportunity: NonNullable<ReturnType<typeof getOpportunity>>) {
  return Array.isArray(opportunity.tunnel_profiles)
    ? opportunity.tunnel_profiles[0]
    : opportunity.tunnel_profiles;
}

function getMonthOptions(applications: ApplicationRow[]) {
  const months = new Map<string, string>();

  for (const application of applications) {
    const opportunity = getOpportunity(application);

    if (!opportunity?.start_date) {
      continue;
    }

    const value = opportunity.start_date.slice(0, 7);
    months.set(value, formatMonthLabel(value));
  }

  return Array.from(months, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.value.localeCompare(b.value),
  );
}

function getTunnelOptions(applications: ApplicationRow[]) {
  const tunnels = new Map<string, string>();

  for (const application of applications) {
    const opportunity = getOpportunity(application);
    const tunnel = opportunity ? getTunnel(opportunity) : null;

    if (tunnel?.id) {
      tunnels.set(tunnel.id, tunnel.name);
    }
  }

  return Array.from(tunnels, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function groupBookingsByOpportunity(bookings: UserBookingRow[]) {
  const groupedBookings = new Map<
    string,
    Array<{ id: string; date: string; time: string; minutes: number }>
  >();

  for (const booking of bookings) {
    const slot = Array.isArray(booking.opportunity_time_slots)
      ? booking.opportunity_time_slots[0]
      : booking.opportunity_time_slots;

    if (!slot) {
      continue;
    }

    const opportunityBookings = groupedBookings.get(booking.opportunity_id) ?? [];
    opportunityBookings.push({
      id: booking.id,
      date: slot.slot_date,
      time: slot.start_time,
      minutes: booking.minutes,
    });
    groupedBookings.set(
      booking.opportunity_id,
      opportunityBookings.sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
      ),
    );
  }

  return groupedBookings;
}

function formatBookedTime(dateValue: string, timeValue: string) {
  const date = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));

  return `${date}, ${timeValue.slice(0, 5)}`;
}

function formatMoney(value: number, currency: string) {
  const currencyLabel = currency === "EUR" ? "€" : currency;
  return `${new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currencyLabel}`;
}
