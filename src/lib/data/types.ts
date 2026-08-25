/**
 * Types shared by both DataAdapter implementations (guest + signed-in) and
 * the components that consume them. Components import from here, never from
 * @/lib/guest or Prisma directly — see docs/Guest-First-Architecture.md.
 */

export type ContextEnergy = "low" | "med" | "high";
export type ContextUniqueness = "familiar" | "related" | "novel";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  goalId: string | null;
  goalTitle: string | null;
  estimatedMinutes: number | null;
  priority: number | null;
  deadlineAt: string | null;
}

export interface TaskInput {
  title: string;
  notes?: string;
  goalId?: string;
  estimatedInput?: string;
  estimatedMinutes?: number;
  priority?: number;
  urgency?: number;
  deadlineAt?: string;
}

export interface GoalInput {
  title: string;
  description?: string;
}

export interface OnboardingStatus {
  completed: boolean;
  interestsCount: number;
}

export type GeneratedTask = {
  title: string;
  nextAction: string;
  estimatedMinutes: number;
  tags: string[];
  reasoning: string;
  confidence: "low" | "med" | "high";
};

export type RecommendationResponse =
  | { type: "generated"; recommendationId: string; generatedTask: GeneratedTask; model?: string; meta?: unknown }
  | { fallback: { message: string; deterministicIdea: string } }
  | { dailyLimitReached: true; message?: string };

export interface RecommendationRequestInput {
  timeInput?: string;
  timeMinutes: number;
  energy: ContextEnergy;
  uniqueness: ContextUniqueness;
  ideaHint?: string;
}

export interface SuggestionHistoryItem {
  id: string;
  title: string;
  nextAction: string;
  reasoning: string;
  decision: "pending" | "accepted" | "skipped";
  contextTimeMinutes: number;
  contextEnergy: ContextEnergy;
  contextUniqueness: ContextUniqueness | null;
  createdAt: string;
}
