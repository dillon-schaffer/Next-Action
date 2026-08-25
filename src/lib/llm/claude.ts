import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const OUTPUT_SCHEMA = z.object({
  recommendedTaskId: z.string(),
  recommendedNextActionText: z.string(),
  explanation: z.string(),
  confidence: z.enum(["low", "med", "high"]),
});

export type LLMRecommendation = z.infer<typeof OUTPUT_SCHEMA>;

const MAX_OUTPUT_TOKENS = 300;
const MODEL = "claude-sonnet-5";

function buildPrompt(
  shortlist: Array<{
    id: string;
    title: string;
    notes: string | null;
    estimatedMinutes: number | null;
    priority: number | null;
    urgency: number | null;
    deadlineAt: string | null;
  }>,
  context: { timeMinutes: number; energy: string; urgency: string },
  recentSummary: string,
  userInterestsSummary: string,
): string {
  const taskList = shortlist
    .map(
      (t) =>
        `- id: ${t.id} | title: ${t.title} | notes: ${t.notes ?? ""} | estMin: ${t.estimatedMinutes ?? "?"} | priority: ${t.priority ?? "?"} | urgency: ${t.urgency ?? "?"} | deadline: ${t.deadlineAt ?? "none"}`,
    )
    .join("\n");

  return `You are a calm, focused assistant helping the user choose a single next action from their task list.

Context:
- Available time: ${context.timeMinutes} minutes
- Energy level: ${context.energy}
- Urgency: ${context.urgency}

The user's tasks overall (reflects their interests and what they care about):
${userInterestsSummary}

Recent activity (for context only): ${recentSummary}

Candidates to choose from (top of list are pre-ranked by relevance; pick one that fits both context AND the user's interests above):
${taskList}

Choose exactly ONE task that fits the user's current context and aligns with their interests (themes from their task list). Prefer variety when several tasks match—e.g. if they have many similar tasks, picking one that's related but a bit different can keep things fresh while still matching what they care about. Respond with a JSON object only (no markdown, no explanation outside JSON) with these exact keys:
- recommendedTaskId (string, one of the task ids above)
- recommendedNextActionText (string, the task title or a one-line next action)
- explanation (string, 1-3 sentences why this task fits now and how it matches their interests)
- confidence ("low" | "med" | "high")`;
}

export async function getLLMRecommendation(
  shortlist: Array<{
    id: string;
    title: string;
    notes: string | null;
    estimatedMinutes: number | null;
    priority: number | null;
    urgency: number | null;
    deadlineAt: string | null;
  }>,
  context: { timeMinutes: number; energy: string; urgency: string },
  recentSummary: string,
  userInterestsSummary: string,
): Promise<LLMRecommendation | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(shortlist, context, recentSummary, userInterestsSummary);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content?.find((c) => c.type === "text")?.type === "text"
        ? (response.content.find((c) => c.type === "text") as { type: "text"; text: string }).text
        : "";
    const trimmed = text.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = OUTPUT_SCHEMA.safeParse(JSON.parse(trimmed));

    if (parsed.success) {
      return parsed.data;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[Claude] LLM response failed validation:", parsed.error.flatten());
    }
    return null;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Claude] LLM request failed:", err instanceof Error ? err.message : err);
    }
    return null;
  }
}
