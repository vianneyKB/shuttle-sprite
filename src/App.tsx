import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import OperatorPage from "./pages/Operator";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RoleRoute } from "./components/auth/RoleRoute";

const queryClient = new QueryClient();

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

const App = () => {
  // #region agent log
  fetch("http://127.0.0.1:7578/ingest/50506bb6-019f-48cf-b599-974a082e015e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "264723" },
    body: JSON.stringify({
      sessionId: "264723",
      runId: "fix-main",
      hypothesisId: "A",
      location: "App.tsx:render",
      message: "App rendering",
      data: { routerBasename, pathname: typeof location !== "undefined" ? location.pathname : null },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={routerBasename}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator"
              element={
                <RoleRoute allow={["operator", "admin"]}>
                  <OperatorPage />
                </RoleRoute>
              }
            />
            <Route path="/vendor" element={<Navigate to="/operator" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
