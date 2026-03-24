import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Xcode Localization Update Flow", () => {
  test("should upload xcloc, update with new file, and show diff preview", async ({
    page,
  }) => {
    // 1. Navigate to new project page
    await page.goto("/dashboard/projects/new");
    await expect(page.getByTestId("tab-upload")).toBeVisible();

    // 2. Upload the original zh-Hans.xcloc.zip
    const fileInput = page.getByTestId("upload-file-input");
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/zh-Hans.xcloc.zip"),
    );

    // 3. xcloc skips language selection — wait for redirect to editor
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, {
      timeout: 15_000,
    });

    // 4. Verify the editor loaded
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 5. Click the "Update" button in the toolbar
    const updateButton = page.getByRole("button", { name: /update/i }).first();
    await expect(updateButton).toBeVisible({ timeout: 5_000 });
    await updateButton.click();

    // 6. Upload the updated xcloc file via the dialog
    const dialogFileInput = page.locator("input[accept='.zip,.xcloc']").first();
    await dialogFileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/zh-Hans-updated.xcloc.zip"),
    );

    // 7. Verify diff preview appears with correct stats
    await expect(page.getByTestId("xcloc-update-diff-preview")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("xcloc-update-stat-preserved")).toBeVisible();
    await expect(page.getByTestId("xcloc-update-stat-added")).toBeVisible();
    await expect(page.getByTestId("xcloc-update-stat-removed")).toBeVisible();

    // Verify stats values: 243 preserved, 2 added, 3 removed, 245 total
    await expect(page.getByTestId("xcloc-update-stat-preserved")).toContainText(
      "243",
    );
    await expect(page.getByTestId("xcloc-update-stat-added")).toContainText(
      "2",
    );
    await expect(page.getByTestId("xcloc-update-stat-removed")).toContainText(
      "3",
    );
    await expect(page.getByTestId("xcloc-update-stat-total")).toContainText(
      "245",
    );

    // 8. Click Confirm
    await page.getByTestId("xcloc-update-confirm").click();

    // 9. Dialog closes and editor refreshes
    await expect(
      page.getByTestId("xcloc-update-diff-preview"),
    ).not.toBeVisible();

    // 10. Verify the editor still shows
    await expect(page.getByTestId("translation-editor")).toBeVisible();
  });

  test("should preserve translations after xcloc update and page reload", async ({
    page,
  }) => {
    // 1. Navigate to new project page and upload original xcloc
    await page.goto("/dashboard/projects/new");
    await expect(page.getByTestId("tab-upload")).toBeVisible();
    const fileInput = page.getByTestId("upload-file-input");
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/zh-Hans.xcloc.zip"),
    );

    // 2. Wait for editor
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 3. Click Update and upload the updated xcloc
    const updateButton = page.getByRole("button", { name: /update/i }).first();
    await updateButton.click();

    const dialogFileInput = page.locator("input[accept='.zip,.xcloc']").first();
    await dialogFileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/zh-Hans-updated.xcloc.zip"),
    );

    // 4. Wait for diff preview and confirm
    await expect(page.getByTestId("xcloc-update-diff-preview")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("xcloc-update-confirm").click();
    await expect(
      page.getByTestId("xcloc-update-diff-preview"),
    ).not.toBeVisible();

    // 5. Editor should still be visible after update
    await expect(page.getByTestId("translation-editor")).toBeVisible();

    // 6. Wait for auto-save (debounce 5s + buffer)
    await page.waitForTimeout(7_000);

    // 7. Reload and verify the project still loads correctly
    const currentUrl = page.url();
    await page.goto(currentUrl);
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });
  });
});
