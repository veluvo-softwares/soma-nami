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

/** Distances from each edge, as a share of the width or height. */
export interface FrameInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The yellow aiming frame on the camera preview, as a share of the preview's
 * size from each edge (AimingScreen draws it from these).
 */
export const AIM_FRAME: FrameInsets = { top: 0.12, bottom: 0.12, left: 0.08, right: 0.08 };

/**
 * The crop keeps this much more than the frame on each side (as a share of
 * the preview), so a label held just past the yellow line is not cut.
 */
export const FRAME_SLACK = 0.03;

export interface Size {
  width: number;
  height: number;
}

/** A crop rectangle in image pixels, as expo-image-manipulator takes it. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * The part of a camera photo that sat inside the aiming frame on screen.
 *
 * The preview fills its view the way `resizeMode: cover` does: the photo is
 * scaled by the larger of the two view/photo ratios, centred, and whatever
 * spills over is hidden. So a view point (vx, vy) shows photo pixel
 * ((vx + offsetX) / scale, (vy + offsetY) / scale). The frame's corners are
 * mapped that way and clamped to the photo. `image` must be the photo as the
 * user saw it (EXIF rotation applied). Returns null when a size is unknown.
 */
export function frameCrop(image: Size, view: Size, frame: FrameInsets = AIM_FRAME, slack = FRAME_SLACK): CropRect | null {
  if (image.width <= 0 || image.height <= 0 || view.width <= 0 || view.height <= 0) return null;
  // A landscape photo through a portrait preview (phone turned sideways while
  // the app stays portrait) can't be mapped to what the user saw: don't crop.
  if (image.width > image.height !== view.width > view.height) return null;
  const scale = Math.max(view.width / image.width, view.height / image.height);
  const offsetX = (image.width * scale - view.width) / 2;
  const offsetY = (image.height * scale - view.height) / 2;
  // Rounded to a thousandth of a pixel first, so float noise (919.9999999) can't move an edge by a pixel.
  const snap = (v: number) => Math.round(v * 1000) / 1000;
  const toX = (share: number) => snap((share * view.width + offsetX) / scale);
  const toY = (share: number) => snap((share * view.height + offsetY) / scale);

  const x1 = Math.max(0, Math.floor(toX(Math.max(0, frame.left - slack))));
  const y1 = Math.max(0, Math.floor(toY(Math.max(0, frame.top - slack))));
  const x2 = Math.min(image.width, Math.ceil(toX(Math.min(1, 1 - frame.right + slack))));
  const y2 = Math.min(image.height, Math.ceil(toY(Math.min(1, 1 - frame.bottom + slack))));
  if (x2 <= x1 || y2 <= y1) return null;
  return { originX: x1, originY: y1, width: x2 - x1, height: y2 - y1 };
}
