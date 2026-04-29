/**
 * lib/paths.ts
 *
 * Utilities for constructing file paths and public URLs.
 * All path construction is centralised here to prevent traversal bugs.
 */

import { config } from "../config.js";
import { sanitizeSlug, sanitizeFilename } from "./validation.js";

/** Full repository path for a post file: {postsBasePath}/{slug}.md */
export function postRepoPath(slug: string): string {
  const safeSlug = sanitizeSlug(slug);
  const base = config.postsBasePath.replace(/\/$/, "");
  return `${base}/${safeSlug}.md`;
}

/** Full repository path for a media file: {repoImageBasePath}/{postSlug}/{filename} */
export function mediaRepoPath(postSlug: string, filename: string): string {
  const safeSlug = sanitizeSlug(postSlug);
  const safeFile = sanitizeFilename(filename);
  const base = config.repoImageBasePath.replace(/\/$/, "");
  return `${base}/${safeSlug}/${safeFile}`;
}

/** Public URL for a media file: {publicImageBasePath}/{postSlug}/{filename} */
export function mediaPublicUrl(postSlug: string, filename: string): string {
  const safeSlug = sanitizeSlug(postSlug);
  const safeFile = sanitizeFilename(filename);
  const base = config.publicImageBasePath.replace(/\/$/, "");
  return `${base}/${safeSlug}/${safeFile}`;
}

/** Repository directory path for a post's media: {repoImageBasePath}/{postSlug} */
export function mediaRepoDir(postSlug: string): string {
  const safeSlug = sanitizeSlug(postSlug);
  const base = config.repoImageBasePath.replace(/\/$/, "");
  return `${base}/${safeSlug}`;
}

/** Map an output format string to a MIME content type */
export function outputFormatToContentType(format: string): string {
  const map: Record<string, string> = {
    png: "image/png",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  return map[format.toLowerCase()] ?? "application/octet-stream";
}

/** Extract the extension from a filename (without the dot) */
export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.slice(dot + 1).toLowerCase();
}
