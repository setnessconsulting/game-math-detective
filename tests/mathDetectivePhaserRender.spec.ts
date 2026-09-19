import { expect, test, type Page } from "@playwright/test";

const FIXTURE = "/tests/fixtures/phaser-render/index.html";

type Diagnostics = {
  phaserVersion: string;
  frame: number;
  sceneActive: boolean;
  rendererClass: string;
  isWebGL: boolean;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  displayListCount: number;
  canvasCount: number;
};

async function readDiagnostics(page: Page): Promise<Diagnostics> {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => {
    const harness = window.__MATH_DETECTIVE_PHASER__;
    if (!harness) return false;
    const diagnostics = harness.getDiagnostics();
    return diagnostics.frame > 1 && diagnostics.sceneActive;
  });
  return page.evaluate(() => window.__MATH_DETECTIVE_PHASER__!.getDiagnostics());
}

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__MATH_DETECTIVE_PHASER__?.destroy()).catch(() => {});
});

test("the installed Phaser package initializes and renders a real WebGL scene", async ({ page }) => {
  const diagnostics = await readDiagnostics(page);
  console.log("MATH_DETECTIVE_PHASER_RENDER", JSON.stringify(diagnostics));

  expect(diagnostics.phaserVersion).toBe("4.2.1");
  expect(diagnostics.sceneActive).toBe(true);
  expect(diagnostics.rendererClass).toContain("WebGLRenderer");
  expect(diagnostics.isWebGL).toBe(true);
  expect(diagnostics.drawingBufferWidth).toBeGreaterThan(0);
  expect(diagnostics.drawingBufferHeight).toBeGreaterThan(0);
  expect(diagnostics.displayListCount).toBeGreaterThan(0);
  expect(diagnostics.canvasCount).toBe(1);

  await expect
    .poll(async () => page.evaluate(() => window.__MATH_DETECTIVE_PHASER__!.getDiagnostics().frame))
    .toBeGreaterThan(diagnostics.frame);
});
