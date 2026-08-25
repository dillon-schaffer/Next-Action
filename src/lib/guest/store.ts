/**
 * Guest data CRUD. Mirrors the shape of the server-side helpers in
 * @/lib/goals, @/lib/tasks, @/lib/interests, and the recommendation flow, but
 * reads/writes localStorage instead of Postgres. Consumed by
 * @/lib/data/guest-adapter, not directly by components.
 */
import { GENERATED_SUGGESTION_DAILY_CAP, utcDayStart } from "@/lib/llm/quota-constants";
import { parseTimeInputOrNumber } from "@/lib/time";
import { generateId } from "./id";
import { readGuestData, writeGuestData } from "./storage";
import type {
  GuestData,
  GuestGoal,
  GuestTask,
  GuestGeneratedSuggestion,
  GuestTaskStatus,
} from "./types";

// ---------------------------------------------------------------------------
// Core read/write
// ---------------------------------------------------------------------------

export function getGuestData(): GuestData {
  return readGuestData();
}

function update(mutator: (data: GuestData) => void): GuestData {
  const data = readGuestData();
  mutator(data);
  writeGuestData(data);
  return data;
}

export function hasUnmigratedGuestData(): boolean {
  const data = readGuestData();
  if (data.migratedAt != null) return false;
  return data.goals.length > 0 || data.tasks.length > 0 || data.interests.length > 0 || data.suggestions.length > 0;
}

export function markGuestDataMigrated(userId: string): void {
  update((data) => {
    data.migratedAt = new Date().toISOString();
    data.migratedUserId = userId;
  });
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export function listGuestGoals(): GuestGoal[] {
  return getGuestData()
    .goals.filter((g) => g.isActive)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createGuestGoal(input: { title: string; description?: string }): GuestGoal {
  const now = new Date().toISOString();
  const goal: GuestGoal = {
    id: generateId("goal"),
    title: input.title,
    description: input.description?.trim() || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  update((data) => {
    data.goals.push(goal);
  });
  return goal;
}

export function updateGuestGoal(
  id: string,
  input: { title: string; description?: string },
): GuestGoal {
  let updated: GuestGoal | undefined;
  update((data) => {
    const goal = data.goals.find((g) => g.id === id);
    if (!goal) throw new Error("Goal not found");
    goal.title = input.title;
    goal.description = input.description?.trim() || null;
    goal.updatedAt = new Date().toISOString();
    updated = goal;
  });
  if (!updated) throw new Error("Goal not found");
  return updated;
}

export function archiveGuestGoal(id: string): void {
  update((data) => {
    const goal = data.goals.find((g) => g.id === id);
    if (!goal) throw new Error("Goal not found");
    goal.isActive = false;
    goal.updatedAt = new Date().toISOString();
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type GuestTaskInput = {
  title: string;
  notes?: string;
  goalId?: string;
  estimatedMinutes?: number;
  estimatedInput?: string;
  priority?: number;
  urgency?: number;
  deadlineAt?: string;
};

export function listGuestTasks(status: GuestTaskStatus = "todo"): GuestTask[] {
  return getGuestData()
    .tasks.filter((t) => t.status === status)
    .sort((a, b) => {
      const aDeadline = a.deadlineAt ?? "￿";
      const bDeadline = b.deadlineAt ?? "￿";
      if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);
      return a.createdAt.localeCompare(b.createdAt);
    });
}

/** Mirrors taskInputSchema's transform in @/lib/tasks: prefer explicit minutes, else parse the raw input string. */
function resolveEstimatedMinutes(input: GuestTaskInput): number | null {
  if (input.estimatedMinutes != null) return parseTimeInputOrNumber(input.estimatedMinutes);
  if (input.estimatedInput != null && input.estimatedInput.trim() !== "") {
    return parseTimeInputOrNumber(input.estimatedInput);
  }
  return null;
}

export function createGuestTask(input: GuestTaskInput): GuestTask {
  const now = new Date().toISOString();
  const task: GuestTask = {
    id: generateId("task"),
    title: input.title,
    notes: input.notes?.trim() || null,
    goalId: input.goalId || null,
    status: "todo",
    priority: input.priority ?? null,
    urgency: input.urgency ?? null,
    estimatedMinutes: resolveEstimatedMinutes(input),
    estimatedInput: input.estimatedInput?.trim() || null,
    deadlineAt: input.deadlineAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
  update((data) => {
    data.tasks.push(task);
  });
  return task;
}

export function updateGuestTask(id: string, input: GuestTaskInput): GuestTask {
  let updated: GuestTask | undefined;
  update((data) => {
    const task = data.tasks.find((t) => t.id === id);
    if (!task) throw new Error("Task not found");
    task.title = input.title;
    task.notes = input.notes?.trim() || null;
    task.goalId = input.goalId || null;
    task.priority = input.priority ?? null;
    task.urgency = input.urgency ?? null;
    task.estimatedMinutes = resolveEstimatedMinutes(input);
    task.estimatedInput = input.estimatedInput?.trim() || null;
    task.deadlineAt = input.deadlineAt ?? null;
    task.updatedAt = new Date().toISOString();
    updated = task;
  });
  if (!updated) throw new Error("Task not found");
  return updated;
}

export function archiveGuestTask(id: string): void {
  update((data) => {
    const task = data.tasks.find((t) => t.id === id);
    if (!task) throw new Error("Task not found");
    task.status = "archived";
    task.updatedAt = new Date().toISOString();
  });
}

// ---------------------------------------------------------------------------
// Interests + onboarding
// ---------------------------------------------------------------------------

function dedupeCaseInsensitive(labels: string[]): string[] {
  const byLower = new Map<string, string>();
  for (const raw of labels) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, label);
  }
  return Array.from(byLower.values());
}

export function listGuestInterests(): string[] {
  return getGuestData().interests;
}

export function setGuestInterests(labels: string[]): void {
  const unique = dedupeCaseInsensitive(labels);
  update((data) => {
    data.interests = unique;
  });
}

export function getGuestOnboardingStatus(): { completed: boolean; interestsCount: number } {
  const data = getGuestData();
  return {
    completed: data.onboardingCompletedAt != null,
    interestsCount: data.interests.length,
  };
}

export function markGuestOnboardingComplete(): void {
  update((data) => {
    data.onboardingCompletedAt = new Date().toISOString();
  });
}

// ---------------------------------------------------------------------------
// Generated suggestions (recommendations) + accept/skip history
// ---------------------------------------------------------------------------

export function listGuestSuggestions(): GuestGeneratedSuggestion[] {
  return getGuestData()
    .suggestions.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addGuestSuggestion(
  suggestion: Omit<GuestGeneratedSuggestion, "id" | "createdAt" | "decision" | "createdTaskId">,
): GuestGeneratedSuggestion {
  const created: GuestGeneratedSuggestion = {
    ...suggestion,
    id: generateId("sugg"),
    decision: "pending",
    createdTaskId: null,
    createdAt: new Date().toISOString(),
  };
  update((data) => {
    data.suggestions.push(created);
  });
  return created;
}

export function confirmGuestSuggestion(id: string): { taskId: string; message: string } {
  let taskId: string | undefined;
  update((data) => {
    const suggestion = data.suggestions.find((s) => s.id === id);
    if (!suggestion || suggestion.decision !== "pending") {
      throw new Error("Suggestion not found or already used");
    }
    const now = new Date().toISOString();
    const task: GuestTask = {
      id: generateId("task"),
      title: suggestion.title,
      notes: suggestion.nextAction,
      goalId: null,
      status: "todo",
      priority: null,
      urgency: null,
      estimatedMinutes: suggestion.estimatedMinutes,
      estimatedInput: null,
      deadlineAt: null,
      createdAt: now,
      updatedAt: now,
    };
    data.tasks.push(task);
    suggestion.decision = "accepted";
    suggestion.createdTaskId = task.id;
    taskId = task.id;
  });
  if (!taskId) throw new Error("Suggestion not found or already used");
  return { taskId, message: "Added. It's in your Tasks list." };
}

export function skipGuestSuggestion(id: string): void {
  update((data) => {
    const suggestion = data.suggestions.find((s) => s.id === id);
    if (!suggestion || suggestion.decision !== "pending") {
      throw new Error("Suggestion not found or already used");
    }
    suggestion.decision = "skipped";
  });
}

// ---------------------------------------------------------------------------
// Local daily quota (guest equivalent of generated-quota.ts)
// ---------------------------------------------------------------------------

/** Counts suggestions actually created today (UTC) — mirrors the server's DB count. */
export function guestSuggestionsUsedToday(): number {
  const today = utcDayStart(new Date());
  return getGuestData().suggestions.filter((s) => new Date(s.createdAt) >= today).length;
}

export function canUseGuestGeneratedSuggestion(): boolean {
  return guestSuggestionsUsedToday() < GENERATED_SUGGESTION_DAILY_CAP;
}

export function guestRemainingGeneratedCount(): number {
  return Math.max(0, GENERATED_SUGGESTION_DAILY_CAP - guestSuggestionsUsedToday());
}
