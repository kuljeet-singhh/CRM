export const OCR_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const OCR_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/gif',
] as const;

export const OCR_ACCEPT_ATTR = OCR_ACCEPTED_TYPES.join(',');

export function isAcceptedImageType(type: string): boolean {
  return (OCR_ACCEPTED_TYPES as readonly string[]).includes(type);
}

export function validateImageFile(file: File): string | null {
  if (!isAcceptedImageType(file.type)) {
    return 'Unsupported image type. Use JPEG, PNG, WebP, BMP, or GIF.';
  }
  if (file.size > OCR_MAX_FILE_BYTES) {
    return 'File too large (max 10 MB).';
  }
  return null;
}
