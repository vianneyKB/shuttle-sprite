
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Vehicle, Booking, ViewMode, FilterOptions } from '@/types';
import { mockVehicles, mockBookings } from '@/data/mockData';

interface AppState {
  viewMode: ViewMode;
  vehicles: Vehicle[];
  bookings: Booking[];
  currentVendorId: string;
  filters: FilterOptions;
  selectedVehicle: Vehicle | null;
  showBookingModal: boolean;
  showVehicleModal: boolean;
}

type AppAction =
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_VEHICLES'; payload: Vehicle[] }
  | { type: 'ADD_VEHICLE'; payload: Vehicle }
  | { type: 'UPDATE_VEHICLE'; payload: Vehicle }
  | { type: 'DELETE_VEHICLE'; payload: string }
  | { type: 'SET_BOOKINGS'; payload: Booking[] }
  | { type: 'ADD_BOOKING'; payload: Booking }
  | { type: 'UPDATE_BOOKING'; payload: Booking }
  | { type: 'SET_CURRENT_VENDOR'; payload: string }
  | { type: 'SET_FILTERS'; payload: Partial<FilterOptions> }
  | { type: 'SET_SELECTED_VEHICLE'; payload: Vehicle | null }
  | { type: 'TOGGLE_BOOKING_MODAL' }
  | { type: 'TOGGLE_VEHICLE_MODAL' };

const initialState: AppState = {
  viewMode: 'customer',
  vehicles: mockVehicles,
  bookings: mockBookings,
  currentVendorId: 'vendor-1',
  filters: {
    searchQuery: '',
    minCapacity: 1,
    maxPrice: 1000,
    location: '',
    features: [],
    availableOnly: false,
  },
  selectedVehicle: null,
  showBookingModal: false,
  showVehicleModal: false,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  console.log('AppContext action:', action.type, 'payload' in action ? action.payload : 'no payload');
  
  switch (action.type) {
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    
    case 'SET_VEHICLES':
      return { ...state, vehicles: action.payload };
    
    case 'ADD_VEHICLE':
      return { ...state, vehicles: [...state.vehicles, action.payload] };
    
    case 'UPDATE_VEHICLE':
      return {
        ...state,
        vehicles: state.vehicles.map(v => 
          v.id === action.payload.id ? action.payload : v
        )
      };
    
    case 'DELETE_VEHICLE':
      return {
        ...state,
        vehicles: state.vehicles.filter(v => v.id !== action.payload)
      };
    
    case 'SET_BOOKINGS':
      return { ...state, bookings: action.payload };
    
    case 'ADD_BOOKING':
      return { ...state, bookings: [...state.bookings, action.payload] };
    
    case 'UPDATE_BOOKING':
      return {
        ...state,
        bookings: state.bookings.map(b => 
          b.id === action.payload.id ? action.payload : b
        )
      };
    
    case 'SET_CURRENT_VENDOR':
      return { ...state, currentVendorId: action.payload };
    
    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };
    
    case 'SET_SELECTED_VEHICLE':
      return { ...state, selectedVehicle: action.payload };
    
    case 'TOGGLE_BOOKING_MODAL':
      return { ...state, showBookingModal: !state.showBookingModal };
    
    case 'TOGGLE_VEHICLE_MODAL':
      return { ...state, showVehicleModal: !state.showVehicleModal };
    
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
