import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useMyVehicles,
  useUpsertVehicle,
  useToggleVehicleAvailability,
  useDeleteVehicle,
} from '@/hooks/useVehicles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Car, Users, DollarSign, MapPin, Edit2, Trash2,
  ToggleLeft, ToggleRight, Loader2,
} from 'lucide-react';
import { Vehicle, VEHICLE_FEATURES } from '@/types';
import { toast } from 'sonner';

const vehicleSchema = z.object({
  make: z.string().trim().min(1, 'Make is required').max(50),
  model: z.string().trim().min(1, 'Model is required').max(50),
  year: z.coerce.number().int().min(1980, 'Year must be after 1980').max(new Date().getFullYear() + 1),
  capacity: z.coerce.number().int().min(1).max(100),
  pricePerHour: z.coerce.number().min(0).max(10000),
  pricePerDay: z.coerce.number().min(0).max(100000),
  location: z.string().trim().min(1, 'Location is required').max(120),
  image: z.string().trim().url('Must be a valid URL').max(500).optional().or(z.literal('')),
});
type VehicleFormValues = z.infer<typeof vehicleSchema>;

export const VehicleManagement: React.FC = () => {
  const { data: vehicles = [], isLoading } = useMyVehicles();
  const upsert = useUpsertVehicle();
  const toggle = useToggleVehicleAvailability();
  const remove = useDeleteVehicle();

  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [open, setOpen] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      make: '', model: '', year: new Date().getFullYear(),
      capacity: 4, pricePerHour: 50, pricePerDay: 400, location: '', image: '',
    },
  });

  const openAdd = () => {
    setEditing(null);
    setFeatures([]);
    form.reset({ make: '', model: '', year: new Date().getFullYear(),
      capacity: 4, pricePerHour: 50, pricePerDay: 400, location: '', image: '' });
    setOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setFeatures(v.features);
    form.reset({
      make: v.make, model: v.model, year: v.year, capacity: v.capacity,
      pricePerHour: v.pricePerHour, pricePerDay: v.pricePerDay,
      location: v.location, image: v.image ?? '',
    });
    setOpen(true);
  };

  const onSubmit = async (values: VehicleFormValues) => {
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        input: { ...values, image: values.image || undefined, features, available: editing?.available ?? true },
      });
      toast.success(editing ? 'Vehicle updated' : 'Vehicle added');
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save vehicle');
    }
  };

  const onToggle = async (v: Vehicle) => {
    try { await toggle.mutateAsync({ id: v.id, available: !v.available }); }
    catch (e: any) { toast.error(e?.message ?? 'Failed to update'); }
  };

  const onDelete = async (v: Vehicle) => {
    if (!confirm('Delete this vehicle?')) return;
    try {
      await remove.mutateAsync(v.id);
      toast.success('Vehicle deleted');
    } catch (e: any) { toast.error(e?.message ?? 'Failed to delete'); }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-secondary-900">Fleet Management</h2>
          <p className="text-sm sm:text-base text-secondary-600">Manage your vehicles and their availability</p>
        </div>
        <Button onClick={openAdd} className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /><span>Add Vehicle</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Vehicles', value: vehicles.length, Icon: Car, bg: 'bg-blue-50', color: 'text-blue-600' },
          { label: 'Available', value: vehicles.filter(v => v.available).length, Icon: ToggleRight, bg: 'bg-green-50', color: 'text-green-600' },
          { label: 'Total Capacity', value: vehicles.reduce((s, v) => s + v.capacity, 0), Icon: Users, bg: 'bg-purple-50', color: 'text-purple-600' },
          { label: 'Avg. Rate/Hour', value: `$${Math.round(vehicles.reduce((s, v) => s + v.pricePerHour, 0) / (vehicles.length || 1))}`, Icon: DollarSign, bg: 'bg-emerald-50', color: 'text-emerald-600' },
        ].map((s, i) => (
          <Card key={i}><CardContent className="p-4"><div className="flex items-center space-x-3">
            <div className={`${s.bg} p-2 rounded-lg`}><s.Icon className={`w-5 h-5 ${s.color}`} /></div>
            <div><p className="text-sm text-secondary-600">{s.label}</p>
              <p className="text-xl font-bold text-secondary-900">{s.value}</p></div>
          </div></CardContent></Card>
        ))}
      </div>

      {vehicles.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {vehicles.map(v => (
            <Card key={v.id} className="overflow-hidden hover:shadow-elevation-md transition-shadow duration-300">
              {v.image && (
                <div className="aspect-video relative overflow-hidden">
                  <img src={v.image} alt={`${v.make} ${v.model}`} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute top-4 right-4">
                    <Badge variant={v.available ? 'default' : 'secondary'}>
                      {v.available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </div>
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-secondary-900">{v.year} {v.make} {v.model}</h3>
                    <div className="flex items-center space-x-4 text-sm text-secondary-600 mt-2">
                      <div className="flex items-center space-x-1"><Users className="w-4 h-4" /><span>{v.capacity} passengers</span></div>
                      <div className="flex items-center space-x-1"><MapPin className="w-4 h-4" /><span>{v.location}</span></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">${v.pricePerHour}</p>
                    <p className="text-sm text-secondary-600">per hour</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {v.features.slice(0, 3).map(f => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
                  {v.features.length > 3 && <Badge variant="outline" className="text-xs">+{v.features.length - 3} more</Badge>}
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onToggle(v)}>
                      {v.available ? <ToggleRight className="w-4 h-4 mr-2" /> : <ToggleLeft className="w-4 h-4 mr-2" />}
                      {v.available ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(v)}>
                      <Edit2 className="w-4 h-4 mr-2" /> Edit
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(v)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="text-center py-12">
          <Car className="w-16 h-16 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-secondary-900 mb-2">No vehicles yet</h3>
          <p className="text-secondary-600 mb-6">Add your first vehicle to start accepting bookings</p>
          <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Your First Vehicle</Button>
        </CardContent></Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { name: 'make', label: 'Make' },
                { name: 'model', label: 'Model' },
                { name: 'year', label: 'Year', type: 'number' },
                { name: 'capacity', label: 'Capacity', type: 'number' },
                { name: 'pricePerHour', label: 'Price / Hour', type: 'number' },
                { name: 'pricePerDay', label: 'Price / Day', type: 'number' },
                { name: 'location', label: 'Location' },
                { name: 'image', label: 'Image URL (optional)' },
              ] as const).map(f => (
                <div key={f.name}>
                  <Label htmlFor={f.name}>{f.label}</Label>
                  <Input id={f.name} type={f.type ?? 'text'} {...form.register(f.name as keyof VehicleFormValues)} />
                  {form.formState.errors[f.name as keyof VehicleFormValues] && (
                    <p className="text-sm text-red-600 mt-1">
                      {form.formState.errors[f.name as keyof VehicleFormValues]?.message as string}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div>
              <Label>Features</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {VEHICLE_FEATURES.map(f => {
                  const active = features.includes(f);
                  return (
                    <Button type="button" key={f} variant={active ? 'default' : 'outline'} size="sm"
                      onClick={() => setFeatures(active ? features.filter(x => x !== f) : [...features, f])}>
                      {f}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
