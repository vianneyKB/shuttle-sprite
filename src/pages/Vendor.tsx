import React from 'react';
import { AppProvider } from '@/context/AppContext';
import { Header } from '@/components/layout/Header';
import { PageMain, PageShell } from '@/components/layout/PageShell';
import { VendorView } from '@/components/vendor/VendorView';

const VendorPage: React.FC = () => (
  <AppProvider>
    <PageShell>
      <Header />
      <PageMain>
        <VendorView />
      </PageMain>
    </PageShell>
  </AppProvider>
);

export default VendorPage;
