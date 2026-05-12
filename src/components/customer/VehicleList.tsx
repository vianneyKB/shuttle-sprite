
import React, { useMemo } from 'react';
import { VehicleCard } from './VehicleCard';
import { useAppContext } from '@/context/AppContext';
import { Vehicle } from '@/types';
import { Car, Search } from 'lucide-react';

export const VehicleList: React.FC = () => {
  const { state } = useAppContext();

  const filteredVehicles = useMemo(() => {
    let filtered = [...state.vehicles];

    // Search query filter
    if (state.filters.searchQuery) {
      const query = state.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(vehicle =>
        vehicle.make.toLowerCase().includes(query) ||
        vehicle.model.toLowerCase().includes(query) ||
        vehicle.vendorName.toLowerCase().includes(query)
      );
    }

    // Capacity filter
    if (state.filters.minCapacity > 1) {
      filtered = filtered.filter(vehicle => vehicle.capacity >= state.filters.minCapacity);
    }

    // Price filter
    if (state.filters.maxPrice < 1000) {
      filtered = filtered.filter(vehicle => vehicle.pricePerHour <= state.filters.maxPrice);
    }

    // Location filter
    if (state.filters.location) {
      const location = state.filters.location.toLowerCase();
      filtered = filtered.filter(vehicle =>
        vehicle.location.toLowerCase().includes(location)
      );
    }

    // Features filter
    if (state.filters.features.length > 0) {
      filtered = filtered.filter(vehicle =>
        state.filters.features.every(feature =>
          vehicle.features.includes(feature)
        )
      );
    }

    // Availability filter
    if (state.filters.availableOnly) {
      filtered = filtered.filter(vehicle => vehicle.available);
    }

    // Sort by availability first, then by rating
    filtered.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return b.rating - a.rating;
    });

    console.log('Filtered vehicles:', filtered.length, 'out of', state.vehicles.length);
    return filtered;
  }, [state.vehicles, state.filters]);

  if (filteredVehicles.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary-100 rounded-full mb-4">
          <Search className="w-8 h-8 text-secondary-400" />
        </div>
        <h3 className="text-lg font-semibold text-secondary-700 mb-2">
          No vehicles found
        </h3>
        <p className="text-secondary-500 mb-4">
          Try adjusting your search criteria or filters to find available vehicles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Car className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-secondary-800">
            Available Vehicles
          </h2>
          <span className="text-sm text-secondary-500">
            ({filteredVehicles.length} {filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'})
          </span>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle, index) => (
          <div
            key={vehicle.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <VehicleCard vehicle={vehicle} />
          </div>
        ))}
      </div>
    </div>
  );
};
