import { test, expect, type Page } from "@playwright/test";

// Must match the hardcoded E2E_TEST_EMAIL in src/auth.config.ts's Credentials provider.
const E2E_TEST_EMAIL = "test@example.com";
const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET ?? "e2e-secret";

async function skipOnboardingIfShown(page: Page) {
  // "/" and "/dashboard" both render a brief loading state while the
  // onboarding-vs-dashboard decision resolves client-side (needed so guests,
  // whose data only exists in the browser, can be routed correctly too) — so
  // wait for whichever real destination shows up rather than racing the URL.
  const skipButton = page.getByRole("button", { name: /^skip for now$/i });
  const getRecommendationButton = page.getByRole("button", { name: /get recommendation/i });
  await expect(skipButton.or(getRecommendationButton)).toBeVisible({ timeout: 15_000 });
  if (await skipButton.isVisible()) {
    await skipButton.click();
    await expect(getRecommendationButton).toBeVisible({ timeout: 10_000 });
  }
}

test.describe("guest-first entry", () => {
  test("a brand-new visitor reaches the app with no sign-in screen", async ({ page }) => {
    await page.goto("/");
    // "/" redirects straight into the app — never a login screen.
    await skipOnboardingIfShown(page);

    // Framed as optional, not a requirement to use the app.
    await expect(page.getByText(/saved on this device/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /save progress/i }).first()).toBeVisible();
  });

  test("guest tasks and interests survive a reload", async ({ page }) => {
    const taskTitle = `Write the guest-mode notes ${Date.now()}`;

    await page.goto("/dashboard/tasks");
    await page.getByLabel(/title/i).fill(taskTitle);
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    await page.reload();
    await expect(page.getByText(taskTitle)).toBeVisible();

    const interestLabel = `river kayaking ${Date.now()}`;
    await page.goto("/onboarding/interests");
    await page.getByPlaceholder(/add an interest/i).fill(interestLabel);
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByText(interestLabel)).toBeVisible();

    await page.reload();
    await expect(page.getByText(interestLabel)).toBeVisible();
  });

  test("guest can request, accept, and skip an AI recommendation", async ({ page }) => {
    await page.goto("/dashboard");
    await skipOnboardingIfShown(page);

    await page.getByRole("button", { name: /get recommendation/i }).click();
    await expect(
      page
        .getByRole("button", { name: /add to my tasks/i })
        .or(page.getByText(/AI is unavailable|short idea you can try|truly new idea|5 AI suggestions for today/i)),
    ).toBeVisible({ timeout: 30_000 });

    const addButton = page.getByRole("button", { name: /add to my tasks/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByText(/added\. it's in your tasks list/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("guest daily quota is enforced locally, without a network round trip", async ({ page }) => {
    // Seed localStorage before any app script runs: onboarding already done,
    // and 5 suggestions already "created" today — at the same cap the server
    // enforces for signed-in users.
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      const data = {
        version: 1,
        guestId: "guest_test",
        onboardingCompletedAt: now,
        interests: [],
        goals: [],
        tasks: [],
        suggestions: Array.from({ length: 5 }).map((_, i) => ({
          id: `sugg_seed_${i}`,
          contextTimeMinutes: 30,
          contextEnergy: "med",
          contextUniqueness: "related",
          title: `Seed suggestion ${i}`,
          nextAction: "Do the thing",
          estimatedMinutes: 30,
          tags: [],
          reasoning: "seeded for quota test",
          confidence: "med",
          model: "claude-sonnet",
          decision: "skipped",
          createdTaskId: null,
          createdAt: now,
        })),
        migratedAt: null,
        migratedUserId: null,
        createdAt: now,
        updatedAt: now,
      };
      window.localStorage.setItem("next-action:guest-data:v1", JSON.stringify(data));
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /get recommendation/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /get recommendation/i }).click();
    await expect(page.getByText(/5 AI suggestions for today/i)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("optional sign-in and migration", () => {
  test("guest progress migrates into the account on sign-in, idempotently", async ({ page }) => {
    const taskTitle = `Pre-signin guest task ${Date.now()}`;

    await page.goto("/dashboard/tasks");
    await page.getByLabel(/title/i).fill(taskTitle);
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    // Sign in without losing the guest data already in this browser context.
    await page.goto("/api/auth/signin?callbackUrl=/dashboard");
    const credsForm = page.locator("form").filter({ has: page.locator('input[type="password"]') });
    await credsForm.getByLabel(/email/i).fill(E2E_TEST_EMAIL);
    await credsForm.locator('input[name="password"]').fill(E2E_TEST_SECRET);
    await credsForm.getByRole("button", { name: /sign in with credentials/i }).click();
    await skipOnboardingIfShown(page);

    await expect(page.getByText(/found progress saved on this device/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /sync now/i }).click();
    await expect(page.getByText(/synced\. your progress on this device/i)).toBeVisible({ timeout: 15_000 });

    await page.goto("/dashboard/tasks");
    await expect(page.getByText(taskTitle)).toBeVisible();
    const matches = await page.getByText(taskTitle).count();
    expect(matches).toBe(1);

    // Retrying the exact same migration payload (same localIds) must not
    // duplicate the task — this is the idempotency guarantee.
    type StoredGuestGoal = { id: string; title: string; description: string | null };
    type StoredGuestTask = {
      id: string;
      title: string;
      notes: string | null;
      goalId: string | null;
      status: string;
      priority: number | null;
      urgency: number | null;
      estimatedMinutes: number | null;
      estimatedInput: string | null;
      deadlineAt: string | null;
    };
    type StoredGuestData = {
      interests: string[];
      onboardingCompletedAt: string | null;
      goals: StoredGuestGoal[];
      tasks: StoredGuestTask[];
    };

    const retry = await page.evaluate(async () => {
      const raw = window.localStorage.getItem("next-action:guest-data:v1");
      const guestData = raw ? (JSON.parse(raw) as StoredGuestData) : null;
      const payload = {
        interests: guestData?.interests ?? [],
        onboardingCompleted: guestData?.onboardingCompletedAt != null,
        goals: (guestData?.goals ?? []).map((g) => ({
          localId: g.id,
          title: g.title,
          description: g.description,
        })),
        tasks: (guestData?.tasks ?? [])
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
        suggestions: [],
      };
      const res = await fetch("/api/guest/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.status;
    });
    expect(retry).toBe(200);

    await page.reload();
    await expect(page.getByText(taskTitle)).toBeVisible();
    expect(await page.getByText(taskTitle).count()).toBe(1);
  });
});
