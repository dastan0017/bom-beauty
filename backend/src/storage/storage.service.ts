import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { Env } from '../config/env';
import { ENV } from '../config/env.module';

export type Bucket = 'public' | 'private';

/**
 * S3-compatible object storage (dev: SeaweedFS, prod: Hetzner Object Storage). Originals live in the private bucket;
 * processed variants and PDFs in the public one, served through MEDIA_PUBLIC_URL.
 */
@Injectable()
export class StorageService {
  readonly client: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    });
  }

  bucket(which: Bucket): string {
    return which === 'public' ? this.env.S3_PUBLIC_BUCKET : this.env.S3_PRIVATE_BUCKET;
  }

  publicUrl(key: string): string {
    return `${this.env.MEDIA_PUBLIC_URL}/${key}`;
  }

  /** Browser upload straight to the private bucket, limited to one key, one content type and a size range. */
  presignUpload(key: string, contentType: string, maxBytes: number, expiresInSeconds = 900) {
    return createPresignedPost(this.client, {
      Bucket: this.bucket('private'),
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: expiresInSeconds,
    });
  }

  async head(which: Bucket, key: string): Promise<{ bytes: number; contentType: string | null } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket(which), Key: key }));
      return { bytes: result.ContentLength ?? 0, contentType: result.ContentType ?? null };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async get(which: Bucket, key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket(which), Key: key }));
    if (!result.Body) throw new Error(`Empty object ${key}`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async put(
    which: Bucket,
    key: string,
    body: Buffer,
    options: { contentType: string; cacheControl?: string; disposition?: string },
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket(which),
        Key: key,
        Body: body,
        ContentType: options.contentType,
        ...(options.cacheControl ? { CacheControl: options.cacheControl } : {}),
        ...(options.disposition ? { ContentDisposition: options.disposition } : {}),
      }),
    );
  }

  async move(from: { bucket: Bucket; key: string }, to: { bucket: Bucket; key: string }): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket(to.bucket),
        Key: to.key,
        CopySource: `${this.bucket(from.bucket)}/${encodeURIComponent(from.key).replace(/%2F/g, '/')}`,
      }),
    );
    await this.delete(from.bucket, from.key);
  }

  async delete(which: Bucket, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket(which), Key: key }));
  }
}

function isNotFound(error: unknown): boolean {
  const meta = (error as { $metadata?: { httpStatusCode?: number }; name?: string }) ?? {};
  return meta.$metadata?.httpStatusCode === 404 || meta.name === 'NotFound' || meta.name === 'NoSuchKey';
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
