import React, { useState } from "react";
import { RouteMap } from "@/components/map/RouteMap";
import { RideRequestModal } from "@/components/map/RideRequestModal";
import { useShuttleRoutes } from "@/hooks/useRoutes";
import type { RouteStop, ShuttleRoute } from "@/types";

export const RoutesMapPanel: React.FC = () => {
  const { data: routes = [], isLoading } = useShuttleRoutes();
  const [request, setRequest] = useState<{
    route: ShuttleRoute;
    stop: RouteStop;
  } | null>(null);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-bold text-secondary-900">Shuttle routes map</h2>
        <p className="text-sm text-secondary-600">
          View active routes and tap a stop to request a ride. Pay cash on board or in advance.
        </p>
      </header>
      <RouteMap
        routes={routes}
        isLoading={isLoading}
        onStopSelect={(route, stop) => setRequest({ route, stop })}
      />
      {request && (
        <RideRequestModal
          route={request.route}
          originStop={request.stop}
          onClose={() => setRequest(null)}
        />
      )}
    </section>
  );
};
