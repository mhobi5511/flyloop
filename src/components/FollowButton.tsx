"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FollowTargetType } from "@/lib/types";

type FollowButtonProps = {
  targetType: FollowTargetType;
  targetId: string;
  label: string;
  initialFollowing?: boolean;
  userId?: string;
};

export function FollowButton({
  targetType,
  targetId,
  label,
  initialFollowing,
  userId,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing ?? false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialFollowing !== undefined) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    async function loadFollow() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .maybeSingle();

      setIsFollowing(Boolean(data));
    }

    void loadFollow();
  }, [initialFollowing, targetId, targetType]);

  async function toggle() {
    setIsLoading(true);
    const previousFollowing = isFollowing;
    setIsFollowing(!previousFollowing);
    const supabase = createSupabaseBrowserClient();
    const activeUserId = userId
      ? userId
      : (await supabase.auth.getUser()).data.user?.id;

    if (!activeUserId) {
      setIsFollowing(previousFollowing);
      setIsLoading(false);
      return;
    }

    if (previousFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", activeUserId)
        .eq("target_type", targetType)
        .eq("target_id", targetId);

      if (error) {
        console.error("Unfollow failed", error);
        setIsFollowing(previousFollowing);
      }
    } else {
      const { error } = await supabase.from("follows").insert({
        follower_id: activeUserId,
        target_type: targetType,
        target_id: targetId,
      });
      if (error && error.code !== "23505") {
        console.error("Follow failed", error);
        setIsFollowing(previousFollowing);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isLoading}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold shadow-sm transition disabled:opacity-60 ${
        isFollowing
          ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700"
      }`}
    >
      {isFollowing ? <Check size={15} /> : <Plus size={15} />}
      {isFollowing ? "Following" : label}
    </button>
  );
}
