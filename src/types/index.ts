
export type PaymentMethod = 'cash' | 'prepay';
export type PaymentStatus = 'not_required' | 'pending' | 'paid';
export type RideRequestStatus = 'awaiting' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Vehicle {
  id: string;
  operatorId: string;
  operatorName: string;
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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
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

export interface RouteStop {
  id: string;
  routeId: string;
  name: string;
  description?: string;
  stopOrder: number;
  lat: number;
  lng: number;
}

export interface ShuttleRoute {
  id: string;
  operatorId: string;
  name: string;
  description?: string;
  operatingHours?: string;
  geometry: GeoJSON.LineString;
  isActive: boolean;
  stops: RouteStop[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RideRequest {
  id: string;
  customerId: string;
  routeId?: string;
  originName: string;
  originLat: number;
  originLng: number;
  destinationName: string;
  destinationLat: number;
  destinationLng: number;
  passengers: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: RideRequestStatus;
  scheduledAt?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PassengerQueueGroup {
  originName: string;
  destinationName: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  requestCount: number;
  totalPassengers: number;
}

export interface FilterOptions {
  searchQuery: string;
  minCapacity: number;
  maxPrice: number;
  location: string;
  features: string[];
  availableOnly: boolean;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type StopType = 'pickup' | 'dropoff' | 'stop';

export const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export const VEHICLE_FEATURES = [
  'WiFi', 'AC', 'USB Charging', 'Leather Seats', 'GPS Tracking',
  'Entertainment System', 'Sound System', 'Refreshments', 'Premium Interior',
] as const;

export const ADDITIONAL_STOP_COST = 15;
