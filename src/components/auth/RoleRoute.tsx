import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/context/AuthContext";

export const RoleRoute: React.FC<{
  children: React.ReactNode;
  allow: AppRole[];
}> = ({ children, allow }) => {
  const { user, roles, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-secondary-600">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  const ok = roles.some((r) => allow.includes(r));
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
};