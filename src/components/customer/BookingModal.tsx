
import React, { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useBookingCalculator } from '@/hooks/useBookingCalculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, MapPin, Plus, Minus, Calendar, Clock } from 'lucide-react';
import { BookingStop } from '@/types';

export const BookingModal: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { calculatePrice } = useBookingCalculator();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [stops, setStops] = useState<BookingStop[]>([
    { id: '1', address: '', type: 'pickup', order: 0 },
    { id: '2', address: '', type: 'dropoff', order: 1 }
  ]);
  const [startDate, setStartDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(2);
  const [specialRequests, setSpecialRequests] = useState('');

  const addStop = () => {
    const newStop: BookingStop = {
      id: Date.now().toString(),
      address: '',
      type: 'stop',
      order: stops.length - 1
    };
    const updatedStops = [...stops];
    updatedStops.splice(-1, 0, newStop);
    updatedStops.forEach((stop, index) => {
      stop.order = index;
    });
    setStops(updatedStops);
  };

  const removeStop = (id: string) => {
    if (stops.length <= 2) return;
    const updatedStops = stops.filter(stop => stop.id !== id);
    updatedStops.forEach((stop, index) => {
      stop.order = index;
    });
    setStops(updatedStops);
  };

  const updateStopAddress = (id: string, address: string) => {
    setStops(stops.map(stop => 
      stop.id === id ? { ...stop, address } : stop
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!state.selectedVehicle) return;

    // Calculate price breakdown using the hook
    const priceBreakdown = calculatePrice(
      state.selectedVehicle.pricePerHour,
      duration,
      stops,
      [] // No recurring days for now
    );

    const booking = {
      id: Date.now().toString(),
      vehicleId: state.selectedVehicle.id,
      customerName,
      customerEmail,
      customerPhone,
      passengers,
      stops,
      startDate,
      time,
      duration,
      totalPrice: priceBreakdown.finalTotal,
      basePriceBreakdown: priceBreakdown,
      status: 'pending' as const,
      specialRequests,
      isRecurring: false,
      daysOfWeek: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    dispatch({ type: 'ADD_BOOKING', payload: booking });
    dispatch({ type: 'TOGGLE_BOOKING_MODAL' });
    
    // Reset form
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setPassengers(1);
    setStops([
      { id: '1', address: '', type: 'pickup', order: 0 },
      { id: '2', address: '', type: 'dropoff', order: 1 }
    ]);
    setStartDate('');
    setTime('');
    setDuration(2);
    setSpecialRequests('');
  };

  if (!state.showBookingModal || !state.selectedVehicle) return null;

  // Calculate price breakdown for display
  const priceBreakdown = calculatePrice(
    state.selectedVehicle.pricePerHour,
    duration,
    stops,
    []
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-secondary-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-secondary-900">Book Your Ride</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: 'TOGGLE_BOOKING_MODAL' })}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-secondary-600 mt-2">
            {state.selectedVehicle.year} {state.selectedVehicle.make} {state.selectedVehicle.model}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-secondary-900">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="passengers">Number of Passengers</Label>
                <Input
                  id="passengers"
                  type="number"
                  min="1"
                  max={state.selectedVehicle.capacity}
                  value={passengers}
                  onChange={(e) => setPassengers(parseInt(e.target.value))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Trip Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-secondary-900">Trip Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="24"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Stops */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-secondary-900">Stops</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStop}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Stop
              </Button>
            </div>
            
            <div className="space-y-3">
              {stops.map((stop, index) => (
                <div key={stop.id} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder={`${stop.type === 'pickup' ? 'Pickup' : stop.type === 'dropoff' ? 'Drop-off' : 'Stop'} address`}
                      value={stop.address}
                      onChange={(e) => updateStopAddress(stop.id, e.target.value)}
                      required
                    />
                  </div>
                  {stops.length > 2 && stop.type === 'stop' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStop(stop.id)}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <Label htmlFor="requests">Special Requests (Optional)</Label>
            <Textarea
              id="requests"
              placeholder="Any special requirements or notes..."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
            />
          </div>

          {/* Pricing Summary */}
          <div className="bg-primary-50 rounded-xl p-4">
            <h4 className="font-semibold text-secondary-900 mb-2">Pricing Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Base Rate ({duration} hours × ${priceBreakdown.hourlyRate})</span>
                <span>${priceBreakdown.subtotal}</span>
              </div>
              {priceBreakdown.additionalStops > 0 && (
                <div className="flex justify-between">
                  <span>Additional Stops ({priceBreakdown.additionalStops} × ${priceBreakdown.additionalStopsCost / priceBreakdown.additionalStops})</span>
                  <span>${priceBreakdown.additionalStopsCost}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-primary-200">
                <span>Total</span>
                <span>${priceBreakdown.finalTotal}</span>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full">
            Confirm Booking
          </Button>
        </form>
      </div>
    </div>
  );
};
