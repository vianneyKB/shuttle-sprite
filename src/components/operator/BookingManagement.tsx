import React from "react";
import { useOperatorBookings, useUpdateBookingStatus } from "@/hooks/useBookings";
import { useMyVehicles } from "@/hooks/useVehicles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Users, MapPin, Phone, Mail, Car, DollarSign, Loader2 } from "lucide-react";
import type { Booking } from "@/types";
import { toast } from "sonner";

export const BookingManagement: React.FC = () => {
  const { data: bookings = [], isLoading } = useOperatorBookings();
  const { data: vehicles = [] } = useMyVehicles();
  const updateStatus = useUpdateBookingStatus();

  const update = async (id: string, status: Booking["status"]) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Booking ${status}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update booking");
    }
  };

  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const statusColor = (s: string) =>
    ({
      pending: "bg-orange-100 text-orange-800",
      confirmed: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    })[s] ?? "bg-gray-100 text-gray-800";

  const BookingCard = ({ booking }: { booking: Booking }) => {
    const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
    return (
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <header className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <>
              <p className="flex flex-wrap items-center gap-2">
                <strong className="text-lg">{booking.customerName}</strong>
                <Badge className={statusColor(booking.status)}>{booking.status}</Badge>
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-secondary-600 mt-2 list-none p-0">
                <li className="flex items-center gap-2"><Phone className="w-4 h-4" />{booking.customerPhone}</li>
                <li className="flex items-center gap-2"><Mail className="w-4 h-4" />{booking.customerEmail}</li>
                <li className="flex items-center gap-2"><Car className="w-4 h-4" />{vehicle?.make} {vehicle?.model}</li>
                <li className="flex items-center gap-2"><Users className="w-4 h-4" />{booking.passengers} passengers</li>
                <li className="flex items-center gap-2"><Calendar className="w-4 h-4" />{booking.startDate}</li>
                <li className="flex items-center gap-2"><Clock className="w-4 h-4" />{booking.time} ({booking.duration}h)</li>
              </ul>
              <p className="text-xs capitalize text-secondary-500 mt-1">
                {booking.paymentMethod} · {booking.paymentStatus.replace("_", " ")}
              </p>
            </>
            <p className="text-2xl font-bold text-primary-600">${booking.totalPrice}</p>
          </header>
          <ul className="space-y-1 text-sm list-none p-0">
            {booking.stops.map((stop) => (
              <li key={stop.id} className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-600" />
                <span className="capitalize font-medium">{stop.type}:</span>
                {stop.address}
              </li>
            ))}
          </ul>
          <footer className="flex flex-wrap gap-2 pt-2 border-t">
            {booking.status === "pending" && (
              <>
                <Button size="sm" onClick={() => update(booking.id, "confirmed")}>Confirm</Button>
                <Button variant="outline" size="sm" onClick={() => update(booking.id, "cancelled")}>Decline</Button>
              </>
            )}
            {booking.status === "confirmed" && (
              <>
                <Button size="sm" onClick={() => update(booking.id, "completed")}>Complete</Button>
                <Button variant="outline" size="sm" onClick={() => update(booking.id, "cancelled")}>Cancel</Button>
              </>
            )}
          </footer>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold">Booking management</h2>
        <p className="text-secondary-600">Fleet bookings from passengers</p>
      </header>
      <Tabs defaultValue="pending">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed ({confirmed.length})</TabsTrigger>
          <TabsTrigger value="completed">Done ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-4 mt-4">
          {pending.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
          {pending.length === 0 && <p className="text-secondary-600 text-center py-8">No pending bookings</p>}
        </TabsContent>
        <TabsContent value="confirmed" className="space-y-4 mt-4">
          {confirmed.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </TabsContent>
        <TabsContent value="completed" className="space-y-4 mt-4">
          {completed.map((b) => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </TabsContent>
      </Tabs>
    </section>
  );
};
