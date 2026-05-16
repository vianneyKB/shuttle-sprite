import React from "react";
import { useMyVehicles } from "@/hooks/useVehicles";
import { useOperatorBookings } from "@/hooks/useBookings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Calendar, DollarSign, TrendingUp, Clock, Loader2 } from "lucide-react";

export const OperatorDashboard: React.FC = () => {
  const { data: vehicles = [], isLoading: vLoad } = useMyVehicles();
  const { data: bookings = [], isLoading: bLoad } = useOperatorBookings();

  if (vLoad || bLoad) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  const totalEarnings = bookings
    .filter((b) => b.status === "completed")
    .reduce((s, b) => s + b.totalPrice, 0);
  const pending = bookings.filter((b) => b.status === "pending").length;
  const confirmed = bookings.filter((b) => b.status === "confirmed").length;
  const available = vehicles.filter((v) => v.available).length;

  const stats = [
    { title: "Total Vehicles", value: vehicles.length, icon: Car, color: "text-blue-600", bgColor: "bg-blue-50" },
    { title: "Available Now", value: available, icon: Clock, color: "text-green-600", bgColor: "bg-green-50" },
    { title: "Pending Bookings", value: pending, icon: Calendar, color: "text-orange-600", bgColor: "bg-orange-50" },
    { title: "Confirmed Bookings", value: confirmed, icon: Calendar, color: "text-purple-600", bgColor: "bg-purple-50" },
    { title: "Total Earnings", value: `$${totalEarnings.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", bgColor: "bg-emerald-50" },
    { title: "Total Bookings", value: bookings.length, icon: TrendingUp, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  ];

  return (
    <section className="space-y-8">
      <header className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-secondary-900">Welcome back</h2>
        <p className="text-secondary-600">Overview of your shuttle operation</p>
      </header>
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0">
        {stats.map((s) => (
          <li key={s.title}>
            <Card className="hover:shadow-elevation-md transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <>
                  <p className="text-sm font-medium text-secondary-600 mb-1">{s.title}</p>
                  <p className="text-2xl font-bold text-secondary-900">{s.value}</p>
                </>
                <p className={`${s.bgColor} p-3 rounded-xl`}>
                  <s.icon className={`w-6 h-6 ${s.color}`} />
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recent bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length > 0 ? (
            <ul className="space-y-4 list-none p-0 m-0">
              {bookings.slice(0, 5).map((booking) => {
                const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
                return (
                  <li
                    key={booking.id}
                    className="flex items-center justify-between p-4 bg-secondary-50 rounded-xl"
                  >
                    <>
                      <p className="flex items-center gap-3">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            booking.status === "pending"
                              ? "bg-orange-400"
                              : booking.status === "confirmed"
                                ? "bg-blue-400"
                                : booking.status === "completed"
                                  ? "bg-green-400"
                                  : "bg-red-400"
                          }`}
                        />
                        <strong>{booking.customerName}</strong>
                        <span className="text-sm text-secondary-600">
                          {vehicle?.make} {vehicle?.model}
                        </span>
                      </p>
                      <p className="text-sm text-secondary-600 mt-1">
                        {booking.startDate} at {booking.time} · {booking.duration}h
                      </p>
                    </>
                    <p className="text-right">
                      <span className="font-semibold">${booking.totalPrice}</span>
                      <br />
                      <span className="text-sm text-secondary-600 capitalize">{booking.status}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-center py-8 text-secondary-600">No bookings yet</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
