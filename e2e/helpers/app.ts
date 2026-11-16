import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page helpers for the end-to-end journey. Each one drives the app the way a
 * person does — accessible names, labels, the header's role switch — so a
 * rename that a passenger would notice fails the test, and a refactor that
 * nobody notices does not.
 */

export type TestUser = {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: "customer" | "operator";
};

export type TestRoute = { name: string; stops: [string, string] };

export type TestVehicle = { make: string; model: string; capacity: number; location: string };

/** The passenger home page, which is also "signed in" for our purposes. */
const passengerHome = (page: Page) =>
  page.getByRole("heading", { level: 1, name: /Professional Transport & Fleet Booking/ });

/** The innermost section carrying a heading — the modal panel, not its backdrop. */
const panelWithHeading = (page: Page, name: string | RegExp): Locator =>
  page.locator("section").filter({ has: page.getByRole("heading", { name }) }).last();

export async function signUp(page: Page, user: TestUser): Promise<void> {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Create account" }).click();

  await page.getByLabel("Full name").fill(user.name);
  await page.getByLabel("Mobile number").fill(user.phone);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  await page.getByRole("combobox").click();
  await page
    .getByRole("option", { name: user.role === "operator" ? /Operator/ : /Customer/ })
    .click();

  await page.getByRole("button", { name: "Create account" }).click();

  // With confirmations off (the local stack's default, pinned in
  // supabase/config.toml) sign-up returns a session and the app navigates
  // home. If a project does confirm by email, sign-up drops back to the
  // sign-in tab instead — handle both rather than depending on the setting.
  const signInSubmit = page.getByRole("button", { name: "Sign in" });
  await expect(passengerHome(page).or(signInSubmit)).toBeVisible();
  if (!(await passengerHome(page).isVisible())) {
    await signIn(page, user);
  }
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(passengerHome(page)).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth$/);
}

/**
 * Open the operator dashboard from the header. Deliberately not a direct
 * `goto("/operator")`: the role switch only renders once the operator's roles
 * have loaded, so clicking it waits for the thing RoleRoute checks.
 */
export async function gotoOperator(page: Page): Promise<void> {
  const link = page.getByRole("link", { name: "Operator" }).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { name: "Operator Dashboard" })).toBeVisible();
}

export async function addVehicle(page: Page, vehicle: TestVehicle): Promise<void> {
  await page.getByRole("tab", { name: "Fleet" }).click();
  await page.getByRole("button", { name: /Add (Vehicle|Your First Vehicle)/ }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Make").fill(vehicle.make);
  await dialog.getByLabel("Model").fill(vehicle.model);
  await dialog.getByLabel("Capacity").fill(String(vehicle.capacity));
  await dialog.getByLabel("Location").fill(vehicle.location);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: new RegExp(`${vehicle.make} ${vehicle.model}`) }),
  ).toBeVisible();
}

/**
 * Create a route with its stops. Stops are placed with the "Add stop" button,
 * which seeds a coordinate near the last one — the map click path is the same
 * code with a hand-picked latitude, and a synthetic click on a Leaflet canvas
 * would test Leaflet rather than this app.
 */
export async function createRoute(page: Page, route: TestRoute): Promise<void> {
  await page.getByRole("tab", { name: "Routes" }).click();
  await page.getByRole("button", { name: "New route" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Route name").fill(route.name);
  await dialog.getByLabel("Operating hours").fill("Mon–Fri 6am–8pm");

  for (const [index, stop] of route.stops.entries()) {
    await dialog.getByRole("button", { name: "Add stop" }).click();
    await dialog.getByLabel(`Stop ${index + 1} name`).fill(stop);
  }

  await dialog.getByRole("button", { name: "Save route" }).click();
  await expect(dialog).toBeHidden();

  const card = page.locator("li").filter({ hasText: route.name });
  await expect(card).toContainText(`${route.stops.length} stops`);
}

/**
 * Request a ride from a named stop on the passenger map. The stop markers are
 * indistinguishable until their popup is open, so open them in turn until the
 * right one answers.
 */
export async function requestRide(
  page: Page,
  trip: { route: TestRoute; passengers: number },
): Promise<void> {
  const [origin, destination] = trip.route.stops;

  await page.getByRole("tab", { name: "Routes" }).click();
  await expect(page.getByRole("heading", { name: "Shuttle routes map" })).toBeVisible();

  // Narrow the map to this run's route so only its stops carry markers.
  await page.getByPlaceholder("Filter routes or stops…").fill(trip.route.name);

  const markers = page.locator("img.leaflet-marker-icon");
  await expect(markers.first()).toBeVisible();
  const popup = page.locator(".leaflet-popup-content");
  let opened = false;

  for (let i = 0; i < (await markers.count()); i += 1) {
    await markers.nth(i).click();
    await expect(popup).toBeVisible();
    if ((await popup.innerText()).includes(origin)) {
      await popup.getByRole("button", { name: "Request ride from here" }).click();
      opened = true;
      break;
    }
    await page.keyboard.press("Escape");
  }
  expect(opened, `no map marker opened a popup for the stop "${origin}"`).toBe(true);

  const modal = panelWithHeading(page, "Request a ride");
  await expect(modal).toContainText(origin);

  await modal.getByRole("combobox").first().click();
  await page.getByRole("option", { name: destination }).click();

  await modal.getByLabel("Passengers").fill(String(trip.passengers));
  await modal.getByRole("button", { name: "Submit request" }).click();

  await expect(page.getByText(/Ride request submitted/)).toBeVisible();
  await expect(modal).toBeHidden();
}

/**
 * Confirm the waiting group, assign the vehicle, then start and complete the
 * ride — the operator's half of the journey, in the order the dispatch state
 * machine allows it.
 */
export async function dispatchRideToCompletion(
  page: Page,
  trip: { route: TestRoute; vehicle: TestVehicle; passengers: number },
): Promise<void> {
  const [origin, destination] = trip.route.stops;

  await page.getByRole("tab", { name: "Queue" }).click();
  await expect(page.getByRole("heading", { name: "Passenger queue" })).toBeVisible();

  const group = page
    .locator("li")
    .filter({ hasText: origin })
    .filter({ hasText: destination })
    .first();
  await expect(group).toBeVisible();
  await expect(group).toContainText(`${trip.passengers} passenger`);

  await group.getByRole("combobox", { name: "Assign vehicle" }).click();
  await page.getByRole("option", { name: new RegExp(`${trip.vehicle.make} ${trip.vehicle.model}`) }).click();
  await group.getByRole("button", { name: "Confirm all" }).click();
  await expect(page.getByText(/1 request confirmed/)).toBeVisible();

  const activeRides = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /^Active rides/ }) })
    .last();

  await activeRides.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByText(/Ride started/)).toBeVisible();

  await activeRides.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.getByText(/Ride completed/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active rides (0)" })).toBeVisible();
}

/**
 * The passenger's own view of their requests. Both the outer tabs and the
 * requests/fleet tabs inside them render a panel, so the inner one is last.
 */
export async function openMyRides(page: Page): Promise<Locator> {
  await page.getByRole("tab", { name: "My rides" }).click();
  const panel = page.getByRole("tabpanel").last();
  await expect(panel).toBeVisible();
  return panel;
}
