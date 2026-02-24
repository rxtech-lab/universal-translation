import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Version History", () => {
  test("should create versions on save and restore a previous version", async ({
    page,
  }) => {
    // 1. Upload test.po and create project
    await page.goto("/dashboard/projects/new");
    await expect(page.getByTestId("tab-upload")).toBeVisible();
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

    // 3. Verify initial state — entry 0 has existing translation, entry 2 is empty
    const entry0 = page.getByTestId("po-entry-0");
    await expect(entry0).toContainText("Hello, %s!");
    await expect(entry0).toContainText("你好，%s！");

    // 4. First save — creates version 1 (before translation, entry 2 has no [E2E])
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(page.getByTestId("version-selector-button")).toBeVisible({
      timeout: 15_000,
    });

    // 5. Translate all entries
    await page.getByTestId("translate-button").first().click();
    await page.getByTestId("translate-all").first().click();
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 30_000,
    });

    // 6. Verify the "About Us" entry now has a translation
    const entry2 = page.getByTestId("po-entry-2");
    await expect(entry2).toContainText("[E2E]");

    // 7. Second save — creates version 2 (after translation, entry 2 has [E2E])
    await page.getByRole("button", { name: "Save" }).first().click();

    // 8. Reload the page to get fresh version count from server
    const currentUrl = page.url();
    await page.goto(currentUrl);
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 9. Verify current state still has [E2E] translation
    await expect(page.getByTestId("po-entry-2")).toContainText("[E2E]");

    // 10. Open version dropdown
    const historyButton = page.getByTestId("version-selector-button");
    await expect(historyButton).toBeVisible({ timeout: 10_000 });
    await historyButton.click();

    // 11. Verify versions exist in the dropdown
    const versionMenu = page.getByTestId("version-selector-menu");
    await expect(versionMenu).toBeVisible();

    // 12. Click the second (older) version to preview it — this is before translation
    const olderVersion = page.getByTestId("version-item-1");
    await expect(olderVersion).toBeVisible();
    await olderVersion.click();

    // 13. URL should contain ?version= and preview banner should appear
    await expect(page).toHaveURL(/\?version=/, { timeout: 10_000 });
    await expect(page.getByTestId("version-preview-banner")).toBeVisible({
      timeout: 10_000,
    });

    // 14. Verify content changed — entry 2 should NOT have [E2E] in the older version
    await expect(page.getByTestId("po-entry-2")).not.toContainText("[E2E]", {
      timeout: 5_000,
    });

    // 15. Click "Apply this version" to restore the older version
    await page.getByTestId("apply-version-button").click();

    // 16. URL should no longer contain ?version= after applying
    await expect(page).not.toHaveURL(/\?version=/, { timeout: 10_000 });
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 17. Verify the older version is now the current content (no [E2E])
    await expect(page.getByTestId("po-entry-2")).not.toContainText("[E2E]");
  });
});
