-- Speeds organizer opportunity lists that filter by creator and order/split by date.
create index if not exists opportunities_created_by_start_date_idx
on public.opportunities(created_by, start_date);

-- Speeds athlete application/history lookups ordered by the application timestamp.
create index if not exists opportunity_interests_athlete_created_at_idx
on public.opportunity_interests(athlete_id, created_at desc);

-- Speeds per-opportunity status queues and their most-recently-updated ordering.
create index if not exists opportunity_interests_opportunity_status_updated_at_idx
on public.opportunity_interests(opportunity_id, status, updated_at desc);

-- Covers My Flying's finalized-booking lookup without indexing mutable draft rows.
create index if not exists opportunity_slot_bookings_final_user_opportunity_idx
on public.opportunity_slot_bookings(user_id, opportunity_id)
where is_final = true;

-- Speeds unread pending push fan-out lookups by opportunity and notification type.
create index if not exists notifications_pending_push_opportunity_type_user_idx
on public.notifications(opportunity_id, type, user_id)
where push_sent_at is null and read = false;
