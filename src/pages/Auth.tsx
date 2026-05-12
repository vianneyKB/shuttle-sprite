import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/context/AuthContext";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});

const signUpSchema = z.object({
  displayName: z.string().min(2, "Enter your name").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  role: z.enum(["customer", "vendor"]),
});

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const signInForm = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUpForm = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", role: "customer" },
  });

  const onSignIn = async (values: z.infer<typeof signInSchema>) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate("/", { replace: true });
  };

  const onSignUp = async (values: z.infer<typeof signUpSchema>) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: values.displayName, role: values.role },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. Check your email to confirm, then sign in.");
    setTab("signin");
  };

  const onOAuth = async (provider: "google" | "apple") => {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
            <Car className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">ShuttleBook</h1>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4 pt-4">
            <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-3">
              <div>
                <Label htmlFor="si-email">Email</Label>
                <Input id="si-email" type="email" autoComplete="email" {...signInForm.register("email")} />
                {signInForm.formState.errors.email && (
                  <p className="text-xs text-destructive mt-1">{signInForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="si-password">Password</Label>
                <Input id="si-password" type="password" autoComplete="current-password" {...signInForm.register("password")} />
                {signInForm.formState.errors.password && (
                  <p className="text-xs text-destructive mt-1">{signInForm.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
              <div className="text-right">
                <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 pt-4">
            <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-3">
              <div>
                <Label htmlFor="su-name">Full name</Label>
                <Input id="su-name" {...signUpForm.register("displayName")} />
                {signUpForm.formState.errors.displayName && (
                  <p className="text-xs text-destructive mt-1">{signUpForm.formState.errors.displayName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" type="email" autoComplete="email" {...signUpForm.register("email")} />
                {signUpForm.formState.errors.email && (
                  <p className="text-xs text-destructive mt-1">{signUpForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="su-password">Password</Label>
                <Input id="su-password" type="password" autoComplete="new-password" {...signUpForm.register("password")} />
                {signUpForm.formState.errors.password && (
                  <p className="text-xs text-destructive mt-1">{signUpForm.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <Label>I am a…</Label>
                <Select
                  defaultValue="customer"
                  onValueChange={(v) => signUpForm.setValue("role", v as "customer" | "vendor")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer (book rides)</SelectItem>
                    <SelectItem value="vendor">Vendor (offer vehicles)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" type="button" onClick={() => onOAuth("google")}>Google</Button>
          <Button variant="outline" type="button" onClick={() => onOAuth("apple")}>Apple</Button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;