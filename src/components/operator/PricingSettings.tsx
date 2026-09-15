import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMyOperatorSettings, useUpsertOperatorSettings, type OperatorSettingsInput } from "@/hooks/useOperatorSettings";
import { CURRENCY_OPTIONS, formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Coins } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter ISO code, e.g. ZAR"),
  taxRate: z.coerce.number().min(0, "0–100").max(100, "0–100"),
  taxLabel: z.string().trim().min(1, "Required").max(30),
  pricesIncludeTax: z.boolean(),
  additionalStopFee: z.coerce.number().min(0, "Cannot be negative").max(100000),
});
type FormValues = OperatorSettingsInput;

export const PricingSettings: React.FC = () => {
  const { data: settings, isLoading } = useMyOperatorSettings();
  const save = useUpsertOperatorSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: "USD",
      taxRate: 0,
      taxLabel: "VAT",
      pricesIncludeTax: false,
      additionalStopFee: 15,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        currency: settings.currency,
        taxRate: settings.taxRate,
        taxLabel: settings.taxLabel,
        pricesIncludeTax: settings.pricesIncludeTax,
        additionalStopFee: settings.additionalStopFee,
      });
    }
  }, [settings, form]);

  const currency = form.watch("currency");
  const taxRate = form.watch("taxRate");
  const incl = form.watch("pricesIncludeTax");
  const knownCurrency = CURRENCY_OPTIONS.some((c) => c.code === currency);

  const onSubmit = async (values: FormValues) => {
    try {
      await save.mutateAsync(values);
      toast.success("Pricing settings saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  if (isLoading) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  // Worked example so the operator can see what a passenger will be charged.
  const exampleNet = 100;
  const exampleTax = incl
    ? exampleNet - exampleNet / (1 + (Number(taxRate) || 0) / 100)
    : exampleNet * ((Number(taxRate) || 0) / 100);
  const exampleTotal = incl ? exampleNet : exampleNet + exampleTax;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">Pricing &amp; tax</h2>
        <p className="text-secondary-600 text-sm">
          Currency and tax apply to all your vehicles. Existing bookings keep the values they were priced with.
        </p>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-5">
            <fieldset className="space-y-2 border-0 p-0">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={knownCurrency ? currency : "other"}
                onValueChange={(v) => {
                  if (v !== "other") form.setValue("currency", v, { shouldDirty: true });
                }}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Other (enter code below)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                aria-label="ISO 4217 currency code"
                placeholder="ISO code, e.g. MUR"
                maxLength={3}
                className="uppercase max-w-[160px]"
                {...form.register("currency")}
              />
              {form.formState.errors.currency && (
                <p className="text-xs text-destructive">{form.formState.errors.currency.message}</p>
              )}
            </fieldset>

            <div className="grid sm:grid-cols-2 gap-4">
              <fieldset className="space-y-2 border-0 p-0">
                <Label htmlFor="taxRate">Tax rate (%)</Label>
                <Input id="taxRate" type="number" step="0.01" min={0} max={100} {...form.register("taxRate")} />
                {form.formState.errors.taxRate && (
                  <p className="text-xs text-destructive">{form.formState.errors.taxRate.message}</p>
                )}
              </fieldset>
              <fieldset className="space-y-2 border-0 p-0">
                <Label htmlFor="taxLabel">Tax name</Label>
                <Input id="taxLabel" placeholder="VAT, GST, Sales tax…" {...form.register("taxLabel")} />
                {form.formState.errors.taxLabel && (
                  <p className="text-xs text-destructive">{form.formState.errors.taxLabel.message}</p>
                )}
              </fieldset>
            </div>

            <fieldset className="flex items-start justify-between gap-4 border-0 p-0">
              <span>
                <Label htmlFor="pricesIncludeTax">Vehicle prices already include tax</Label>
                <p className="text-xs text-secondary-500 mt-1">
                  On: tax is shown as part of the listed price. Off: tax is added on top at checkout.
                </p>
              </span>
              <Switch
                id="pricesIncludeTax"
                checked={incl}
                onCheckedChange={(v) => form.setValue("pricesIncludeTax", v, { shouldDirty: true })}
              />
            </fieldset>

            <fieldset className="space-y-2 border-0 p-0">
              <Label htmlFor="additionalStopFee">Fee per additional stop ({currency || "…"})</Label>
              <Input id="additionalStopFee" type="number" step="0.01" min={0} className="max-w-[200px]" {...form.register("additionalStopFee")} />
              <p className="text-xs text-secondary-500">Pickup and drop-off are free; each stop in between is charged this amount.</p>
              {form.formState.errors.additionalStopFee && (
                <p className="text-xs text-destructive">{form.formState.errors.additionalStopFee.message}</p>
              )}
            </fieldset>

            <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary-600" /> Example: a {formatMoney(exampleNet, currency)} fare
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(exampleTotal - exampleTax, currency)}</span>
            </p>
            <p className="flex justify-between">
              <span>{form.watch("taxLabel") || "Tax"} ({Number(taxRate) || 0}%)</span>
              <span>{formatMoney(exampleTax, currency)}</span>
            </p>
            <p className="flex justify-between font-semibold pt-2 border-t">
              <span>Passenger pays</span>
              <span>{formatMoney(exampleTotal, currency)}</span>
            </p>
          </CardContent>
        </Card>
      </form>
    </section>
  );
};
