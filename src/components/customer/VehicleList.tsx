import React, { useMemo } from 'react';
import { VehicleCard } from './VehicleCard';
import { useAppContext } from '@/context/AppContext';
import { useVehicles } from '@/hooks/useVehicles';
import { Car, Search, Loader2 } from 'lucide-react';

export const VehicleList: React.FC = () => {
  const { state } = useAppContext();
  const { data: vehicles = [], isLoading, error } = useVehicles();

  const filteredVehicles = useMemo(() => {
    let filtered = [...vehicles];
    const f = state.filters;
    if (f.searchQuery) {
      const q = f.searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.vendorName.toLowerCase().includes(q)
      );
    }
    if (f.minCapacity > 1) filtered = filtered.filter(v => v.capacity >= f.minCapacity);
    if (f.maxPrice < 1000) filtered = filtered.filter(v => v.pricePerHour <= f.maxPrice);
    if (f.location) {
      const loc = f.location.toLowerCase();
      filtered = filtered.filter(v => v.location.toLowerCase().includes(loc));
    }
    if (f.features.length > 0) {
      filtered = filtered.filter(v => f.features.every(feat => v.features.includes(feat)));
    }
    if (f.availableOnly) filtered = filtered.filter(v => v.available);
    filtered.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return b.rating - a.rating;
    });
    return filtered;
  }, [vehicles, state.filters]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-12 text-red-600">Failed to load vehicles.</div>;
  }

  if (filteredVehicles.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-secondary-100 rounded-full mb-4">
          <Search className="w-8 h-8 text-secondary-400" />
        </div>
        <h3 className="text-lg font-semibold text-secondary-700 mb-2">No vehicles found</h3>
        <p className="text-secondary-500 mb-4">Try adjusting your search criteria or filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Car className="w-5 h-5 text-primary-600 shrink-0" />
          <h2 className="text-base sm:text-lg font-semibold text-secondary-800">Available Vehicles</h2>
          <span className="text-sm text-secondary-500 shrink-0">
            ({filteredVehicles.length} {filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'})
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle, index) => (
          <div key={vehicle.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
            <VehicleCard vehicle={vehicle} />
          </div>
        ))}
      </div>
    </div>
  );
};
