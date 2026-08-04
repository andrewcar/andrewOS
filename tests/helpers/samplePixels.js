import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

/**
 * Sample RGB(A) at normalized (0–1) coordinates in a PNG screenshot.
 * Mirrors hearth's sample_pixels.swift workflow for evidence-based UI checks.
 *
 * @param {string} pngPath
 * @param {{ label?: string, x: number, y: number }[]} points
 * @returns {{ label: string, x: number, y: number, r: number, g: number, b: number, a: number, width: number, height: number }[]}
 */
export function samplePixels(pngPath, points) {
  const png = PNG.sync.read(readFileSync(pngPath));
  const { width, height, data } = png;

  return points.map(({ label = 'point', x, y }) => {
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      throw new Error(`normalized coords out of range: ${label} (${x}, ${y})`);
    }
    const px = Math.min(width - 1, Math.max(0, Math.round(x * (width - 1))));
    const py = Math.min(height - 1, Math.max(0, Math.round(y * (height - 1))));
    const idx = (width * py + px) << 2;
    return {
      label,
      x,
      y,
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3],
      width,
      height,
    };
  });
}

/**
 * Assert sampled RGB is within tolerance of a target hex color (e.g. '#FAF4E8').
 */
export function assertColorNear(sample, hex, tolerance = 12) {
  const target = hexToRgb(hex);
  const dr = Math.abs(sample.r - target.r);
  const dg = Math.abs(sample.g - target.g);
  const db = Math.abs(sample.b - target.b);
  if (dr > tolerance || dg > tolerance || db > tolerance) {
    throw new Error(
      `${sample.label}: expected ~${hex} (±${tolerance}), got rgb(${sample.r},${sample.g},${sample.b})`
    );
  }
}

/**
 * Mean channel variance across samples — used to prove a WebGL frame isn't solid black/blank.
 */
export function pixelVariance(samples) {
  if (!samples.length) throw new Error('pixelVariance requires samples');
  const mean = { r: 0, g: 0, b: 0 };
  for (const s of samples) {
    mean.r += s.r;
    mean.g += s.g;
    mean.b += s.b;
  }
  mean.r /= samples.length;
  mean.g /= samples.length;
  mean.b /= samples.length;
  let sum = 0;
  for (const s of samples) {
    sum += (s.r - mean.r) ** 2 + (s.g - mean.g) ** 2 + (s.b - mean.b) ** 2;
  }
  return sum / samples.length;
}

/**
 * Axis-aligned ink bounds in a PNG (non-near-black / opaque pixels).
 *
 * @param {Buffer|Uint8Array} pngBuffer
 * @param {{ darkMax?: number, alphaMin?: number, x0Norm?: number, x1Norm?: number }} [opts]
 */
export function inkBounds(pngBuffer, opts = {}) {
  const darkMax = opts.darkMax ?? 28;
  const alphaMin = opts.alphaMin ?? 20;
  const png = PNG.sync.read(Buffer.from(pngBuffer));
  const { width, height, data } = png;
  const x0 = Math.max(0, Math.floor((opts.x0Norm ?? 0) * width));
  const x1 = Math.min(width, Math.ceil((opts.x1Norm ?? 1) * width));
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  let inkPixels = 0;

  const isInkAt = (x, y) => {
    if (x < x0 || x >= x1 || y < 0 || y >= height) return false;
    const i = (width * y + x) << 2;
    const a = data[i + 3];
    if (a < alphaMin) return false;
    return data[i] > darkMax || data[i + 1] > darkMax || data[i + 2] > darkMax;
  };

  for (let y = 0; y < height; y++) {
    for (let x = x0; x < x1; x++) {
      if (isInkAt(x, y)) {
        inkPixels += 1;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (bottom < top || right < left) {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      height: 0,
      inkWidth: 0,
      centerY: 0,
      centerX: 0,
      width,
      pngHeight: height,
      inkPixels: 0,
      cornerInk: { tl: false, tr: false, bl: false, br: false },
      looksClipped: false,
    };
  }

  const inkHeight = bottom - top + 1;
  const inkWidth = right - left + 1;
  // Circle AABB corners are empty; a flat clip puts ink in those corners
  const inset = Math.max(1, Math.floor(Math.min(inkWidth, inkHeight) * 0.08));
  const cornerInk = {
    tl: isInkAt(left + inset, top + inset),
    tr: isInkAt(right - inset, top + inset),
    bl: isInkAt(left + inset, bottom - inset),
    br: isInkAt(right - inset, bottom - inset),
  };
  const looksClipped =
    Math.abs(inkWidth - inkHeight) > 4
    || cornerInk.tl
    || cornerInk.tr
    || cornerInk.bl
    || cornerInk.br;

  return {
    top,
    bottom,
    left,
    right,
    height: inkHeight,
    inkWidth,
    centerY: (top + bottom) / 2,
    centerX: (left + right) / 2,
    width,
    pngHeight: height,
    inkPixels,
    cornerInk,
    looksClipped,
  };
}

/** @deprecated prefer inkBounds */
export function inkVerticalBounds(pngBuffer, opts = {}) {
  const b = inkBounds(pngBuffer, opts);
  return {
    top: b.top,
    bottom: b.bottom,
    height: b.height,
    centerY: b.centerY,
    width: b.width,
    pngHeight: b.pngHeight,
    inkPixels: b.inkPixels,
  };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) throw new Error(`invalid hex color: ${hex}`);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
