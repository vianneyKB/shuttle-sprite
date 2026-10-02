/**
 * Vehicle photos: where they live in Supabase Storage, and the rules the
 * browser applies before an upload is attempted.
 *
 * The bucket (`vehicle-images`, created in 20261002041042) is public for
 * reading and writable only by an operator, under a folder named after their
 * own user id — so the path an upload picks is not cosmetic, it is what the
 * storage policy checks. Everything here is pure so the path and URL rules can
 * be tested without a network or a session.
 *
 * The size and MIME limits are repeated on the bucket itself. These are the
 * courtesy copy: they turn a 20 MB photo into a sentence rather than a failed
 * request.
 */

export const VEHICLE_IMAGE_BUCKET = "vehicle-images";

/** Matches `file_size_limit` on the bucket. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Matches `allowed_mime_types` on the bucket. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** For the file input's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Public URLs look like …/storage/v1/object/public/<bucket>/<path>. */
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${VEHICLE_IMAGE_BUCKET}/`;

export const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} kB`;

/** A human sentence when the file cannot be uploaded, or null when it can. */
export const imageFileError = (file: { type: string; size: number }): string | null => {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a JPEG, PNG, WebP or AVIF image";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image must be ${formatBytes(MAX_IMAGE_BYTES)} or smaller`;
  }
  return null;
};

const MAX_SLUG_LENGTH = 40;

/** The original name, reduced to something safe for a URL path segment. */
export const slugifyFileName = (fileName: string): string => {
  const base = fileName.replace(/\.[^.]+$/, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug || "photo";
};

/**
 * `<operator id>/<unique>-<name>.<ext>`. The first segment is what the storage
 * policy compares against auth.uid(), so it is always the operator's own id.
 * `unique` keeps a re-upload of the same filename from overwriting the photo a
 * different vehicle is still using.
 */
export const vehicleImagePath = (
  operatorId: string,
  file: { name: string; type: string },
  unique: string
): string => {
  const ext = EXTENSIONS[file.type] ?? "jpg";
  return `${operatorId}/${unique}-${slugifyFileName(file.name)}.${ext}`;
};

/**
 * The object path inside our bucket, or null when the URL points somewhere
 * else. Vehicles added before uploads existed carry third-party URLs; those
 * are never ours to delete.
 */
export const storagePathFromPublicUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const at = url.indexOf(PUBLIC_URL_MARKER);
  if (at === -1) return null;
  const path = url.slice(at + PUBLIC_URL_MARKER.length).split("?")[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/**
 * Of the photos this edit touched, the ones no longer referenced: uploads the
 * operator replaced or abandoned, and the image a saved vehicle has moved off.
 * Anything hosted elsewhere, and the one being kept, is left alone.
 */
export const orphanedImages = (
  candidates: ReadonlyArray<string | null | undefined>,
  keep: string | null | undefined
): string[] => {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || candidate === keep) continue;
    if (!storagePathFromPublicUrl(candidate)) continue;
    seen.add(candidate);
  }
  return [...seen];
};
