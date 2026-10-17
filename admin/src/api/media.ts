import type { AdminMedia, AdminVideo, MediaPurpose } from '@bom/shared';
import { useQuery } from '@tanstack/react-query';
import { Upload } from 'tus-js-client';
import { api, unwrap } from '@/lib/api';
import { keys } from './keys';

// Uploads from the admin (docs/ARCHITECTURE.md §7.5, §7.6).

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Normalises what browsers report for iPhone photos and missing types. */
function contentTypeOf(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'heic' || ext === 'heif') return `image/${ext}`;
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function postForm(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (share: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`));
    xhr.onerror = () => reject(new Error('upload network error'));
    xhr.send(form);
  });
}

/** Photo or PDF: presign → upload to storage → complete → wait until processed (or failed). */
export async function uploadMedia(
  file: File,
  purpose: MediaPurpose,
  onProgress: (share: number) => void = () => undefined,
): Promise<AdminMedia> {
  const presign = await unwrap(
    api.POST('/v1/admin/media/presign', {
      body: { purpose, contentType: contentTypeOf(file), size: file.size, fileName: file.name },
    }),
  );
  await postForm(presign.upload.url, presign.upload.fields, file, onProgress);
  let media = await unwrap(
    api.POST('/v1/admin/media/{id}/complete', { params: { path: { id: presign.mediaId } } }),
  );
  for (let i = 0; i < 120 && media.status !== 'ready' && media.status !== 'failed'; i += 1) {
    await sleep(1000);
    media = await unwrap(api.GET('/v1/admin/media/{id}', { params: { path: { id: presign.mediaId } } }));
  }
  return media;
}

/** Video: Bunny Stream video + signed TUS upload straight from the browser. Processing continues on Bunny. */
export async function uploadVideo(
  file: File,
  title: string,
  onProgress: (share: number) => void = () => undefined,
): Promise<AdminVideo> {
  const created = await unwrap(
    api.POST('/v1/admin/videos', { body: { title, fileName: file.name, size: file.size } }),
  );
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: created.tus.endpoint,
      retryDelays: [0, 3000, 10000, 30000],
      headers: created.tus.headers,
      metadata: { filetype: file.type || 'video/mp4', title },
      onProgress: (sent, total) => onProgress(total ? sent / total : 0),
      onSuccess: () => resolve(),
      onError: (error) => reject(error),
    });
    upload.start();
  });
  return created.video;
}

const getMedia = (id: string) => unwrap(api.GET('/v1/admin/media/{id}', { params: { path: { id } } }));
const getVideo = (id: string) => unwrap(api.GET('/v1/admin/videos/{id}', { params: { path: { id } } }));

/** A file referenced by id only (settings), e.g. the share image. */
export function useMedia(id: string | null) {
  return useQuery({
    queryKey: keys.media(id ?? ''),
    queryFn: () => getMedia(id ?? ''),
    enabled: Boolean(id),
  });
}

const settled = (video: AdminVideo) => video.status === 'ready' || video.status === 'failed';

/** The video as it is now: re-read every 10 s while Bunny is still encoding it. */
export function useVideoStatus(video: AdminVideo | null): AdminVideo | null {
  const live = useQuery({
    queryKey: keys.video(video?.id ?? ''),
    queryFn: () => getVideo(video?.id ?? ''),
    enabled: Boolean(video && !settled(video)),
    refetchInterval: (query) => (query.state.data && settled(query.state.data) ? false : 10_000),
  });
  return video && live.data?.id === video.id ? live.data : video;
}
