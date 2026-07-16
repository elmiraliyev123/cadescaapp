export function hostRelativePublicAssetUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.pathname.startsWith("/media/") ? url.pathname : value;
  } catch {
    return value;
  }
}
