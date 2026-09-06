import React from "react";
import { Header } from "@/components/layout/Header";
import { PageMain, PageShell } from "@/components/layout/PageShell";
import { OperatorView } from "@/components/operator/OperatorView";
import { PageSeo } from "@/components/seo/PageSeo";

const OperatorPage: React.FC = () => (
  <PageShell>
    <PageSeo
      title="Operator Dashboard — ShuttleBook"
      description="Manage shuttle routes, fleet vehicles, bookings, and passenger queues from the ShuttleBook operator dashboard."
      path="/operator"
    />
    <Header />
    <PageMain>
      <OperatorView />
    </PageMain>
  </PageShell>
);

export default OperatorPage;
