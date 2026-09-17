
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
  /** ISO 4217 code from the operator's settings; prices are in this currency. */
  currency: string;
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
  /** Snapshot at booking time; later changes to operator settings never alter it. */
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  basePriceBreakdown: PriceBreakdown;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  specialRequests?: string;
  isRecurring: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Returned by calculate_booking_price and stored on bookings.price_breakdown. */
export interface PriceBreakdown {
  currency: string;
  hourlyRate: number;
  duration: number;
  additionalStops: number;
  additionalStopFee: number;
  additionalStopsCost: number;
  recurringMultiplier: number;
  pricesIncludeTax: boolean;
  subtotal: number;
  taxRate: number;
  taxLabel: string;
  taxAmount: number;
  finalTotal: number;
}

export interface OperatorSettings {
  operatorId: string;
  currency: string;
  taxRate: number;
  taxLabel: string;
  pricesIncludeTax: boolean;
  additionalStopFee: number;
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
  /** Dispatch: set when an operator confirms / assigns a vehicle. */
  operatorId?: string;
  vehicleId?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
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
