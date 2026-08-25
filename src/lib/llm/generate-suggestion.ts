import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { isTooSimilar } from "@/lib/similarity";

const MAX_OUTPUT_TOKENS = 350;
const MODEL = "claude-sonnet-5";

const GENERATED_OUTPUT_SCHEMA = z.object({
  type: z.literal("generated"),
  generatedTask: z.object({
    title: z.string(),
    nextAction: z.string().max(120),
    estimatedMinutes: z.number().int().min(1),
    tags: z.array(z.string()),
    reasoning: z.string(),
    confidence: z.enum(["low", "med", "high"]),
  }),
  model: z.string(),
  meta: z.object({
    sourceFeatures: z.array(z.string()),
    shortlistHash: z.string(),
  }),
});

export type GeneratedSuggestionResult = z.infer<typeof GENERATED_OUTPUT_SCHEMA>;

const FALLBACK_IDEA =
  "Spend 15 minutes on the one thing that would make tomorrow easier.";

export type GenerateSuggestionOutcome =
  | { success: true; data: GeneratedSuggestionResult }
  | {
      success: false;
      fallback: {
        message: string;
        deterministicIdea: string;
      };
    };

function buildGeneratePrompt(
  context: {
    timeMinutes: number;
    energy: string;
    uniqueness: "familiar" | "related" | "novel";
    ideaHint?: string;
  },
  userInterestsSummary: string,
  recentBehaviorSummary: string,
  referenceTexts?: string[],
): string {
  const ideaHintInstruction =
    context.ideaHint != null && context.ideaHint.trim() !== ""
      ? `\n\nUser preference hint (soft constraint): "${context.ideaHint.trim()}". Prefer tasks that match this hint when possible, but do not force it if it conflicts with time, energy, or uniqueness requirements.`
      : "";

  const differentInstruction =
    referenceTexts != null && referenceTexts.length > 0
      ? `\n\nIMPORTANT: Your suggestion MUST be clearly different from these (do not suggest the same or very similar action):\n${referenceTexts.map((t) => `- ${t}`).join("\n")}\nSuggest something new that is not listed above.`
      : "";

  const uniquenessInstruction = `\n\nUniqueness requirement:
- If "familiar": Suggest a task that closely aligns with patterns from previously accepted/completed tasks. It should feel like the same kind of work the user has done before, using similar skills and approaches.
- If "related": Suggest a task that is adjacent to existing interests/projects but not a direct repeat. It should explore similar themes or domains but introduce a slight variation or new angle.
- If "novel": Suggest a genuinely new skill/domain that the user hasn't tried before, while still aligning with their interests and fitting the time/energy constraints. This should feel like exploring something completely different.`;

  return `You suggest ONE new, concrete next action. You do NOT choose from an existing list. Output valid JSON only.

Context: available time = ${context.timeMinutes} minutes; energy = ${context.energy}; uniqueness preference = ${context.uniqueness}.${ideaHintInstruction}

The suggestion MUST fit within the user's available time (${context.timeMinutes} min). Prefer estimatedMinutes that use most of this window (e.g. 70-100%) when it makes sense; only suggest a short task (e.g. 25 min) if the user has 5 hours when a longer, fitting action is clearly better.

Interests (from user's goals/tasks, themes only): ${userInterestsSummary}

Recent behavior (counts only): ${recentBehaviorSummary}
${differentInstruction}
${uniquenessInstruction}

Output JSON only, no markdown:
{"type":"generated","generatedTask":{"title":"...","nextAction":"...","estimatedMinutes":N,"tags":["..."],"reasoning":"...","confidence":"low|med|high"},"model":"claude-sonnet","meta":{"sourceFeatures":["interest","recentProjects","recentAcceptedActionsSummary"],"shortlistHash":"..."}}

Rules: title = one short actionable sentence. nextAction = single step ≤120 chars. estimatedMinutes must be ≤ ${context.timeMinutes} and should match the suggested action length. tags = 0-3. reasoning = 1-2 sentences. The suggestion MUST match the uniqueness preference: ${context.uniqueness}. shortlistHash = "" or any short id.`;
}

export async function getGeneratedSuggestion(
  context: {
    timeMinutes: number;
    energy: string;
    uniqueness: "familiar" | "related" | "novel";
    ideaHint?: string;
  },
  userInterestsSummary: string,
  recentBehaviorSummary: string,
  referenceTexts?: string[],
): Promise<GenerateSuggestionOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      fallback: {
        message: "AI is unavailable. Here's a short idea you can try:",
        deterministicIdea: FALLBACK_IDEA,
      },
    };
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildGeneratePrompt(
    context,
    userInterestsSummary,
    recentBehaviorSummary,
    referenceTexts,
  );

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

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Claude] Generated suggestion: invalid JSON");
      }
      return {
        success: false,
        fallback: {
          message: "AI is unavailable. Here's a short idea you can try:",
          deterministicIdea: FALLBACK_IDEA,
        },
      };
    }

    const validated = GENERATED_OUTPUT_SCHEMA.safeParse(parsed);
    if (validated.success) {
      return { success: true, data: validated.data };
    }
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Claude] Generated suggestion validation failed:",
        validated.error.flatten(),
      );
    }
    return {
      success: false,
      fallback: {
        message: "AI is unavailable. Here's a short idea you can try:",
        deterministicIdea: FALLBACK_IDEA,
      },
    };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Claude] Generated suggestion request failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return {
      success: false,
      fallback: {
        message: "AI is unavailable. Here's a short idea you can try:",
        deterministicIdea: FALLBACK_IDEA,
      },
    };
  }
}

/**
 * Gets a generated suggestion and enforces the uniqueness guard: if the first
 * result is too similar to `referenceTexts`, retries once with those texts
 * fed back into the prompt. Shared by the authenticated and guest branches of
 * POST /api/recommendations so the retry/fallback logic only lives once.
 */
export async function getGeneratedSuggestionWithUniquenessGuard(
  context: {
    timeMinutes: number;
    energy: string;
    uniqueness: "familiar" | "related" | "novel";
    ideaHint?: string;
  },
  userInterestsSummary: string,
  recentBehaviorSummary: string,
  referenceTexts: string[],
  uniquenessThreshold: number,
): Promise<GenerateSuggestionOutcome> {
  const first = await getGeneratedSuggestion(context, userInterestsSummary, recentBehaviorSummary);
  if (!first.success) return first;

  if (!isTooSimilar(first.data.generatedTask.title, first.data.generatedTask.nextAction, referenceTexts, uniquenessThreshold)) {
    return first;
  }

  const retry = await getGeneratedSuggestion(context, userInterestsSummary, recentBehaviorSummary, referenceTexts);
  const stillTooSimilarFallback: GenerateSuggestionOutcome = {
    success: false,
    fallback: {
      message: "I couldn't find a truly new idea right now. Try adjusting your interests or time window.",
      deterministicIdea: "",
    },
  };
  if (!retry.success) return stillTooSimilarFallback;

  if (isTooSimilar(retry.data.generatedTask.title, retry.data.generatedTask.nextAction, referenceTexts, uniquenessThreshold)) {
    return stillTooSimilarFallback;
  }

  return retry;
}
