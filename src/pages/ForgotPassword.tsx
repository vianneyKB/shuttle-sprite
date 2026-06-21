import React, { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageSeo } from "@/components/seo/PageSeo";

const schema = z.object({ email: z.string().email("Enter a valid email") });

const ForgotPassword: React.FC = () => {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: z.infer<typeof schema>) => {
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your inbox for a reset link.");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center p-4 safe-bottom overflow-x-hidden bg-gradient-to-br from-secondary-50 via-white to-primary-50">
      <PageSeo
        title="Reset your password — ShuttleBook"
        description="Request a password reset link for your ShuttleBook account."
        path="/forgot-password"
      />
      <Card className="w-full max-w-md p-5 sm:p-8 space-y-6">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we'll send you a link to set a new password.
        </p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label htmlFor="fp-email">Email</Label>
            <Input id="fp-email" type="email" autoComplete="email" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
          <Link to="/auth" className="block text-center text-sm text-primary-600 hover:underline">
            Back to sign in
          </Link>
        </form>
      </Card>
    </div>
  );
};

export default ForgotPassword;