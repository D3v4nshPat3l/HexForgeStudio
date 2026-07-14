const BROWSER_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/x-icon", "image/avif"]);

export interface PreviewHandle {
  url: string;
  revoke(): void;
}

export function createNativeImagePreview(file: File): PreviewHandle | null {
  if (!BROWSER_IMAGE_TYPES.has(file.type)) return null;
  const url = URL.createObjectURL(file);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export async function canBrowserDecodeImage(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}
