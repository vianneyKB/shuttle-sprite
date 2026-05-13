
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Vehicle, FilterOptions } from '@/types';

interface AppState {
  filters: FilterOptions;
  selectedVehicle: Vehicle | null;
  showBookingModal: boolean;
}

type AppAction =
  | { type: 'SET_FILTERS'; payload: Partial<FilterOptions> }
  | { type: 'SET_SELECTED_VEHICLE'; payload: Vehicle | null }
  | { type: 'TOGGLE_BOOKING_MODAL' };

const initialState: AppState = {
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
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };
    case 'SET_SELECTED_VEHICLE':
      return { ...state, selectedVehicle: action.payload };
    case 'TOGGLE_BOOKING_MODAL':
      return { ...state, showBookingModal: !state.showBookingModal };
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
