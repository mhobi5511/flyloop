import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationMatch = {
  opportunityId?: string | null;
  type: string;
  userId: string;
};

export async function hasUnreadNotification(
  supabase: SupabaseClient,
  { opportunityId = null, type, userId }: NotificationMatch,
) {
  let query = supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("read", false)
    .limit(1);

  if (opportunityId) {
    query = query.eq("opportunity_id", opportunityId);
  } else {
    query = query.is("opportunity_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function filterUsersWithoutUnreadNotification(
  supabase: SupabaseClient,
  users: string[],
  match: Omit<NotificationMatch, "userId">,
) {
  const uniqueUsers = [...new Set(users.filter(Boolean))];
  const allowedUsers: string[] = [];

  for (const userId of uniqueUsers) {
    const hasUnread = await hasUnreadNotification(supabase, {
      userId,
      type: match.type,
      opportunityId: match.opportunityId,
    });

    if (!hasUnread) {
      allowedUsers.push(userId);
    }
  }

  return allowedUsers;
}
