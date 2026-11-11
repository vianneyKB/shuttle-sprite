import { expect, test } from "@playwright/test";

import { deleteUsersByEmail } from "./helpers/admin";
import {
  addVehicle,
  createRoute,
  dispatchRideToCompletion,
  gotoOperator,
  openMyRides,
  requestRide,
  signIn,
  signOut,
  signUp,
  type TestRoute,
  type TestUser,
  type TestVehicle,
} from "./helpers/app";

/**
 * The one journey that has to work: an operator puts a route on the map, a
 * passenger asks for a ride on it, the operator dispatches it, and the
 * passenger is told. Nothing is stubbed — it runs against a real Supabase, so
 * it covers the RLS policies, the dispatch RPC and the realtime subscription
 * together, which no unit test can.
 *
 * Everything is named with the run's timestamp: the passenger map shows every
 * active route in the database, so unique names keep this run's route, stops
 * and vehicle unambiguous even on a stack other runs have used.
 */
const run = Date.now();

const operator: TestUser = {
  email: `e2e-operator-${run}@shuttlebook.test`,
  password: `Operator-e2e-${run}`,
  name: "E2E Operator",
  phone: "082 555 0101",
  role: "operator",
};

const passenger: TestUser = {
  email: `e2e-passenger-${run}@shuttlebook.test`,
  password: `Passenger-e2e-${run}`,
  name: "E2E Passenger",
  phone: "082 555 0202",
  role: "customer",
};

const route: TestRoute = {
  name: `E2E Route ${run}`,
  stops: [`Alpha Terminal ${run}`, `Beta Mall ${run}`],
};

const vehicle: TestVehicle = {
  make: "E2E",
  model: `Shuttle ${run}`,
  capacity: 14,
  location: "Johannesburg",
};

const PASSENGERS = 2;

test.describe("ride journey", () => {
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await deleteUsersByEmail([operator.email, passenger.email]);
  });

  test("signup → route → request → confirm → status", async ({ page }) => {
    const [origin, destination] = route.stops;

    await test.step("an operator signs up and puts a route on the map", async () => {
      await signUp(page, operator);
      await gotoOperator(page);
      // A vehicle first: the dispatch state machine will not start a ride
      // without one, so a fleet of nothing cannot complete this journey.
      await addVehicle(page, vehicle);
      await createRoute(page, route);
      await signOut(page);
    });

    await test.step("a passenger signs up and requests a ride on it", async () => {
      await signUp(page, passenger);
      await requestRide(page, { route, passengers: PASSENGERS });

      const rides = await openMyRides(page);
      await expect(rides).toContainText(`${origin} → ${destination}`);
      await expect(rides).toContainText("awaiting");
      await signOut(page);
    });

    await test.step("the operator confirms, starts and completes it", async () => {
      await signIn(page, operator);
      await gotoOperator(page);
      await dispatchRideToCompletion(page, { route, vehicle, passengers: PASSENGERS });
      await signOut(page);
    });

    await test.step("the passenger sees the final status in My rides", async () => {
      await signIn(page, passenger);
      const rides = await openMyRides(page);
      await expect(rides).toContainText(`${origin} → ${destination}`);
      await expect(rides).toContainText("completed");
      await expect(rides).toContainText(`${PASSENGERS} passenger(s)`);
      // The vehicle the operator assigned is named on the passenger's card.
      await expect(rides).toContainText(`${vehicle.make} ${vehicle.model}`);
    });
  });
});
