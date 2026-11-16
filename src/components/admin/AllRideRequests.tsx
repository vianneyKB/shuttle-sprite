import React, { useMemo } from "react";
import { useAllRideRequests } from "@/hooks/useRideRequests";
import { useProfileSummaries } from "@/hooks/useProfile";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Loader2 } from "lucide-react";
import type { RideRequestStatus } from "@/types";
import { formatMoney } from "@/lib/money";
import { formatScheduled } from "@/lib/schedule";
import { accountLabel } from "@/lib/operatorApplications";

const statusColor: Record<RideRequestStatus, string> = {
  awaiting: "bg-orange-100 text-orange-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export const AllRideRequests: React.FC = () => {
  const { data: requests = [], isLoading } = useAllRideRequests();

  const accountIds = useMemo(
    () =>
      requests.flatMap((r) => [r.customerId, ...(r.operatorId ? [r.operatorId] : [])]),
    [requests]
  );
  const { data: names = new Map() } = useProfileSummaries(accountIds);

  if (isLoading) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold">All ride requests</h2>
        <p className="text-secondary-600">
          Every ride request on the platform, newest first ({requests.length}).
        </p>
      </header>

      {requests.length === 0 ? (
        <p className="text-secondary-600 text-center py-8">No ride requests yet</p>
      ) : (
        <div className="bg-white rounded-xl shadow-elevation border border-secondary-200 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Passenger</TableHead>
                <TableHead>Journey</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Seats</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {accountLabel(r.customerId, names)}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {r.originName}
                      <ArrowRight className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
                      {r.destinationName}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.scheduledAt ? formatScheduled(r.scheduledAt) : "As soon as possible"}
                  </TableCell>
                  <TableCell className="text-right">{r.passengers}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {r.totalPrice == null ? "—" : formatMoney(r.totalPrice, r.currency)}
                  </TableCell>
                  <TableCell className="capitalize whitespace-nowrap">
                    {r.paymentMethod} · {r.paymentStatus.replace("_", " ")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.operatorId ? accountLabel(r.operatorId, names) : "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor[r.status]}>{r.status.replace("_", " ")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
};
