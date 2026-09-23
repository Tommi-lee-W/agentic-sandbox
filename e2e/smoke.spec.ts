import { expect, test } from "@playwright/test";

test("health endpoint answers", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("user can add a run through the UI", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Measurement Runs" })).toBeVisible();
  const rowsBefore = await page.locator("tbody#runs tr").count();

  await page.getByPlaceholder("Vehicle ID").fill("WVW-E2E1");
  await page.getByLabel("Cycle").selectOption("RDE");
  await page.getByPlaceholder("CO2 g/km").fill("123.4");
  await page.getByRole("button", { name: "Add run" }).click();

  await expect(page.getByRole("status")).toContainText("Created run-");
  await expect(page.locator("tbody#runs tr")).toHaveCount(rowsBefore + 1);
  await expect(page.locator("tbody#runs")).toContainText("WVW-E2E1");
});

test("user can filter runs by vehicle via the web form", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("tbody#runs")).toContainText("WVW-1001");

  await page.getByPlaceholder("Filter by vehicle").fill("WVW-1001");
  await page.getByRole("button", { name: "Filter" }).click();

  await expect(page.locator("tbody#runs tr")).toHaveCount(2);
  await expect(page.locator("tbody#runs")).toContainText("WVW-1001");
  await expect(page.locator("tbody#runs")).not.toContainText("WVW-2042");
});
