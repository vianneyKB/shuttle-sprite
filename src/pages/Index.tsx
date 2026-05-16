import React from 'react';
import { AppProvider } from '@/context/AppContext';
import { Header } from '@/components/layout/Header';
import { PageMain, PageShell } from '@/components/layout/PageShell';
import { CustomerView } from '@/components/customer/CustomerView';

const Index: React.FC = () => (
  <AppProvider>
    <PageShell>
      <Header />
      <PageMain>
        <CustomerView />
      </PageMain>
    </PageShell>
  </AppProvider>
);

export default Index;
