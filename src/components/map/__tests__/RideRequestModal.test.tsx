/**
 * What the request form refuses to send. Each guard here mirrors a check
 * inside `create_ride_request()` — the server is still the authority; these
 * tests pin that the passenger is told *before* a round trip, and that a
 * refused form never reaches the RPC.
 *
 * The data hooks are mocked: a real `useCreateRideRequest` needs Supabase and
 * a QueryClient, and what is under test is the component's own validation.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RideRequestModal } from "../RideRequestModal";
import type { RouteStop, ShuttleRoute } from "@/types";

const createRide = vi.fn();
const updateProfile = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
let profile: { phone: string | null } | undefined = { phone: "0821234567" };
let quote: { isLoading: boolean; data?: unknown } = { isLoading: false, data: undefined };

vi.mock("@/hooks/useRideRequests", () => ({
  useCreateRideRequest: () => ({ mutateAsync: createRide, isPending: false }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useMyProfile: () => ({ data: profile }),
  useUpdateMyProfile: () => ({ mutateAsync: updateProfile, isPending: false }),
}));
vi.mock("@/hooks/useRouteFares", () => ({
  useRideFareQuote: () => quote,
}));
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) },
}));

const stop = (id: string, name: string, order: number): RouteStop => ({
  id,
  routeId: "r1",
  name,
  stopOrder: order,
  lat: -26.2 + order,
  lng: 28.0 + order,
});

const origin = stop("s1", "Noord Street", 0);
const route: ShuttleRoute = {
  id: "r1",
  operatorId: "op1",
  name: "Noord → Soweto",
  isActive: true,
  stops: [origin, stop("s2", "Baragwanath", 1), stop("s3", "Maponya Mall", 2)],
} as ShuttleRoute;

const onClose = vi.fn();

const open = () => render(<RideRequestModal route={route} originStop={origin} onClose={onClose} />);

/** Picks a destination through the real shadcn Select, as a passenger would. */
const chooseDestination = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole("combobox", { name: "Destination" }));
  await user.click(await screen.findByRole("option", { name }));
};

beforeEach(() => {
  createRide.mockReset().mockResolvedValue({ id: "req1" });
  updateProfile.mockReset().mockResolvedValue(undefined);
  toastError.mockReset();
  toastSuccess.mockReset();
  onClose.mockReset();
  profile = { phone: "0821234567" };
  quote = { isLoading: false, data: undefined };
});

describe("RideRequestModal — destination", () => {
  it("refuses to submit without a destination and does not call the RPC", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(toastError).toHaveBeenCalledWith("Select a destination stop");
    expect(createRide).not.toHaveBeenCalled();
  });

  it("never offers the origin as a destination", () => {
    open();
    expect(screen.getByText(/From/)).toBeInTheDocument();
    // The origin is named in the header, but not as a choosable stop.
    expect(screen.queryByRole("option", { name: "Noord Street" })).not.toBeInTheDocument();
  });

  it("submits the chosen stop once one is picked", async () => {
    const user = userEvent.setup();
    open();
    await chooseDestination(user, "Maponya Mall");
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(toastError).not.toHaveBeenCalled();
    expect(createRide).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: "r1",
        originStopId: "s1",
        destinationStopId: "s3",
        passengers: 1,
        paymentMethod: "cash",
      })
    );
    expect(onClose).toHaveBeenCalled();
  });
});

describe("RideRequestModal — passengers", () => {
  it("refuses an empty passenger count, which reads as 0", async () => {
    const user = userEvent.setup();
    open();
    await chooseDestination(user, "Baragwanath");
    await user.clear(screen.getByLabelText("Passengers"));
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(toastError).toHaveBeenCalledWith("Passengers must be between 1 and 50");
    expect(createRide).not.toHaveBeenCalled();
  });

  it("refuses more than the 50 the RPC allows", async () => {
    const user = userEvent.setup();
    open();
    await chooseDestination(user, "Baragwanath");
    const field = screen.getByLabelText("Passengers");
    await user.clear(field);
    await user.type(field, "51");
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(toastError).toHaveBeenCalledWith("Passengers must be between 1 and 50");
    expect(createRide).not.toHaveBeenCalled();
  });

  it("accepts a seat count in range", async () => {
    const user = userEvent.setup();
    open();
    await chooseDestination(user, "Baragwanath");
    const field = screen.getByLabelText("Passengers");
    await user.clear(field);
    await user.type(field, "4");
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(createRide).toHaveBeenCalledWith(expect.objectContaining({ passengers: 4 }));
  });
});

describe("RideRequestModal — mobile number", () => {
  it("asks for a number when the profile has none, and saves it with the request", async () => {
    profile = { phone: null };
    const user = userEvent.setup();
    open();
    await chooseDestination(user, "Baragwanath");
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(toastError).toHaveBeenCalledWith("Add a mobile number so the driver can reach you");
    expect(createRide).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Mobile number"), "0821234567");
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(updateProfile).toHaveBeenCalledWith({ phone: "0821234567" });
    expect(createRide).toHaveBeenCalled();
  });
});

describe("RideRequestModal — fare display", () => {
  it("shows nothing to price until a destination is chosen", () => {
    open();
    expect(screen.getByText("Choose a destination to see the fare.")).toBeInTheDocument();
  });

  it("labels the seat row with the seat count the server priced, not the form's", async () => {
    // The passenger has typed 9 but the quote in hand was priced for 2 — the
    // row has to read 2, or it would sit above a subtotal that contradicts it.
    quote = {
      isLoading: false,
      data: {
        source: "segment",
        farePerSeat: 18,
        passengers: 2,
        currency: "ZAR",
        subtotal: 36,
        taxRate: 15,
        taxLabel: "VAT",
        taxAmount: 5.4,
        pricesIncludeTax: false,
        total: 41.4,
      },
    };
    const user = userEvent.setup();
    open();
    await chooseDestination(user, "Baragwanath");
    const field = screen.getByLabelText("Passengers");
    await user.clear(field);
    await user.type(field, "9");
    expect(screen.getByText(/^2 × .* per seat$/)).toBeInTheDocument();
    expect(screen.getByText("VAT (15%)")).toBeInTheDocument();
    expect(screen.getByText("Fare")).toBeInTheDocument();
  });

  it("says so plainly when the route has no fare", async () => {
    quote = { isLoading: false, data: { source: "none", passengers: 1, currency: "ZAR", taxRate: 15, taxLabel: "VAT" } };
    const user = userEvent.setup();
    open();
    await chooseDestination(user, "Baragwanath");
    expect(screen.getByText("No fare set for this trip — pay the driver on board.")).toBeInTheDocument();
  });
});
