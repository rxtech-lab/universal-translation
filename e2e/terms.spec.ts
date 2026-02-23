import path from "node:path";
import { expect, test } from "@playwright/test";

/** Helper: create a project from sample.txt and land on the editor page */
async function createProjectAndOpenEditor(
  page: import("@playwright/test").Page,
) {
  await page.goto("/dashboard/projects/new");
  const fileInput = page.getByTestId("upload-file-input");
  await fileInput.setInputFiles(
    path.resolve(__dirname, "../test-assets/sample.txt"),
  );

  // Mode selection (txt files)
  await expect(page.getByTestId("mode-universal")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId("mode-universal").click();
  await page.getByTestId("mode-continue").click();

  // Language selection
  await expect(page.getByTestId("target-language-trigger")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId("target-language-trigger").click();
  await page.getByRole("option", { name: "Chinese (Simplified)" }).click();

  // Create project
  await page.getByTestId("create-project-button").click();

  // Wait for editor
  await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("translation-editor")).toBeVisible({
    timeout: 10_000,
  });
}

/** Helper: open terms dialog */
async function openTermsDialog(page: import("@playwright/test").Page) {
  await page.getByTestId("terms-button").click();
  await expect(page.getByTestId("terms-dialog")).toBeVisible({
    timeout: 5_000,
  });
}

/** Helper: add a term via the inputs in the terms dialog */
async function addTerm(
  page: import("@playwright/test").Page,
  original: string,
  translation: string,
) {
  await page.getByTestId("term-original-input").fill(original);
  await page.getByTestId("term-translation-input").fill(translation);
  await page.getByTestId("term-add-button").click();
  // Wait for the new row to appear (router.refresh() triggers RSC re-fetch)
  // Term text lives in <input value="...">, so use locator with input[value]
  await expect(
    page
      .getByTestId("term-row")
      .filter({ has: page.locator(`input[value="${original}"]`) }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("Terms Panel", () => {
  test("should add a term and see it in the list", async ({ page }) => {
    await createProjectAndOpenEditor(page);
    await openTermsDialog(page);

    // Initially no terms
    await expect(page.getByTestId("term-row")).toHaveCount(0);

    // Add a term
    await addTerm(page, "Hello", "你好");

    // Verify the row appeared with the correct input value
    await expect(page.getByTestId("term-row")).toHaveCount(1);
    await expect(
      page.getByTestId("term-row").locator('input[value="Hello"]'),
    ).toBeVisible();
  });

  test("should clear all terms", async ({ page }) => {
    await createProjectAndOpenEditor(page);
    await openTermsDialog(page);

    // Add two terms
    await addTerm(page, "Hello", "你好");
    await addTerm(page, "World", "世界");
    await expect(page.getByTestId("term-row")).toHaveCount(2);

    // Click Clear button
    await page.getByTestId("terms-clear-button").click();

    // Confirm in alert dialog
    await page.getByTestId("terms-clear-confirm").click();

    // Wait for terms to be removed
    await expect(page.getByTestId("term-row")).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test("should keep save button visible with many terms", async ({ page }) => {
    await createProjectAndOpenEditor(page);
    await openTermsDialog(page);

    // Add several terms to force scrolling
    for (let i = 0; i < 10; i++) {
      await addTerm(page, `Term ${i}`, `翻译 ${i}`);
    }

    // The save button should still be visible (not scrolled away)
    await expect(page.getByTestId("terms-save-button")).toBeVisible();
    await expect(page.getByTestId("terms-save-button")).toBeInViewport();
  });
});
