import { expect, test, type Page } from "@playwright/test";

async function solveCurrentEvidence(page: Page) {
  await page.getByTestId("inspect-station").click();
  await page.getByTestId("open-challenge").click();

  await page.getByTestId("answer-input").fill("999999");
  await page.getByTestId("submit-answer").click();
  await expect(page.getByText(/Check the evidence/)).toBeVisible();

  await page.getByRole("button", { name: "L4 · reveal" }).click();
  await page.getByRole("dialog", { name: "Show the step-by-step reveal?" })
    .getByRole("button", { name: "Show Level 4" })
    .click();
  const hint = await page.getByTestId("hint-text").innerText();
  const numbers = hint.match(/-?\d+(?:\.\d+)?/g);
  const answer = numbers?.at(-1);
  expect(answer, `expected a numeric answer in hint: ${hint}`).toBeDefined();

  await page.getByTestId("answer-input").fill(answer!);
  await page.getByTestId("submit-answer").click();
  await expect(page.getByRole("dialog", { name: "Clue ready to reveal" })).toBeVisible();
  await page.getByTestId("reveal-clue").click();
}

test("plays the deterministic quick case through the deduction board", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Math Detective", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("phaser-surface").locator("canvas")).toHaveCount(1);
  await expect(page.getByTestId("game-phase")).toHaveText("briefing");

  await page.getByRole("button", { name: "Begin case" }).click();
  await expect(page.getByTestId("game-phase")).toHaveText("evidence");
  await expect(page.getByRole("heading", { name: "Evidence station" })).toBeVisible();

  for (let index = 0; index < 5; index += 1) {
    await solveCurrentEvidence(page);
    await expect(page.getByTestId("next-station")).toBeVisible();
    const nextLabel = await page.getByTestId("next-station").innerText();
    await page.getByTestId("next-station").click();
    if (nextLabel === "Open deduction board") break;
  }

  await expect(page.getByTestId("game-phase")).toHaveText("board");
  const suspect = page.locator('[data-testid="suspect-card"][data-status="alive"]').first();
  await suspect.locator(".md-suspect-choice").click();
  const links = suspect.locator(".md-link-button");
  for (let index = 0; index < await links.count(); index += 1) {
    await links.nth(index).click();
  }
  await page.getByTestId("accuse").click();
  await page.getByRole("dialog", { name: /Name / }).getByRole("button", { name: "Confirm accusation" }).click();
  await expect(page.getByRole("heading", { name: "Case closed" })).toBeVisible();
  await page.getByRole("button", { name: "Open case summary" }).click();
  await expect(page.getByRole("heading", { name: "A sharp investigation" })).toBeVisible();
});
