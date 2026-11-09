import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, ShieldCheck } from "lucide-react";
import { OperatorApplications } from "./OperatorApplications";
import { AllBookings } from "./AllBookings";
import { AllRideRequests } from "./AllRideRequests";

const triggerClass =
  "shrink-0 flex items-center gap-1.5 min-h-11 px-3 text-xs sm:text-sm data-[state=active]:gradient-primary data-[state=active]:text-white rounded-lg font-semibold";

export const AdminView: React.FC = () => (
  <section className="space-y-6 sm:space-y-8">
    <header className="text-center space-y-3 sm:space-y-4 py-4 sm:py-8 px-1">
      <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gradient leading-tight">
        Platform Administration
      </h1>
      <p className="text-base sm:text-xl text-secondary-600 max-w-2xl mx-auto">
        Approve the operators who may carry passengers, and see every booking and ride request
        across all of them.
      </p>
    </header>

    <Tabs defaultValue="applications" className="w-full">
      <TabsList className="scrollbar-thin-x w-full flex flex-wrap md:grid md:grid-cols-3 bg-white shadow-elevation rounded-xl p-1 h-auto min-h-12 gap-1">
        <TabsTrigger value="applications" className={triggerClass}>
          <ShieldCheck className="w-4 h-4" /> Operators
        </TabsTrigger>
        <TabsTrigger value="bookings" className={triggerClass}>
          <Calendar className="w-4 h-4" /> Bookings
        </TabsTrigger>
        <TabsTrigger value="requests" className={triggerClass}>
          <MapPin className="w-4 h-4" /> Ride requests
        </TabsTrigger>
      </TabsList>

      <section className="mt-8 space-y-6">
        <TabsContent value="applications"><OperatorApplications /></TabsContent>
        <TabsContent value="bookings"><AllBookings /></TabsContent>
        <TabsContent value="requests"><AllRideRequests /></TabsContent>
      </section>
    </Tabs>
  </section>
);
