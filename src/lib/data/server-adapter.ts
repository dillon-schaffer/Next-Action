import type { DataAdapter } from "./adapter";
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

async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

type ServerTask = {
  id: string;
  title: string;
  notes: string | null;
  goalId: string | null;
  goal: { title: string } | null;
  estimatedMinutes: number | null;
  priority: number | null;
  deadlineAt: string | null;
};

function toTask(t: ServerTask): Task {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    goalId: t.goalId,
    goalTitle: t.goal?.title ?? null,
    estimatedMinutes: t.estimatedMinutes,
    priority: t.priority,
    deadlineAt: t.deadlineAt,
  };
}

/** Implements DataAdapter over the existing session-authenticated REST API. */
export function createServerAdapter(): DataAdapter {
  return {
    mode: "signed-in",

    async listGoals(): Promise<Goal[]> {
      const { goals } = await fetchJson("/api/goals");
      return goals;
    },
    async createGoal(input: GoalInput): Promise<Goal> {
      const { goal } = await fetchJson("/api/goals", { method: "POST", body: JSON.stringify(input) });
      return goal;
    },
    async updateGoal(id: string, input: GoalInput): Promise<Goal> {
      const { goal } = await fetchJson(`/api/goals/${id}`, { method: "PUT", body: JSON.stringify(input) });
      return goal;
    },
    async archiveGoal(id: string): Promise<void> {
      await fetchJson(`/api/goals/${id}`, { method: "DELETE" });
    },

    async listTasks(): Promise<Task[]> {
      const { tasks } = await fetchJson("/api/tasks");
      return (tasks as ServerTask[]).map(toTask);
    },
    async createTask(input: TaskInput): Promise<Task> {
      const { task } = await fetchJson("/api/tasks", { method: "POST", body: JSON.stringify(input) });
      return toTask(task);
    },
    async updateTask(id: string, input: TaskInput): Promise<Task> {
      const { task } = await fetchJson(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(input) });
      return toTask(task);
    },
    async archiveTask(id: string): Promise<void> {
      await fetchJson(`/api/tasks/${id}`, { method: "DELETE" });
    },

    async listInterests(): Promise<string[]> {
      const { interests } = await fetchJson("/api/user/interests");
      return interests;
    },
    async setInterests(labels: string[]): Promise<void> {
      await fetchJson("/api/user/interests", { method: "POST", body: JSON.stringify({ interests: labels }) });
    },

    async getOnboardingStatus(): Promise<OnboardingStatus> {
      const { interests, onboardingCompleted } = await fetchJson("/api/user/interests");
      return { completed: onboardingCompleted, interestsCount: interests.length };
    },
    async markOnboardingComplete(): Promise<void> {
      await fetchJson("/api/user/interests", { method: "POST", body: JSON.stringify({}) });
    },

    async requestRecommendation(input: RecommendationRequestInput): Promise<RecommendationResponse> {
      return fetchJson("/api/recommendations", { method: "POST", body: JSON.stringify(input) });
    },
    async confirmSuggestion(id: string) {
      return fetchJson(`/api/recommendations/generated/${id}/confirm`, { method: "POST" });
    },
    async skipSuggestion(id: string): Promise<void> {
      await fetchJson(`/api/recommendations/generated/${id}/skip`, { method: "POST" });
    },
    async listSuggestionHistory(): Promise<SuggestionHistoryItem[]> {
      const { generatedSuggestions } = await fetchJson("/api/recommendations");
      return generatedSuggestions ?? [];
    },
  };
}
