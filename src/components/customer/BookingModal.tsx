import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppContext } from '@/context/AppContext';
import { useCreateBooking, useCalculatePrice } from '@/hooks/useBookings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, MapPin, Plus, Minus, Loader2 } from 'lucide-react';
import { BookingStop, type PaymentMethod } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const bookingSchema = z.object({
  customerName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  customerEmail: z.string().trim().email('Invalid email address').max(255),
  customerPhone: z.string().trim().min(7, 'Enter a valid phone number').max(30),
  passengers: z.coerce.number().int().min(1, 'At least 1 passenger').max(100),
  startDate: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  duration: z.coerce.number().min(1, 'At least 1 hour').max(24, 'Max 24 hours'),
  specialRequests: z.string().max(1000).optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export const BookingModal: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const createBooking = useCreateBooking();
  const calcPrice = useCalculatePrice();
  const [stops, setStops] = useState<BookingStop[]>([
    { id: '1', address: '', type: 'pickup', order: 0 },
    { id: '2', address: '', type: 'dropoff', order: 1 },
  ]);
  const [stopErrors, setStopErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      passengers: 1,
      startDate: '',
      time: '',
      duration: 2,
      specialRequests: '',
    },
  });

  const duration = form.watch('duration');

  // Recompute price server-side whenever duration / stops change
  useEffect(() => {
    if (!state.selectedVehicle) return;
    const d = Number(duration);
    if (!d || d <= 0) return;
    calcPrice.mutate({
      vehicleId: state.selectedVehicle.id,
      duration: d,
      stopCount: stops.length,
      daysOfWeekCount: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, stops.length, state.selectedVehicle?.id]);

  const addStop = () => {
    const newStop: BookingStop = { id: Date.now().toString(), address: '', type: 'stop', order: stops.length - 1 };
    const updated = [...stops];
    updated.splice(-1, 0, newStop);
    updated.forEach((s, i) => (s.order = i));
    setStops(updated);
  };

  const removeStop = (id: string) => {
    if (stops.length <= 2) return;
    const updated = stops.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i }));
    setStops(updated);
  };

  const updateStopAddress = (id: string, address: string) => {
    setStops(stops.map(s => (s.id === id ? { ...s, address } : s)));
  };

  const close = () => {
    form.reset();
    setStops([
      { id: '1', address: '', type: 'pickup', order: 0 },
      { id: '2', address: '', type: 'dropoff', order: 1 },
    ]);
    dispatch({ type: 'TOGGLE_BOOKING_MODAL' });
    dispatch({ type: 'SET_SELECTED_VEHICLE', payload: null });
  };

  const onSubmit = async (values: BookingFormValues) => {
    if (!state.selectedVehicle) return;

    const errs: Record<string, string> = {};
    stops.forEach(s => {
      if (!s.address.trim()) errs[s.id] = 'Address is required';
    });
    if (Object.keys(errs).length > 0) {
      setStopErrors(errs);
      return;
    }
    setStopErrors({});

    if (values.passengers > state.selectedVehicle.capacity) {
      form.setError('passengers', {
        message: `Max capacity is ${state.selectedVehicle.capacity}`,
      });
      return;
    }

    try {
      await createBooking.mutateAsync({
        vehicleId: state.selectedVehicle.id,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        passengers: values.passengers,
        stops,
        startDate: values.startDate,
        time: values.time,
        duration: values.duration,
        specialRequests: values.specialRequests,
        paymentMethod,
      });
      toast.success('Booking created successfully');
      close();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create booking');
    }
  };

  if (!state.showBookingModal || !state.selectedVehicle) return null;

  const breakdown = calcPrice.data;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 safe-bottom">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-4 sm:p-6 border-b border-secondary-200 shrink-0 sticky top-0 bg-white z-10">
          <div className="flex justify-between items-start gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-secondary-900">Book Your Ride</h2>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={close} aria-label="Close"><X className="w-5 h-5" /></Button>
          </div>
          <p className="text-secondary-600 mt-2 text-sm sm:text-base">
            {state.selectedVehicle.year} {state.selectedVehicle.make} {state.selectedVehicle.model}
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-5 sm:space-y-6 pb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-secondary-900">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...form.register('customerName')} />
                {form.formState.errors.customerName && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.customerName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register('customerEmail')} />
                {form.formState.errors.customerEmail && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.customerEmail.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" {...form.register('customerPhone')} />
                {form.formState.errors.customerPhone && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.customerPhone.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="passengers">Number of Passengers</Label>
                <Input id="passengers" type="number" min={1} max={state.selectedVehicle.capacity}
                  {...form.register('passengers')} />
                {form.formState.errors.passengers && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.passengers.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-secondary-900">Trip Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" {...form.register('startDate')} />
                {form.formState.errors.startDate && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input id="time" type="time" {...form.register('time')} />
                {form.formState.errors.time && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.time.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="duration">Duration (hours)</Label>
                <Input id="duration" type="number" min={1} max={24} {...form.register('duration')} />
                {form.formState.errors.duration && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.duration.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <h3 className="text-lg font-semibold text-secondary-900">Stops</h3>
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto min-h-11" onClick={addStop}>
                <Plus className="w-4 h-4 mr-2" /> Add Stop
              </Button>
            </div>
            <div className="space-y-3">
              {stops.map((stop) => (
                <div key={stop.id}>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <MapPin className="w-5 h-5 text-primary-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder={`${stop.type === 'pickup' ? 'Pickup' : stop.type === 'dropoff' ? 'Drop-off' : 'Stop'} address`}
                        value={stop.address}
                        onChange={(e) => updateStopAddress(stop.id, e.target.value)}
                      />
                    </div>
                    {stops.length > 2 && stop.type === 'stop' && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeStop(stop.id)}>
                        <Minus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {stopErrors[stop.id] && (
                    <p className="text-sm text-red-600 mt-1 ml-8">{stopErrors[stop.id]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="requests">Special Requests (Optional)</Label>
            <Textarea id="requests" placeholder="Any special requirements or notes..." {...form.register('specialRequests')} />
            {form.formState.errors.specialRequests && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.specialRequests.message}</p>
            )}
          </div>

          <fieldset className="space-y-2 border-0 p-0">
            <Label>Payment</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Pay cash on board</SelectItem>
                <SelectItem value="prepay">Pay in advance</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          <div className="bg-primary-50 rounded-xl p-4">
            <h4 className="font-semibold text-secondary-900 mb-2">Pricing Summary</h4>
            {calcPrice.isPending ? (
              <div className="flex items-center text-sm text-secondary-600"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating…</div>
            ) : breakdown ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Base Rate ({breakdown.duration}h × ${breakdown.hourlyRate})</span>
                  <span>${breakdown.subtotal}</span>
                </div>
                {breakdown.additionalStops > 0 && (
                  <div className="flex justify-between">
                    <span>Additional Stops ({breakdown.additionalStops})</span>
                    <span>${breakdown.additionalStopsCost}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg pt-2 border-t border-primary-200">
                  <span>Total</span>
                  <span>${breakdown.finalTotal}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-secondary-600">Enter trip details to see pricing.</p>
            )}
          </div>

          <Button type="submit" className="w-full min-h-12 text-base sticky bottom-0" disabled={createBooking.isPending}>
            {createBooking.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : 'Confirm Booking'}
          </Button>
        </form>
      </div>
    </div>
  );
};
