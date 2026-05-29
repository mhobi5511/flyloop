import type {
  Athlete,
  Coach,
  Follow,
  Interest,
  Notification,
  Opportunity,
  Tunnel,
} from "./types";

export const currentAthlete: Athlete = {
  id: "athlete-lina",
  name: "Lina Meyer",
  country: "Germany",
  phone: "+491701112233",
  instagram: "linameyer.fly",
  homeTunnelId: "tunnel-jochen",
  disciplines: ["Dynamic", "Belly", "Angles"],
};

export const coaches: Coach[] = [
  {
    id: "coach-rafa",
    name: "Rafa Demo Coach",
    country: "Spain",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
    headline: "Dynamic, angles and VFS progression with calm structure.",
    bio: "Rafa builds compact camps for athletes who want clear feedback, more reps, and calm coaching pressure.",
    languages: ["English", "Spanish"],
    disciplines: ["Dynamic", "Angles", "VFS"],
    instagram: "rafa.demo.fly",
    whatsapp: "+34600111222",
    followers: 1240,
  },
  {
    id: "coach-tota",
    name: "Tota Demo Coach",
    country: "Poland",
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
    headline: "Energetic dynamic camps and group awareness.",
    bio: "Tota is known for high-energy progressions, tidy briefs and practical tunnel time planning.",
    languages: ["English", "Polish"],
    disciplines: ["Dynamic", "Freefly"],
    instagram: "tota.demo.fly",
    whatsapp: "+420601222333",
    followers: 890,
  },
  {
    id: "coach-marc",
    name: "Marc Demo Coach",
    country: "Germany",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
    headline: "Belly, backfly and transition foundations.",
    bio: "Marc helps athletes build reliable foundations and confidence before they move into faster lines.",
    languages: ["English", "German"],
    disciplines: ["Belly", "Backfly", "Transitions"],
    instagram: "marc.demo.fly",
    whatsapp: "+49170111003",
    followers: 720,
  },
];

export const tunnels: Tunnel[] = [
  {
    id: "tunnel-jochen",
    name: "Jochen Schweizer Arena",
    city: "Munich",
    country: "Germany",
    distanceKm: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
    followers: 3200,
    amenities: ["14 ft chamber", "Cafe", "Gear rental"],
  },
  {
    id: "tunnel-flystation-munich",
    name: "FlyStation Munich",
    city: "Munich",
    country: "Germany",
    distanceKm: 14,
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    followers: 2110,
    amenities: ["14 ft chamber", "Event room", "Coaching lounge"],
  },
  {
    id: "tunnel-flyspot-warsaw",
    name: "Flyspot Warsaw",
    city: "Warsaw",
    country: "Poland",
    distanceKm: 810,
    imageUrl:
      "https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=1200&q=80",
    followers: 2740,
    amenities: ["17 ft chamber", "Rigging area", "Hotel nearby"],
  },
];

export const opportunities: Opportunity[] = [
  {
    id: "opp-rafa-jochen",
    type: "camp",
    title: "Camp with Rafa at Jochen Schweizer Arena",
    coachId: "coach-rafa",
    tunnelId: "tunnel-jochen",
    startDate: "2026-06-22",
    endDate: "2026-06-23",
    registrationDeadline: "2026-06-12",
    price: 520,
    currency: "EUR",
    totalCapacity: 8,
    availableSpots: 2,
    minMinutesOrHours: "45 min per athlete",
    description: "Two days of dynamic and angle progression with Rafa in Munich.",
    languages: ["English", "Spanish"],
    disciplines: ["Dynamic", "Angles"],
    skillLevel: "Intermediate",
    status: "published",
    contactMethod: "whatsapp",
    createdBy: "coach-maya",
  },
  {
    id: "opp-tota-warsaw",
    type: "camp",
    title: "Camp with Tota in Warsaw",
    coachId: "coach-tota",
    tunnelId: "tunnel-flyspot-warsaw",
    startDate: "2026-06-30",
    endDate: "2026-07-01",
    registrationDeadline: "2026-06-19",
    price: 490,
    currency: "EUR",
    totalCapacity: 10,
    availableSpots: 5,
    minMinutesOrHours: "55 min per athlete",
    description: "A high-energy dynamic camp at Flyspot Warsaw with Tota.",
    languages: ["English", "Polish"],
    disciplines: ["Dynamic", "Freefly"],
    skillLevel: "Intermediate",
    status: "published",
    contactMethod: "instagram",
    createdBy: "admin-demo",
  },
  {
    id: "opp-huck-munich",
    type: "huck_jam",
    title: "Huck Jam Munich",
    tunnelId: "tunnel-flystation-munich",
    startDate: "2026-06-14",
    endDate: "2026-06-14",
    registrationDeadline: "2026-06-08",
    price: 95,
    currency: "EUR",
    totalCapacity: 20,
    availableSpots: 9,
    minMinutesOrHours: "10 min blocks",
    description: "Open huck jam in Munich for mixed groups and fast rotations.",
    languages: ["English", "German"],
    disciplines: ["VFS", "Transitions"],
    skillLevel: "All levels",
    status: "published",
    contactMethod: "whatsapp",
    createdBy: "admin-demo",
  },
  {
    id: "opp-rafa-last-minute",
    type: "camp",
    title: "Rafa Last-Minute Dynamic Camp",
    coachId: "coach-rafa",
    tunnelId: "tunnel-jochen",
    startDate: "2026-06-02",
    endDate: "2026-06-03",
    registrationDeadline: "2026-05-31",
    price: 430,
    currency: "EUR",
    totalCapacity: 8,
    availableSpots: 2,
    description:
      "Starts soon, still published and still has spots, so Flyloop promotes it automatically as last-minute.",
    languages: ["English", "Spanish"],
    disciplines: ["Dynamic", "Angles"],
    skillLevel: "Intermediate",
    status: "published",
    contactMethod: "whatsapp",
    createdBy: "coach-rafa",
  },
];

export const interests: Interest[] = [
  {
    id: "interest-1",
    opportunityId: "opp-rafa-last-minute",
    athleteId: "athlete-lina",
    status: "pending",
    createdAt: "2026-05-28T10:15:00.000Z",
  },
];

export const followedCoachIds = ["coach-rafa"];
export const followedTunnelIds = ["tunnel-jochen", "tunnel-flystation-munich"];

export const follows: Follow[] = [
  {
    id: "follow-rafa",
    followerId: currentAthlete.id,
    targetType: "coach",
    targetId: "coach-rafa",
    createdAt: "2026-05-28T08:00:00.000Z",
  },
  {
    id: "follow-jochen",
    followerId: currentAthlete.id,
    targetType: "tunnel",
    targetId: "tunnel-jochen",
    createdAt: "2026-05-28T08:05:00.000Z",
  },
];

export const notifications: Notification[] = [
  {
    id: "notification-rafa-last-minute",
    userId: currentAthlete.id,
    title: "Camp with Rafa still has open spots this weekend.",
    body: "Rafa Last-Minute Dynamic Camp has 2 open spots at Jochen Schweizer Arena.",
    type: "last_minute",
    opportunityId: "opp-rafa-last-minute",
    read: false,
    createdAt: "2026-05-29T08:00:00.000Z",
  },
  {
    id: "notification-huck-munich",
    userId: currentAthlete.id,
    title: "New Huck Jam posted in Munich.",
    body: "Huck Jam Munich is open for interest at FlyStation Munich.",
    type: "new_opportunity",
    opportunityId: "opp-huck-munich",
    read: false,
    createdAt: "2026-05-28T14:30:00.000Z",
  },
];

export function getCoach(id?: string) {
  return coaches.find((coach) => coach.id === id);
}

export function getTunnel(id: string) {
  return tunnels.find((tunnel) => tunnel.id === id);
}

export function getOpportunity(id: string) {
  return opportunities.find((opportunity) => opportunity.id === id);
}
