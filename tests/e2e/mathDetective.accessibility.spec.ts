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

  const begin = page.getByRole("button", { name: "Start investigating" });
  await expect(begin).toBeEnabled();
  await begin.focus();
  await begin.press("Enter");
  await expect(page.getByTestId("game-phase")).toHaveText("evidence");
  await page.getByTestId("inspect-station").click();
  await page.getByTestId("open-challenge").click();
  await expect(page.getByRole("spinbutton", { name: "Numeric answer" })).toBeFocused();
  await expectAccessible(page);

  await page.getByTestId("pause-case").click();
  await expect(page.getByRole("dialog", { name: "Safe pause for the next detective" })).toBeVisible();
  await expect(page.getByTestId("resume-case")).toBeFocused();
  await page.getByTestId("resume-case").press("Tab");
  await expect(page.getByTestId("restart-case")).toBeFocused();
  await page.getByTestId("restart-case").press("Tab");
  await expect(page.getByTestId("pause-new-case")).toBeFocused();
  await page.getByTestId("pause-new-case").press("Tab");
  await expect(page.getByTestId("resume-case")).toBeFocused();
  await expectAccessible(page);
  await page.getByTestId("resume-case").click();
  await expect(page.getByTestId("pause-case")).toBeVisible();
});

test("phone layout avoids horizontal overflow and nested play scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Math Detective", exact: true })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const selectors = [".md-shell", ".md-case-layout", ".md-case-panel", ".md-world-panel"];
    const verticalScrollContainers = selectors.filter((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      return element.scrollHeight > element.clientHeight + 1 && ["auto", "scroll"].includes(style.overflowY);
    });
    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      verticalScrollContainers,
    };
  });

  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth + 1);
  expect(metrics.verticalScrollContainers).toEqual([]);
});

test("large text keeps the pause controls targetable", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  const pause = page.getByTestId("pause-case");
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(page.getByRole("dialog", { name: "Safe pause for the next detective" })).toBeVisible();
  await expect(page.getByTestId("resume-case")).toBeFocused();
  await page.getByTestId("resume-case").click();
  await expect(page.getByTestId("pause-case")).toBeVisible();
});
