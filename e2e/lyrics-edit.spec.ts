import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Lyrics Edit/Add/Delete", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Navigate to new project page
    await page.goto("/dashboard/projects/new");
    await expect(page.getByTestId("tab-upload")).toBeVisible();

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
  });

  test("should edit source text of a lyrics line", async ({ page }) => {
    // Click the source text display to enter edit mode
    const sourceDisplay = page.getByTestId("lyrics-source-display").first();
    await expect(sourceDisplay).toBeVisible();
    await sourceDisplay.click();

    // Verify the source input appears
    const sourceInput = page.getByTestId("lyrics-source-input").first();
    await expect(sourceInput).toBeVisible();

    // Clear and type new source text
    await sourceInput.fill("Twinkle twinkle little moon");

    // Click away to blur
    await page.getByTestId("translation-editor").click();

    // Verify the updated text appears
    await expect(
      page.getByTestId("lyrics-source-display").first(),
    ).toContainText("Twinkle twinkle little moon");
  });

  test("should add a line after the current line", async ({ page }) => {
    // Get initial count of source displays
    const initialCount = await page
      .getByTestId("lyrics-source-display")
      .count();

    // Open the line menu on the first entry
    await page.getByTestId("lyrics-line-menu").first().click();

    // Click "Add line after"
    await page.getByTestId("add-line-after").click();

    // Verify a new entry was added (count increased)
    await expect(page.getByTestId("lyrics-source-display")).toHaveCount(
      initialCount + 1,
      { timeout: 5_000 },
    );
  });

  test("should add a line before the current line", async ({ page }) => {
    // Get initial count of source displays
    const initialCount = await page
      .getByTestId("lyrics-source-display")
      .count();

    // Open the line menu on the first entry
    await page.getByTestId("lyrics-line-menu").first().click();

    // Click "Add line before"
    await page.getByTestId("add-line-before").click();

    // Verify a new entry was added (count increased)
    await expect(page.getByTestId("lyrics-source-display")).toHaveCount(
      initialCount + 1,
      { timeout: 5_000 },
    );
  });

  test("should delete a lyrics line", async ({ page }) => {
    // Get initial count of source displays
    const initialCount = await page
      .getByTestId("lyrics-source-display")
      .count();
    expect(initialCount).toBeGreaterThan(1);

    // Open the line menu on the first entry
    await page.getByTestId("lyrics-line-menu").first().click();

    // Click "Delete line"
    await page.getByTestId("delete-line").click();

    // Verify the line was removed (count decreased)
    await expect(page.getByTestId("lyrics-source-display")).toHaveCount(
      initialCount - 1,
      { timeout: 5_000 },
    );
  });
});
