/**
 * lib/r2.ts
 *
 * Cloudflare R2 media storage via the S3-compatible API.
 *
 * R2 is only active when all four required env vars are set:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Falls back to GitHub-based storage when any var is missing.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  if (!config.r2AccountId || !config.r2AccessKeyId || !config.r2SecretAccessKey) {
    throw new Error("R2 is not configured");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
  return _client;
}

/** Returns true when R2 credentials are all present. */
export function isR2Enabled(): boolean {
  return !!(
    config.r2AccountId &&
    config.r2AccessKeyId &&
    config.r2SecretAccessKey &&
    config.r2BucketName
  );
}

/**
 * Upload a binary buffer to R2.
 * @param key    Object key (path within the bucket), e.g. "images/blog/my-post/hero.webp"
 * @param body   Raw file bytes
 * @param contentType  MIME type, e.g. "image/webp"
 * @returns      Public URL using the configured R2_PUBLIC_URL
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.r2BucketName!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  const base = (config.r2PublicUrl ?? "").replace(/\/$/, "");
  return `${base}/${key}`;
}

/**
 * Delete an object from R2.
 * @param key  Object key as used in uploadToR2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.r2BucketName!,
      Key: key,
    })
  );
}
