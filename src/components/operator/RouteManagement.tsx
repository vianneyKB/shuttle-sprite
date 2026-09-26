import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useMyRoutes,
  useUpsertRoute,
  useSaveRouteStops,
  useDeleteRoute,
  useSetRouteActive,
  type RouteStopInput,
} from "@/hooks/useRoutes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Route,
  Coins,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { RouteFaresDialog } from "./RouteFaresDialog";
import { RouteStopsMap } from "./RouteStopsMap";
import { formatCoord, moveStop, nextStopSeed, toCoord } from "@/lib/routeStops";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const routeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).optional(),
  operatingHours: z.string().max(120).optional(),
});

type RouteFormValues = z.infer<typeof routeSchema>;

type StopDraft = RouteStopInput & { key: string };

const newStop = (lat: number, lng: number): StopDraft => ({
  key: crypto.randomUUID(),
  name: "",
  lat,
  lng,
});

type StopRowProps = {
  stop: StopDraft;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<RouteStopInput>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
};

/**
 * One stop in the ordered list. The map is the primary way to place a stop, so
 * the raw numbers sit behind a collapsible "precise coordinates" section for
 * the cases a click can't reach (a surveyed point, a pasted coordinate).
 */
const StopRow: React.FC<StopRowProps> = ({
  stop,
  index,
  total,
  selected,
  onSelect,
  onChange,
  onMove,
  onRemove,
}) => {
  const [showCoords, setShowCoords] = useState(false);

  return (
    <Card
      className={cn("p-3 space-y-2", selected && "ring-2 ring-primary-300")}
      onFocusCapture={onSelect}
    >
      <p className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold"
        >
          {index + 1}
        </span>
        <Input
          aria-label={`Stop ${index + 1} name`}
          placeholder={`Stop ${index + 1} name`}
          value={stop.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </p>
      <p className="flex items-center justify-between gap-2">
        <span className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Move ${stop.name || `stop ${index + 1}`} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Move ${stop.name || `stop ${index + 1}`} down`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-secondary-600"
          aria-label={`Remove ${stop.name || `stop ${index + 1}`}`}
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </p>
      <Collapsible open={showCoords} onOpenChange={setShowCoords}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="w-full justify-between text-xs text-secondary-600">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {formatCoord(stop.lat)}, {formatCoord(stop.lng)}
            </span>
            <span className="flex items-center gap-1">
              Precise coordinates
              <ChevronDown className={cn("w-3 h-3 transition-transform", showCoords && "rotate-180")} />
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <span className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              step="any"
              aria-label={`Stop ${index + 1} latitude`}
              placeholder="Lat"
              value={stop.lat}
              onChange={(e) => onChange({ lat: toCoord(e.target.value, stop.lat) })}
            />
            <Input
              type="number"
              step="any"
              aria-label={`Stop ${index + 1} longitude`}
              placeholder="Lng"
              value={stop.lng}
              onChange={(e) => onChange({ lng: toCoord(e.target.value, stop.lng) })}
            />
          </span>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export const RouteManagement: React.FC = () => {
  const { data: routes = [], isLoading } = useMyRoutes();
  const upsert = useUpsertRoute();
  const saveStops = useSaveRouteStops();
  const remove = useDeleteRoute();
  const setActive = useSetRouteActive();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [faresFor, setFaresFor] = useState<string | undefined>();

  const addStopAt = (lat: number, lng: number) => {
    const stop = newStop(lat, lng);
    setStops((prev) => [...prev, stop]);
    setSelectedKey(stop.key);
  };

  const form = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: { name: "", description: "", operatingHours: "" },
  });

  const openCreate = () => {
    setEditingId(undefined);
    form.reset({ name: "", description: "", operatingHours: "" });
    setStops([]);
    setSelectedKey(null);
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
      route.stops.map((s) => ({
        key: s.id,
        name: s.name,
        description: s.description,
        lat: s.lat,
        lng: s.lng,
      }))
    );
    setSelectedKey(null);
    setOpen(true);
  };

  const onSubmit = async (values: RouteFormValues) => {
    const validStops = stops.filter((s) => s.name.trim());
    if (validStops.length < 2) {
      toast.error("Add at least 2 named stops");
      return;
    }
    let routeId: string | undefined;
    try {
      routeId = await upsert.mutateAsync({
        id: editingId,
        input: {
          name: values.name,
          description: values.description,
          operatingHours: values.operatingHours,
          // Editing a hidden route must not quietly put it back on the map.
          isActive: editingId ? routes.find((r) => r.id === editingId)?.isActive ?? true : true,
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
      // Stops are saved atomically by the RPC, but the route row itself was
      // created a step earlier; don't leave a brand-new route with no stops.
      if (!editingId && routeId) {
        await remove.mutateAsync(routeId).catch(() => undefined);
      }
      toast.error(e instanceof Error ? e.message : "Failed to save route");
    }
  };

  const onToggleActive = async (id: string, isActive: boolean) => {
    try {
      await setActive.mutateAsync({ id, isActive });
      toast.success(
        isActive ? "Route is live on the passenger map" : "Route hidden from the passenger map"
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update route");
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
                      {!route.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </p>
                    {route.description && (
                      <p className="text-sm text-secondary-600 mt-1">{route.description}</p>
                    )}
                    <p className="text-xs text-secondary-500 mt-2">
                      {route.stops.length} stops
                      {route.operatingHours ? ` · ${route.operatingHours}` : ""}
                      {!route.isActive ? " · hidden from the passenger map" : ""}
                    </p>
                  </>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-2 mr-1">
                      <Switch
                        id={`route-active-${route.id}`}
                        checked={route.isActive}
                        disabled={setActive.isPending && setActive.variables?.id === route.id}
                        onCheckedChange={(checked) => onToggleActive(route.id, checked)}
                      />
                      <Label
                        htmlFor={`route-active-${route.id}`}
                        className="text-sm font-normal text-secondary-600"
                      >
                        {route.isActive ? "Active" : "Inactive"}
                      </Label>
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setFaresFor(route.id)}>
                      <Coins className="w-4 h-4 mr-1" /> Fares
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(route.id)}>
                      <Edit2 className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Delete route"
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

      {faresFor && routes.find((r) => r.id === faresFor) && (
        <RouteFaresDialog
          route={routes.find((r) => r.id === faresFor)!}
          open
          onOpenChange={(o) => { if (!o) setFaresFor(undefined); }}
        />
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
              <p className="text-xs text-secondary-600">
                Click the map to add a stop, drag a pin to move it. Pins are numbered in pickup order.
              </p>
              <RouteStopsMap
                stops={stops}
                selectedKey={selectedKey}
                onAdd={addStopAt}
                onMove={(key, lat, lng) =>
                  setStops((prev) => prev.map((s) => (s.key === key ? { ...s, lat, lng } : s)))
                }
                onSelect={setSelectedKey}
              />
              {stops.length === 0 ? (
                <p className="text-sm text-secondary-600 text-center py-2">
                  No stops yet — click the map to place the first one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {stops.map((stop, idx) => (
                    <li key={stop.key}>
                      <StopRow
                        stop={stop}
                        index={idx}
                        total={stops.length}
                        selected={selectedKey === stop.key}
                        onSelect={() => setSelectedKey(stop.key)}
                        onChange={(patch) =>
                          setStops((prev) =>
                            prev.map((s) => (s.key === stop.key ? { ...s, ...patch } : s))
                          )
                        }
                        onMove={(delta) => {
                          setSelectedKey(stop.key);
                          setStops((prev) => moveStop(prev, prev.findIndex((s) => s.key === stop.key), delta));
                        }}
                        onRemove={() => {
                          setStops((prev) => prev.filter((s) => s.key !== stop.key));
                          setSelectedKey((k) => (k === stop.key ? null : k));
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const seed = nextStopSeed(stops);
                  addStopAt(seed.lat, seed.lng);
                }}
              >
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
