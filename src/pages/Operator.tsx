import React from "react";
import { PageShell } from "@/components/layout/PageShell";
import { OperatorView } from "@/components/operator/OperatorView";

const OperatorPage: React.FC = () => (
  <PageShell>
    <OperatorView />
  </PageShell>
);

export default OperatorPage;
