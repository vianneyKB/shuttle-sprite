import React from 'react';
import { AppProvider } from '@/context/AppContext';
import { Header } from '@/components/layout/Header';
import { PageMain, PageShell } from '@/components/layout/PageShell';
import { CustomerView } from '@/components/customer/CustomerView';
import { PageSeo } from '@/components/seo/PageSeo';

const Index: React.FC = () => (
  <AppProvider>
    <PageSeo
      title="ShuttleBook — Shuttle Routes & Fleet Booking"
      description="View live shuttle routes on the map, book fleet vehicles, and track your rides — all in one place."
      path="/"
    />
    <PageShell>
      <Header />
      <PageMain>
        <CustomerView />
      </PageMain>
    </PageShell>
  </AppProvider>
);

export default Index;
