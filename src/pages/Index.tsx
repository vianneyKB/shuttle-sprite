
import React from 'react';
import { AppProvider } from '@/context/AppContext';
import { Header } from '@/components/layout/Header';
import { CustomerView } from '@/components/customer/CustomerView';
import { VendorView } from '@/components/vendor/VendorView';
import { useAppContext } from '@/context/AppContext';

const AppContent: React.FC = () => {
  const { state } = useAppContext();

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-white to-primary-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {state.viewMode === 'customer' ? <CustomerView /> : <VendorView />}
      </main>
    </div>
  );
};

const Index: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default Index;
