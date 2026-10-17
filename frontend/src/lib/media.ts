import type { ImageRef } from '@bom/shared';

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL ?? '';

/** Pre-built variant URL (docs/DATA-MODEL.md §6). */
export function variantUrl(id: string, width: number, format: 'avif' | 'webp'): string {
  return `${MEDIA_URL}/p/${id}/${width}.${format}`;
}

/** JPEG copy (≤ 1200 px) made for share cards. */
export function shareUrl(id: string): string {
  return `${MEDIA_URL}/p/${id}/share.jpg`;
}

export function srcSet(image: ImageRef, format: 'avif' | 'webp'): string {
  return image.widths.map((width) => `${variantUrl(image.id, width, format)} ${width}w`).join(', ');
}

/** Smallest variant at least `target` px wide (or the largest one). */
export function pickWidth(image: ImageRef, target: number): number {
  const sorted = [...image.widths].sort((a, b) => a - b);
  return sorted.find((width) => width >= target) ?? sorted[sorted.length - 1] ?? target;
}
