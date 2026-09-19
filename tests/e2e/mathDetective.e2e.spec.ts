import { expect, test } from "@playwright/test";

test("boots the standalone shell and reaches the first evidence station", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Math Detective", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("phaser-surface").locator("canvas")).toHaveCount(1);
  await expect(page.getByTestId("game-phase")).toHaveText("briefing");

  await page.getByRole("button", { name: "Begin case" }).click();
  await expect(page.getByTestId("game-phase")).toHaveText("evidence");
  await expect(page.getByRole("heading", { name: "Evidence station" })).toBeVisible();

  await page.getByRole("spinbutton", { name: "Numeric answer" }).fill("0");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText(/attempts 1/)).toBeVisible();
});
