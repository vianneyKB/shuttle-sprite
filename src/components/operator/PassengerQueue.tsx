import React from "react";
import { usePassengerQueue } from "@/hooks/useRideRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, ArrowRight, Loader2 } from "lucide-react";

export const PassengerQueue: React.FC = () => {
  const { data: groups = [], isLoading } = usePassengerQueue();

  if (isLoading) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  return (
    <section className="space-y-6">
      <header className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-secondary-900">Passenger queue</h2>
        <p className="text-secondary-600 text-sm sm:text-base max-w-xl mx-auto">
          Passengers awaiting pickup, grouped by origin and destination (e.g. Mall A → Mall B).
        </p>
      </header>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-secondary-600">
            No passengers waiting right now.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {groups.map((g, i) => (
            <li key={`${g.originName}-${g.destinationName}-${i}`}>
              <Card className="h-full border-l-4 border-l-primary-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">
                      {g.originName}
                      <ArrowRight className="w-4 h-4 inline mx-1 text-secondary-400" />
                      {g.destinationName}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex gap-6 pt-0">
                  <p className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-secondary-500" />
                    <span>
                      <strong className="text-lg text-primary-600">{g.totalPassengers}</strong>{" "}
                      passenger{g.totalPassengers !== 1 ? "s" : ""}
                    </span>
                  </p>
                  <p className="text-sm text-secondary-600">
                    {g.requestCount} request{g.requestCount !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
