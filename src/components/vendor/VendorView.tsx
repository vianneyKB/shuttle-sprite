
import React from 'react';
import { VendorDashboard } from './VendorDashboard';
import { VehicleManagement } from './VehicleManagement';
import { BookingManagement } from './BookingManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Car, Calendar } from 'lucide-react';

export const VendorView: React.FC = () => {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-3 sm:space-y-4 py-4 sm:py-8 px-1">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gradient leading-tight">
          Operator Dashboard
        </h1>
        <p className="text-base sm:text-xl text-secondary-600 max-w-2xl mx-auto leading-relaxed">
          Manage your fleet, track bookings, and grow your transport business 
          with professional tools and insights.
        </p>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="scrollbar-thin-x w-full flex md:grid md:grid-cols-3 bg-white shadow-elevation rounded-xl p-1 h-auto min-h-12 gap-1">
          <TabsTrigger 
            value="dashboard" 
            className="shrink-0 flex items-center gap-1.5 sm:gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg min-h-11 px-3 sm:px-4 font-semibold text-xs sm:text-sm"
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger 
            value="vehicles" 
            className="shrink-0 flex items-center gap-1.5 sm:gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg min-h-11 px-3 sm:px-4 font-semibold text-xs sm:text-sm"
          >
            <Car className="w-4 h-4 shrink-0" />
            <span>Fleet</span>
          </TabsTrigger>
          <TabsTrigger 
            value="bookings" 
            className="shrink-0 flex items-center gap-1.5 sm:gap-2 data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg min-h-11 px-3 sm:px-4 font-semibold text-xs sm:text-sm"
          >
            <Calendar className="w-4 h-4 shrink-0" />
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
