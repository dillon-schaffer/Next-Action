/**
 * Shape of guest data persisted in the browser (localStorage). Everything a
 * guest does — interests, goals, tasks, generated suggestions, accept/skip
 * history, onboarding progress — lives here until (optionally) migrated into
 * an account. See docs/Guest-First-Architecture.md.
 */

export type GuestTaskStatus = "todo" | "done" | "archived";
export type ContextEnergy = "low" | "med" | "high";
export type ContextUniqueness = "familiar" | "related" | "novel";
export type SuggestionDecision = "pending" | "accepted" | "skipped";

export interface GuestGoal {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

export interface GuestTask {
  id: string;
  title: string;
  notes: string | null;
  goalId: string | null;
  status: GuestTaskStatus;
  priority: number | null;
  urgency: number | null;
  estimatedMinutes: number | null;
  estimatedInput: string | null;
  deadlineAt: string | null; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export interface GuestGeneratedSuggestion {
  id: string;
  contextTimeMinutes: number;
  contextEnergy: ContextEnergy;
  contextUniqueness: ContextUniqueness;
  title: string;
  nextAction: string;
  estimatedMinutes: number;
  tags: string[];
  reasoning: string;
  confidence: "low" | "med" | "high";
  model: string;
  decision: SuggestionDecision;
  createdTaskId: string | null;
  createdAt: string;
}

/** Current schema version. Bump when the shape changes; see storage.ts migrate(). */
export const GUEST_DATA_VERSION = 1;

export interface GuestData {
  version: number;
  guestId: string;
  onboardingCompletedAt: string | null;
  interests: string[];
  goals: GuestGoal[];
  tasks: GuestTask[];
  suggestions: GuestGeneratedSuggestion[];
  /** Set once this data has been successfully synced into an account. */
  migratedAt: string | null;
  migratedUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyGuestData(guestId: string): GuestData {
  const now = new Date().toISOString();
  return {
    version: GUEST_DATA_VERSION,
    guestId,
    onboardingCompletedAt: null,
    interests: [],
    goals: [],
    tasks: [],
    suggestions: [],
    migratedAt: null,
    migratedUserId: null,
    createdAt: now,
    updatedAt: now,
  };
}
