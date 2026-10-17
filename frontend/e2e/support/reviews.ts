import { request, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';

// Review screenshots for specs that need the home slider: uploaded through the admin API like the owner would
// (presign → storage → complete → worker), then removed again.

const API = process.env.E2E_API_URL ?? 'http://localhost:4000/v1';
const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://localhost:5173';
const OWNER = {
  email: process.env.SEED_OWNER_EMAIL ?? 'owner@bombeauty.kg',
  password: process.env.SEED_OWNER_PASSWORD ?? 'change-me-please',
};

interface Media {
  id: string;
  status: string;
}

async function upload(api: APIRequestContext, csrf: string, colour: string): Promise<string> {
  const body = await sharp({ create: { width: 900, height: 1300, channels: 3, background: colour } })
    .png()
    .toBuffer();
  const presign = await api.post(`${API}/admin/media/presign`, {
    headers: { 'X-CSRF-Token': csrf },
    data: { purpose: 'review', contentType: 'image/png', size: body.length, fileName: 'review.png' },
  });
  const { mediaId, upload: target } = (await presign.json()) as {
    mediaId: string;
    upload: { url: string; fields: Record<string, string> };
  };
  const stored = await api.post(target.url, {
    multipart: { ...target.fields, file: { name: 'review.png', mimeType: 'image/png', buffer: body } },
  });
  if (!stored.ok()) throw new Error(`storage upload failed: ${stored.status()}`);
  await api.post(`${API}/admin/media/${mediaId}/complete`, { headers: { 'X-CSRF-Token': csrf } });
  for (let i = 0; i < 60; i += 1) {
    const media = (await (await api.get(`${API}/admin/media/${mediaId}`)).json()) as Media;
    if (media.status === 'ready') return mediaId;
    if (media.status === 'failed') throw new Error('review image failed to process');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('review image not processed in time');
}

/** Adds `count` reviews; the returned function deletes them. */
export async function addReviews(count: number): Promise<() => Promise<void>> {
  const api = await request.newContext({ extraHTTPHeaders: { Origin: ADMIN } });
  const login = await api.post(`${API}/auth/login`, { data: { ...OWNER, remember: false } });
  if (!login.ok()) throw new Error(`admin login failed: ${login.status()}`);
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const colours = ['#dde3f5', '#cfe8dd', '#f4d6df', '#fbe7c6'];
  const mediaIds: string[] = [];
  for (let i = 0; i < count; i += 1)
    mediaIds.push(await upload(api, csrfToken, colours[i % colours.length] ?? '#ffffff'));
  const created = await api.post(`${API}/admin/reviews`, {
    headers: { 'X-CSRF-Token': csrfToken },
    data: { mediaIds },
  });
  const reviews = (await created.json()) as { id: string; media: { id: string } }[];
  const ids = reviews.filter((review) => mediaIds.includes(review.media.id)).map((review) => review.id);
  return async () => {
    for (const id of ids)
      await api.delete(`${API}/admin/reviews/${id}`, { headers: { 'X-CSRF-Token': csrfToken } });
    await api.dispose();
  };
}
