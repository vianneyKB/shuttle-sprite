import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Placeholders held while a lazily imported chunk arrives. They exist so a
 * code-split boundary never collapses the layout: the panel version keeps the
 * same box the real component will occupy, so the page does not jump when it
 * lands.
 */

/** A whole route still downloading — matches the signed-in wait in `ProtectedRoute`. */
export const PageFallback: React.FC = () => (
  <div
    className="min-h-screen flex items-center justify-center text-secondary-600"
    role="status"
    aria-live="polite"
  >
    <Loader2 className="w-6 h-6 animate-spin text-primary-600" aria-hidden="true" />
    <span className="sr-only">Loading…</span>
  </div>
);

/** A panel inside an already-painted page; `className` carries the box to hold. */
export const PanelFallback: React.FC<{ className?: string; label?: string }> = ({
  className,
  label = "Loading…",
}) => (
  <div
    className={cn(
      "rounded-xl border border-secondary-200 bg-secondary-50 flex items-center justify-center",
      className
    )}
    role="status"
    aria-live="polite"
  >
    <Loader2 className="w-8 h-8 animate-spin text-primary-600" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
);
