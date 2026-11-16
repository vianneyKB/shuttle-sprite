import React, { useMemo, useState } from "react";
import {
  useOperatorApplications,
  useReviewOperatorApplication,
} from "@/hooks/useOperatorApplications";
import { useProfileSummaries } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Clock, Loader2, Phone, X } from "lucide-react";
import { toast } from "sonner";
import type { OperatorApplication } from "@/types";
import {
  APPLICATION_STATUS_COLOR,
  APPLICATION_STATUS_LABEL,
  NOTE_MAX_LENGTH,
  accountLabel,
  daysWaiting,
  groupApplications,
  rejectionNoteError,
} from "@/lib/operatorApplications";

const formatDate = (d: Date) =>
  d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export const OperatorApplications: React.FC = () => {
  const { data: applications = [], isLoading } = useOperatorApplications();
  const review = useReviewOperatorApplication();
  const [rejecting, setRejecting] = useState<OperatorApplication | null>(null);
  const [note, setNote] = useState("");

  const accountIds = useMemo(
    () => applications.flatMap((a) => [a.userId, ...(a.decidedBy ? [a.decidedBy] : [])]),
    [applications]
  );
  const { data: names = new Map() } = useProfileSummaries(accountIds);
  const groups = useMemo(() => groupApplications(applications), [applications]);

  const noteError = rejectionNoteError(note);

  const approve = async (application: OperatorApplication) => {
    try {
      await review.mutateAsync({ userId: application.userId, approve: true });
      toast.success(`${accountLabel(application.userId, names)} can now operate`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not approve the application");
    }
  };

  const reject = async () => {
    if (!rejecting || noteError) return;
    try {
      await review.mutateAsync({ userId: rejecting.userId, approve: false, note });
      toast.success("Application rejected");
      setRejecting(null);
      setNote("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not reject the application");
    }
  };

  const ApplicationCard: React.FC<{ application: OperatorApplication }> = ({ application }) => {
    const summary = names.get(application.userId);
    const waiting = daysWaiting(application.requestedAt);
    return (
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <strong className="text-lg break-words">
                  {accountLabel(application.userId, names)}
                </strong>
                <Badge className={APPLICATION_STATUS_COLOR[application.status]}>
                  {APPLICATION_STATUS_LABEL[application.status]}
                </Badge>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-secondary-600 list-none p-0">
                {summary?.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="w-4 h-4 shrink-0" />
                    {summary.phone}
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  Applied {formatDate(application.requestedAt)}
                  {application.status === "pending" &&
                    ` · waiting ${waiting} ${waiting === 1 ? "day" : "days"}`}
                </li>
              </ul>
            </div>
            {application.status === "pending" && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => void approve(application)}
                >
                  <Check className="w-4 h-4 mr-1.5" /> Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => {
                    setNote("");
                    setRejecting(application);
                  }}
                >
                  <X className="w-4 h-4 mr-1.5" /> Reject
                </Button>
              </div>
            )}
          </header>

          {application.decidedAt && (
            <p className="text-xs text-secondary-500 border-t pt-3">
              {APPLICATION_STATUS_LABEL[application.status]} {formatDate(application.decidedAt)}
              {application.decidedBy ? ` by ${accountLabel(application.decidedBy, names)}` : ""}
              {application.decisionNote ? ` — ${application.decisionNote}` : ""}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-secondary-600 text-center py-8">{children}</p>
  );

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">Operator applications</h2>
        <p className="text-secondary-600">
          An account that signed up to operate stays a passenger until it is approved here.
          Approving grants the operator role.
        </p>
      </header>

      <Tabs defaultValue="pending">
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="pending">Waiting ({groups.pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({groups.approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({groups.rejected.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {groups.pending.map((a) => (
            <ApplicationCard key={a.id} application={a} />
          ))}
          {groups.pending.length === 0 && <Empty>Nobody is waiting to be approved</Empty>}
        </TabsContent>
        <TabsContent value="approved" className="space-y-4 mt-4">
          {groups.approved.map((a) => (
            <ApplicationCard key={a.id} application={a} />
          ))}
          {groups.approved.length === 0 && <Empty>No approved operators yet</Empty>}
        </TabsContent>
        <TabsContent value="rejected" className="space-y-4 mt-4">
          {groups.rejected.map((a) => (
            <ApplicationCard key={a.id} application={a} />
          ))}
          {groups.rejected.length === 0 && <Empty>No applications have been rejected</Empty>}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!rejecting}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this application</DialogTitle>
            <DialogDescription>
              {rejecting ? accountLabel(rejecting.userId, names) : ""} keeps their passenger
              account. The reason is recorded and shown to them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={note}
              maxLength={NOTE_MAX_LENGTH}
              placeholder="e.g. No operating licence on file"
              onChange={(e) => setNote(e.target.value)}
            />
            {noteError && <p className="text-xs text-destructive">{noteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button disabled={!!noteError || review.isPending} onClick={() => void reject()}>
              Reject application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
