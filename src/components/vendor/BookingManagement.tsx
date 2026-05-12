
import React, { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Users, MapPin, Phone, Mail, Car, DollarSign } from 'lucide-react';
import { Booking } from '@/types';

export const BookingManagement: React.FC = () => {
  const { state, dispatch } = useAppContext();
  
  const vendorVehicles = state.vehicles.filter(v => v.vendorId === state.currentVendorId);
  const vendorBookings = state.bookings.filter(b => 
    vendorVehicles.some(v => v.id === b.vehicleId)
  );

  const pendingBookings = vendorBookings.filter(b => b.status === 'pending');
  const confirmedBookings = vendorBookings.filter(b => b.status === 'confirmed');
  const completedBookings = vendorBookings.filter(b => b.status === 'completed');
  const cancelledBookings = vendorBookings.filter(b => b.status === 'cancelled');

  const updateBookingStatus = (bookingId: string, status: Booking['status']) => {
    const booking = vendorBookings.find(b => b.id === bookingId);
    if (booking) {
      dispatch({
        type: 'UPDATE_BOOKING',
        payload: { ...booking, status }
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const BookingCard = ({ booking }: { booking: Booking }) => {
    const vehicle = vendorVehicles.find(v => v.id === booking.vehicleId);
    
    return (
      <Card className="hover:shadow-elevation-md transition-shadow duration-300">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-lg font-semibold text-secondary-900">{booking.customerName}</h3>
                <Badge className={getStatusColor(booking.status)}>
                  {booking.status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-secondary-600">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>{booking.customerPhone}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>{booking.customerEmail}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Car className="w-4 h-4" />
                  <span>{vehicle?.make} {vehicle?.model}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>{booking.passengers} passengers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{booking.startDate}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>{booking.time} ({booking.duration}h)</span>
                </div>
              </div>
            </div>
            
            <div className="text-right ml-4">
              <div className="text-2xl font-bold text-primary-600">${booking.totalPrice}</div>
              <div className="text-sm text-secondary-600">Total</div>
            </div>
          </div>

          {/* Stops */}
          <div className="mb-4">
            <h4 className="font-medium text-secondary-900 mb-2">Journey</h4>
            <div className="space-y-2">
              {booking.stops.map((stop, index) => (
                <div key={stop.id} className="flex items-center space-x-2 text-sm">
                  <MapPin className="w-4 h-4 text-primary-600" />
                  <span className="capitalize font-medium">{stop.type}:</span>
                  <span className="text-secondary-600">{stop.address}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Special Requests */}
          {booking.specialRequests && (
            <div className="mb-4">
              <h4 className="font-medium text-secondary-900 mb-1">Special Requests</h4>
              <p className="text-sm text-secondary-600 bg-secondary-50 p-3 rounded-lg">
                {booking.specialRequests}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2 pt-4 border-t border-secondary-200">
            {booking.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                >
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                >
                  Decline
                </Button>
              </>
            )}
            {booking.status === 'confirmed' && (
              <>
                <Button
                  size="sm"
                  onClick={() => updateBookingStatus(booking.id, 'completed')}
                >
                  Mark Complete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-secondary-900">Booking Management</h2>
        <p className="text-secondary-600">Manage and track all your bookings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-600">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{pendingBookings.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-600">Confirmed</p>
                <p className="text-2xl font-bold text-blue-600">{confirmedBookings.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{completedBookings.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-600">Revenue</p>
                <p className="text-2xl font-bold text-emerald-600">
                  ${completedBookings.reduce((sum, b) => sum + b.totalPrice, 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending ({pendingBookings.length})</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed ({confirmedBookings.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedBookings.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelledBookings.length})</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="pending" className="space-y-4">
            {pendingBookings.length > 0 ? (
              pendingBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Calendar className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                  <p className="text-secondary-600">No pending bookings</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="confirmed" className="space-y-4">
            {confirmedBookings.length > 0 ? (
              confirmedBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Calendar className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                  <p className="text-secondary-600">No confirmed bookings</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedBookings.length > 0 ? (
              completedBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Calendar className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                  <p className="text-secondary-600">No completed bookings</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledBookings.length > 0 ? (
              cancelledBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Calendar className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                  <p className="text-secondary-600">No cancelled bookings</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
