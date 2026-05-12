
import React from 'react';
import { VendorDashboard } from './VendorDashboard';
import { VehicleManagement } from './VehicleManagement';
import { BookingManagement } from './BookingManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Car, Calendar } from 'lucide-react';

export const VendorView: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gradient leading-tight">
          Vendor Dashboard
        </h1>
        <p className="text-xl text-secondary-600 max-w-2xl mx-auto leading-relaxed">
          Manage your fleet, track bookings, and grow your transport business 
          with professional tools and insights.
        </p>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white shadow-elevation rounded-xl p-1 h-14">
          <TabsTrigger 
            value="dashboard" 
            className="flex items-center space-x-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg h-12 font-semibold transition-all duration-300"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger 
            value="vehicles" 
            className="flex items-center space-x-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg h-12 font-semibold transition-all duration-300"
          >
            <Car className="w-4 h-4" />
            <span>Fleet</span>
          </TabsTrigger>
          <TabsTrigger 
            value="bookings" 
            className="flex items-center space-x-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg h-12 font-semibold transition-all duration-300"
          >
            <Calendar className="w-4 h-4" />
            <span>Bookings</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-8">
          <TabsContent value="dashboard" className="space-y-6">
            <VendorDashboard />
          </TabsContent>
          
          <TabsContent value="vehicles" className="space-y-6">
            <VehicleManagement />
          </TabsContent>
          
          <TabsContent value="bookings" className="space-y-6">
            <BookingManagement />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
