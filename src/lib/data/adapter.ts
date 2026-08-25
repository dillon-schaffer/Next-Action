import type {
  Goal,
  GoalInput,
  OnboardingStatus,
  RecommendationRequestInput,
  RecommendationResponse,
  SuggestionHistoryItem,
  Task,
  TaskInput,
} from "./types";

/**
 * Storage-agnostic contract for everything the UI needs. Components call
 * these methods and never talk to Auth.js sessions or Prisma directly.
 * Implementations: guest-adapter.ts (localStorage) and server-adapter.ts
 * (existing REST API + Postgres).
 */
export interface DataAdapter {
  readonly mode: "guest" | "signed-in";

  listGoals(): Promise<Goal[]>;
  createGoal(input: GoalInput): Promise<Goal>;
  updateGoal(id: string, input: GoalInput): Promise<Goal>;
  archiveGoal(id: string): Promise<void>;

  listTasks(): Promise<Task[]>;
  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, input: TaskInput): Promise<Task>;
  archiveTask(id: string): Promise<void>;

  listInterests(): Promise<string[]>;
  setInterests(labels: string[]): Promise<void>;

  getOnboardingStatus(): Promise<OnboardingStatus>;
  markOnboardingComplete(): Promise<void>;

  requestRecommendation(input: RecommendationRequestInput): Promise<RecommendationResponse>;
  confirmSuggestion(id: string): Promise<{ taskId: string; message: string }>;
  skipSuggestion(id: string): Promise<void>;
  listSuggestionHistory(): Promise<SuggestionHistoryItem[]>;
}
