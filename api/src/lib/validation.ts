/**
 * lib/validation.ts
 *
 * Zod schemas and shared validation helpers.
 */

import { z } from "zod";

// ─── Slug ─────────────────────────────────────────────────────────────────────

/** Lowercase alphanumeric + hyphens only */
export const slugSchema = z
  .string()
  .min(1, "Slug must not be empty")
  .max(200, "Slug too long")
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens");

/** Derive a URL-safe slug from a human-readable title */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Sanitize/normalize a slug, throwing if result is empty */
export function sanitizeSlug(value: string): string {
  const slug = slugify(value);
  if (!slug) throw new Error("Invalid slug");
  return slug;
}

// ─── Filename ─────────────────────────────────────────────────────────────────

export const ALLOWED_MEDIA_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".pdf",
] as const;

export const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
] as const;

/** Safe filename: letters, numbers, dots, underscores, hyphens; no slashes or path traversal */
export const filenameSchema = z
  .string()
  .min(1, "Filename must not be empty")
  .max(255, "Filename too long")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Filename must contain only letters, numbers, dots, underscores, and hyphens"
  )
  .refine((f) => !f.includes(".."), "Filename must not contain path traversal")
  .refine(
    (f) => ALLOWED_MEDIA_EXTENSIONS.some((ext) => f.toLowerCase().endsWith(ext)),
    `Unsupported file extension. Allowed: ${ALLOWED_MEDIA_EXTENSIONS.join(", ")}`
  );

/** Sanitize a filename: lowercase, clean characters, preserve extension */
export function sanitizeFilename(value: string): string {
  const lastDot = value.lastIndexOf(".");
  if (lastDot <= 0) throw new Error("Invalid filename: missing extension");

  const basename = value.slice(0, lastDot);
  const extension = value.slice(lastDot + 1);

  const cleanBase = basename
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const cleanExt = extension
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

  if (!cleanBase || !cleanExt) throw new Error("Invalid filename");

  return `${cleanBase}.${cleanExt}`;
}

export function isAllowedMediaFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_MEDIA_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isAllowedMediaType(contentType: string): boolean {
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(contentType);
}

// ─── Base64 ───────────────────────────────────────────────────────────────────

/**
 * Strip data-URL prefix and whitespace from a base64 string.
 * Supports both bare base64 and "data:image/webp;base64,AAAA..." format.
 */
export function cleanBase64(value: string): string {
  const commaIndex = value.indexOf(",");
  if (value.startsWith("data:") && commaIndex !== -1) {
    return value.slice(commaIndex + 1).replace(/\s/g, "");
  }
  return value.replace(/\s/g, "");
}

/** Estimate decoded byte length without allocating a buffer */
export function estimateBase64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Decode a base64 string to a Buffer */
export function decodeBase64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, "base64");
}

/** Decode base64 text (UTF-8) as returned by GitHub Contents API */
export function decodeBase64ToString(value: string): string {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf-8");
}

/** Encode a string to base64 */
export function encodeStringToBase64(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64");
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function escapeMarkdownAlt(value: string): string {
  return value.replace(/\[/g, "").replace(/\]/g, "").trim();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Remove control characters from a commit message */
export function sanitizeCommitMessage(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]/g, " ").trim();
}

// ─── Zod schemas for route bodies ────────────────────────────────────────────

export const postCreateSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().min(1, "description is required"),
  body: z.string().min(1, "body is required"),
  slug: z.string().optional(),
  author: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().optional(),
});

export const postUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().optional(),
  body: z.string().optional(),
  /** Set to a URL to update the featured image; set to "" to remove it. */
  image: z.string().optional(),
});

export const mediaUploadSchema = z.object({
  postSlug: z.string().optional(),
  slug: z.string().optional(), // legacy alias
  filename: z.string().min(1, "filename is required"),
  contentType: z.string().min(1, "contentType is required"),
  // Accept either "data" (legacy Worker field name) or "contentBase64"
  data: z.string().optional(),
  contentBase64: z.string().optional(),
  alt: z.string().optional(),
});

export const mediaGenerateSchema = z.object({
  postSlug: slugSchema,
  filename: z.string().min(1, "filename is required"),
  prompt: z
    .string()
    .min(10, "prompt must be at least 10 characters")
    .max(4000, "prompt is too long"),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).optional(),
  quality: z.enum(["low", "medium", "high", "auto"]).optional(),
  outputFormat: z.enum(["png", "jpeg", "webp"]).optional(),
});

export const attachMediaSchema = z.object({
  filename: z.string().min(1, "filename is required"),
  alt: z.string().optional(),
  placement: z
    .enum(["frontmatter", "body-top", "body-after-first-heading"])
    .default("frontmatter"),
  field: z.string().optional().default("image"),
});

export const generateAndAttachSchema = mediaGenerateSchema.extend({
  alt: z.string().optional(),
  placement: z
    .enum(["frontmatter", "body-top", "body-after-first-heading"])
    .optional()
    .default("frontmatter"),
  field: z.string().optional().default("image"),
});
