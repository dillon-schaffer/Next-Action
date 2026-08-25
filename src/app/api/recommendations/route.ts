import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/auth.config";
import { listInterestsForUser } from "@/lib/interests";
import { parseTimeInput } from "@/lib/time";
import { getUniquenessThreshold } from "@/lib/similarity";
import { canUseGeneratedSuggestion } from "@/lib/llm/generated-quota";
import { getGeneratedSuggestionWithUniquenessGuard } from "@/lib/llm/generate-suggestion";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [events, generatedSuggestions] = await Promise.all([
    prisma.recommendationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            notes: true,
          },
        },
      },
    }),
    prisma.generatedSuggestion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        nextAction: true,
        reasoning: true,
        decision: true,
        contextTimeMinutes: true,
        contextEnergy: true,
        contextUniqueness: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ events, generatedSuggestions });
}

const guestContextSchema = z.object({
  interestsSummary: z.array(z.string().max(100)).max(20).default([]),
  taskThemes: z.array(z.string().max(150)).max(10).default([]),
  referenceTexts: z.array(z.string().max(200)).max(120).default([]),
  recentBehavior: z
    .object({
      accepted: z.number().int().min(0).max(1000),
      skipped: z.number().int().min(0).max(1000),
      genAccepted: z.number().int().min(0).max(1000),
      genSkipped: z.number().int().min(0).max(1000),
    })
    .optional(),
});

const recommendationRequestSchema = z
  .object({
    timeMinutes: z.number().int().positive().max(24 * 60 * 30).optional(),
    timeInput: z.string().optional(),
    energy: z.enum(["low", "med", "high"]),
    uniqueness: z.enum(["familiar", "related", "novel"]),
    ideaHint: z
      .string()
      .max(500)
      .optional()
      .transform((s) => (s != null && s.trim() === "" ? undefined : s?.trim())),
    // Present only for unauthenticated (guest) requests — see docs/Guest-First-Architecture.md.
    // The server never trusts a client-provided user id; guest requests simply have none.
    guest: guestContextSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.timeInput != null && data.timeInput.trim() !== "") {
        const parsed = parseTimeInput(data.timeInput);
        return parsed != null;
      }
      return data.timeMinutes != null;
    },
    { message: "Provide timeMinutes or valid timeInput (e.g. 45m, 2h, 1d)" },
  );

function resolveTimeMinutes(body: z.infer<typeof recommendationRequestSchema>): number | null {
  if (body.timeInput != null && body.timeInput.trim() !== "") {
    return parseTimeInput(body.timeInput);
  }
  if (body.timeMinutes != null) {
    return body.timeMinutes;
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const json = await request.json();
  const parsed = recommendationRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const timeMinutes = resolveTimeMinutes(parsed.data);
  if (timeMinutes == null) {
    return NextResponse.json(
      { error: "Provide timeMinutes or valid timeInput (e.g. 45m, 2h, 1d)" },
      { status: 400 },
    );
  }

  const context = {
    timeMinutes,
    energy: parsed.data.energy,
    uniqueness: parsed.data.uniqueness,
    ideaHint: parsed.data.ideaHint ?? undefined,
  };

  if (userId) {
    return handleAuthenticatedRequest(userId, context);
  }
  return handleGuestRequest(context, parsed.data.guest);
}

async function handleAuthenticatedRequest(
  userId: string,
  context: { timeMinutes: number; energy: "low" | "med" | "high"; uniqueness: "familiar" | "related" | "novel"; ideaHint?: string },
) {
  const allowed = await canUseGeneratedSuggestion(userId);
  if (!allowed) {
    return NextResponse.json(
      {
        dailyLimitReached: true,
        message: "You've reached your 5 AI suggestions for today. Try again tomorrow.",
      },
      { status: 200 },
    );
  }

  const [
    userInterestsRows,
    allTasksForInterests,
    recentEvents,
    recentGenerated,
    existingTaskTitles,
    recentSuggestionTexts,
  ] = await Promise.all([
    listInterestsForUser(userId),
    prisma.task.findMany({
      where: { userId, status: "todo" },
      select: { title: true, goal: { select: { title: true } } },
      take: 50,
    }),
    prisma.recommendationEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { decision: true },
    }),
    prisma.generatedSuggestion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { decision: true, title: true, nextAction: true },
    }),
    prisma.task.findMany({
      where: { userId, status: "todo" },
      select: { title: true },
      take: 100,
    }),
    prisma.generatedSuggestion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { title: true, nextAction: true },
    }),
  ]);

  const referenceTexts: string[] = [
    ...existingTaskTitles.map((t) => t.title).filter(Boolean),
    ...recentSuggestionTexts.flatMap((s) => [s.title, s.nextAction].filter(Boolean)),
  ];

  const accepted = recentEvents.filter((e) => e.decision === "accepted").length;
  const skipped = recentEvents.filter((e) => e.decision === "skipped").length;
  const genAccepted = recentGenerated.filter((e) => e.decision === "accepted").length;
  const genSkipped = recentGenerated.filter((e) => e.decision === "skipped").length;
  const recentBehaviorSummary = `Last 10 (existing recs): ${accepted} accepted, ${skipped} skipped. Last 10 (generated): ${genAccepted} accepted, ${genSkipped} skipped. No task titles.`;

  const interestLabels = userInterestsRows.map((r) => r.label);
  const taskThemes = allTasksForInterests.map(
    (t) => (t.goal ? `${t.title} (${t.goal.title})` : t.title),
  );
  const userInterestsSummary = buildInterestsSummary(interestLabels, taskThemes);

  const uniquenessThreshold = getUniquenessThreshold(context.uniqueness);
  const outcome = await getGeneratedSuggestionWithUniquenessGuard(
    context,
    userInterestsSummary,
    recentBehaviorSummary,
    referenceTexts,
    uniquenessThreshold,
  );

  if (!outcome.success) {
    return NextResponse.json({ fallback: outcome.fallback }, { status: 200 });
  }

  const data = outcome.data;
  const shortlistHash =
    data.meta?.shortlistHash ?? `${userId}-${new Date().toISOString().slice(0, 10)}`;

  const suggestion = await prisma.generatedSuggestion.create({
    data: {
      userId,
      contextTimeMinutes: context.timeMinutes,
      contextEnergy: context.energy,
      contextUrgency: "med", // Keep for backward compatibility
      contextUniqueness: context.uniqueness,
      title: data.generatedTask.title,
      nextAction: data.generatedTask.nextAction.slice(0, 120),
      estimatedMinutes: data.generatedTask.estimatedMinutes,
      tags: data.generatedTask.tags ?? [],
      reasoning: data.generatedTask.reasoning,
      confidence: data.generatedTask.confidence,
      model: data.model ?? "claude-sonnet",
      sourceFeatures: data.meta?.sourceFeatures ?? [],
      shortlistHash,
      decision: "pending",
    },
  });

  return NextResponse.json({
    type: "generated",
    recommendationId: suggestion.id,
    generatedTask: {
      title: data.generatedTask.title,
      nextAction: data.generatedTask.nextAction,
      estimatedMinutes: data.generatedTask.estimatedMinutes,
      tags: data.generatedTask.tags,
      reasoning: data.generatedTask.reasoning,
      confidence: data.generatedTask.confidence,
    },
    model: data.model,
    meta: data.meta,
  });
}

/**
 * Guest path: no session, no userId, no DB persistence. The client sends
 * compact interest/task/history summaries it already computed locally (never
 * full task lists) and its own browser-local daily quota already gated this
 * call before it was made. We build the same prompt shape as the
 * authenticated flow from that client-supplied context instead of DB rows.
 */
async function handleGuestRequest(
  context: { timeMinutes: number; energy: "low" | "med" | "high"; uniqueness: "familiar" | "related" | "novel"; ideaHint?: string },
  guest: z.infer<typeof guestContextSchema> | undefined,
) {
  const interestsSummary = guest?.interestsSummary ?? [];
  const taskThemes = guest?.taskThemes ?? [];
  const referenceTexts = guest?.referenceTexts ?? [];
  const rb = guest?.recentBehavior;

  const userInterestsSummary = buildInterestsSummary(interestsSummary, taskThemes);
  const recentBehaviorSummary = rb
    ? `Last 10 (existing recs): ${rb.accepted} accepted, ${rb.skipped} skipped. Last 10 (generated): ${rb.genAccepted} accepted, ${rb.genSkipped} skipped. No task titles.`
    : "No recent behavior data yet.";

  const uniquenessThreshold = getUniquenessThreshold(context.uniqueness);
  const outcome = await getGeneratedSuggestionWithUniquenessGuard(
    context,
    userInterestsSummary,
    recentBehaviorSummary,
    referenceTexts,
    uniquenessThreshold,
  );

  if (!outcome.success) {
    return NextResponse.json({ fallback: outcome.fallback }, { status: 200 });
  }

  const data = outcome.data;
  return NextResponse.json({
    type: "generated",
    // No recommendationId: guests store the suggestion (and assign their own
    // local id) client-side in localStorage — see guest-adapter.ts.
    generatedTask: {
      title: data.generatedTask.title,
      nextAction: data.generatedTask.nextAction,
      estimatedMinutes: data.generatedTask.estimatedMinutes,
      tags: data.generatedTask.tags,
      reasoning: data.generatedTask.reasoning,
      confidence: data.generatedTask.confidence,
    },
    model: data.model,
    meta: data.meta,
  });
}

function buildInterestsSummary(interestLabels: string[], taskThemes: string[]): string {
  const taskThemesText =
    taskThemes.length > 0 ? ` Recent task themes: ${taskThemes.slice(0, 10).join("; ")}.` : "";
  return interestLabels.length > 0
    ? `interests: [${interestLabels.slice(0, 20).join(", ")}].${taskThemesText}`
    : `Interests: not set. Use safe default themes: small project progress, quick life admin, learning. Suggest a broad, low-risk next action. If relevant, you may mention that adding interests in the app will improve suggestions.${taskThemesText}`;
}
