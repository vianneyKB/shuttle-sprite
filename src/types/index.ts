
export interface Vehicle {
  id: string;
  vendorId: string;
  vendorName: string;
  make: string;
  model: string;
  year: number;
  capacity: number;
  pricePerHour: number;
  pricePerDay: number;
  location: string;
  features: string[];
  image: string;
  available: boolean;
  rating: number;
  reviews: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingStop {
  id: string;
  address: string;
  type: 'pickup' | 'dropoff' | 'stop';
  order: number;
  notes?: string;
}

export interface Booking {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  passengers: number;
  stops: BookingStop[];
  startDate: string;
  endDate?: string;
  daysOfWeek: string[];
  time: string;
  duration: number;
  totalPrice: number;
  basePriceBreakdown: {
    hourlyRate: number;
    duration: number;
    subtotal: number;
    additionalStops: number;
    additionalStopsCost: number;
    recurringMultiplier: number;
    finalTotal: number;
  };
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  specialRequests?: string;
  isRecurring: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  vehicles: Vehicle[];
  bookings: Booking[];
  totalEarnings: number;
  monthlyEarnings: number;
  rating: number;
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  bookings: Booking[];
  createdAt: Date;
}

export interface FilterOptions {
  searchQuery: string;
  minCapacity: number;
  maxPrice: number;
  location: string;
  features: string[];
  availableOnly: boolean;
}

export interface BookingFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  passengers: number;
  stops: BookingStop[];
  startDate: string;
  endDate?: string;
  daysOfWeek: string[];
  time: string;
  duration: number;
  specialRequests?: string;
  isRecurring: boolean;
}

export type ViewMode = 'customer' | 'vendor';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type StopType = 'pickup' | 'dropoff' | 'stop';

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday', 
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const;

export const VEHICLE_FEATURES = [
  'WiFi',
  'AC',
  'USB Charging',
  'Leather Seats',
  'GPS Tracking',
  'Entertainment System',
  'Sound System',
  'Refreshments',
  'Premium Interior'
] as const;

export const ADDITIONAL_STOP_COST = 15;
