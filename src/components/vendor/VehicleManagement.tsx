
import React, { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Car, Users, DollarSign, MapPin, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Vehicle } from '@/types';

export const VehicleManagement: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showAddForm, setShowAddForm] = useState(false);
  
  const vendorVehicles = state.vehicles.filter(v => v.vendorId === state.currentVendorId);

  const toggleAvailability = (vehicleId: string) => {
    const vehicle = vendorVehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      dispatch({
        type: 'UPDATE_VEHICLE',
        payload: { ...vehicle, available: !vehicle.available }
      });
    }
  };

  const deleteVehicle = (vehicleId: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      dispatch({ type: 'DELETE_VEHICLE', payload: vehicleId });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900">Fleet Management</h2>
          <p className="text-secondary-600">Manage your vehicles and their availability</p>
        </div>
        <Button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vehicle</span>
        </Button>
      </div>

      {/* Fleet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Car className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Total Vehicles</p>
                <p className="text-xl font-bold text-secondary-900">{vendorVehicles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-green-50 p-2 rounded-lg">
                <ToggleRight className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Available</p>
                <p className="text-xl font-bold text-secondary-900">
                  {vendorVehicles.filter(v => v.available).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-50 p-2 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Total Capacity</p>
                <p className="text-xl font-bold text-secondary-900">
                  {vendorVehicles.reduce((sum, v) => sum + v.capacity, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-50 p-2 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-600">Avg. Rate/Hour</p>
                <p className="text-xl font-bold text-secondary-900">
                  ${Math.round(vendorVehicles.reduce((sum, v) => sum + v.pricePerHour, 0) / (vendorVehicles.length || 1))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle List */}
      <div className="space-y-6">
        {vendorVehicles.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {vendorVehicles.map((vehicle) => (
              <Card key={vehicle.id} className="overflow-hidden hover:shadow-elevation-md transition-shadow duration-300">
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={vehicle.image}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 right-4">
                    <Badge variant={vehicle.available ? "default" : "secondary"}>
                      {vehicle.available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-secondary-900">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-secondary-600 mt-2">
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{vehicle.capacity} passengers</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{vehicle.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600">${vehicle.pricePerHour}</p>
                      <p className="text-sm text-secondary-600">per hour</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {vehicle.features.slice(0, 3).map((feature) => (
                      <Badge key={feature} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {vehicle.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{vehicle.features.length - 3} more
                      </Badge>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAvailability(vehicle.id)}
                      >
                        {vehicle.available ? (
                          <ToggleRight className="w-4 h-4 mr-2" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 mr-2" />
                        )}
                        {vehicle.available ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteVehicle(vehicle.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Car className="w-16 h-16 text-secondary-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-secondary-900 mb-2">No vehicles yet</h3>
              <p className="text-secondary-600 mb-6">
                Add your first vehicle to start accepting bookings
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Vehicle
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
