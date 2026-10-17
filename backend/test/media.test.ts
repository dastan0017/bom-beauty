import { HeadObjectCommand } from '@aws-sdk/client-s3';
import type { AdminMedia, ErrorResponse, PresignMediaResponse } from '@bom/shared';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { variantWidths } from '../src/media/media-pipeline.service';
import { StorageService } from '../src/storage/storage.service';
import { createTestApp, loginAs, request, type AdminClient, type TestContext } from './app';

describe('media uploads and processing', () => {
  let ctx: TestContext;
  let owner: AdminClient;
  let storage: StorageService;
  const api = (path: string) => ctx.url(`/v1/admin${path}`);

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx);
    storage = ctx.app.get(StorageService);
  });
  afterAll(() => ctx.close());

  /** The admin's upload flow: presign → browser form POST to S3 → complete → wait for the worker. */
  async function upload(
    purpose: string,
    body: Buffer,
    contentType: string,
    fileName: string,
  ): Promise<AdminMedia> {
    const presign = await request<PresignMediaResponse>(api('/media/presign'), {
      method: 'POST',
      headers: owner.write,
      json: { purpose, contentType, size: body.length, fileName },
    });
    expect(presign.status).toBe(200);
    const form = new FormData();
    for (const [key, value] of Object.entries(presign.body.upload.fields)) form.append(key, value);
    form.append('file', new Blob([new Uint8Array(body)], { type: contentType }));
    const stored = await fetch(presign.body.upload.url, { method: 'POST', body: form });
    expect(stored.status).toBe(204);

    const completed = await request<AdminMedia>(api(`/media/${presign.body.mediaId}/complete`), {
      method: 'POST',
      headers: owner.write,
    });
    expect(completed.status).toBe(200);
    const deadline = Date.now() + 30_000;
    for (;;) {
      const current = await request<AdminMedia>(api(`/media/${presign.body.mediaId}`), {
        headers: owner.read,
      });
      if (current.body.status === 'ready' || current.body.status === 'failed') return current.body;
      if (Date.now() > deadline) throw new Error(`media stuck in ${current.body.status}`);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  it('never upscales variants', () => {
    expect(variantWidths(800)).toEqual([320, 640, 800]);
    expect(variantWidths(4000)).toEqual([320, 640, 960, 1280, 1920]);
    expect(variantWidths(200)).toEqual([200]);
  });

  it('turns a photo into upright AVIF/WebP variants without EXIF or GPS, keeping the original privately', async () => {
    // 2000×1200 stored sideways (orientation 6), with camera and GPS metadata.
    const photo = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#d12f63' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({
        IFD0: { Copyright: 'Client camera' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '42/1 52/1 0/1' },
      })
      .toBuffer();
    const exif = (await sharp(photo).metadata()).exif;
    // 0x8825 is the GPSInfo pointer (little-endian in sharp's output).
    expect(exif?.includes(Buffer.from([0x25, 0x88]))).toBe(true);
    expect(exif?.toString('latin1')).toContain('Client camera');

    const media = await upload('product', photo, 'image/jpeg', 'фото.jpg');
    expect(media.status).toBe('ready');
    expect(media.image).toMatchObject({ width: 1200, height: 2000, widths: [320, 640, 960, 1200] });
    expect(media.image?.blurDataUrl).toMatch(/^data:image\/webp;base64,/);

    for (const format of ['avif', 'webp'] as const) {
      const variant = await storage.get('public', `p/${media.id}/640.${format}`);
      const meta = await sharp(variant).metadata();
      expect(meta.width).toBe(640);
      expect(meta.exif).toBeUndefined();
    }
    const share = await sharp(await storage.get('public', `p/${media.id}/share.jpg`)).metadata();
    expect(share).toMatchObject({ format: 'jpeg', width: 1200 });
    expect(share.exif).toBeUndefined();
    const head = await storage.client.send(
      new HeadObjectCommand({ Bucket: storage.bucket('public'), Key: `p/${media.id}/320.webp` }),
    );
    expect(head.CacheControl).toBe('public, max-age=31536000, immutable');
    expect(await storage.head('private', `orig/${media.id}`)).not.toBeNull();
    expect(await storage.head('private', `incoming/${media.id}`)).toBeNull();
  });

  it('publishes PDFs as downloads and rejects files that are not PDFs', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
    const protocol = await upload('protocol', pdf, 'application/pdf', 'Протокол ухода.pdf');
    expect(protocol.status).toBe('ready');
    expect(protocol.file?.name).toBe('Протокол ухода.pdf');
    expect(protocol.file?.url).toMatch(new RegExp(`/d/${protocol.id}/protokol-uhoda\\.pdf$`));
    const head = await storage.client.send(
      new HeadObjectCommand({ Bucket: storage.bucket('public'), Key: `d/${protocol.id}/protokol-uhoda.pdf` }),
    );
    expect(head.ContentDisposition).toContain('attachment');

    const fake = await upload(
      'catalog',
      Buffer.from('<html>не pdf</html>'),
      'application/pdf',
      'catalog.pdf',
    );
    expect(fake.status).toBe('failed');
  });

  it('checks type and size before handing out an upload', async () => {
    const wrongType = await request<ErrorResponse>(api('/media/presign'), {
      method: 'POST',
      headers: owner.write,
      json: { purpose: 'protocol', contentType: 'image/png', size: 100, fileName: 'x.png' },
    });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.error.fields).toEqual({ contentType: 'media.pdf_only' });
    const tooBig = await request<ErrorResponse>(api('/media/presign'), {
      method: 'POST',
      headers: owner.write,
      json: { purpose: 'review', contentType: 'image/png', size: 16 * 1024 * 1024, fileName: 'x.png' },
    });
    expect(tooBig.body.error.fields).toEqual({ size: 'media.image_too_big' });
    const notUploaded = await request<PresignMediaResponse>(api('/media/presign'), {
      method: 'POST',
      headers: owner.write,
      json: { purpose: 'review', contentType: 'image/png', size: 100, fileName: 'x.png' },
    });
    const complete = await request<ErrorResponse>(api(`/media/${notUploaded.body.mediaId}/complete`), {
      method: 'POST',
      headers: owner.write,
    });
    expect(complete.body.error.fields).toEqual({ id: 'media.not_uploaded' });
  });
});
