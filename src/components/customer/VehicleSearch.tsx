
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { VEHICLE_FEATURES } from '@/types';

export const VehicleSearch: React.FC = () => {
  const { state, dispatch } = useAppContext();
  
  const handleSearchChange = (value: string) => {
    dispatch({ type: 'SET_FILTERS', payload: { searchQuery: value } });
  };

  const handleFilterChange = (key: string, value: string | number | boolean | string[]) => {
    dispatch({ type: 'SET_FILTERS', payload: { [key]: value } });
  };

  const toggleFeature = (feature: string) => {
    const currentFeatures = state.filters.features;
    const newFeatures = currentFeatures.includes(feature)
      ? currentFeatures.filter(f => f !== feature)
      : [...currentFeatures, feature];
    
    handleFilterChange('features', newFeatures);
  };

  const clearFilters = () => {
    dispatch({ 
      type: 'SET_FILTERS', 
      payload: {
        searchQuery: '',
        minCapacity: 1,
        maxPrice: 1000,
        location: '',
        features: [],
        availableOnly: false,
      }
    });
  };

  const hasActiveFilters = 
    state.filters.searchQuery ||
    state.filters.minCapacity > 1 ||
    state.filters.maxPrice < 1000 ||
    state.filters.location ||
    state.filters.features.length > 0 ||
    state.filters.availableOnly;

  return (
    <div className="space-y-6">
      {/* Main Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-secondary-400" />
        <Input
          placeholder="Search by make, model, or operator..."
          value={state.filters.searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 h-12 text-base border-secondary-300 focus:border-primary-500 focus:ring-primary-500"
        />
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select
          value={state.filters.minCapacity.toString()}
          onValueChange={(value) => handleFilterChange('minCapacity', parseInt(value))}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Min. Capacity" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 4, 6, 8, 10, 12, 15].map(cap => (
              <SelectItem key={cap} value={cap.toString()}>
                {cap}+ passengers
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={state.filters.maxPrice.toString()}
          onValueChange={(value) => handleFilterChange('maxPrice', parseInt(value))}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Max Price" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">Up to $50/hr</SelectItem>
            <SelectItem value="75">Up to $75/hr</SelectItem>
            <SelectItem value="100">Up to $100/hr</SelectItem>
            <SelectItem value="150">Up to $150/hr</SelectItem>
            <SelectItem value="1000">Any price</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Location..."
          value={state.filters.location}
          onChange={(e) => handleFilterChange('location', e.target.value)}
          className="h-11"
        />

        <div className="flex items-center space-x-2">
          <Button
            variant={state.filters.availableOnly ? 'default' : 'outline'}
            onClick={() => handleFilterChange('availableOnly', !state.filters.availableOnly)}
            className="h-11 flex-1"
          >
            <Filter className="w-4 h-4 mr-2" />
            Available Only
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-11 px-3"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Features Filter */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-secondary-700">Features</h3>
        <div className="flex flex-wrap gap-2">
          {VEHICLE_FEATURES.map(feature => (
            <Badge
              key={feature}
              variant={state.filters.features.includes(feature) ? 'default' : 'outline'}
              className={`cursor-pointer min-h-9 px-3 py-1.5 transition-all duration-200 active:scale-95 sm:hover:scale-105 ${
                state.filters.features.includes(feature)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-secondary-300 hover:border-primary-400'
              }`}
              onClick={() => toggleFeature(feature)}
            >
              {feature}
            </Badge>
          ))}
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-primary-50 rounded-lg border border-primary-200">
          <div className="flex items-center gap-2 text-sm text-primary-700">
            <Filter className="w-4 h-4" />
            <span>
              Showing filtered results
              {state.filters.features.length > 0 && (
                <span className="ml-1">with {state.filters.features.length} feature(s)</span>
              )}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-primary-600 hover:text-primary-800 hover:bg-primary-100"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};
