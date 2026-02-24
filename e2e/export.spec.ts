import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Export Filename", () => {
  test("should use project name as exported filename for txt", async ({
    page,
  }) => {
    // 1. Navigate to the new project page
    await page.goto("/dashboard/projects/new");

    // 2. Upload sample.txt
    const fileInput = page.getByTestId("upload-file-input");
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/sample.txt"),
    );

    // 3. Handle mode selection
    await expect(page.getByTestId("mode-universal")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("mode-universal").click();
    await page.getByTestId("mode-continue").click();

    // 4. Handle language selection
    await expect(page.getByTestId("target-language-trigger")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("target-language-trigger").click();
    await page.getByRole("option", { name: "Chinese (Simplified)" }).click();

    // 5. Create project (project name will be "sample" — derived from filename)
    await page.getByTestId("create-project-button").click();

    // 6. Wait for editor
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 7. Translate all entries
    await page.getByTestId("translate-button").first().click();
    await page.getByTestId("translate-all").first().click();
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 30_000,
    });

    // 8. Click Export and capture the download
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-button").click();
    const download = await downloadPromise;

    // 9. Verify the filename uses the project name ("sample") + extension
    expect(download.suggestedFilename()).toBe("sample.txt");
  });

  test("should use project name as exported filename for po", async ({
    page,
  }) => {
    // 1. Upload test.po and create project
    await page.goto("/dashboard/projects/new");
    const fileInput = page.getByTestId("upload-file-input");
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/test.po"),
    );
    await expect(page.getByTestId("target-language-trigger")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("target-language-trigger").click();
    await page.getByRole("option", { name: "Chinese (Simplified)" }).click();
    await page.getByTestId("create-project-button").click();

    // 2. Wait for editor
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 3. Translate all
    await page.getByTestId("translate-button").first().click();
    await page.getByTestId("translate-all").first().click();
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 30_000,
    });

    // 4. Export and verify filename
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-button").click();
    const download = await downloadPromise;

    // Project name for test.po is "test", so filename should be "test.po"
    expect(download.suggestedFilename()).toBe("test.po");
  });
});
