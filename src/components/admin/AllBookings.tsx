import React, { useMemo } from "react";
import { useAllBookings } from "@/hooks/useBookings";
import { useVehicles } from "@/hooks/useVehicles";
import { useProfileSummaries } from "@/hooks/useProfile";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import type { BookingStatus } from "@/types";
import { formatMoney } from "@/lib/money";
import { accountLabel } from "@/lib/operatorApplications";

const statusColor: Record<BookingStatus, string> = {
  pending: "bg-orange-100 text-orange-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export const AllBookings: React.FC = () => {
  const { data: bookings = [], isLoading } = useAllBookings();
  const { data: vehicles = [] } = useVehicles();

  const vehiclesById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const operatorIds = useMemo(
    () =>
      bookings
        .map((b) => vehiclesById.get(b.vehicleId)?.operatorId)
        .filter((id): id is string => !!id),
    [bookings, vehiclesById]
  );
  const { data: operators = new Map() } = useProfileSummaries(operatorIds);

  if (isLoading) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold">All bookings</h2>
        <p className="text-secondary-600">
          Every fleet booking on the platform, newest first ({bookings.length}).
        </p>
      </header>

      {bookings.length === 0 ? (
        <p className="text-secondary-600 text-center py-8">No bookings yet</p>
      ) : (
        <div className="bg-white rounded-xl shadow-elevation border border-secondary-200 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Passenger</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Seats</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const vehicle = vehiclesById.get(b.vehicleId);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.customerName}
                      <span className="block text-xs text-secondary-500">{b.customerPhone}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {vehicle ? `${vehicle.make} ${vehicle.model}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {vehicle ? accountLabel(vehicle.operatorId, operators) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.startDate}
                      <span className="block text-xs text-secondary-500">
                        {b.time} ({b.duration}h)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{b.passengers}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatMoney(b.totalPrice, b.currency)}
                    </TableCell>
                    <TableCell className="capitalize whitespace-nowrap">
                      {b.paymentMethod} · {b.paymentStatus.replace("_", " ")}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[b.status]}>{b.status}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
};
