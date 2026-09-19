import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("initial and evidence states remain keyboard and axe accessible", async ({ page }) => {
  await page.goto("/");
  await expectAccessible(page);

  const begin = page.getByRole("button", { name: "Begin case" });
  await expect(begin).toBeEnabled();
  await begin.focus();
  await begin.press("Enter");
  await expect(page.getByTestId("game-phase")).toHaveText("evidence");
  await expect(page.getByRole("spinbutton", { name: "Numeric answer" })).toBeFocused();
  await expectAccessible(page);
});
