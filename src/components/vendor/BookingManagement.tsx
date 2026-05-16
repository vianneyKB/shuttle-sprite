import React from 'react';
import { useVendorBookings, useUpdateBookingStatus } from '@/hooks/useBookings';
import { useMyVehicles } from '@/hooks/useVehicles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Users, MapPin, Phone, Mail, Car, DollarSign, Loader2 } from 'lucide-react';
import { Booking } from '@/types';
import { toast } from 'sonner';

export const BookingManagement: React.FC = () => {
  const { data: bookings = [], isLoading } = useVendorBookings();
  const { data: vehicles = [] } = useMyVehicles();
  const updateStatus = useUpdateBookingStatus();

  const update = async (id: string, status: Booking['status']) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Booking ${status}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update booking');
    }
  };

  const pending = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const completed = bookings.filter(b => b.status === 'completed');
  const cancelled = bookings.filter(b => b.status === 'cancelled');

  const statusColor = (s: string) => ({
    pending: 'bg-orange-100 text-orange-800',
    confirmed: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  } as Record<string, string>)[s] ?? 'bg-gray-100 text-gray-800';

  const BookingCard = ({ booking }: { booking: Booking }) => {
    const vehicle = vehicles.find(v => v.id === booking.vehicleId);
    return (
      <Card className="hover:shadow-elevation-md transition-shadow duration-300">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-base sm:text-lg font-semibold text-secondary-900">{booking.customerName}</h3>
                <Badge className={statusColor(booking.status)}>{booking.status}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-secondary-600">
                <div className="flex items-center space-x-2"><Phone className="w-4 h-4" /><span>{booking.customerPhone}</span></div>
                <div className="flex items-center space-x-2"><Mail className="w-4 h-4" /><span>{booking.customerEmail}</span></div>
                <div className="flex items-center space-x-2"><Car className="w-4 h-4" /><span>{vehicle?.make} {vehicle?.model}</span></div>
                <div className="flex items-center space-x-2"><Users className="w-4 h-4" /><span>{booking.passengers} passengers</span></div>
                <div className="flex items-center space-x-2"><Calendar className="w-4 h-4" /><span>{booking.startDate}</span></div>
                <div className="flex items-center space-x-2"><Clock className="w-4 h-4" /><span>{booking.time} ({booking.duration}h)</span></div>
              </div>
            </div>
            <div className="text-left sm:text-right sm:ml-4 shrink-0">
              <div className="text-xl sm:text-2xl font-bold text-primary-600">${booking.totalPrice}</div>
              <div className="text-sm text-secondary-600">Total</div>
            </div>
          </div>
          <div className="mb-4">
            <h4 className="font-medium text-secondary-900 mb-2">Journey</h4>
            <div className="space-y-2">
              {booking.stops.map((stop) => (
                <div key={stop.id} className="flex items-center space-x-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary-600" />
                  <span className="capitalize font-medium">{stop.type}:</span>
                  <span className="text-secondary-600">{stop.address}</span>
                </div>
              ))}
            </div>
          </div>
          {booking.specialRequests && (
            <div className="mb-4">
              <h4 className="font-medium text-secondary-900 mb-1">Special Requests</h4>
              <p className="text-sm text-secondary-600 bg-secondary-50 p-3 rounded-lg">{booking.specialRequests}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-secondary-200">
            {booking.status === 'pending' && (<>
              <Button size="sm" onClick={() => update(booking.id, 'confirmed')}>Confirm</Button>
              <Button variant="outline" size="sm" onClick={() => update(booking.id, 'cancelled')}>Decline</Button>
            </>)}
            {booking.status === 'confirmed' && (<>
              <Button size="sm" onClick={() => update(booking.id, 'completed')}>Mark Complete</Button>
              <Button variant="outline" size="sm" onClick={() => update(booking.id, 'cancelled')}>Cancel</Button>
            </>)}
          </div>
        </CardContent>
      </Card>
    );
  };

  const Empty = ({ label }: { label: string }) => (
    <Card><CardContent className="text-center py-8">
      <Calendar className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
      <p className="text-secondary-600">No {label} bookings</p>
    </CardContent></Card>
  );

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-secondary-900">Booking Management</h2>
        <p className="text-secondary-600">Manage and track all your bookings</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: pending.length, color: 'text-orange-600' },
          { label: 'Confirmed', value: confirmed.length, color: 'text-blue-600' },
          { label: 'Completed', value: completed.length, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4"><div className="flex items-center justify-between">
            <div><p className="text-sm text-secondary-600">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
            <Calendar className={`w-8 h-8 ${s.color}`} />
          </div></CardContent></Card>
        ))}
        <Card><CardContent className="p-4"><div className="flex items-center justify-between">
          <div><p className="text-sm text-secondary-600">Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">${completed.reduce((s, b) => s + b.totalPrice, 0).toLocaleString()}</p>
          </div>
          <DollarSign className="w-8 h-8 text-emerald-600" />
        </div></CardContent></Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="scrollbar-thin-x w-full flex md:grid md:grid-cols-4 h-auto min-h-11 gap-1 p-1">
          <TabsTrigger value="pending" className="shrink-0 min-h-11 px-2 sm:px-3 text-xs sm:text-sm">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="confirmed" className="shrink-0 min-h-11 px-2 sm:px-3 text-xs sm:text-sm">Confirmed ({confirmed.length})</TabsTrigger>
          <TabsTrigger value="completed" className="shrink-0 min-h-11 px-2 sm:px-3 text-xs sm:text-sm">Done ({completed.length})</TabsTrigger>
          <TabsTrigger value="cancelled" className="shrink-0 min-h-11 px-2 sm:px-3 text-xs sm:text-sm">Cancelled ({cancelled.length})</TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="pending" className="space-y-4">
            {pending.length > 0 ? pending.map(b => <BookingCard key={b.id} booking={b} />) : <Empty label="pending" />}
          </TabsContent>
          <TabsContent value="confirmed" className="space-y-4">
            {confirmed.length > 0 ? confirmed.map(b => <BookingCard key={b.id} booking={b} />) : <Empty label="confirmed" />}
          </TabsContent>
          <TabsContent value="completed" className="space-y-4">
            {completed.length > 0 ? completed.map(b => <BookingCard key={b.id} booking={b} />) : <Empty label="completed" />}
          </TabsContent>
          <TabsContent value="cancelled" className="space-y-4">
            {cancelled.length > 0 ? cancelled.map(b => <BookingCard key={b.id} booking={b} />) : <Empty label="cancelled" />}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
