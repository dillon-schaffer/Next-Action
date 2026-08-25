import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/auth.config";
import { prisma } from "@/lib/db";
import { listInterestsForUser, markOnboardingComplete, setInterestsForUser } from "@/lib/interests";

/**
 * Migrates a guest's local-storage data (goals, tasks, interests, suggestion
 * history) into the signed-in user's account.
 *
 * Idempotent: every guest record carries a client-generated `localId`. Goal,
 * Task, and GeneratedSuggestion each have a unique `localId` column, so every
 * write here is an upsert keyed on it — calling this endpoint again with the
 * same payload (e.g. a retry after a dropped connection) updates nothing new,
 * it never creates duplicates. Interests are merged and deduped
 * case-insensitively, which is naturally idempotent.
 */

const guestGoalSchema = z.object({
  localId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
});

const guestTaskSchema = z.object({
  localId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  notes: z.string().max(4000).nullable(),
  goalLocalId: z.string().max(100).nullable(),
  status: z.enum(["todo", "done", "archived"]),
  priority: z.number().int().min(1).max(5).nullable(),
  urgency: z.number().int().min(1).max(5).nullable(),
  estimatedMinutes: z.number().int().positive().max(24 * 60 * 30).nullable(),
  estimatedInput: z.string().max(50).nullable(),
  deadlineAt: z.string().nullable(),
});

const guestSuggestionSchema = z.object({
  localId: z.string().min(1).max(100),
  contextTimeMinutes: z.number().int().positive(),
  contextEnergy: z.enum(["low", "med", "high"]),
  contextUniqueness: z.enum(["familiar", "related", "novel"]),
  title: z.string().min(1).max(500),
  nextAction: z.string().max(120),
  estimatedMinutes: z.number().int().positive(),
  tags: z.array(z.string()).max(10),
  reasoning: z.string().max(2000),
  confidence: z.enum(["low", "med", "high"]),
  model: z.string().max(100),
  decision: z.enum(["pending", "accepted", "skipped"]),
  createdTaskLocalId: z.string().max(100).nullable(),
  createdAt: z.string(),
});

const migrateBodySchema = z.object({
  interests: z.array(z.string().max(100)).max(200),
  onboardingCompleted: z.boolean(),
  goals: z.array(guestGoalSchema).max(500),
  tasks: z.array(guestTaskSchema).max(2000),
  suggestions: z.array(guestSuggestionSchema).max(1000),
});

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = migrateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // Interests: merge (never wipe existing account interests), case-insensitively deduped.
  const existingInterests = await listInterestsForUser(userId);
  const merged = [...existingInterests.map((r) => r.label), ...body.interests];
  await setInterestsForUser(userId, merged);

  // Goals: upsert by localId so retries don't duplicate.
  const goalIdByLocalId = new Map<string, string>();
  for (const g of body.goals) {
    const goal = await prisma.goal.upsert({
      where: { userId_localId: { userId, localId: g.localId } },
      create: { userId, title: g.title, description: g.description, localId: g.localId },
      update: {},
    });
    goalIdByLocalId.set(g.localId, goal.id);
  }

  // Tasks: upsert by localId; resolve goalId via the map above.
  const taskIdByLocalId = new Map<string, string>();
  for (const t of body.tasks) {
    const goalId = t.goalLocalId ? goalIdByLocalId.get(t.goalLocalId) ?? null : null;
    const task = await prisma.task.upsert({
      where: { userId_localId: { userId, localId: t.localId } },
      create: {
        userId,
        title: t.title,
        notes: t.notes,
        goalId,
        status: t.status,
        priority: t.priority,
        urgency: t.urgency,
        estimatedMinutes: t.estimatedMinutes,
        estimatedInput: t.estimatedInput,
        deadlineAt: parseDate(t.deadlineAt),
        localId: t.localId,
      },
      update: {},
    });
    taskIdByLocalId.set(t.localId, task.id);
  }

  // Suggestion (accept/skip) history: upsert by localId; resolve createdTaskId.
  for (const s of body.suggestions) {
    const createdTaskId = s.createdTaskLocalId ? taskIdByLocalId.get(s.createdTaskLocalId) ?? null : null;
    await prisma.generatedSuggestion.upsert({
      where: { userId_localId: { userId, localId: s.localId } },
      create: {
        userId,
        contextTimeMinutes: s.contextTimeMinutes,
        contextEnergy: s.contextEnergy,
        contextUrgency: "med",
        contextUniqueness: s.contextUniqueness,
        title: s.title,
        nextAction: s.nextAction,
        estimatedMinutes: s.estimatedMinutes,
        tags: s.tags,
        reasoning: s.reasoning,
        confidence: s.confidence,
        model: s.model,
        sourceFeatures: [],
        decision: s.decision,
        createdTaskId,
        localId: s.localId,
        createdAt: parseDate(s.createdAt) ?? undefined,
      },
      update: {},
    });
  }

  if (body.onboardingCompleted) {
    await markOnboardingComplete(userId);
  }

  return NextResponse.json({ ok: true, userId });
}
