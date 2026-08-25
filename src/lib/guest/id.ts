/** Stable local IDs for guest records. Never sent anywhere that identifies a person. */
export function generateId(prefix: string = "id"): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // fall through to the manual fallback below
  }
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${random}`;
}
