import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Lyrics Stop Translation", () => {
  test("should stop lyrics translation when Stop button is clicked", async ({
    page,
  }) => {
    // 1. Navigate to new project page
    await page.goto("/dashboard/projects/new");

    // 2. Upload the sample-lyrics.txt file
    const fileInput = page.getByTestId("upload-file-input");
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/sample-lyrics.txt"),
    );

    // 3. Select lyrics mode
    await expect(page.getByTestId("mode-lyrics")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("mode-lyrics").click();
    await page.getByTestId("mode-continue").click();

    // 4. Select target language
    await expect(page.getByTestId("target-language-trigger")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("target-language-trigger").click();
    await page.getByRole("option", { name: "Chinese (Simplified)" }).click();

    // 5. Create project
    await page.getByTestId("create-project-button").click();

    // 6. Wait for editor
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 7. Click Translate dropdown → Translate All
    await page.getByTestId("translate-button").first().click();
    await page.getByTestId("translate-all").first().click();

    // 8. Wait for the stop button to appear (translation has started)
    await expect(
      page.getByTestId("translate-stop-button").first(),
    ).toBeVisible({ timeout: 10_000 });

    // 9. Click Stop
    await page.getByTestId("translate-stop-button").first().click();

    // 10. Verify status returns to idle (translation was stopped)
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 10_000,
    });

    // 11. Verify the translate dropdown reappears (not stuck in translating state)
    await expect(page.getByTestId("translate-button").first()).toBeVisible({
      timeout: 5_000,
    });

    // 12. Verify no errors occurred
    await expect(page.getByTestId("status-error")).toHaveCount(0);
  });
});
