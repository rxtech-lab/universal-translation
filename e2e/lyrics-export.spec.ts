import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Lyrics Export Options", () => {
  test("should show export dialog with translation-only and bilingual options", async ({
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

    // 7. Translate all entries
    await page.getByTestId("translate-button").first().click();
    await page.getByTestId("translate-all").first().click();
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 30_000,
    });

    // 8. Click Export — should show lyrics export dialog
    await page.getByRole("button", { name: /export/i }).first().click();
    await expect(page.getByTestId("lyrics-export-dialog")).toBeVisible({
      timeout: 5_000,
    });

    // 9. Verify both options are visible
    await expect(page.getByTestId("export-translation-only")).toBeVisible();
    await expect(page.getByTestId("export-bilingual")).toBeVisible();

    // 10. Select "Translation Only" and export
    await page.getByTestId("export-translation-only").click();

    // Set up download listener before clicking
    const [download1] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-confirm").click(),
    ]);
    expect(download1.suggestedFilename()).toContain("zh-Hans");
    expect(download1.suggestedFilename()).not.toContain("bilingual");

    // 11. Click Export again and select "Bilingual"
    await page.getByRole("button", { name: /export/i }).first().click();
    await expect(page.getByTestId("lyrics-export-dialog")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("export-bilingual").click();

    const [download2] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-confirm").click(),
    ]);
    expect(download2.suggestedFilename()).toContain("bilingual");
  });
});
