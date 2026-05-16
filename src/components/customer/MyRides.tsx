import React from "react";
import { useMyBookings, useCancelBooking } from "@/hooks/useBookings";
import { useMyRideRequests, useCancelRideRequest } from "@/hooks/useRideRequests";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Loader2, Bus } from "lucide-react";
import { toast } from "sonner";

const Row = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={className}>{children}</p>
);

export const MyRides: React.FC = () => {
  const { data: bookings = [], isLoading: bLoad } = useMyBookings();
  const { data: requests = [], isLoading: rLoad } = useMyRideRequests();
  const cancelBooking = useCancelBooking();
  const cancelRequest = useCancelRideRequest();

  const statusColor = (s: string) =>
    ({
      pending: "bg-orange-100 text-orange-800",
      awaiting: "bg-orange-100 text-orange-800",
      confirmed: "bg-blue-100 text-blue-800",
      in_progress: "bg-purple-100 text-purple-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    })[s] ?? "bg-gray-100 text-gray-800";

  if (bLoad || rLoad) {
    return (
      <p className="flex justify-center py-12" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  return (
    <Tabs defaultValue="requests" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="requests">Shuttle requests ({requests.length})</TabsTrigger>
        <TabsTrigger value="fleet">Fleet bookings ({bookings.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="requests" className="space-y-4">
        {requests.length === 0 ? (
          <p className="text-center text-secondary-600 py-8">
            No shuttle ride requests yet. Pick a stop on the map to request a ride.
          </p>
        ) : (
          requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 sm:p-6 space-y-3">
                <Row className="flex flex-wrap items-center gap-2 justify-between not-only:p-0">
                  <Badge className={statusColor(r.status)}>{r.status.replace("_", " ")}</Badge>
                  <span className="text-sm text-secondary-600 capitalize">
                    {r.paymentMethod} · {r.paymentStatus.replace("_", " ")}
                  </span>
                </Row>
                <p className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary-600 shrink-0" />
                  {r.originName} → {r.destinationName}
                </p>
                <p className="text-sm text-secondary-600">{r.passengers} passenger(s)</p>
                {r.status === "awaiting" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await cancelRequest.mutateAsync(r.id);
                        toast.success("Request cancelled");
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Cancel failed");
                      }
                    }}
                  >
                    Cancel request
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <TabsContent value="fleet" className="space-y-4">
        {bookings.length === 0 ? (
          <p className="text-center text-secondary-600 py-8">No fleet bookings yet.</p>
        ) : (
          bookings.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4 sm:p-6 space-y-3">
                <Row className="flex flex-wrap items-center gap-2 justify-between">
                  <Badge className={statusColor(b.status)}>{b.status}</Badge>
                  <span className="font-semibold text-primary-600">${b.totalPrice}</span>
                </Row>
                <p className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 shrink-0" />
                  {b.startDate} at {b.time} · {b.duration}h
                </p>
                <p className="text-sm text-secondary-600 capitalize">
                  <Bus className="w-4 h-4 inline mr-1" />
                  {b.paymentMethod} · {b.paymentStatus.replace("_", " ")}
                </p>
                {b.status === "pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await cancelBooking.mutateAsync(b.id);
                        toast.success("Booking cancelled");
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Cancel failed");
                      }
                    }}
                  >
                    Cancel booking
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
};
