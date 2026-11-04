export const catalogPhotoLimit = 12;
export const catalogPhotoBytes = 8_388_608;
const imageTypes = new Set([
  "image/avif",
  "image/webp",
  "image/jpeg",
  "image/png",
]);

export function catalogUploadError(
  files: readonly { name: string; size: number; type: string }[],
): string | null {
  if (!files.length) return "Choose at least one image.";
  if (files.length > catalogPhotoLimit)
    return "Upload no more than 12 images at once.";
  for (const file of files) {
    if (!imageTypes.has(file.type))
      return `${file.name}: use an AVIF, WebP, JPEG, or PNG image.`;
    if (!file.size || file.size > catalogPhotoBytes)
      return `${file.name}: choose a nonempty image no larger than 8 MB.`;
  }
  return null;
}
