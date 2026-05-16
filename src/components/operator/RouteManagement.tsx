import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useMyRoutes,
  useUpsertRoute,
  useSaveRouteStops,
  useDeleteRoute,
  type RouteStopInput,
} from "@/hooks/useRoutes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Loader2, Route } from "lucide-react";
import { toast } from "sonner";

const routeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).optional(),
  operatingHours: z.string().max(120).optional(),
});

type RouteFormValues = z.infer<typeof routeSchema>;

type StopDraft = RouteStopInput & { key: string };

const emptyStop = (): StopDraft => ({
  key: crypto.randomUUID(),
  name: "",
  lat: -26.2041,
  lng: 28.0473,
});

export const RouteManagement: React.FC = () => {
  const { data: routes = [], isLoading } = useMyRoutes();
  const upsert = useUpsertRoute();
  const saveStops = useSaveRouteStops();
  const remove = useDeleteRoute();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [stops, setStops] = useState<StopDraft[]>([emptyStop(), emptyStop()]);

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: { name: "", description: "", operatingHours: "" },
  });

  const openCreate = () => {
    setEditingId(undefined);
    form.reset({ name: "", description: "", operatingHours: "" });
    setStops([emptyStop(), emptyStop()]);
    setOpen(true);
  };

  const openEdit = (id: string) => {
    const route = routes.find((r) => r.id === id);
    if (!route) return;
    setEditingId(id);
    form.reset({
      name: route.name,
      description: route.description ?? "",
      operatingHours: route.operatingHours ?? "",
    });
    setStops(
      route.stops.length > 0
        ? route.stops.map((s) => ({
            key: s.id,
            name: s.name,
            description: s.description,
            lat: s.lat,
            lng: s.lng,
          }))
        : [emptyStop(), emptyStop()]
    );
    setOpen(true);
  };

  const onSubmit = async (values: RouteFormValues) => {
    const validStops = stops.filter((s) => s.name.trim());
    if (validStops.length < 2) {
      toast.error("Add at least 2 named stops");
      return;
    }
    try {
      const routeId = await upsert.mutateAsync({
        id: editingId,
        input: {
          name: values.name,
          description: values.description,
          operatingHours: values.operatingHours,
        },
      });
      await saveStops.mutateAsync({
        routeId,
        stops: validStops.map(({ name, description, lat, lng }) => ({
          name,
          description,
          lat,
          lng,
        })),
      });
      toast.success(editingId ? "Route updated" : "Route created");
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save route");
    }
  };

  if (isLoading) {
    return (
      <p className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </p>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <>
          <h2 className="text-2xl font-bold">Shuttle routes</h2>
          <p className="text-secondary-600 text-sm">Create routes with ordered stops for the map.</p>
        </>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> New route
        </Button>
      </header>

      {routes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-secondary-600">
            No routes yet. Create your first shuttle route.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {routes.map((route) => (
            <li key={route.id}>
              <Card>
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <>
                    <p className="flex items-center gap-2 font-semibold text-lg">
                      <Route className="w-5 h-5 text-primary-600" />
                      {route.name}
                    </p>
                    {route.description && (
                      <p className="text-sm text-secondary-600 mt-1">{route.description}</p>
                    )}
                    <p className="text-xs text-secondary-500 mt-2">
                      {route.stops.length} stops
                      {route.operatingHours ? ` · ${route.operatingHours}` : ""}
                    </p>
                  </>
                  <p className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(route.id)}>
                      <Edit2 className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!confirm("Delete this route?")) return;
                        try {
                          await remove.mutateAsync(route.id);
                          toast.success("Route deleted");
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "Delete failed");
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit route" : "New route"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <fieldset className="space-y-2 border-0 p-0">
              <Label htmlFor="name">Route name</Label>
              <Input id="name" {...form.register("name")} />
            </fieldset>
            <fieldset className="space-y-2 border-0 p-0">
              <Label htmlFor="hours">Operating hours</Label>
              <Input id="hours" placeholder="Mon–Fri 7am–7pm" {...form.register("operatingHours")} />
            </fieldset>
            <fieldset className="space-y-2 border-0 p-0">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" {...form.register("description")} rows={2} />
            </fieldset>

            <fieldset className="space-y-3 border-0 p-0">
              <Label>Stops (in order)</Label>
              {stops.map((stop, idx) => (
                <Card key={stop.key} className="p-3 space-y-2">
                  <Input
                    placeholder={`Stop ${idx + 1} name`}
                    value={stop.name}
                    onChange={(e) =>
                      setStops((prev) =>
                        prev.map((s) => (s.key === stop.key ? { ...s, name: e.target.value } : s))
                      )
                    }
                  />
                  <p className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="any"
                      placeholder="Lat"
                      value={stop.lat}
                      onChange={(e) =>
                        setStops((prev) =>
                          prev.map((s) =>
                            s.key === stop.key ? { ...s, lat: Number(e.target.value) } : s
                          )
                        )
                      }
                    />
                    <Input
                      type="number"
                      step="any"
                      placeholder="Lng"
                      value={stop.lng}
                      onChange={(e) =>
                        setStops((prev) =>
                          prev.map((s) =>
                            s.key === stop.key ? { ...s, lng: Number(e.target.value) } : s
                          )
                        )
                      }
                    />
                  </p>
                  {stops.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStops((prev) => prev.filter((s) => s.key !== stop.key))}
                    >
                      Remove stop
                    </Button>
                  )}
                </Card>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setStops((p) => [...p, emptyStop()])}>
                <Plus className="w-4 h-4 mr-1" /> Add stop
              </Button>
            </fieldset>

            <Button type="submit" className="w-full" disabled={upsert.isPending || saveStops.isPending}>
              {upsert.isPending || saveStops.isPending ? "Saving…" : "Save route"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
