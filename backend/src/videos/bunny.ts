import { createHash } from 'node:crypto';

/** TUS upload signature for Bunny Stream: sha256(libraryId + apiKey + expiration + videoId). */
export function bunnyTusSignature(
  libraryId: string,
  apiKey: string,
  expiresAt: number,
  videoId: string,
): string {
  return createHash('sha256').update(`${libraryId}${apiKey}${expiresAt}${videoId}`).digest('hex');
}

/** Bunny Stream video status codes. */
export const BUNNY_STATUS = {
  created: 0,
  uploaded: 1,
  processing: 2,
  transcoding: 3,
  finished: 4,
  error: 5,
  uploadFailed: 6,
} as const;

export interface BunnyVideo {
  guid: string;
  status: number;
  length: number;
  width: number;
  height: number;
  thumbnailFileName: string | null;
  availableResolutions: string | null;
  storageSize?: number;
}
