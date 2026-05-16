
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Star, Users, MapPin, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Vehicle } from '@/types';
import { useAppContext } from '@/context/AppContext';

interface VehicleCardProps {
  vehicle: Vehicle;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle }) => {
  const { dispatch } = useAppContext();

  const handleBookNow = () => {
    dispatch({ type: 'SET_SELECTED_VEHICLE', payload: vehicle });
    dispatch({ type: 'TOGGLE_BOOKING_MODAL' });
    console.log('Opening booking modal for vehicle:', vehicle.id);
  };

  return (
    <Card className="vehicle-card">
      <div className="relative">
        <img
          src={vehicle.image}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="w-full h-48 object-cover"
        />
        <div className="absolute top-4 right-4">
          {vehicle.available ? (
            <Badge className="bg-success-500 text-white border-success-600 shadow-sm">
              <CheckCircle className="w-3 h-3 mr-1" />
              Available
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-secondary-500 text-white border-secondary-600">
              <XCircle className="w-3 h-3 mr-1" />
              Unavailable
            </Badge>
          )}
        </div>
        <div className="absolute top-4 left-4">
          <div className="flex items-center space-x-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
            <span className="text-xs font-semibold text-secondary-800">
              {vehicle.rating}
            </span>
            <span className="text-xs text-secondary-600">
              ({vehicle.reviews})
            </span>
          </div>
        </div>
      </div>

      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* Vehicle Info */}
          <div>
            <h3 className="text-xl font-bold text-secondary-900">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            <p className="text-sm text-secondary-600 font-medium">
              by {vehicle.vendorName}
            </p>
          </div>

          {/* Key Details */}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 text-sm">
            <div className="flex items-center gap-1 text-secondary-600">
              <Users className="w-4 h-4 shrink-0" />
              <span>{vehicle.capacity} passengers</span>
            </div>
            <div className="flex items-center gap-1 text-secondary-600 min-w-0">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{vehicle.location}</span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-secondary-700">Features</h4>
            <div className="flex flex-wrap gap-1">
              {vehicle.features.slice(0, 4).map(feature => (
                <Badge
                  key={feature}
                  variant="outline"
                  className="text-xs feature-badge"
                >
                  {feature}
                </Badge>
              ))}
              {vehicle.features.length > 4 && (
                <Badge variant="outline" className="text-xs text-secondary-500">
                  +{vehicle.features.length - 4} more
                </Badge>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-secondary-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-secondary-600">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Hourly Rate</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-600">
                  ${vehicle.pricePerHour}
                </div>
                <div className="text-xs text-secondary-500">
                  ${vehicle.pricePerDay}/day
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 sm:p-6 pt-0">
        <Button
          onClick={handleBookNow}
          disabled={!vehicle.available}
          className="w-full h-12 gradient-primary text-white font-semibold hover:shadow-elevation-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {vehicle.available ? 'Book Now' : 'Currently Unavailable'}
        </Button>
      </CardFooter>
    </Card>
  );
};
