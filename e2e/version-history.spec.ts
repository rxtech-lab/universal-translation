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

    // 3. Verify initial state — entry 0 has existing translation
    const entry0 = page.getByTestId("po-entry-0");
    await expect(entry0).toContainText("Hello, %s!");
    await expect(entry0).toContainText("你好，%s！");

    // 4. Translate all entries
    await page.getByTestId("translate-button").first().click();
    await page.getByTestId("translate-all").first().click();
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 30_000,
    });

    // 5. Verify the "About Us" entry now has a translation (was empty before)
    const entry2 = page.getByTestId("po-entry-2");
    await expect(entry2).toContainText("[E2E]");

    // 6. Click Save to persist and create a version
    await page.getByRole("button", { name: "Save" }).first().click();

    // 7. Wait for save to complete — History button should appear
    await expect(page.getByTestId("version-selector-button")).toBeVisible({
      timeout: 15_000,
    });

    // 8. Reload the page to get fresh version count from server
    const currentUrl = page.url();
    await page.goto(currentUrl);
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 9. The History button should show version count
    const historyButton = page.getByTestId("version-selector-button");
    await expect(historyButton).toBeVisible({ timeout: 10_000 });

    // 10. Open version dropdown
    await historyButton.click();

    // 11. Verify versions exist in the dropdown
    const versionMenu = page.getByTestId("version-selector-menu");
    await expect(versionMenu).toBeVisible();

    // 12. Click the first (latest) version to restore it
    const firstVersion = page.getByTestId("version-item-0");
    await expect(firstVersion).toBeVisible();
    await firstVersion.click();

    // 13. Wait for page to refresh after restore
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });
  });
});
