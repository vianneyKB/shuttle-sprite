import React from "react";
import { useMyOperatorApplication } from "@/hooks/useOperatorApplications";
import { useAuth } from "@/context/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, XCircle } from "lucide-react";

/**
 * Where an account's own request to operate has got to. Signing up as an
 * operator no longer grants the role, so without this the applicant would see
 * a passenger view and no explanation. Renders nothing for everyone else —
 * including once the application is approved, when the Operator view itself is
 * the answer.
 */
export const OperatorApplicationNotice: React.FC = () => {
  const { isOperator } = useAuth();
  const { data: application } = useMyOperatorApplication();

  if (!application || isOperator) return null;

  if (application.status === "pending") {
    return (
      <Alert className="border-orange-200 bg-orange-50">
        <Clock className="h-4 w-4" />
        <AlertTitle>Your operator application is being reviewed</AlertTitle>
        <AlertDescription className="text-secondary-600">
          You can book and ride as a passenger in the meantime. Routes, fleet and fares open up
          as soon as an administrator approves you.
        </AlertDescription>
      </Alert>
    );
  }

  if (application.status === "rejected") {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Your operator application was not approved</AlertTitle>
        <AlertDescription>
          {application.decisionNote ?? "No reason was recorded."} Your passenger account is
          unaffected.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
