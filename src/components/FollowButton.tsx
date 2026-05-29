"use client";

import { Check, Plus } from "lucide-react";
import { currentAthlete } from "@/lib/demo-data";
import { toggleFollow } from "@/lib/demo-store";
import { useDemoState } from "@/lib/use-demo-state";
import type { FollowTargetType } from "@/lib/types";

type FollowButtonProps = {
  targetType: FollowTargetType;
  targetId: string;
  label: string;
};

export function FollowButton({ targetType, targetId, label }: FollowButtonProps) {
  const [state, setState] = useDemoState();
  const isFollowing = state.follows.some(
    (follow) =>
      follow.followerId === currentAthlete.id &&
      follow.targetType === targetType &&
      follow.targetId === targetId,
  );

  function onClick() {
    setState(toggleFollow(targetType, targetId));
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold ${
        isFollowing
          ? "border border-slate-200 bg-white text-slate-700"
          : "bg-sky-600 text-white"
      }`}
    >
      {isFollowing ? <Check size={17} /> : <Plus size={17} />}
      {isFollowing ? "Following" : label}
    </button>
  );
}
