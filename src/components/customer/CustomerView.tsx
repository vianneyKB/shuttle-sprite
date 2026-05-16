
import React from 'react';
import { VehicleSearch } from './VehicleSearch';
import { VehicleList } from './VehicleList';
import { BookingModal } from './BookingModal';
import { useAppContext } from '@/context/AppContext';

export const CustomerView: React.FC = () => {
  const { state } = useAppContext();

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-3 sm:space-y-4 py-6 sm:py-12 px-1">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gradient leading-tight">
          Professional Transport
          <br />
          Made Simple
        </h1>
        <p className="text-base sm:text-xl text-secondary-600 max-w-2xl mx-auto leading-relaxed px-2">
          Book premium shuttle services with professional drivers, 
          multi-stop support, and flexible scheduling options.
        </p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-elevation-md border border-secondary-200">
        <VehicleSearch />
      </div>

      {/* Vehicle Listings */}
      <VehicleList />

      {/* Booking Modal */}
      {state.showBookingModal && <BookingModal />}
    </div>
  );
};
