
import { BookingStop, ADDITIONAL_STOP_COST } from '@/types';

export interface PriceBreakdown {
  hourlyRate: number;
  duration: number;
  subtotal: number;
  additionalStops: number;
  additionalStopsCost: number;
  recurringMultiplier: number;
  finalTotal: number;
}

export const useBookingCalculator = () => {
  const calculatePrice = (
    hourlyRate: number,
    duration: number,
    stops: BookingStop[],
    daysOfWeek: string[]
  ): PriceBreakdown => {
    console.log('Calculating price with:', { hourlyRate, duration, stops: stops.length, daysOfWeek });
    
    // Base price calculation
    const subtotal = hourlyRate * duration;
    
    // Additional stops calculation (first 2 stops are free - pickup and dropoff)
    const additionalStops = Math.max(0, stops.length - 2);
    const additionalStopsCost = additionalStops * ADDITIONAL_STOP_COST;
    
    // Recurring multiplier (number of days per week for recurring bookings)
    const recurringMultiplier = daysOfWeek.length > 0 ? daysOfWeek.length : 1;
    
    // Final total
    const baseTotal = subtotal + additionalStopsCost;
    const finalTotal = baseTotal * recurringMultiplier;
    
    const breakdown: PriceBreakdown = {
      hourlyRate,
      duration,
      subtotal,
      additionalStops,
      additionalStopsCost,
      recurringMultiplier,
      finalTotal
    };
    
    console.log('Price breakdown:', breakdown);
    
    return breakdown;
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return {
    calculatePrice,
    formatPrice
  };
};
