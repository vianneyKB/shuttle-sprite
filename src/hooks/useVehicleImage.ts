import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  VEHICLE_IMAGE_BUCKET,
  imageFileError,
  orphanedImages,
  storagePathFromPublicUrl,
  vehicleImagePath,
} from "@/lib/vehicleImage";

/** Collision-proof without being guessable from the filename alone. */
const uniqueSegment = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Upload one photo into the operator's own folder and return its public URL —
 * what goes into `vehicles.image`. The storage policy only accepts a path that
 * starts with the caller's user id, so the path is built from the session, not
 * from anything the form supplies.
 */
export const useUploadVehicleImage = () => {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      if (!user) throw new Error("Not authenticated");
      const problem = imageFileError(file);
      if (problem) throw new Error(problem);

      const path = vehicleImagePath(user.id, file, uniqueSegment());
      const { error } = await supabase.storage
        .from(VEHICLE_IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) throw error;

      const { data } = supabase.storage.from(VEHICLE_IMAGE_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    },
  });
};

/**
 * Delete photos nothing points at any more: an upload the operator replaced or
 * abandoned, or the image a vehicle has moved off. Best effort and silent —
 * the vehicle row is already correct, and a leftover object is not worth
 * showing anyone an error about. URLs hosted elsewhere are skipped.
 */
export const discardVehicleImages = async (
  candidates: ReadonlyArray<string | null | undefined>,
  keep?: string | null
): Promise<void> => {
  const paths = orphanedImages(candidates, keep)
    .map(storagePathFromPublicUrl)
    .filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(VEHICLE_IMAGE_BUCKET).remove(paths);
  } catch {
    /* orphaned object, not a user-facing failure */
  }
};
