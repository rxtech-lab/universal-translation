import path from "node:path";
import { expect, test } from "@playwright/test";

test.describe("Basic Translation Flow", () => {
  test("should upload txt, translate, and complete without errors", async ({
    page,
  }) => {
    // 1. Navigate to the new project page
    await page.goto("/dashboard/projects/new");

    // 2. Ensure the upload tab is active
    await expect(page.getByTestId("tab-upload")).toBeVisible();

    // 3. Upload the sample.txt file via the hidden file input
    const fileInput = page.getByTestId("upload-file-input");
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/sample.txt"),
    );

    // 4. Handle mode selection (txt files show mode selector)
    //    Select "Universal" mode (should be pre-selected) and click Continue
    await expect(page.getByTestId("mode-universal")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("mode-universal").click();
    await page.getByTestId("mode-continue").click();

    // 5. Handle language selection
    //    Source language defaults to English, select Chinese (Simplified) as target
    await expect(page.getByTestId("target-language-trigger")).toBeVisible({
      timeout: 10_000,
    });

    // Click the target language select trigger
    await page.getByTestId("target-language-trigger").click();

    // Select "Chinese (Simplified)" from the Radix Select dropdown
    await page.getByRole("option", { name: "Chinese (Simplified)" }).click();

    // 6. Click "Create Project"
    await page.getByTestId("create-project-button").click();

    // 7. Wait for redirect to editor page
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, {
      timeout: 15_000,
    });

    // 8. Verify the editor loaded
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 9. Verify the document editor shows entries
    await expect(page.getByTestId("document-editor")).toBeVisible();
    await expect(page.getByTestId("document-stats")).toContainText(
      /0\/\d+ translated/,
    );

    // 10. Click "Translate" dropdown, then "Translate All"
    //     There are two TranslateDropdown instances (desktop + mobile), target the visible one
    await page.getByTestId("translate-button").first().click();
    await page.getByTestId("translate-all").first().click();

    // 11. Wait for translation to complete
    //     Status goes: "Translating X/Y" -> "Ready"
    //     Mock translations can complete almost instantly, so wait for
    //     either "translating" or "idle" to appear (one of them must show).
    //     There are two TranslationStatus instances (desktop + mobile), target the first
    await expect(
      page
        .getByTestId("status-translating")
        .first()
        .or(page.getByTestId("status-idle").first()),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 30_000,
    });

    // 12. Verify no error elements are shown
    await expect(page.getByTestId("status-error")).toHaveCount(0);

    // 13. Verify translations have been filled in
    //     The mock returns "[E2E] {sourceText}" so check the stats updated
    await expect(page.getByTestId("document-stats")).not.toContainText("0/");
  });
});
test.describe("Single Line Retranslation", () => {
  test("should retranslate a single PO entry and re-render", async ({
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

    // 3. Translate all entries
    await page.getByTestId("translate-button").first().click();
    await page.getByTestId("translate-all").first().click();
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 30_000,
    });

    // 4. Find the "About Us" entry (index 2 in test.po, was untranslated, now has [E2E] prefix)
    const aboutUsEntry = page.getByTestId("po-entry-2");
    await expect(aboutUsEntry).toBeVisible();
    await expect(aboutUsEntry).toContainText("[E2E]");

    // 5. Click Retranslate on that entry
    await aboutUsEntry.getByTestId("entry-retranslate").click();

    // 6. Confirm retranslation in dialog
    await page.getByTestId("entry-retranslate-confirm").click();

    // 7. Wait for translation to complete
    await expect(page.getByTestId("status-idle").first()).toBeVisible({
      timeout: 30_000,
    });

    // 8. Verify the entry re-rendered with translation (not raw ${{}} templates)
    await expect(aboutUsEntry).toContainText("[E2E]");
  });
});

test.describe("PO Update Flow", () => {
  test("should update PO file and preserve translations", async ({ page }) => {
    // 1. Navigate to new project page
    await page.goto("/dashboard/projects/new");
    await expect(page.getByTestId("tab-upload")).toBeVisible();

    // 2. Upload test.po
    const fileInput = page.getByTestId("upload-file-input");
    await fileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/test.po"),
    );

    // 3. Select source=English, target=Chinese (Simplified) and create
    await expect(page.getByTestId("target-language-trigger")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByTestId("target-language-trigger").click();
    await page.getByRole("option", { name: "Chinese (Simplified)" }).click();
    await page.getByTestId("create-project-button").click();

    // 4. Wait for editor to load
    await expect(page).toHaveURL(/\/dashboard\/projects\/[a-f0-9-]+/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 5. Click the "Update" button in the toolbar (desktop)
    const updateButton = page.getByRole("button", { name: /update/i }).first();
    await expect(updateButton).toBeVisible({ timeout: 5_000 });
    await updateButton.click();

    // 6. Dialog opens — upload test-updated.po
    const dialogFileInput = page
      .locator("input[type='file'][accept='.po']")
      .first();
    await dialogFileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/test-updated.po"),
    );

    // 7. Verify diff preview appears
    await expect(page.getByTestId("po-update-diff-preview")).toBeVisible({
      timeout: 5_000,
    });
    // Stats should show some preserved + added + removed entries
    await expect(page.getByTestId("po-update-stat-preserved")).toBeVisible();
    await expect(page.getByTestId("po-update-stat-added")).toBeVisible();

    // 8. Click Confirm
    await page.getByTestId("po-update-confirm").click();

    // 9. Dialog closes and editor refreshes
    await expect(page.getByTestId("po-update-diff-preview")).not.toBeVisible();

    // 10. New entries should be visible, stale entries gone
    await expect(page.getByTestId("translation-editor")).toBeVisible();
  });

  test("should preserve correct translation-to-source mapping after PO update and page reload", async ({
    page,
  }) => {
    // 1. Upload test.po and create project
    // test.po already has translations: "Hello, %s!"→"你好，%s！", "Settings"→"设置", etc.
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

    // 3. Verify entry 0 has correct existing translation from test.po
    const entry0 = page.getByTestId("po-entry-0");
    await expect(entry0).toContainText("Hello, %s!");
    await expect(entry0).toContainText("你好，%s！");

    const entry1 = page.getByTestId("po-entry-1");
    await expect(entry1).toContainText("Settings");
    await expect(entry1).toContainText("设置");

    // 4. Click Update → upload test-updated.po
    //    test-updated.po keeps Hello/Settings but removes About Us, adds Logout/Dashboard
    const updateButton = page.getByRole("button", { name: /update/i }).first();
    await updateButton.click();

    const dialogFileInput = page
      .locator("input[type='file'][accept='.po']")
      .first();
    await dialogFileInput.setInputFiles(
      path.resolve(__dirname, "../test-assets/test-updated.po"),
    );

    // 5. Wait for diff preview and confirm
    await expect(page.getByTestId("po-update-diff-preview")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("po-update-confirm").click();
    await expect(page.getByTestId("po-update-diff-preview")).not.toBeVisible();

    // 6. Verify preserved entries have correct translation↔source associations
    //    The bug was: translations would shift to wrong source entries after update
    const helloEntry = page.getByTestId("po-entry-0");
    await expect(helloEntry).toContainText("Hello, %s!");
    await expect(helloEntry).toContainText("你好，%s！");

    const settingsEntry = page.getByTestId("po-entry-1");
    await expect(settingsEntry).toContainText("Settings");
    await expect(settingsEntry).toContainText("设置");

    // New entries (Logout, Dashboard) should be untranslated
    const logoutEntry = page.getByTestId("po-entry-5");
    await expect(logoutEntry).toContainText("Logout");

    const dashboardEntry = page.getByTestId("po-entry-6");
    await expect(dashboardEntry).toContainText("Dashboard");

    // 7. Wait for auto-save to persist (debounce is 5s)
    await page.waitForTimeout(7_000);

    // 8. Reload the page — this triggers the DB load path (loadFromJson)
    const currentUrl = page.url();
    await page.goto(currentUrl);
    await expect(page.getByTestId("translation-editor")).toBeVisible({
      timeout: 10_000,
    });

    // 9. Re-verify: translations must survive the reload with correct source mapping
    //    Before the fix, reloading would desync position-based IDs and the document,
    //    causing "你好" to appear next to "Settings" and "设置" next to "Hello"
    const helloAfterReload = page.getByTestId("po-entry-0");
    await expect(helloAfterReload).toContainText("Hello, %s!");
    await expect(helloAfterReload).toContainText("你好，%s！");

    const settingsAfterReload = page.getByTestId("po-entry-1");
    await expect(settingsAfterReload).toContainText("Settings");
    await expect(settingsAfterReload).toContainText("设置");

    // New entries should still be untranslated after reload
    const logoutAfterReload = page.getByTestId("po-entry-5");
    await expect(logoutAfterReload).toContainText("Logout");

    const dashboardAfterReload = page.getByTestId("po-entry-6");
    await expect(dashboardAfterReload).toContainText("Dashboard");
  });
});
