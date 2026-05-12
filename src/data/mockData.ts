
import { Vehicle, Booking, Vendor } from '@/types';

export const mockVehicles: Vehicle[] = [
  {
    id: '1',
    vendorId: 'vendor-1',
    vendorName: 'Elite Transport Co.',
    make: 'Mercedes-Benz',
    model: 'Sprinter',
    year: 2023,
    capacity: 12,
    pricePerHour: 85,
    pricePerDay: 680,
    location: 'Downtown Business District',
    features: ['WiFi', 'AC', 'Leather Seats', 'Premium Interior', 'Sound System'],
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
    available: true,
    rating: 4.9,
    reviews: 127,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-07-01')
  },
  {
    id: '2',
    vendorId: 'vendor-2',
    vendorName: 'Metro Shuttle Services',
    make: 'Ford',
    model: 'Transit',
    year: 2022,
    capacity: 8,
    pricePerHour: 65,
    pricePerDay: 520,
    location: 'Airport District',
    features: ['WiFi', 'AC', 'USB Charging', 'GPS Tracking'],
    image: 'https://images.unsplash.com/photo-1570125909517-53cb21c89ff2?w=800&h=400&fit=crop',
    available: true,
    rating: 4.7,
    reviews: 89,
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-06-28')
  },
  {
    id: '3',
    vendorId: 'vendor-1',
    vendorName: 'Elite Transport Co.',
    make: 'Chevrolet',
    model: 'Express',
    year: 2023,
    capacity: 15,
    pricePerHour: 95,
    pricePerDay: 760,
    location: 'Downtown Business District',
    features: ['WiFi', 'AC', 'Entertainment System', 'Refreshments', 'Premium Interior'],
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&h=400&fit=crop',
    available: false,
    rating: 4.8,
    reviews: 156,
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-07-02')
  },
  {
    id: '4',
    vendorId: 'vendor-3',
    vendorName: 'Luxury Fleet Solutions',
    make: 'Mercedes-Benz',
    model: 'V-Class',
    year: 2024,
    capacity: 6,
    pricePerHour: 120,
    pricePerDay: 960,
    location: 'Uptown Premium Area',
    features: ['WiFi', 'AC', 'Leather Seats', 'Premium Interior', 'Entertainment System', 'Refreshments'],
    image: 'https://images.unsplash.com/photo-1549924231-f129b911e442?w=800&h=400&fit=crop',
    available: true,
    rating: 5.0,
    reviews: 73,
    createdAt: new Date('2024-04-12'),
    updatedAt: new Date('2024-07-03')
  },
  {
    id: '5',
    vendorId: 'vendor-2',
    vendorName: 'Metro Shuttle Services',
    make: 'Toyota',
    model: 'Hiace',
    year: 2021,
    capacity: 10,
    pricePerHour: 55,
    pricePerDay: 440,
    location: 'Airport District',
    features: ['AC', 'USB Charging', 'GPS Tracking'],
    image: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&h=400&fit=crop',
    available: true,
    rating: 4.5,
    reviews: 64,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-06-25')
  },
  {
    id: '6',
    vendorId: 'vendor-4',
    vendorName: 'City Express Transport',
    make: 'Nissan',
    model: 'NV200',
    year: 2022,
    capacity: 4,
    pricePerHour: 45,
    pricePerDay: 360,
    location: 'City Center',
    features: ['AC', 'USB Charging'],
    image: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&h=400&fit=crop',
    available: true,
    rating: 4.3,
    reviews: 42,
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-06-30')
  }
];

export const mockBookings: Booking[] = [
  {
    id: 'booking-1',
    vehicleId: '1',
    customerName: 'John Smith',
    customerEmail: 'john.smith@email.com',
    customerPhone: '+1 (555) 123-4567',
    passengers: 8,
    stops: [
      { id: 'stop-1', address: '123 Main Street, Downtown', type: 'pickup', order: 0 },
      { id: 'stop-2', address: '456 Business Ave, Corporate District', type: 'stop', order: 1, notes: 'Wait 15 minutes' },
      { id: 'stop-3', address: '789 Conference Center, Tech Hub', type: 'dropoff', order: 2 }
    ],
    startDate: '2024-07-15',
    time: '09:00',
    duration: 6,
    daysOfWeek: [],
    totalPrice: 540,
    basePriceBreakdown: {
      hourlyRate: 85,
      duration: 6,
      subtotal: 510,
      additionalStops: 1,
      additionalStopsCost: 15,
      recurringMultiplier: 1,
      finalTotal: 540
    },
    status: 'confirmed',
    specialRequests: 'Please arrive 10 minutes early',
    isRecurring: false,
    createdAt: new Date('2024-07-01'),
    updatedAt: new Date('2024-07-03')
  },
  {
    id: 'booking-2',
    vehicleId: '2',
    customerName: 'Sarah Johnson',
    customerEmail: 'sarah.j@company.com',
    customerPhone: '+1 (555) 987-6543',
    passengers: 6,
    stops: [
      { id: 'stop-4', address: 'Grand Hotel, Fifth Avenue', type: 'pickup', order: 0 },
      { id: 'stop-5', address: 'International Airport, Terminal 2', type: 'dropoff', order: 1 }
    ],
    startDate: '2024-07-08',
    endDate: '2024-07-22',
    time: '07:30',
    duration: 3,
    daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
    totalPrice: 585,
    basePriceBreakdown: {
      hourlyRate: 65,
      duration: 3,
      subtotal: 195,
      additionalStops: 0,
      additionalStopsCost: 0,
      recurringMultiplier: 3,
      finalTotal: 585
    },
    status: 'pending',
    isRecurring: true,
    createdAt: new Date('2024-07-02'),
    updatedAt: new Date('2024-07-02')
  },
  {
    id: 'booking-3',
    vehicleId: '4',
    customerName: 'Michael Chen',
    customerEmail: 'mchen@startup.io',
    customerPhone: '+1 (555) 456-7890',
    passengers: 4,
    stops: [
      { id: 'stop-6', address: 'Tech Incubator, Silicon Valley', type: 'pickup', order: 0 },
      { id: 'stop-7', address: 'Innovation Center, Research Park', type: 'dropoff', order: 1 }
    ],
    startDate: '2024-07-12',
    time: '14:00',
    duration: 2,
    daysOfWeek: [],
    totalPrice: 240,
    basePriceBreakdown: {
      hourlyRate: 120,
      duration: 2,
      subtotal: 240,
      additionalStops: 0,
      additionalStopsCost: 0,
      recurringMultiplier: 1,
      finalTotal: 240
    },
    status: 'completed',
    isRecurring: false,
    createdAt: new Date('2024-07-01'),
    updatedAt: new Date('2024-07-12')
  }
];

// Add vehicle data to bookings
mockBookings.forEach(booking => {
  booking.vehicle = mockVehicles.find(v => v.id === booking.vehicleId);
});

export const mockVendors: Vendor[] = [
  {
    id: 'vendor-1',
    name: 'Elite Transport Co.',
    email: 'contact@elitetransport.com',
    phone: '+1 (555) 100-2000',
    location: 'Downtown Business District',
    vehicles: mockVehicles.filter(v => v.vendorId === 'vendor-1'),
    bookings: mockBookings.filter(b => 
      mockVehicles.find(v => v.id === b.vehicleId)?.vendorId === 'vendor-1'
    ),
    totalEarnings: 45780,
    monthlyEarnings: 8950,
    rating: 4.85,
    createdAt: new Date('2023-08-15')
  },
  {
    id: 'vendor-2',
    name: 'Metro Shuttle Services',
    email: 'info@metroshuttle.com',
    phone: '+1 (555) 200-3000',
    location: 'Airport District',
    vehicles: mockVehicles.filter(v => v.vendorId === 'vendor-2'),
    bookings: mockBookings.filter(b => 
      mockVehicles.find(v => v.id === b.vehicleId)?.vendorId === 'vendor-2'
    ),
    totalEarnings: 32450,
    monthlyEarnings: 6800,
    rating: 4.6,
    createdAt: new Date('2023-10-01')
  },
  {
    id: 'vendor-3',
    name: 'Luxury Fleet Solutions',
    email: 'bookings@luxuryfleet.com',
    phone: '+1 (555) 300-4000',
    location: 'Uptown Premium Area',
    vehicles: mockVehicles.filter(v => v.vendorId === 'vendor-3'),
    bookings: mockBookings.filter(b => 
      mockVehicles.find(v => v.id === b.vehicleId)?.vendorId === 'vendor-3'
    ),
    totalEarnings: 28900,
    monthlyEarnings: 7200,
    rating: 4.95,
    createdAt: new Date('2024-01-10')
  },
  {
    id: 'vendor-4',
    name: 'City Express Transport',
    email: 'hello@cityexpress.com',
    phone: '+1 (555) 400-5000',
    location: 'City Center',
    vehicles: mockVehicles.filter(v => v.vendorId === 'vendor-4'),
    bookings: mockBookings.filter(b => 
      mockVehicles.find(v => v.id === b.vehicleId)?.vendorId === 'vendor-4'
    ),
    totalEarnings: 15600,
    monthlyEarnings: 3200,
    rating: 4.3,
    createdAt: new Date('2024-03-20')
  }
];
