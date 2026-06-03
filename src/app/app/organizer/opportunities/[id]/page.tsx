import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AtSign,
  Bell,
  CalendarDays,
  Download,
  FileDown,
  FileText,
  MapPin,
  MessageCircle,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import {
  releaseParticipantTimesForm,
  sendTimetableBookingReminderForm,
} from "@/app/app/organizer/opportunities/actions";
import { AppShell } from "@/components/AppShell";
import { ApplicantStatusActions } from "@/components/ApplicantStatusActions";
import {
  ApplicationStatusBadge,
  applicantBorderClass,
} from "@/components/ApplicationStatusBadge";
import { Avatar } from "@/components/Avatar";
import { NotificationReadSignal } from "@/components/NotificationReadSignal";
import { OrganizerOpportunityActions } from "@/components/OrganizerOpportunityActions";
import {
  formatDateRange,
  formatOpportunityType,
  formatPrice,
  getOpportunityShareText,
  getPublicOpportunityUrl,
} from "@/lib/opportunities";
import { phoneToWhatsAppPath } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatTimetableDate,
  formatTimetableMoney,
  formatTimetableTime,
  getTimetableSummary,
  groupTimetableSlotsByDay,
  type TimetableSlot,
} from "@/lib/timetable";
import type { InterestStatus, OpportunityStatus, OpportunityType } from "@/lib/types";

type OrganizerOpportunity = {
  id: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  start_date: string;
  end_date: string;
  total_capacity: number;
  available_spots: number;
  price: number | string;
  currency: string;
  description: string | null;
  tunnel_profiles:
    | { name: string; city: string | null; country: string | null }
    | Array<{ name: string; city: string | null; country: string | null }>
    | null;
};

type ApplicantRow = {
  id: string;
  status: InterestStatus;
  created_at: string;
  profiles:
    | {
        id: string;
        full_name: string;
        country: string | null;
        phone: string | null;
        whatsapp_number: string | null;
        instagram_handle: string | null;
        profile_image_url: string | null;
      }
    | Array<{
        id: string;
        full_name: string;
        country: string | null;
        phone: string | null;
        whatsapp_number: string | null;
        instagram_handle: string | null;
        profile_image_url: string | null;
      }>
    | null;
};

type TimetableSlotRow = {
  id: string;
  slot_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  is_published: boolean;
  opportunity_slot_bookings:
    | Array<{
        id: string;
        minutes: number;
        user_id: string;
        profiles:
          | {
              full_name: string;
              phone: string | null;
              whatsapp_number: string | null;
            }
          | Array<{
              full_name: string;
              phone: string | null;
              whatsapp_number: string | null;
            }>
          | null;
      }>
    | null;
};

export default async function OrganizerOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ published?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [
    { data: profile },
    { data: opportunity },
    { count: timetableSlotCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_organizer,wants_to_create_opportunities")
      .eq("id", user?.id)
      .maybeSingle(),
    supabase
      .from("opportunities")
      .select("id,title,type,status,start_date,end_date,total_capacity,available_spots,price,currency,description,tunnel_profiles(name,city,country)")
      .eq("id", id)
      .eq("created_by", user?.id)
      .maybeSingle(),
    supabase
      .from("opportunity_time_slots")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", id),
  ]);

  if (!opportunity) {
    notFound();
  }

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user?.id)
    .eq("opportunity_id", id)
    .eq("type", "new_interest")
    .eq("read", false);

  const { data: applicants } = await supabase
    .from("opportunity_interests")
    .select("id,status,created_at,profiles!opportunity_interests_athlete_id_fkey(id,full_name,country,phone,whatsapp_number,instagram_handle,profile_image_url)")
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false });
  const { data: timetableRows } = await supabase
    .from("opportunity_time_slots")
    .select("id,slot_date,start_time,duration_minutes,capacity,is_published,opportunity_slot_bookings(id,minutes,user_id,profiles!opportunity_slot_bookings_user_id_fkey(full_name,phone,whatsapp_number))")
    .eq("opportunity_id", id)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });
  const canCreate =
    profile?.is_organizer === true ||
    profile?.wants_to_create_opportunities === true;
  const currentOpportunity = opportunity as OrganizerOpportunity;
  const applicantRows = (applicants ?? []) as ApplicantRow[];
  const timetableSlots = ((timetableRows ?? []) as TimetableSlotRow[]).map(
    (slot): TimetableSlot => ({
      id: slot.id,
      slotDate: slot.slot_date,
      startTime: slot.start_time,
      durationMinutes: slot.duration_minutes,
      capacity: slot.capacity,
      bookings: (slot.opportunity_slot_bookings ?? []).map((booking) => {
        const profile = Array.isArray(booking.profiles)
          ? booking.profiles[0]
          : booking.profiles;

        return {
          id: booking.id,
          minutes: booking.minutes,
          userId: booking.user_id,
          athleteName: profile?.full_name ?? "Participant",
          athletePhone: profile?.whatsapp_number ?? profile?.phone ?? "",
        };
      }),
    }),
  );
  const timetableSummary = getTimetableSummary(
    timetableSlots,
    Number(currentOpportunity.price),
  );
  const timetableDays = groupTimetableSlotsByDay(timetableSlots);
  const hasPublishedTimetable = ((timetableRows ?? []) as TimetableSlotRow[]).some(
    (slot) => slot.is_published,
  );
  const participantsWithBookings = new Set(
    timetableSlots.flatMap((slot) => slot.bookings.map((booking) => booking.userId)),
  );
  const publicUrl = getPublicOpportunityUrl(currentOpportunity.id);
  const shareLabel = `Share ${formatOpportunityType(currentOpportunity.type)}`;
  const typeLabel = formatOpportunityType(currentOpportunity.type);
  const showPublishedSuccess = resolvedSearchParams.published === "1";
  const tunnel = Array.isArray(currentOpportunity.tunnel_profiles)
    ? currentOpportunity.tunnel_profiles[0]
    : currentOpportunity.tunnel_profiles;
  const tunnelName = tunnel?.name ?? "Tunnel to be confirmed";
  const tunnelLocation = formatLocation(tunnel?.city, tunnel?.country);
  const shareText = getOpportunityShareText(
    {
      id: currentOpportunity.id,
      type: currentOpportunity.type,
      title: currentOpportunity.title,
      tunnelId: "",
      tunnelName,
      startDate: currentOpportunity.start_date,
      endDate: currentOpportunity.end_date,
      registrationDeadline: null,
      price: Number(currentOpportunity.price),
      currency: currentOpportunity.currency,
      totalCapacity: currentOpportunity.total_capacity,
      availableSpots: currentOpportunity.available_spots,
      description: currentOpportunity.description ?? "",
      languages: [],
      disciplines: [],
      skillLevel: null,
      status: currentOpportunity.status,
      contactMethod: "whatsapp",
      createdBy: "",
    },
    publicUrl,
  );

  return (
    <AppShell active="dashboard" canCreate={canCreate}>
      <NotificationReadSignal />
      {showPublishedSuccess ? (
        <section className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 shadow-sm">
          <p className="text-sm font-black text-sky-800">
            Opportunity published successfully.
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-700">
            Your {typeLabel} is now live.
          </p>
        </section>
      ) : null}
      <Link href="/app/dashboard" className="text-sm font-bold text-sky-700">
        Back to Coachings
      </Link>
      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_200px] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] font-black uppercase">
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                {formatOpportunityType(currentOpportunity.type)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                {currentOpportunity.status}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
              {currentOpportunity.title}
            </h1>
            <div className="mt-3 grid gap-1.5 text-sm font-semibold text-slate-700 sm:grid-cols-2">
              <p className="flex items-center gap-2">
                <MapPin size={16} className="text-sky-700" />
                <span>
                  <span className="font-black text-slate-900">{tunnelName}</span>
                  {tunnelLocation ? (
                    <span className="text-slate-500">, {tunnelLocation}</span>
                  ) : null}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays size={16} className="text-sky-700" />
                {formatDateRange(
                  currentOpportunity.start_date,
                  currentOpportunity.end_date,
                )}
              </p>
              <p className="flex items-center gap-2">
                <Users size={16} className="text-sky-700" />
                {currentOpportunity.available_spots}/
                {currentOpportunity.total_capacity} open
              </p>
              <p className="flex items-center gap-2">
                <WalletCards size={16} className="text-sky-700" />
                {formatPrice(
                  Number(currentOpportunity.price),
                  currentOpportunity.currency,
                )}
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <OrganizerOpportunityActions
              opportunityId={currentOpportunity.id}
              shareLabel={shareLabel}
              shareText={shareText}
              shareUrl={publicUrl}
              hasTimetable={(timetableSlotCount ?? 0) > 0}
            />
          </div>
        </div>
      </section>

      {timetableSlots.length > 0 ? (
        <details className="group mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight">Timetable</h2>
                <div className="mt-2 grid grid-cols-1 gap-2 text-sm font-bold text-slate-700 sm:grid-cols-3">
                  <p>
                    <span className="text-slate-500">Booked Slots: </span>
                    <span className="font-black text-slate-950">
                      {timetableSummary.bookedSlots} / {timetableSummary.totalSlots}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">Booked Minutes: </span>
                    <span className="font-black text-slate-950">
                      {timetableSummary.totalBookedMinutes}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">Estimated Revenue: </span>
                    <span className="font-black text-slate-950">
                      {formatTimetableMoney(
                        timetableSummary.estimatedRevenue,
                        currentOpportunity.currency,
                      )}
                    </span>
                  </p>
                </div>
              </div>
              <span className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-black text-white transition group-open:hidden">
                Expand
              </span>
              <span className="hidden h-9 items-center justify-center rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 transition group-open:inline-flex">
                Collapse
              </span>
            </div>
          </summary>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TimetableStat
                label="Slots booked"
                value={`${timetableSummary.bookedSlots} / ${timetableSummary.totalSlots}`}
                caption="Slots Booked"
              />
              <TimetableStat
                label="Booked minutes"
                value={timetableSummary.totalBookedMinutes}
              />
              <TimetableStat
                label="Est. revenue"
                value={formatTimetableMoney(
                  timetableSummary.estimatedRevenue,
                  currentOpportunity.currency,
                )}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/app/organizer/opportunities/${currentOpportunity.id}/timetable.csv`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                <Download size={15} /> CSV
              </Link>
              <Link
                href={`/app/organizer/opportunities/${currentOpportunity.id}/timetable.pdf`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                <FileDown size={15} /> Download PDF
              </Link>
              <Link
                href={`/app/organizer/opportunities/${currentOpportunity.id}/timetable.txt`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                <FileText size={15} /> Download Formatted Text
              </Link>
            </div>

            <div className="mt-4 grid gap-4">
              {timetableDays.map((day) => (
                <section key={day.date} className="grid gap-2">
                  <h3 className="text-base font-black text-slate-950">
                    {formatTimetableDate(day.date)}
                  </h3>
                  <div className="grid gap-3">
                    {day.slots.map((slot) => (
                      <article
                        key={slot.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-3 py-2 text-white">
                          <p className="text-base font-black">
                            {formatTimetableTime(slot.startTime)}
                          </p>
                          <p className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-black">
                            {slot.bookings.length} / {slot.capacity} booked
                          </p>
                        </div>
                        <div className="grid gap-1.5 p-2">
                          {slot.bookings.map((booking) => (
                            <div
                              key={booking.id}
                              className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg bg-white px-2.5 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-950">
                                  {booking.athleteName || "Participant"}
                                </p>
                                <p className="text-xs font-bold text-slate-500">
                                  {booking.minutes} min
                                </p>
                              </div>
                              <form
                                action={releaseParticipantTimesForm.bind(
                                  null,
                                  currentOpportunity.id,
                                  booking.userId,
                                )}
                              >
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-xs font-black text-rose-700 transition hover:bg-rose-50"
                                >
                                  <XCircle size={14} /> Release Times
                                </button>
                              </form>
                            </div>
                          ))}
                          {Array.from({ length: slot.openSpots }).map((_, index) => (
                            <div
                              key={`${slot.id}-open-${index}`}
                              className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-2.5 py-2 text-sm font-bold text-slate-400"
                            >
                              Open Spot
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      <section className="mt-4">
        <h2 className="text-xl font-black tracking-tight">Applicants</h2>
        <div className="mt-2 grid gap-2">
          {applicantRows.map((applicant) => {
            const profile = Array.isArray(applicant.profiles)
              ? applicant.profiles[0]
              : applicant.profiles;
            const phone = profile?.whatsapp_number ?? profile?.phone ?? "";
            const instagram = profile?.instagram_handle ?? "";
            const canSendTimetableReminder =
              applicant.status === "accepted" &&
              hasPublishedTimetable &&
              Boolean(profile?.id) &&
              !participantsWithBookings.has(profile?.id ?? "");

            return (
              <article
                key={applicant.id}
                className={`rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm ${applicantBorderClass(applicant.status)}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 gap-2.5">
                      {profile?.id ? (
                        <Link href={`/app/users/${profile.id}`}>
                          <Avatar
                            name={profile?.full_name}
                            imageUrl={profile?.profile_image_url}
                            size="sm"
                          />
                        </Link>
                      ) : (
                        <Avatar
                          name={profile?.full_name}
                          imageUrl={profile?.profile_image_url}
                          size="sm"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {profile?.id ? (
                            <Link
                              href={`/app/users/${profile.id}`}
                              className="font-black text-slate-950 hover:text-sky-700"
                            >
                              {profile?.full_name ?? "Applicant"}
                            </Link>
                          ) : (
                            <h3 className="font-black text-slate-950">
                              {profile?.full_name ?? "Applicant"}
                            </h3>
                          )}
                          <ApplicationStatusBadge status={applicant.status} />
                        </div>
                        <div className="mt-1 grid gap-0.5 text-xs text-slate-600">
                          <p>{profile?.country ?? "Country not set"}</p>
                          <p>Phone: {phone || "Not provided"}</p>
                        </div>
                        {canSendTimetableReminder && profile?.id ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                              No times booked
                            </span>
                            <form
                              action={sendTimetableBookingReminderForm.bind(
                                null,
                                currentOpportunity.id,
                                profile.id,
                              )}
                            >
                              <button
                                type="submit"
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 text-xs font-black text-amber-800 transition hover:bg-amber-50"
                              >
                                <Bell size={14} /> Send Reminder
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {phone ? (
                        <a
                          href={`https://wa.me/${phoneToWhatsAppPath(phone)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 text-xs font-bold text-white"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      ) : null}
                      {instagram ? (
                        <a
                          href={`https://instagram.com/${instagram}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-700"
                        >
                          <AtSign size={14} /> Instagram
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <ApplicantStatusActions
                    interestId={applicant.id}
                    currentStatus={applicant.status}
                  />
                </div>
              </article>
            );
          })}
        </div>
        {applicantRows.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No applicants yet.
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}

function formatLocation(city?: string | null, country?: string | null) {
  return [city, country].filter(Boolean).join(", ");
}

function TimetableStat({
  label,
  value,
  caption,
}: {
  label: string;
  value: number | string;
  caption?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[0.68rem] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
      {caption ? (
        <p className="text-xs font-bold text-slate-500">{caption}</p>
      ) : null}
    </div>
  );
}
