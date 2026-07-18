-- Return the notification bell list and all navigation badge counts in one
-- RLS-scoped query. Counts stay in PostgreSQL; only the latest rows cross the
-- network.
create or replace function public.get_notification_center_snapshot(
  target_limit integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with unread_counts as (
    select
      count(*)::integer as bell_unread_count,
      count(*) filter (
        where notification.type = any(array[
          'new_interest',
          'application_withdrawn',
          'participant_removal_requested'
        ]::text[])
      )::integer as organizer_unread_count,
      count(*) filter (
        where notification.type = any(array[
          'application_status',
          'timetable_published',
          'self_booking_enabled',
          'timetable_updated',
          'slot_bookings_released',
          'slot_bookings_released_by_organizer',
          'slot_booking_released_by_organizer',
          'slot_booking_assigned_by_organizer',
          'slot_booking_removal_requested',
          'slot_booking_removal_approved',
          'slot_booking_removal_declined',
          'participant_removed_from_camp',
          'participant_removal_kept',
          'new_opportunity'
        ]::text[])
        and not (
          notification.type = 'application_status'
          and (
            lower(coalesce(notification.body, '')) like '%declined%'
            or lower(coalesce(notification.body, '')) like '%wasn''t a spot%'
            or lower(coalesce(notification.body, '')) like '%wasn''''t a spot%'
            or lower(coalesce(notification.body, '')) like '%leider%'
          )
        )
      )::integer as participant_unread_count
    from public.notifications as notification
    where notification.user_id = auth.uid()
      and notification.read = false
      and notification.type = any(array[
        'new_interest',
        'application_withdrawn',
        'participant_removal_requested',
        'application_status',
        'timetable_published',
        'self_booking_enabled',
        'timetable_updated',
        'slot_bookings_released',
        'slot_bookings_released_by_organizer',
        'slot_booking_released_by_organizer',
        'slot_booking_assigned_by_organizer',
        'slot_booking_removal_requested',
        'slot_booking_removal_approved',
        'slot_booking_removal_declined',
        'participant_removed_from_camp',
        'participant_removal_kept',
        'new_opportunity'
      ]::text[])
  ),
  recent_notifications as (
    select
      notification.id,
      notification.title,
      notification.body,
      notification.type,
      notification.opportunity_id,
      notification.read,
      notification.created_at
    from public.notifications as notification
    where notification.user_id = auth.uid()
      and notification.read = false
      and notification.type = any(array[
        'new_interest',
        'application_withdrawn',
        'participant_removal_requested',
        'application_status',
        'timetable_published',
        'self_booking_enabled',
        'timetable_updated',
        'slot_bookings_released',
        'slot_bookings_released_by_organizer',
        'slot_booking_released_by_organizer',
        'slot_booking_assigned_by_organizer',
        'slot_booking_removal_requested',
        'slot_booking_removal_approved',
        'slot_booking_removal_declined',
        'participant_removed_from_camp',
        'participant_removal_kept',
        'new_opportunity'
      ]::text[])
    order by notification.created_at desc, notification.id desc
    limit least(greatest(coalesce(target_limit, 20), 1), 50)
  )
  select jsonb_build_object(
    'notifications', coalesce(
      (
        select jsonb_agg(
          to_jsonb(recent_notifications)
          order by recent_notifications.created_at desc,
            recent_notifications.id desc
        )
        from recent_notifications
      ),
      '[]'::jsonb
    ),
    'bell_unread_count', unread_counts.bell_unread_count,
    'organizer_unread_count', unread_counts.organizer_unread_count,
    'participant_unread_count', unread_counts.participant_unread_count
  )
  from unread_counts;
$$;

comment on function public.get_notification_center_snapshot(integer)
is 'Returns the current user notification badge counts and a bounded unread bell list in one RLS-scoped call.';

revoke execute on function public.get_notification_center_snapshot(integer) from public;
revoke execute on function public.get_notification_center_snapshot(integer) from anon;
grant execute on function public.get_notification_center_snapshot(integer) to authenticated;
