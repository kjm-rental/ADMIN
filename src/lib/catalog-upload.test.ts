import { expect, it } from "vitest";
import config from "../../next.config";
import {
  catalogUploadError,
  catalogPhotoBytes,
  catalogPhotoLimit,
} from "./catalog-upload";

const photo = {
  name: "motorcycle.jpg",
  type: "image/jpeg",
  size: 2 * 1024 * 1024,
};
it("accepts a normal photograph larger than the old 1 MB request limit", () => {
  expect(catalogUploadError([photo])).toBeNull();
});
it("allows the documented twelve 8 MiB photos with room for multipart overhead", () => {
  expect(
    catalogUploadError(
      Array.from({ length: catalogPhotoLimit }, () => ({
        ...photo,
        size: catalogPhotoBytes,
      })),
    ),
  ).toBeNull();
  expect(config.experimental?.serverActions).toEqual({
    bodySizeLimit: "100mb",
  });
  expect(100 * 1024 * 1024).toBeGreaterThan(
    catalogPhotoLimit * catalogPhotoBytes + 65536,
  );
});
it("rejects oversized or unsupported files with a clear filename-specific message", () => {
  expect(
    catalogUploadError([{ ...photo, size: catalogPhotoBytes + 1 }]),
  ).toContain("motorcycle.jpg: choose a nonempty image no larger than 8 MB");
  expect(catalogUploadError([{ ...photo, type: "application/pdf" }])).toContain(
    "use an AVIF, WebP, JPEG, or PNG",
  );
});
it("rejects empty selections, zero-byte files and excess file counts", () => {
  expect(catalogUploadError([])).toContain("Choose at least one");
  expect(catalogUploadError([{ ...photo, size: 0 }])).toContain("nonempty");
  expect(catalogUploadError(Array.from({ length: 13 }, () => photo))).toContain(
    "no more than 12",
  );
});
