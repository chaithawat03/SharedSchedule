import { randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

test.skip(
  !process.env.TEST_DATABASE_URL,
  "A dedicated TEST_DATABASE_URL is required for browser tests",
);

function phone() {
  return `08${String(randomInt(0, 100_000_000)).padStart(8, "0")}`;
}

async function register(
  page: Page,
  number: string,
  name: string,
  destination: RegExp = /\/rooms$/,
) {
  await page.getByLabel("Phone number").fill(number);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(destination);
}

test("two members join, share schedules, and retain ownership boundaries", async ({
  page,
  browser,
}) => {
  test.skip(
    test.info().project.name !== "chromium-desktop",
    "The full transaction flow runs once on desktop; other projects run the layout smoke test",
  );
  const ownerName = `Owner ${randomInt(100_000)}`;
  const partnerName = `Partner ${randomInt(100_000)}`;
  await page.goto("/");
  await register(page, phone(), ownerName);
  await page.getByLabel("Room name").fill(`M10 room ${randomInt(1_000_000)}`);
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page).toHaveURL(/\/room\/[0-9a-f-]+$/);
  const roomUrl = page.url();
  await page.getByRole("button", { name: "Join as Participant" }).click();
  await expect(
    page.getByRole("button", { name: "Select dates" }),
  ).toBeVisible();

  const days = Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    state: "WORK",
    startTime: "07:40",
    endTime: "17:00",
  }));
  expect(
    (await page.request.put("/api/me/work-pattern", { data: { days } })).ok(),
  ).toBeTruthy();
  await page.reload();
  const day = page.getByRole("button", { name: /^Open [A-Z]/ }).first();
  const dayName = await day.getAttribute("aria-label");
  await day.click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Weekly pattern").first()).toBeVisible();
  await dialog.getByRole("button", { name: /Add my schedule/ }).click();
  await dialog.getByLabel("Status").selectOption({ label: "OT" });
  await dialog.getByLabel("All day").uncheck();
  await dialog.getByLabel("Start time").fill("17:20");
  await dialog.getByLabel("End time").fill("19:40");
  await dialog.getByRole("button", { name: "Save event" }).click();
  await expect(dialog.getByText(/17:20/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close day detail" }).click();

  await page.getByRole("button", { name: "Create invite" }).click();
  const inviteUrl = await page.getByLabel("Share this link now").inputValue();
  const partnerContext = await browser.newContext();
  try {
    const partner = await partnerContext.newPage();
    await partner.goto(inviteUrl);
    await register(partner, phone(), partnerName, /\/room\/[0-9a-f-]+$/);
    await expect(partner).toHaveURL(roomUrl);
    await partner.getByRole("button", { name: dayName! }).click();
    dialog = partner.getByRole("dialog");
    await expect(dialog.getByText(/17:20/)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Edit my event" }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: /Add my schedule/ }).click();
    await dialog.getByLabel("Status").selectOption({ label: "OFF" });
    await dialog.getByRole("button", { name: "Save event" }).click();
    await expect(dialog.getByText("OFF")).toBeVisible();
    await dialog.getByRole("button", { name: "Close day detail" }).click();
    await expect(partner.getByRole("link", { name: "Settings" })).toHaveCount(
      0,
    );

    await page.reload();
    await page.getByRole("button", { name: dayName! }).click();
    await expect(page.getByRole("dialog").getByText("OFF")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Edit my event" })
      .click();
    await page.getByRole("dialog").getByLabel("Title").fill("Updated overtime");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save event" })
      .click();
    await expect(
      page.getByRole("dialog").getByText("Updated overtime"),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Edit my event" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete my event" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm delete" })
      .click();
    await expect(
      page.getByRole("dialog").getByText("Updated overtime"),
    ).toHaveCount(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close day detail" })
      .click();
    await page.getByRole("link", { name: "Notifications" }).click();
    await expect(page.getByText(partnerName).first()).toBeVisible();
    await page.goto(roomUrl);
    await page.getByRole("button", { name: "Select dates" }).click();
    await page
      .getByRole("button", { name: /^Select [A-Z]/ })
      .first()
      .click();
    await expect(page.getByText("1 selected")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Room settings" }),
    ).toBeVisible();
  } finally {
    await partnerContext.close();
  }
});

test("room and work calendar fit the viewport and day actions remain keyboard reachable", async ({
  page,
}) => {
  await page.goto("/");
  await register(page, phone(), `Mobile ${randomInt(100_000)}`);
  await page.getByLabel("Room name").fill(`M10 layout ${randomInt(1_000_000)}`);
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.getByRole("heading", { name: /M10 layout/ })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: /^Open [A-Z]/ })
    .first()
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Work Calendar" }).click();
  await expect(
    page.getByRole("heading", { name: "Work calendar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save weekly pattern" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
