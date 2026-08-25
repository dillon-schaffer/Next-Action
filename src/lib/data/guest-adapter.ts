import {
  archiveGuestGoal,
  archiveGuestTask,
  canUseGuestGeneratedSuggestion,
  confirmGuestSuggestion,
  createGuestGoal,
  createGuestTask,
  getGuestData,
  getGuestOnboardingStatus,
  listGuestGoals,
  listGuestInterests,
  listGuestSuggestions,
  listGuestTasks,
  markGuestOnboardingComplete,
  addGuestSuggestion,
  setGuestInterests,
  skipGuestSuggestion,
  updateGuestGoal,
  updateGuestTask,
} from "@/lib/guest/store";
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

function toGoal(g: ReturnType<typeof listGuestGoals>[number]): Goal {
  return { id: g.id, title: g.title, description: g.description };
}

function toTask(t: ReturnType<typeof listGuestTasks>[number], goalTitleById: Map<string, string>): Task {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    goalId: t.goalId,
    goalTitle: t.goalId ? (goalTitleById.get(t.goalId) ?? null) : null,
    estimatedMinutes: t.estimatedMinutes,
    priority: t.priority,
    deadlineAt: t.deadlineAt,
  };
}

const DAILY_LIMIT_MESSAGE = "You've reached your 5 AI suggestions for today. Try again tomorrow.";

async function requestRecommendation(input: RecommendationRequestInput): Promise<RecommendationResponse> {
  if (!canUseGuestGeneratedSuggestion()) {
    return { dailyLimitReached: true, message: DAILY_LIMIT_MESSAGE };
  }

  const data = getGuestData();
  const goalTitleById = new Map(data.goals.map((g) => [g.id, g.title]));
  const activeTasks = data.tasks.filter((t) => t.status === "todo");

  const interestsSummary = data.interests.slice(0, 20);
  const taskThemes = activeTasks
    .slice(0, 10)
    .map((t) => (t.goalId && goalTitleById.has(t.goalId) ? `${t.title} (${goalTitleById.get(t.goalId)})` : t.title));
  const referenceTexts = [
    ...activeTasks.slice(0, 100).map((t) => t.title),
    ...data.suggestions.slice(0, 20).flatMap((s) => [s.title, s.nextAction]),
  ].filter(Boolean);

  const recentSuggestions = listGuestSuggestions().slice(0, 10);
  const genAccepted = recentSuggestions.filter((s) => s.decision === "accepted").length;
  const genSkipped = recentSuggestions.filter((s) => s.decision === "skipped").length;

  const res = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timeInput: input.timeInput,
      timeMinutes: input.timeMinutes,
      energy: input.energy,
      uniqueness: input.uniqueness,
      ideaHint: input.ideaHint,
      guest: {
        interestsSummary,
        taskThemes,
        referenceTexts,
        recentBehavior: { accepted: 0, skipped: 0, genAccepted, genSkipped },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to get suggestion");
  }

  const result = await res.json();

  if (result?.type === "generated" && result.generatedTask) {
    const saved = addGuestSuggestion({
      contextTimeMinutes: input.timeMinutes,
      contextEnergy: input.energy,
      contextUniqueness: input.uniqueness,
      title: result.generatedTask.title,
      nextAction: result.generatedTask.nextAction,
      estimatedMinutes: result.generatedTask.estimatedMinutes,
      tags: result.generatedTask.tags ?? [],
      reasoning: result.generatedTask.reasoning,
      confidence: result.generatedTask.confidence,
      model: result.model ?? "claude-sonnet",
    });
    return {
      type: "generated",
      recommendationId: saved.id,
      generatedTask: result.generatedTask,
      model: result.model,
      meta: result.meta,
    };
  }

  // fallback or dailyLimitReached shape — pass through unchanged
  return result as RecommendationResponse;
}

export function createGuestAdapter(): DataAdapter {
  return {
    mode: "guest",

    async listGoals(): Promise<Goal[]> {
      return listGuestGoals().map(toGoal);
    },
    async createGoal(input: GoalInput): Promise<Goal> {
      return toGoal(createGuestGoal(input));
    },
    async updateGoal(id: string, input: GoalInput): Promise<Goal> {
      return toGoal(updateGuestGoal(id, input));
    },
    async archiveGoal(id: string): Promise<void> {
      archiveGuestGoal(id);
    },

    async listTasks(): Promise<Task[]> {
      const goalTitleById = new Map(listGuestGoals().map((g) => [g.id, g.title]));
      return listGuestTasks("todo").map((t) => toTask(t, goalTitleById));
    },
    async createTask(input: TaskInput): Promise<Task> {
      const goalTitleById = new Map(listGuestGoals().map((g) => [g.id, g.title]));
      return toTask(createGuestTask(input), goalTitleById);
    },
    async updateTask(id: string, input: TaskInput): Promise<Task> {
      const goalTitleById = new Map(listGuestGoals().map((g) => [g.id, g.title]));
      return toTask(updateGuestTask(id, input), goalTitleById);
    },
    async archiveTask(id: string): Promise<void> {
      archiveGuestTask(id);
    },

    async listInterests(): Promise<string[]> {
      return listGuestInterests();
    },
    async setInterests(labels: string[]): Promise<void> {
      setGuestInterests(labels);
    },

    async getOnboardingStatus(): Promise<OnboardingStatus> {
      return getGuestOnboardingStatus();
    },
    async markOnboardingComplete(): Promise<void> {
      markGuestOnboardingComplete();
    },

    requestRecommendation,

    async confirmSuggestion(id: string) {
      return confirmGuestSuggestion(id);
    },
    async skipSuggestion(id: string): Promise<void> {
      skipGuestSuggestion(id);
    },
    async listSuggestionHistory(): Promise<SuggestionHistoryItem[]> {
      return listGuestSuggestions().map((s) => ({
        id: s.id,
        title: s.title,
        nextAction: s.nextAction,
        reasoning: s.reasoning,
        decision: s.decision,
        contextTimeMinutes: s.contextTimeMinutes,
        contextEnergy: s.contextEnergy,
        contextUniqueness: s.contextUniqueness,
        createdAt: s.createdAt,
      }));
    },
  };
}
