/**
 * routes/media.ts
 *
 * Media management endpoints.
 *
 * Migrated from the Cloudflare Worker (api/src/index.ts).
 *
 * Preserved behavior:
 *   - POST /media accepts both `data` (legacy) and `contentBase64` field names.
 *   - POST /media response includes `url`, `markdown`, and `githubUrl` fields.
 *   - GET /media/:postSlug returns 200 with empty array when directory missing.
 *   - DELETE /media/:postSlug/:filename returns 404 JSON when file missing.
 *
 * New endpoints:
 *   - POST /media/generate — generate image with OpenAI, upload to GitHub.
 *   - POST /media/generate-and-attach — generate + attach to post in one call.
 *
 * Note: POST /media now also accepts `contentBase64` in addition to the legacy
 * `data` field so that Custom GPT Actions can use the more descriptive name.
 * The `data` field still works unchanged.
 */

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";
import * as github from "../lib/github.js";
import { parseMarkdown, stringifyMarkdown } from "../lib/frontmatter.js";
import {
  insertImageAtBodyTop,
  insertImageAfterFirstHeading,
} from "../lib/frontmatter.js";
import { generateImageBase64 } from "../lib/openai-images.js";
import {
  sanitizeSlug,
  sanitizeFilename,
  cleanBase64,
  estimateBase64Bytes,
  isAllowedMediaFilename,
  isAllowedMediaType,
  escapeMarkdownAlt,
  sanitizeCommitMessage,
  mediaUploadSchema,
  mediaGenerateSchema,
  generateAndAttachSchema,
  ALLOWED_MEDIA_EXTENSIONS,
  ALLOWED_MEDIA_TYPES,
} from "../lib/validation.js";
import {
  mediaRepoPath,
  mediaPublicUrl,
  mediaRepoDir,
  outputFormatToContentType,
  fileExtension,
  postRepoPath,
} from "../lib/paths.js";
import { decodeBase64ToString } from "../lib/validation.js";

function errorReply(
  reply: Parameters<typeof requireAuth>[1],
  status: number,
  error: string,
  code: string,
  details?: unknown
) {
  return reply.code(status).send({ ok: false, error, code, details });
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /media ────────────────────────────────────────────────────────────
  // Upload a manually supplied image to GitHub.
  app.post(
    "/media",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parseResult = mediaUploadSchema.safeParse(request.body);
      if (!parseResult.success) {
        return errorReply(reply, 400, "Validation failed", "VALIDATION_ERROR", {
          issues: parseResult.error.issues,
        });
      }

      const input = parseResult.data;

      // Accept postSlug or legacy slug alias
      const rawSlug = input.postSlug || input.slug;
      if (!rawSlug) {
        return errorReply(reply, 400, "Missing required field: postSlug", "MISSING_FIELD");
      }

      // Accept contentBase64 or legacy data alias
      const rawBase64 = input.contentBase64 || input.data;
      if (!rawBase64) {
        return errorReply(
          reply,
          400,
          "Missing required field: contentBase64 (or data)",
          "MISSING_FIELD"
        );
      }

      let postSlug: string;
      let filename: string;
      try {
        postSlug = sanitizeSlug(rawSlug);
        filename = sanitizeFilename(input.filename);
      } catch (err: unknown) {
        return errorReply(reply, 400, (err as Error).message, "INVALID_INPUT");
      }

      const contentType = input.contentType.trim().toLowerCase();

      if (!isAllowedMediaFilename(filename)) {
        return errorReply(reply, 400, "Unsupported media file extension", "UNSUPPORTED_EXTENSION", {
          allowedExtensions: ALLOWED_MEDIA_EXTENSIONS,
        });
      }

      if (!isAllowedMediaType(contentType)) {
        return errorReply(reply, 400, "Unsupported media content type", "UNSUPPORTED_CONTENT_TYPE", {
          allowedContentTypes: ALLOWED_MEDIA_TYPES,
        });
      }

      const cleanData = cleanBase64(rawBase64);
      const size = estimateBase64Bytes(cleanData);

      if (size > config.maxMediaBytes) {
        return errorReply(reply, 400, "Media file is too large", "FILE_TOO_LARGE", {
          maxBytes: config.maxMediaBytes,
          receivedBytes: size,
        });
      }

      try {
        const filePath = mediaRepoPath(postSlug, filename);
        const existing = await github.getFile(filePath, false);

        if (existing) {
          return errorReply(reply, 409, "Media file already exists", "MEDIA_EXISTS", {
            postSlug,
            filename,
            path: filePath,
          });
        }

        const result = await github.putFileBase64({
          repoPath: filePath,
          contentBase64: cleanData,
          message: sanitizeCommitMessage(`Upload media: ${postSlug}/${filename}`),
        });

        const publicUrl = mediaPublicUrl(postSlug, filename);
        const altText = escapeMarkdownAlt(input.alt || filename);
        const markdown =
          contentType === "application/pdf"
            ? `[${altText}](${publicUrl})`
            : `![${altText}](${publicUrl})`;

        return reply.code(201).send({
          ok: true,
          action: "uploaded",
          postSlug,
          filename,
          contentType,
          size,
          path: filePath,
          url: publicUrl,
          publicUrl,
          markdown,
          githubUrl: result.content?.html_url,
          sha: result.content?.sha,
          commit: result.commit,
        });
      } catch (err: unknown) {
        app.log.error(err, "POST /media failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── GET /media/:postSlug ───────────────────────────────────────────────────
  // List all media files for a post.
  // NOTE: this route must be registered BEFORE /media/generate to avoid
  // Fastify matching "generate" as a postSlug parameter.
  app.get(
    "/media/:postSlug",
    { preHandler: config.protectReads ? [requireAuth] : [] },
    async (request, reply) => {
      const { postSlug: rawSlug } = request.params as { postSlug: string };

      // "generate" and "generate-and-attach" are reserved route segments
      if (rawSlug === "generate" || rawSlug === "generate-and-attach") {
        return errorReply(reply, 404, "Not found", "NOT_FOUND");
      }

      let postSlug: string;
      try {
        postSlug = sanitizeSlug(rawSlug);
      } catch {
        return errorReply(reply, 400, "Invalid postSlug", "INVALID_SLUG");
      }

      try {
        const dirPath = mediaRepoDir(postSlug);
        const items = await github.listDirectory(dirPath, false);

        if (!items) {
          return reply.code(200).send({
            ok: true,
            postSlug,
            count: 0,
            media: [],
          });
        }

        const media = items
          .filter((item) => item.type === "file")
          .map((item) => {
            const fn = item.name;
            return {
              name: fn,
              filename: fn,
              path: item.path,
              url: mediaPublicUrl(postSlug, fn),
              publicUrl: mediaPublicUrl(postSlug, fn),
              githubUrl: item.html_url,
              size: item.size,
              sha: item.sha,
            };
          })
          .sort((a, b) => a.filename.localeCompare(b.filename));

        return reply.code(200).send({
          ok: true,
          postSlug,
          count: media.length,
          media,
        });
      } catch (err: unknown) {
        app.log.error(err, "GET /media/:postSlug failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── DELETE /media/:postSlug/:filename ──────────────────────────────────────
  app.delete(
    "/media/:postSlug/:filename",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { postSlug: rawSlug, filename: rawFilename } = request.params as {
        postSlug: string;
        filename: string;
      };

      let postSlug: string;
      let filename: string;
      try {
        postSlug = sanitizeSlug(rawSlug);
        filename = sanitizeFilename(decodeURIComponent(rawFilename));
      } catch (err: unknown) {
        return errorReply(reply, 400, (err as Error).message, "INVALID_INPUT");
      }

      try {
        const filePath = mediaRepoPath(postSlug, filename);
        const file = await github.getFile(filePath, false);

        if (!file) {
          return errorReply(reply, 404, "Media file not found", "MEDIA_NOT_FOUND", {
            postSlug,
            filename,
          });
        }

        const result = await github.deleteFile({
          repoPath: filePath,
          message: sanitizeCommitMessage(`Delete media: ${postSlug}/${filename}`),
          sha: file.sha,
        });

        return reply.code(200).send({
          ok: true,
          action: "deleted",
          postSlug,
          filename,
          path: filePath,
          url: mediaPublicUrl(postSlug, filename),
          deleted: true,
          commit: result.commit,
        });
      } catch (err: unknown) {
        app.log.error(err, "DELETE /media/:postSlug/:filename failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── POST /media/generate ───────────────────────────────────────────────────
  // Generate an image with OpenAI, upload to GitHub, return URL only.
  app.post(
    "/media/generate",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parseResult = mediaGenerateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return errorReply(reply, 400, "Validation failed", "VALIDATION_ERROR", {
          issues: parseResult.error.issues,
        });
      }

      const input = parseResult.data;
      const outputFormat = input.outputFormat ?? (config.defaultImageFormat as "png" | "jpeg" | "webp");

      // Validate that the filename extension matches outputFormat
      const ext = fileExtension(input.filename);
      if (ext !== outputFormat && !(outputFormat === "jpeg" && ext === "jpg")) {
        return errorReply(
          reply,
          400,
          `Filename extension ".${ext}" does not match outputFormat "${outputFormat}"`,
          "EXTENSION_MISMATCH"
        );
      }

      let postSlug: string;
      let filename: string;
      try {
        postSlug = sanitizeSlug(input.postSlug);
        filename = sanitizeFilename(input.filename);
      } catch (err: unknown) {
        return errorReply(reply, 400, (err as Error).message, "INVALID_INPUT");
      }

      try {
        const generation = await generateImageBase64({
          prompt: input.prompt,
          size: input.size,
          quality: input.quality,
          outputFormat,
        });

        const bytes = estimateBase64Bytes(generation.b64);

        if (bytes > config.maxMediaBytes) {
          return errorReply(reply, 400, "Generated image exceeds MAX_MEDIA_BYTES", "FILE_TOO_LARGE", {
            maxBytes: config.maxMediaBytes,
            generatedBytes: bytes,
          });
        }

        const filePath = mediaRepoPath(postSlug, filename);

        // Allow overwriting generated images (idempotent re-generate)
        const existing = await github.getFile(filePath, false);

        const result = await github.putFileBase64({
          repoPath: filePath,
          contentBase64: generation.b64,
          message: sanitizeCommitMessage(`Generate media: ${postSlug}/${filename}`),
          sha: existing?.sha,
        });

        const publicUrl = mediaPublicUrl(postSlug, filename);
        const contentType = outputFormatToContentType(outputFormat);

        return reply.code(201).send({
          ok: true,
          path: filePath,
          publicUrl,
          contentType,
          bytes,
          sha: result.content?.sha,
          commit: result.commit,
          generation: {
            model: generation.model,
            size: generation.size,
            quality: generation.quality,
            outputFormat: generation.outputFormat,
            usage: generation.usage,
          },
        });
      } catch (err: unknown) {
        app.log.error(err, "POST /media/generate failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── POST /media/generate-and-attach ───────────────────────────────────────
  // One-call workflow: generate image -> upload -> attach to post frontmatter.
  app.post(
    "/media/generate-and-attach",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parseResult = generateAndAttachSchema.safeParse(request.body);
      if (!parseResult.success) {
        return errorReply(reply, 400, "Validation failed", "VALIDATION_ERROR", {
          issues: parseResult.error.issues,
        });
      }

      const input = parseResult.data;
      const outputFormat = input.outputFormat ?? (config.defaultImageFormat as "png" | "jpeg" | "webp");

      // Validate filename extension
      const ext = fileExtension(input.filename);
      if (ext !== outputFormat && !(outputFormat === "jpeg" && ext === "jpg")) {
        return errorReply(
          reply,
          400,
          `Filename extension ".${ext}" does not match outputFormat "${outputFormat}"`,
          "EXTENSION_MISMATCH"
        );
      }

      let postSlug: string;
      let filename: string;
      try {
        postSlug = sanitizeSlug(input.postSlug);
        filename = sanitizeFilename(input.filename);
      } catch (err: unknown) {
        return errorReply(reply, 400, (err as Error).message, "INVALID_INPUT");
      }

      try {
        // Step 1: Generate image
        const generation = await generateImageBase64({
          prompt: input.prompt,
          size: input.size,
          quality: input.quality,
          outputFormat,
        });

        const bytes = estimateBase64Bytes(generation.b64);

        if (bytes > config.maxMediaBytes) {
          return errorReply(reply, 400, "Generated image exceeds MAX_MEDIA_BYTES", "FILE_TOO_LARGE", {
            maxBytes: config.maxMediaBytes,
            generatedBytes: bytes,
          });
        }

        // Step 2: Upload to GitHub
        const mediaPath = mediaRepoPath(postSlug, filename);
        const existingMedia = await github.getFile(mediaPath, false);

        const mediaResult = await github.putFileBase64({
          repoPath: mediaPath,
          contentBase64: generation.b64,
          message: sanitizeCommitMessage(`Generate media: ${postSlug}/${filename}`),
          sha: existingMedia?.sha,
        });

        const publicUrl = mediaPublicUrl(postSlug, filename);
        const contentType = outputFormatToContentType(outputFormat);

        // Step 3: Attach to post
        const postPath = postRepoPath(postSlug);
        const postFile = await github.getFile(postPath, false);

        let attachResult: { sha?: string; commit?: unknown } = {};

        if (postFile) {
          const currentMarkdown = decodeBase64ToString(postFile.content);
          const current = parseMarkdown(currentMarkdown);
          const { placement = "frontmatter", field = "image", alt } = input;

          let nextFrontmatter = { ...current.frontmatter };
          let nextBody = current.body;

          const imageMarkdown = `![${(alt || filename).replace(/\[|\]/g, "")}](${publicUrl})`;

          if (placement === "frontmatter") {
            nextFrontmatter[field] = publicUrl;
            if (alt) nextFrontmatter["imageAlt"] = alt;
          } else if (placement === "body-top") {
            nextBody = insertImageAtBodyTop(current.body, imageMarkdown);
          } else if (placement === "body-after-first-heading") {
            nextBody = insertImageAfterFirstHeading(current.body, imageMarkdown);
          }

          const markdown = stringifyMarkdown({
            frontmatter: nextFrontmatter,
            body: nextBody,
          });

          const updated = await github.putFileText({
            repoPath: postPath,
            content: markdown,
            message: sanitizeCommitMessage(`Attach media to post: ${postSlug}`),
            sha: postFile.sha,
          });

          attachResult = {
            sha: updated.content?.sha,
            commit: updated.commit,
          };
        }

        return reply.code(201).send({
          ok: true,
          path: mediaPath,
          publicUrl,
          contentType,
          bytes,
          sha: mediaResult.content?.sha,
          commit: mediaResult.commit,
          postAttached: !!postFile,
          attachSha: attachResult.sha,
          attachCommit: attachResult.commit,
          generation: {
            model: generation.model,
            size: generation.size,
            quality: generation.quality,
            outputFormat: generation.outputFormat,
            usage: generation.usage,
          },
        });
      } catch (err: unknown) {
        app.log.error(err, "POST /media/generate-and-attach failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );
}
