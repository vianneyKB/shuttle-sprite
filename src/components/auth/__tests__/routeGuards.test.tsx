/**
 * The two route guards. These decide who reaches the operator console, so the
 * cases that matter are the refusals: not signed in, and signed in without the
 * role. `loading` has its own cases because a guard that redirects while the
 * session is still resolving signs a legitimate operator out on every refresh.
 *
 * `useAuth` is mocked rather than wrapped in a real AuthProvider: the provider
 * talks to Supabase, and what is under test is the branch each guard takes for
 * a given auth state.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { ProtectedRoute } from "../ProtectedRoute";
import { RoleRoute } from "../RoleRoute";
import type { AppRole } from "@/context/AuthContext";

const useAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuth(),
}));

type AuthState = { user: User | null; roles: AppRole[]; loading: boolean };

const signedOut: AuthState = { user: null, roles: [], loading: false };
const asUser = (roles: AppRole[]): AuthState => ({
  user: { id: "u1" } as User,
  roles,
  loading: false,
});

/** Renders the guard at /operator with stand-ins for the pages it can send you to. */
const renderAt = (path: string, guarded: ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>home page</p>} />
        <Route path="/auth" element={<p>sign in page</p>} />
        <Route path="/operator" element={guarded} />
        <Route path="/profile" element={guarded} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => useAuth.mockReset());

describe("ProtectedRoute", () => {
  it("renders the page for a signed-in user", () => {
    useAuth.mockReturnValue(asUser(["customer"]));
    renderAt("/profile", <ProtectedRoute><p>protected content</p></ProtectedRoute>);
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to /auth", () => {
    useAuth.mockReturnValue(signedOut);
    renderAt("/profile", <ProtectedRoute><p>protected content</p></ProtectedRoute>);
    expect(screen.getByText("sign in page")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("waits while the session is still loading instead of redirecting", () => {
    useAuth.mockReturnValue({ user: null, roles: [], loading: true });
    renderAt("/profile", <ProtectedRoute><p>protected content</p></ProtectedRoute>);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("sign in page")).not.toBeInTheDocument();
  });
});

describe("RoleRoute", () => {
  const guard = (
    <RoleRoute allow={["operator", "admin"]}>
      <p>operator console</p>
    </RoleRoute>
  );

  it("admits a user holding one of the allowed roles", () => {
    useAuth.mockReturnValue(asUser(["operator"]));
    renderAt("/operator", guard);
    expect(screen.getByText("operator console")).toBeInTheDocument();
  });

  it("admits an admin, and a user who holds several roles", () => {
    useAuth.mockReturnValue(asUser(["admin"]));
    renderAt("/operator", guard);
    expect(screen.getByText("operator console")).toBeInTheDocument();

    useAuth.mockReturnValue(asUser(["customer", "operator"]));
    renderAt("/operator", guard);
    expect(screen.getAllByText("operator console")).toHaveLength(2);
  });

  it("sends a passenger home, not to the sign-in page", () => {
    useAuth.mockReturnValue(asUser(["customer"]));
    renderAt("/operator", guard);
    expect(screen.getByText("home page")).toBeInTheDocument();
    expect(screen.queryByText("operator console")).not.toBeInTheDocument();
  });

  it("sends a user with no roles home — an empty role list is not a pass", () => {
    useAuth.mockReturnValue(asUser([]));
    renderAt("/operator", guard);
    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to /auth", () => {
    useAuth.mockReturnValue(signedOut);
    renderAt("/operator", guard);
    expect(screen.getByText("sign in page")).toBeInTheDocument();
  });

  it("waits while roles are still loading — a role arrives after the user does", () => {
    useAuth.mockReturnValue({ user: { id: "u1" } as User, roles: [], loading: true });
    renderAt("/operator", guard);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("home page")).not.toBeInTheDocument();
  });
});
