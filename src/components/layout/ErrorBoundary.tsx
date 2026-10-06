import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportError } from "@/lib/errorReporting";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Id of the crash report, when one was sent. Shown so support can find it. */
  eventId: string | null;
}

/**
 * Top-level boundary: a render error below this point replaces the page with a
 * friendly fallback instead of a blank screen, and is reported.
 *
 * Deliberately plain — `Button` and `Card` are presentational, so the fallback
 * does not depend on the router, query client or auth context. One of those
 * failing is exactly how we get here.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, eventId: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const eventId = reportError(error, {
      componentStack: info.componentStack,
      mechanism: "react-error-boundary",
    });
    if (eventId) this.setState({ eventId });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 safe-bottom overflow-x-hidden bg-gradient-to-br from-secondary-50 via-white to-primary-50">
        <Card className="w-full max-w-md p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This page ran into an unexpected problem. Reloading usually fixes it — your rides and
            bookings are safe.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={this.handleReload}>Reload the page</Button>
            <Button variant="outline" asChild>
              <a href={import.meta.env.BASE_URL}>Back to home</a>
            </Button>
          </div>
          {this.state.eventId && (
            <p className="mt-6 text-xs text-muted-foreground">
              Reference <code className="font-mono">{this.state.eventId}</code>
            </p>
          )}
        </Card>
      </div>
    );
  }
}
