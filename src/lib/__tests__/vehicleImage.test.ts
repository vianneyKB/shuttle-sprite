import { describe, expect, it } from "vitest";
import {
  ACCEPT_ATTRIBUTE,
  MAX_IMAGE_BYTES,
  VEHICLE_IMAGE_BUCKET,
  formatBytes,
  imageFileError,
  orphanedImages,
  slugifyFileName,
  storagePathFromPublicUrl,
  vehicleImagePath,
} from "../vehicleImage";

const OPERATOR = "11111111-1111-1111-1111-111111111111";
const publicUrl = (path: string) =>
  `https://dyynbzbpitjoyfrxnxux.supabase.co/storage/v1/object/public/${VEHICLE_IMAGE_BUCKET}/${path}`;

describe("imageFileError", () => {
  it("accepts the formats the bucket accepts", () => {
    for (const type of ACCEPT_ATTRIBUTE.split(",")) {
      expect(imageFileError({ type, size: 1024 })).toBeNull();
    }
  });

  it("refuses a format the bucket would reject", () => {
    expect(imageFileError({ type: "image/gif", size: 1024 })).toMatch(/JPEG, PNG, WebP or AVIF/);
    expect(imageFileError({ type: "application/pdf", size: 10 })).not.toBeNull();
  });

  it("refuses a file over the bucket's size limit, and allows one exactly at it", () => {
    expect(imageFileError({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBeNull();
    expect(imageFileError({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 })).toBe(
      "Image must be 5 MB or smaller"
    );
  });
});

describe("formatBytes", () => {
  it("reads as a person would say it", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(200 * 1024)).toBe("200 kB");
  });
});

describe("slugifyFileName", () => {
  it("drops the extension and anything a URL would have to escape", () => {
    expect(slugifyFileName("Toyota Quantum (front).JPG")).toBe("toyota-quantum-front");
    expect(slugifyFileName("φωτο.png")).toBe("photo");
    expect(slugifyFileName("")).toBe("photo");
  });

  it("keeps the name short enough to stay readable in a path", () => {
    expect(slugifyFileName(`${"a".repeat(80)}.png`)).toHaveLength(40);
  });
});

describe("vehicleImagePath", () => {
  it("puts the photo under the operator's own id — the policy checks that folder", () => {
    const path = vehicleImagePath(OPERATOR, { name: "quantum.jpg", type: "image/jpeg" }, "abc123");
    expect(path).toBe(`${OPERATOR}/abc123-quantum.jpg`);
  });

  it("names the file by its real type, not by what the operator called it", () => {
    expect(vehicleImagePath(OPERATOR, { name: "photo.jpeg", type: "image/webp" }, "x")).toBe(
      `${OPERATOR}/x-photo.webp`
    );
  });

  it("never collides on a re-upload of the same filename", () => {
    const a = vehicleImagePath(OPERATOR, { name: "van.png", type: "image/png" }, "one");
    const b = vehicleImagePath(OPERATOR, { name: "van.png", type: "image/png" }, "two");
    expect(a).not.toBe(b);
  });
});

describe("storagePathFromPublicUrl", () => {
  it("recovers the object path from a public URL", () => {
    expect(storagePathFromPublicUrl(publicUrl(`${OPERATOR}/abc-quantum.jpg`))).toBe(
      `${OPERATOR}/abc-quantum.jpg`
    );
  });

  it("ignores a cache-busting query and unescapes the path", () => {
    expect(storagePathFromPublicUrl(publicUrl(`${OPERATOR}/a%20b.jpg?t=1`))).toBe(`${OPERATOR}/a b.jpg`);
  });

  it("returns null for an image hosted anywhere else", () => {
    expect(storagePathFromPublicUrl("https://images.example.com/van.jpg")).toBeNull();
    expect(storagePathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/avatars/a.jpg")).toBeNull();
    expect(storagePathFromPublicUrl("")).toBeNull();
    expect(storagePathFromPublicUrl(null)).toBeNull();
  });
});

describe("orphanedImages", () => {
  const first = publicUrl(`${OPERATOR}/one.jpg`);
  const second = publicUrl(`${OPERATOR}/two.jpg`);

  it("returns the uploads that were replaced, never the one being kept", () => {
    expect(orphanedImages([first, second], second)).toEqual([first]);
  });

  it("never offers up a photo hosted elsewhere for deletion", () => {
    expect(orphanedImages(["https://images.example.com/van.jpg", first], null)).toEqual([first]);
  });

  it("skips blanks and lists each object once", () => {
    expect(orphanedImages([first, first, "", null, undefined], null)).toEqual([first]);
  });

  it("is empty when the only photo is the one the vehicle still uses", () => {
    expect(orphanedImages([first], first)).toEqual([]);
  });
});
