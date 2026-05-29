"use client";

import {
  coaches,
  currentAthlete,
  follows,
  interests,
  notifications,
  opportunities,
} from "./demo-data";
import { isLastMinuteOpportunity } from "./opportunities";
import type {
  Follow,
  FollowTargetType,
  Interest,
  InterestStatus,
  Notification,
  Opportunity,
  OpportunityType,
  UserRole,
} from "./types";

export type DemoState = {
  role: UserRole;
  opportunities: Opportunity[];
  interests: Interest[];
  follows: Follow[];
  notifications: Notification[];
};

const storageKey = "flyloop-demo-state-v1";
const changeEvent = "flyloop-demo-change";

export const initialDemoState: DemoState = {
  role: "athlete",
  opportunities,
  interests,
  follows,
  notifications,
};

function normalizeState(state: DemoState): DemoState {
  const existingIds = new Set(state.notifications.map((item) => item.id));
  const generated: Notification[] = [];

  state.opportunities.forEach((opportunity) => {
    if (opportunity.status !== "published") {
      return;
    }

    const coachName =
      coaches.find((coach) => coach.id === opportunity.coachId)?.name ??
      "Organizer";
    const city = opportunity.tunnelCity ?? "Munich";
    const isHuckJam = opportunity.type === "huck_jam";
    const postedId = `posted-${opportunity.id}`;

    if (!existingIds.has(postedId)) {
      generated.push({
        id: postedId,
        userId: currentAthlete.id,
        title: isHuckJam
          ? `New Huck Jam posted in ${city}.`
          : `${coachName} posted a new camp in ${city}.`,
        body: opportunity.title,
        type: "new_opportunity",
        opportunityId: opportunity.id,
        read: false,
        createdAt: opportunity.createdAt ?? new Date().toISOString(),
      });
    }

    const lastMinuteId = `last-minute-${opportunity.id}`;
    if (isLastMinuteOpportunity(opportunity) && !existingIds.has(lastMinuteId)) {
      generated.push({
        id: lastMinuteId,
        userId: currentAthlete.id,
        title: `${opportunity.title} still has open spots this weekend.`,
        body: `${opportunity.availableSpots} spots remain open.`,
        type: "last_minute",
        opportunityId: opportunity.id,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return {
    ...state,
    notifications: [...generated, ...state.notifications].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  };
}

export function readDemoState(): DemoState {
  if (typeof window === "undefined") {
    return initialDemoState;
  }

  const saved = window.localStorage.getItem(storageKey);
  if (!saved) {
    return normalizeState(initialDemoState);
  }

  try {
    return normalizeState(JSON.parse(saved) as DemoState);
  } catch {
    return normalizeState(initialDemoState);
  }
}

export function writeDemoState(state: DemoState) {
  const normalized = normalizeState(state);
  window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  window.dispatchEvent(new Event(changeEvent));
  return normalized;
}

export function resetDemoState() {
  window.localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(changeEvent));
}

export function subscribeDemoState(callback: () => void) {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(changeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function setDemoRole(role: UserRole) {
  const state = readDemoState();
  if (typeof document !== "undefined") {
    document.cookie = `flyloop_session=1; path=/; max-age=2592000; samesite=lax`;
    document.cookie = `flyloop_role=${role}; path=/; max-age=2592000; samesite=lax`;
  }
  return writeDemoState({ ...state, role });
}

export function clearDemoSession() {
  if (typeof document !== "undefined") {
    document.cookie = "flyloop_session=; path=/; max-age=0; samesite=lax";
    document.cookie = "flyloop_role=; path=/; max-age=0; samesite=lax";
  }
}

export function toggleFollow(targetType: FollowTargetType, targetId: string) {
  const state = readDemoState();
  const existing = state.follows.find(
    (follow) =>
      follow.followerId === currentAthlete.id &&
      follow.targetType === targetType &&
      follow.targetId === targetId,
  );

  const nextFollows = existing
    ? state.follows.filter((follow) => follow.id !== existing.id)
    : [
        ...state.follows,
        {
          id: crypto.randomUUID(),
          followerId: currentAthlete.id,
          targetType,
          targetId,
          createdAt: new Date().toISOString(),
        },
      ];

  return writeDemoState({ ...state, follows: nextFollows });
}

export function createInterest(opportunityId: string) {
  const state = readDemoState();
  const existing = state.interests.find(
    (interest) =>
      interest.opportunityId === opportunityId &&
      interest.athleteId === currentAthlete.id,
  );

  if (existing) {
    return writeDemoState(state);
  }

  return writeDemoState({
    ...state,
    interests: [
      {
        id: crypto.randomUUID(),
        opportunityId,
        athleteId: currentAthlete.id,
        status: "pending",
        message: "Interested in joining. Please contact me externally.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...state.interests,
    ],
  });
}

export function updateInterestStatus(id: string, status: InterestStatus) {
  const state = readDemoState();
  return writeDemoState({
    ...state,
    interests: state.interests.map((interest) =>
      interest.id === id
        ? { ...interest, status, updatedAt: new Date().toISOString() }
        : interest,
    ),
  });
}

export function createDemoOpportunity(input: {
  type: OpportunityType;
  title: string;
  coachId?: string;
  tunnelId: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  price: number;
  totalCapacity: number;
  availableSpots?: number;
}) {
  const state = readDemoState();
  const opportunity: Opportunity = {
    id: crypto.randomUUID(),
    type: input.type,
    title: input.title,
    coachId: input.type === "camp" ? input.coachId ?? "coach-rafa" : input.coachId,
    tunnelId: input.tunnelId,
    startDate: input.startDate,
    endDate: input.endDate,
    registrationDeadline: input.registrationDeadline,
    price: input.price,
    currency: "EUR",
    totalCapacity: input.totalCapacity,
    availableSpots: input.availableSpots ?? input.totalCapacity,
    minMinutesOrHours: input.type === "camp" ? "45 min per athlete" : "10 min blocks",
    description:
      input.type === "camp"
        ? "Camp published from the coach dashboard."
        : "Huck Jam published from the coach dashboard.",
    languages: ["English"],
    disciplines: input.type === "camp" ? ["Dynamic", "Angles"] : ["Belly", "Backfly", "Dynamic"],
    skillLevel: input.type === "camp" ? "Intermediate" : "All levels",
    status: "published",
    contactMethod: "whatsapp",
    createdBy: "coach-rafa",
  };

  return writeDemoState({
    ...state,
    opportunities: [opportunity, ...state.opportunities],
  });
}

export function markAllNotificationsRead() {
  const state = readDemoState();
  return writeDemoState({
    ...state,
    notifications: state.notifications.map((notification) => ({
      ...notification,
      read: true,
    })),
  });
}
