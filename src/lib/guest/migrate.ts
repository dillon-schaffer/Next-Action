/**
 * Builds the payload sent to POST /api/guest/migrate and applies the result
 * locally once the server confirms success. See docs/Guest-First-Architecture.md
 * for the idempotency guarantee (retrying never duplicates data).
 */
import { getGuestData, markGuestDataMigrated } from "./store";

export interface GuestMigrationPayload {
  interests: string[];
  onboardingCompleted: boolean;
  goals: Array<{ localId: string; title: string; description: string | null }>;
  tasks: Array<{
    localId: string;
    title: string;
    notes: string | null;
    goalLocalId: string | null;
    status: "todo" | "done" | "archived";
    priority: number | null;
    urgency: number | null;
    estimatedMinutes: number | null;
    estimatedInput: string | null;
    deadlineAt: string | null;
  }>;
  suggestions: Array<{
    localId: string;
    contextTimeMinutes: number;
    contextEnergy: "low" | "med" | "high";
    contextUniqueness: "familiar" | "related" | "novel";
    title: string;
    nextAction: string;
    estimatedMinutes: number;
    tags: string[];
    reasoning: string;
    confidence: string;
    model: string;
    decision: "pending" | "accepted" | "skipped";
    createdTaskLocalId: string | null;
    createdAt: string;
  }>;
}

export function buildGuestMigrationPayload(): GuestMigrationPayload {
  const data = getGuestData();
  return {
    interests: data.interests,
    onboardingCompleted: data.onboardingCompletedAt != null,
    goals: data.goals.map((g) => ({
      localId: g.id,
      title: g.title,
      description: g.description,
    })),
    tasks: data.tasks
      .filter((t) => t.status !== "archived")
      .map((t) => ({
        localId: t.id,
        title: t.title,
        notes: t.notes,
        goalLocalId: t.goalId,
        status: t.status,
        priority: t.priority,
        urgency: t.urgency,
        estimatedMinutes: t.estimatedMinutes,
        estimatedInput: t.estimatedInput,
        deadlineAt: t.deadlineAt,
      })),
    suggestions: data.suggestions.map((s) => ({
      localId: s.id,
      contextTimeMinutes: s.contextTimeMinutes,
      contextEnergy: s.contextEnergy,
      contextUniqueness: s.contextUniqueness,
      title: s.title,
      nextAction: s.nextAction,
      estimatedMinutes: s.estimatedMinutes,
      tags: s.tags,
      reasoning: s.reasoning,
      confidence: s.confidence,
      model: s.model,
      decision: s.decision,
      createdTaskLocalId: s.createdTaskId,
      createdAt: s.createdAt,
    })),
  };
}

export async function migrateGuestDataToAccount(): Promise<{ ok: boolean; error?: string }> {
  const payload = buildGuestMigrationPayload();
  try {
    const res = await fetch("/api/guest/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error ?? "Migration failed. Please try again." };
    }
    const body = await res.json();
    markGuestDataMigrated(body.userId ?? "unknown");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }
}
