import { z } from "zod";

import { createEmptyGuestData, GUEST_DATA_VERSION, type GuestData } from "./types";
import { generateId } from "./id";

const STORAGE_KEY = "next-action:guest-data:v1";

const goalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().nullable(),
  goalId: z.string().nullable(),
  status: z.enum(["todo", "done", "archived"]),
  priority: z.number().nullable(),
  urgency: z.number().nullable(),
  estimatedMinutes: z.number().nullable(),
  estimatedInput: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const suggestionSchema = z.object({
  id: z.string(),
  contextTimeMinutes: z.number(),
  contextEnergy: z.enum(["low", "med", "high"]),
  contextUniqueness: z.enum(["familiar", "related", "novel"]),
  title: z.string(),
  nextAction: z.string(),
  estimatedMinutes: z.number(),
  tags: z.array(z.string()),
  reasoning: z.string(),
  confidence: z.enum(["low", "med", "high"]),
  model: z.string(),
  decision: z.enum(["pending", "accepted", "skipped"]),
  createdTaskId: z.string().nullable(),
  createdAt: z.string(),
});

const guestDataSchema = z.object({
  version: z.number(),
  guestId: z.string(),
  onboardingCompletedAt: z.string().nullable(),
  interests: z.array(z.string()),
  goals: z.array(goalSchema),
  tasks: z.array(taskSchema),
  suggestions: z.array(suggestionSchema),
  migratedAt: z.string().nullable(),
  migratedUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Forward-compatible migration hook. Bump GUEST_DATA_VERSION in types.ts and
 * add a case here when the schema changes; older local data is upgraded
 * in place instead of being discarded.
 */
function migrate(raw: unknown): unknown {
  if (raw != null && typeof raw === "object" && "version" in raw) {
    return raw;
  }
  return raw;
}

/**
 * Reads guest data from localStorage. Never throws: missing, corrupt, or
 * outdated data safely falls back to a fresh empty record.
 */
export function readGuestData(): GuestData {
  if (!isBrowser()) {
    return createEmptyGuestData(generateId("guest"));
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createEmptyGuestData(generateId("guest"));
      writeGuestData(fresh);
      return fresh;
    }

    const parsedJson: unknown = JSON.parse(raw);
    const migrated = migrate(parsedJson);
    const result = guestDataSchema.safeParse(migrated);
    if (!result.success) {
      // Corrupt or from an incompatible future version — start clean rather
      // than crash. We intentionally do not throw here.
      const fresh = createEmptyGuestData(generateId("guest"));
      writeGuestData(fresh);
      return fresh;
    }
    return result.data as GuestData;
  } catch {
    const fresh = createEmptyGuestData(generateId("guest"));
    try {
      writeGuestData(fresh);
    } catch {
      // localStorage may be unavailable (private mode, quota exceeded, etc.)
      // Fall through and return the in-memory value; nothing will persist
      // this session, but the app still functions.
    }
    return fresh;
  }
}

export function writeGuestData(data: GuestData): void {
  if (!isBrowser()) return;
  try {
    const toSave: GuestData = { ...data, version: GUEST_DATA_VERSION, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Storage unavailable or full — fail silently rather than crash the UI.
  }
}

/** For tests / "start over" flows. Not wired into any UI by default. */
export function clearGuestData(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
