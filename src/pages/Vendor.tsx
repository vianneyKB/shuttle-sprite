import React from 'react';
import { AppProvider } from '@/context/AppContext';
import { Header } from '@/components/layout/Header';
import { VendorView } from '@/components/vendor/VendorView';

const VendorPage: React.FC = () => (
  <AppProvider>
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-white to-primary-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <VendorView />
      </main>
    </div>
  </AppProvider>
);

export default VendorPage;
