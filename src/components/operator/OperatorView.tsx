import React from "react";
import { OperatorDashboard } from "./OperatorDashboard";
import { RouteManagement } from "./RouteManagement";
import { PassengerQueue } from "./PassengerQueue";
import { VehicleManagement } from "@/components/vendor/VehicleManagement";
import { BookingManagement } from "@/components/operator/BookingManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Car, Calendar, Route, Users } from "lucide-react";

export const OperatorView: React.FC = () => (
  <section className="space-y-6 sm:space-y-8">
    <header className="text-center space-y-3 sm:space-y-4 py-4 sm:py-8 px-1">
      <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gradient leading-tight">
        Operator Dashboard
      </h1>
      <p className="text-base sm:text-xl text-secondary-600 max-w-2xl mx-auto">
        Manage routes, fleet, bookings, and see passengers waiting by direction.
      </p>
    </header>

    <Tabs defaultValue="dashboard" className="w-full">
      <TabsList className="scrollbar-thin-x w-full flex flex-wrap md:grid md:grid-cols-5 bg-white shadow-elevation rounded-xl p-1 h-auto min-h-12 gap-1">
        <TabsTrigger value="dashboard" className="shrink-0 flex items-center gap-1.5 min-h-11 px-3 text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg font-semibold">
          <BarChart3 className="w-4 h-4" /> Dashboard
        </TabsTrigger>
        <TabsTrigger value="routes" className="shrink-0 flex items-center gap-1.5 min-h-11 px-3 text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg font-semibold">
          <Route className="w-4 h-4" /> Routes
        </TabsTrigger>
        <TabsTrigger value="queue" className="shrink-0 flex items-center gap-1.5 min-h-11 px-3 text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg font-semibold">
          <Users className="w-4 h-4" /> Queue
        </TabsTrigger>
        <TabsTrigger value="vehicles" className="shrink-0 flex items-center gap-1.5 min-h-11 px-3 text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg font-semibold">
          <Car className="w-4 h-4" /> Fleet
        </TabsTrigger>
        <TabsTrigger value="bookings" className="shrink-0 flex items-center gap-1.5 min-h-11 px-3 text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg font-semibold">
          <Calendar className="w-4 h-4" /> Bookings
        </TabsTrigger>
      </TabsList>

      <section className="mt-8 space-y-6">
        <TabsContent value="dashboard"><OperatorDashboard /></TabsContent>
        <TabsContent value="routes"><RouteManagement /></TabsContent>
        <TabsContent value="queue"><PassengerQueue /></TabsContent>
        <TabsContent value="vehicles"><VehicleManagement /></TabsContent>
        <TabsContent value="bookings"><BookingManagement /></TabsContent>
      </section>
    </Tabs>
  </section>
);
