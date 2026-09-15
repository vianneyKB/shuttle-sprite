import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { OperatorSettings } from "@/types";
import { DEFAULT_CURRENCY, DEFAULT_TAX_RATE } from "@/lib/money";

export type DbOperatorSettings = {
  operator_id: string;
  currency: string;
  tax_rate: number;
  tax_label: string;
  prices_include_tax: boolean;
  additional_stop_fee: number;
};

export const mapOperatorSettings = (r: DbOperatorSettings): OperatorSettings => ({
  operatorId: r.operator_id,
  currency: r.currency,
  taxRate: Number(r.tax_rate),
  taxLabel: r.tax_label,
  pricesIncludeTax: r.prices_include_tax,
  additionalStopFee: Number(r.additional_stop_fee),
});

/** Matches the database defaults, used until the operator saves settings. */
export const defaultOperatorSettings = (operatorId: string): OperatorSettings => ({
  operatorId,
  currency: DEFAULT_CURRENCY,
  taxRate: DEFAULT_TAX_RATE,
  taxLabel: "VAT",
  pricesIncludeTax: false,
  additionalStopFee: 15,
});

export const useMyOperatorSettings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["operator_settings", "mine", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<OperatorSettings> => {
      const { data, error } = await supabase
        .from("operator_settings")
        .select("*")
        .eq("operator_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapOperatorSettings(data as DbOperatorSettings) : defaultOperatorSettings(user!.id);
    },
  });
};

export type OperatorSettingsInput = Omit<OperatorSettings, "operatorId">;

export const useUpsertOperatorSettings = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: OperatorSettingsInput) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("operator_settings").upsert(
        {
          operator_id: user.id,
          currency: input.currency.toUpperCase(),
          tax_rate: input.taxRate,
          tax_label: input.taxLabel,
          prices_include_tax: input.pricesIncludeTax,
          additional_stop_fee: input.additionalStopFee,
        },
        { onConflict: "operator_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operator_settings"] });
      // Vehicle prices are displayed in the operator's currency.
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
};
