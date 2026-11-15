import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUploadVehicleImage } from '@/hooks/useVehicleImage';
import { ACCEPT_ATTRIBUTE, MAX_IMAGE_BYTES, formatBytes, imageFileError } from '@/lib/vehicleImage';

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** Lets the dialog hold Save until the photo is actually in the bucket. */
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
};

/**
 * The vehicle photo: pick a file, see it, replace or remove it. The URL the
 * form carries is produced by the upload — operators no longer paste a link to
 * someone else's host.
 */
export const VehicleImageField: React.FC<Props> = ({ value, onChange, onUploadingChange, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadVehicleImage();
  const busy = upload.isPending || disabled;

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset first: picking the same file twice must still fire a change.
    event.target.value = '';
    if (!file) return;

    const problem = imageFileError(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    onUploadingChange?.(true);
    try {
      onChange(await upload.mutateAsync(file));
      toast.success('Photo uploaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload photo');
    } finally {
      onUploadingChange?.(false);
    }
  };

  return (
    <div>
      <Label htmlFor="vehicle-image">Photo (optional)</Label>
      <input
        ref={inputRef}
        id="vehicle-image"
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={onPick}
        disabled={busy}
      />
      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-4">
        {value ? (
          <img
            src={value}
            alt="Vehicle photo"
            className="w-full sm:w-40 aspect-video rounded-lg object-cover border border-secondary-200"
          />
        ) : (
          <div className="w-full sm:w-40 aspect-video rounded-lg border border-dashed border-secondary-300 flex items-center justify-center text-secondary-400">
            <ImagePlus className="w-6 h-6" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {upload.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
              : <><ImagePlus className="w-4 h-4 mr-2" /> {value ? 'Replace' : 'Upload'}</>}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={busy}
              onClick={() => onChange('')}
              className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="w-4 h-4 mr-2" /> Remove
            </Button>
          )}
          <p className="text-xs text-secondary-500 w-full sm:w-auto">
            JPEG, PNG, WebP or AVIF, up to {formatBytes(MAX_IMAGE_BYTES)}.
          </p>
        </div>
      </div>
    </div>
  );
};
