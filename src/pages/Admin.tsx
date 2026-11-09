import React from "react";
import { Header } from "@/components/layout/Header";
import { PageMain, PageShell } from "@/components/layout/PageShell";
import { AdminView } from "@/components/admin/AdminView";
import { PageSeo } from "@/components/seo/PageSeo";

const AdminPage: React.FC = () => (
  <PageShell>
    <PageSeo
      title="Administration — ShuttleBook"
      description="Approve operator applications and review every booking and ride request on the ShuttleBook platform."
      path="/admin"
    />
    <Header />
    <PageMain>
      <AdminView />
    </PageMain>
  </PageShell>
);

export default AdminPage;
