import React from 'react';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useVendorBookings } from '@/hooks/useBookings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Calendar, DollarSign, TrendingUp, Clock, Loader2 } from 'lucide-react';

export const VendorDashboard: React.FC = () => {
  const { data: vehicles = [], isLoading: vLoad } = useMyVehicles();
  const { data: bookings = [], isLoading: bLoad } = useVendorBookings();

  if (vLoad || bLoad) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  }

  const totalEarnings = bookings.filter(b => b.status === 'completed').reduce((s, b) => s + b.totalPrice, 0);
  const pending = bookings.filter(b => b.status === 'pending').length;
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const available = vehicles.filter(v => v.available).length;

  const stats = [
    { title: 'Total Vehicles', value: vehicles.length, icon: Car, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { title: 'Available Now', value: available, icon: Clock, color: 'text-green-600', bgColor: 'bg-green-50' },
    { title: 'Pending Bookings', value: pending, icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { title: 'Confirmed Bookings', value: confirmed, icon: Calendar, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { title: 'Total Earnings', value: `$${totalEarnings.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { title: 'Total Bookings', value: bookings.length, icon: TrendingUp, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-secondary-900">Welcome Back!</h2>
        <p className="text-secondary-600">Here's an overview of your transport business</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <Card key={i} className="hover:shadow-elevation-md transition-shadow duration-300">
            <CardContent className="p-6"><div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-secondary-600 mb-1">{s.title}</p>
                <p className="text-2xl font-bold text-secondary-900">{s.value}</p></div>
              <div className={`${s.bgColor} p-3 rounded-xl`}><s.icon className={`w-6 h-6 ${s.color}`} /></div>
            </div></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center space-x-2"><Calendar className="w-5 h-5" /><span>Recent Bookings</span></CardTitle></CardHeader>
        <CardContent>
          {bookings.length > 0 ? (
            <div className="space-y-4">
              {bookings.slice(0, 5).map(booking => {
                const vehicle = vehicles.find(v => v.id === booking.vehicleId);
                return (
                  <div key={booking.id} className="flex items-center justify-between p-4 bg-secondary-50 rounded-xl">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          booking.status === 'pending' ? 'bg-orange-400' :
                          booking.status === 'confirmed' ? 'bg-blue-400' :
                          booking.status === 'completed' ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                        <h4 className="font-semibold text-secondary-900">{booking.customerName}</h4>
                        <span className="text-sm text-secondary-600">{vehicle?.make} {vehicle?.model}</span>
                      </div>
                      <p className="text-sm text-secondary-600 mt-1">
                        {booking.startDate} at {booking.time} • {booking.duration}h • {booking.passengers} passengers
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-secondary-900">${booking.totalPrice}</p>
                      <p className="text-sm text-secondary-600 capitalize">{booking.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
              <p className="text-secondary-600">No bookings yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
