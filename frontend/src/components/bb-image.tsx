import type { ImageRef } from '@bom/shared';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { pickWidth, srcSet, variantUrl } from '@/lib/media';

interface BbImageProps {
  image: ImageRef | null | undefined;
  /** `sizes` attribute, e.g. "(min-width: 1024px) 360px, 50vw". */
  sizes: string;
  /** Rendered (CSS) width used to pick the fallback `src`. */
  width?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
  /** Shown when there is no image yet (the owner uploads media after launch). */
  placeholder?: ReactNode;
  fit?: 'cover' | 'contain';
}

/**
 * Responsive image from the pre-built AVIF/WebP variants (docs/DATA-MODEL.md §6). A plain `<picture>` instead of
 * next/image: variants already exist in object storage, so there is nothing for an optimiser to do.
 * Fills its positioned parent (`absolute inset-0`).
 */
export function BbImage({
  image,
  sizes,
  width = 640,
  alt,
  className,
  priority = false,
  placeholder,
  fit = 'cover',
}: BbImageProps) {
  if (!image || image.widths.length === 0) {
    return placeholder ? <>{placeholder}</> : null;
  }
  const style: CSSProperties | undefined = image.blurDataUrl
    ? { backgroundImage: `url(${image.blurDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(image, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(image, 'webp')} sizes={sizes} />
      <img
        src={variantUrl(image.id, pickWidth(image, width), 'webp')}
        alt={alt ?? image.alt}
        width={image.width}
        height={image.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        style={style}
        className={cn(
          'absolute inset-0 size-full',
          fit === 'cover' ? 'object-cover' : 'object-contain',
          className,
        )}
      />
    </picture>
  );
}

/** The design's mono "фото" label on an empty product slot. */
export function PhotoPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('font-mono text-[11px] text-muted', className)}>
      {label}
    </span>
  );
}
