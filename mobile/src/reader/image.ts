/**
 * The C2 spike measured OCR's peak memory by input size: a full 4032 x 3024
 * iPhone photo would blow far past the iPhone 12's budget, and a long side of
 * about 1280 px read as well as the original. Photos are shrunk to this first.
 */
export const OCR_MAX_SIDE = 1280;

/** Target size that fits `maxSide` on the long side, keeping the aspect; never enlarges. */
export function fitLongSide(width: number, height: number, maxSide = OCR_MAX_SIDE) {
  const long = Math.max(width, height);
  if (long <= maxSide || long <= 0) return { width, height, resized: false };
  const scale = maxSide / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale), resized: true };
}

/** QVAC takes a plain file path; camera and picker hand back file:// URIs. */
export function uriToPath(uri: string): string {
  return uri.startsWith('file://') ? decodeURIComponent(uri.slice('file://'.length)) : uri;
}
