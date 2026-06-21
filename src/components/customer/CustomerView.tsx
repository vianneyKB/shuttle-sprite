import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Car, List } from "lucide-react";
import { RoutesMapPanel } from "./RoutesMapPanel";
import { VehicleSearch } from "./VehicleSearch";
import { VehicleList } from "./VehicleList";
import { MyRides } from "./MyRides";
import { BookingModal } from "./BookingModal";
import { useAppContext } from "@/context/AppContext";

export const CustomerView: React.FC = () => {
  const { state } = useAppContext();

  return (
    <section className="space-y-6 sm:space-y-8">
      <header className="text-center space-y-3 sm:space-y-4 py-6 sm:py-10 px-1">
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gradient leading-tight">
          ShuttleBook — Professional Transport & Fleet Booking
        </h1>
        <p className="text-base sm:text-xl text-secondary-600 max-w-2xl mx-auto">
          Explore routes on the map, book fleet vehicles, and track your rides.
        </p>
      </header>

      <Tabs defaultValue="map" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-auto min-h-11">
          <TabsTrigger value="map" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Map className="w-4 h-4" /> Routes
          </TabsTrigger>
          <TabsTrigger value="book" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Car className="w-4 h-4" /> Book fleet
          </TabsTrigger>
          <TabsTrigger value="rides" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <List className="w-4 h-4" /> My rides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map">
          <RoutesMapPanel />
        </TabsContent>

        <TabsContent value="book" className="space-y-8">
          <section className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-elevation-md border border-secondary-200">
            <VehicleSearch />
          </section>
          <VehicleList />
        </TabsContent>

        <TabsContent value="rides">
          <MyRides />
        </TabsContent>
      </Tabs>

      {state.showBookingModal && <BookingModal />}
    </section>
  );
};
