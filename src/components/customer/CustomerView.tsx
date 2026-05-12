
import React from 'react';
import { VehicleSearch } from './VehicleSearch';
import { VehicleList } from './VehicleList';
import { BookingModal } from './BookingModal';
import { useAppContext } from '@/context/AppContext';

export const CustomerView: React.FC = () => {
  const { state } = useAppContext();

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gradient leading-tight">
          Professional Transport
          <br />
          Made Simple
        </h1>
        <p className="text-xl text-secondary-600 max-w-2xl mx-auto leading-relaxed">
          Book premium shuttle services with professional drivers, 
          multi-stop support, and flexible scheduling options.
        </p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-2xl p-8 shadow-elevation-md border border-secondary-200">
        <VehicleSearch />
      </div>

      {/* Vehicle Listings */}
      <VehicleList />

      {/* Booking Modal */}
      {state.showBookingModal && <BookingModal />}
    </div>
  );
};
