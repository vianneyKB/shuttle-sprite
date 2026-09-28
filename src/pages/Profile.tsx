import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { PageMain, PageShell } from "@/components/layout/PageShell";
import { PageSeo } from "@/components/seo/PageSeo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useProfile";
import { profileChanges, profileFormSchema, type ProfileFormValues } from "@/lib/profile";

const ProfilePage: React.FC = () => {
  const { data: profile, isLoading, isError } = useMyProfile();
  const update = useUpdateMyProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: "", phone: "" },
  });

  // The row arrives after the first render, so reset() rather than setValue():
  // it makes the stored values the baseline the dirty state is measured against.
  useEffect(() => {
    if (!profile) return;
    form.reset({ displayName: profile.displayName, phone: profile.phone });
  }, [profile, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!profile) return;
    const changes = profileChanges(profile, values);
    if (Object.keys(changes).length === 0) {
      toast("Nothing to save — your details are unchanged.");
      return;
    }
    try {
      await update.mutateAsync(changes);
      form.reset(values);
      toast.success("Profile saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save your profile");
    }
  };

  return (
    <PageShell>
      <PageSeo
        title="Your profile — ShuttleBook"
        description="Update the name and mobile number ShuttleBook uses for your shuttle rides and fleet bookings."
        path="/profile"
      />
      <Header />
      <PageMain className="max-w-lg">
        <h1 className="text-2xl font-bold mb-1">Your profile</h1>
        <p className="text-sm text-secondary-600 mb-4">
          These details are used for your ride requests and fleet bookings.
        </p>

        <Card className="p-5 sm:p-6">
          {isLoading ? (
            <p className="flex items-center gap-2 text-secondary-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your details…
            </p>
          ) : isError || !profile ? (
            <p className="text-sm text-destructive">
              Could not load your profile. Check your connection and reload the page.
            </p>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="pf-name">Full name</Label>
                <Input id="pf-name" autoComplete="name" {...form.register("displayName")} />
                {form.formState.errors.displayName && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.displayName.message}
                  </p>
                )}
                <p className="text-xs text-secondary-500 mt-1">
                  Shown to the operator on your bookings and ride requests.
                </p>
              </div>

              <div>
                <Label htmlFor="pf-phone">Mobile number</Label>
                <Input
                  id="pf-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="e.g. 082 123 4567"
                  {...form.register("phone")}
                />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.phone.message}
                  </p>
                )}
                <p className="text-xs text-secondary-500 mt-1">
                  The driver calls this number — a booking cannot be made without it.
                </p>
              </div>

              <div>
                <Label htmlFor="pf-email">Email</Label>
                <Input id="pf-email" type="email" value={profile.email} readOnly disabled />
                <p className="text-xs text-secondary-500 mt-1">
                  This is the address you sign in with. Changing it isn't supported yet.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full min-h-11"
                disabled={update.isPending || !form.formState.isDirty}
              >
                {update.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </form>
          )}
        </Card>
      </PageMain>
    </PageShell>
  );
};

export default ProfilePage;
