/**
 * routes/posts.ts
 *
 * CRUD + publish endpoints for blog posts stored as Markdown files in GitHub.
 *
 * Migrated from the Cloudflare Worker (api/src/index.ts) with the following
 * intentional changes:
 *   - Uses Fastify route params instead of regex matching.
 *   - Uses Zod validation instead of ad-hoc if-checks.
 *   - Auth is applied as a preHandler hook on mutating routes only;
 *     GET reads respect the PROTECT_READS env var.
 *   - Error responses include a machine-readable `code` field.
 *   - New endpoint: POST /posts/:slug/attach-media
 *
 * Preserved:
 *   - Route paths identical to the Worker.
 *   - Response shapes (ok, action, slug, path, url, commit, etc.).
 *   - GitHub behavior: flat .md files under POSTS_BASE_PATH.
 *   - Frontmatter serialization format.
 *   - POST /posts/:slug/publish endpoint.
 *   - PUT merges frontmatter (does not wipe unknown fields).
 */

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { config } from "../config.js";
import * as github from "../lib/github.js";
import { parseMarkdown, stringifyMarkdown, buildMarkdown } from "../lib/frontmatter.js";
import {
  insertImageAtBodyTop,
  insertImageAfterFirstHeading,
} from "../lib/frontmatter.js";
import {
  sanitizeSlug,
  slugify,
  today,
  sanitizeCommitMessage,
  postCreateSchema,
  postUpdateSchema,
  attachMediaSchema,
} from "../lib/validation.js";
import { postRepoPath, mediaPublicUrl } from "../lib/paths.js";
import { decodeBase64ToString } from "../lib/validation.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errorReply(
  reply: Parameters<typeof requireAuth>[1],
  status: number,
  error: string,
  code: string,
  details?: unknown
) {
  return reply.code(status).send({ ok: false, error, code, details });
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export async function postsRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /posts ─────────────────────────────────────────────────────────────
  // List all posts. Protected when PROTECT_READS=true (default).
  app.get(
    "/posts",
    { preHandler: config.protectReads ? [requireAuth] : [] },
    async (_request, reply) => {
      try {
        const postsPath = config.postsBasePath;
        const items = await github.listDirectory(postsPath, true);

        if (!items) {
          return reply.code(200).send({ ok: true, count: 0, posts: [] });
        }

        const markdownFiles = items.filter(
          (item) => item.type === "file" && item.name.endsWith(".md")
        );

        const posts = await Promise.all(
          markdownFiles.map(async (item) => {
            const file = await github.getFile(item.path, false);
            if (!file) return null;

            const markdown = decodeBase64ToString(file.content);
            const parsed = parseMarkdown(markdown);
            const slug = item.name.replace(/\.md$/, "");

            return {
              slug,
              path: item.path,
              sha: file.sha,
              url: file.html_url,
              title: (parsed.frontmatter["title"] as string) || slug,
              description: (parsed.frontmatter["description"] as string) || "",
              author: (parsed.frontmatter["author"] as string) || "",
              date: (parsed.frontmatter["date"] as string) || "",
              tags: (parsed.frontmatter["tags"] as string[]) || [],
              draft: (parsed.frontmatter["draft"] as boolean) ?? false,
            };
          })
        );

        const filtered = posts
          .filter(Boolean)
          .sort((a: any, b: any) =>
            (b.date || "").localeCompare(a.date || "")
          );

        return reply.code(200).send({
          ok: true,
          count: filtered.length,
          posts: filtered,
        });
      } catch (err: unknown) {
        app.log.error(err, "GET /posts failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── POST /posts ────────────────────────────────────────────────────────────
  app.post(
    "/posts",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const parseResult = postCreateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return errorReply(reply, 400, "Validation failed", "VALIDATION_ERROR", {
          issues: parseResult.error.issues,
        });
      }

      const input = parseResult.data;

      let slug: string;
      try {
        slug = sanitizeSlug(input.slug || slugify(input.title));
      } catch {
        return errorReply(reply, 400, "Invalid slug", "INVALID_SLUG");
      }

      const filePath = postRepoPath(slug);

      try {
        const existing = await github.getFile(filePath, false);
        if (existing) {
          return errorReply(reply, 409, "Post already exists", "POST_EXISTS", {
            slug,
            path: filePath,
          });
        }

        const markdown = buildMarkdown({
          title: input.title,
          description: input.description,
          author: input.author || config.defaultAuthor,
          date: input.date || today(),
          tags: input.tags || [],
          draft: input.draft ?? false,
          body: input.body,
        });

        const result = await github.putFileText({
          repoPath: filePath,
          content: markdown,
          message: sanitizeCommitMessage(`Create blog post: ${slug}`),
        });

        return reply.code(201).send({
          ok: true,
          action: "created",
          title: input.title,
          slug,
          path: filePath,
          url: result.content?.html_url,
          commit: result.commit,
        });
      } catch (err: unknown) {
        app.log.error(err, "POST /posts failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── GET /posts/:slug ───────────────────────────────────────────────────────
  app.get(
    "/posts/:slug",
    { preHandler: config.protectReads ? [requireAuth] : [] },
    async (request, reply) => {
      const { slug: rawSlug } = request.params as { slug: string };

      let slug: string;
      try {
        slug = sanitizeSlug(rawSlug);
      } catch {
        return errorReply(reply, 400, "Invalid slug", "INVALID_SLUG");
      }

      try {
        const filePath = postRepoPath(slug);
        const file = await github.getFile(filePath, false);

        if (!file) {
          return errorReply(reply, 404, "Post not found", "POST_NOT_FOUND", { slug });
        }

        const markdown = decodeBase64ToString(file.content);
        const parsed = parseMarkdown(markdown);

        return reply.code(200).send({
          ok: true,
          slug,
          path: filePath,
          sha: file.sha,
          url: file.html_url,
          frontmatter: parsed.frontmatter,
          body: parsed.body,
          markdown,
        });
      } catch (err: unknown) {
        app.log.error(err, "GET /posts/:slug failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── PUT /posts/:slug ───────────────────────────────────────────────────────
  // Merge-update: replaces only the provided fields; preserves others.
  app.put(
    "/posts/:slug",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { slug: rawSlug } = request.params as { slug: string };

      let slug: string;
      try {
        slug = sanitizeSlug(rawSlug);
      } catch {
        return errorReply(reply, 400, "Invalid slug", "INVALID_SLUG");
      }

      const parseResult = postUpdateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return errorReply(reply, 400, "Validation failed", "VALIDATION_ERROR", {
          issues: parseResult.error.issues,
        });
      }

      const input = parseResult.data;

      try {
        const filePath = postRepoPath(slug);
        const file = await github.getFile(filePath, false);

        if (!file) {
          return errorReply(reply, 404, "Post not found", "POST_NOT_FOUND", { slug });
        }

        const currentMarkdown = decodeBase64ToString(file.content);
        const current = parseMarkdown(currentMarkdown);

        const mergedFrontmatter: Record<string, unknown> = {
          ...current.frontmatter,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.author !== undefined ? { author: input.author } : {}),
          ...(input.date !== undefined ? { date: input.date } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.draft !== undefined ? { draft: input.draft } : {}),
        };
        if (input.image !== undefined) {
          if (input.image === "") delete mergedFrontmatter["image"];
          else mergedFrontmatter["image"] = input.image;
        }

        const nextBody = input.body !== undefined ? input.body : current.body;

        const markdown = stringifyMarkdown({
          frontmatter: mergedFrontmatter,
          body: nextBody,
        });

        const result = await github.putFileText({
          repoPath: filePath,
          content: markdown,
          message: sanitizeCommitMessage(
            `Update blog post: ${(mergedFrontmatter["title"] as string) || slug}`
          ),
          sha: file.sha,
        });

        return reply.code(200).send({
          ok: true,
          action: "updated",
          slug,
          path: filePath,
          url: result.content?.html_url,
          commit: result.commit,
        });
      } catch (err: unknown) {
        app.log.error(err, "PUT /posts/:slug failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── PATCH /posts/:slug ─────────────────────────────────────────────────────
  // Same merge semantics as PUT (existing Worker had no PATCH, but we add it
  // here for cleaner semantics). Functionally identical to PUT in this
  // implementation.
  app.patch(
    "/posts/:slug",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Delegate to the same logic as PUT
      const { slug: rawSlug } = request.params as { slug: string };

      let slug: string;
      try {
        slug = sanitizeSlug(rawSlug);
      } catch {
        return errorReply(reply, 400, "Invalid slug", "INVALID_SLUG");
      }

      const parseResult = postUpdateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return errorReply(reply, 400, "Validation failed", "VALIDATION_ERROR", {
          issues: parseResult.error.issues,
        });
      }

      const input = parseResult.data;

      try {
        const filePath = postRepoPath(slug);
        const file = await github.getFile(filePath, false);

        if (!file) {
          return errorReply(reply, 404, "Post not found", "POST_NOT_FOUND", { slug });
        }

        const currentMarkdown = decodeBase64ToString(file.content);
        const current = parseMarkdown(currentMarkdown);

        const mergedFrontmatter: Record<string, unknown> = {
          ...current.frontmatter,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.author !== undefined ? { author: input.author } : {}),
          ...(input.date !== undefined ? { date: input.date } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.draft !== undefined ? { draft: input.draft } : {}),
        };
        if (input.image !== undefined) {
          if (input.image === "") delete mergedFrontmatter["image"];
          else mergedFrontmatter["image"] = input.image;
        }

        const nextBody = input.body !== undefined ? input.body : current.body;

        const markdown = stringifyMarkdown({
          frontmatter: mergedFrontmatter,
          body: nextBody,
        });

        const result = await github.putFileText({
          repoPath: filePath,
          content: markdown,
          message: sanitizeCommitMessage(
            `Update blog post: ${(mergedFrontmatter["title"] as string) || slug}`
          ),
          sha: file.sha,
        });

        return reply.code(200).send({
          ok: true,
          action: "updated",
          slug,
          path: filePath,
          url: result.content?.html_url,
          commit: result.commit,
        });
      } catch (err: unknown) {
        app.log.error(err, "PATCH /posts/:slug failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── DELETE /posts/:slug ────────────────────────────────────────────────────
  app.delete(
    "/posts/:slug",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { slug: rawSlug } = request.params as { slug: string };

      let slug: string;
      try {
        slug = sanitizeSlug(rawSlug);
      } catch {
        return errorReply(reply, 400, "Invalid slug", "INVALID_SLUG");
      }

      try {
        const filePath = postRepoPath(slug);
        const file = await github.getFile(filePath, false);

        if (!file) {
          return errorReply(reply, 404, "Post not found", "POST_NOT_FOUND", { slug });
        }

        const result = await github.deleteFile({
          repoPath: filePath,
          message: sanitizeCommitMessage(`Delete blog post: ${slug}`),
          sha: file.sha,
        });

        return reply.code(200).send({
          ok: true,
          action: "deleted",
          slug,
          path: filePath,
          commit: result.commit,
        });
      } catch (err: unknown) {
        app.log.error(err, "DELETE /posts/:slug failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── POST /posts/:slug/publish ──────────────────────────────────────────────
  // Migrated from the original Worker. Sets draft: false and fills in date.
  app.post(
    "/posts/:slug/publish",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { slug: rawSlug } = request.params as { slug: string };

      let slug: string;
      try {
        slug = sanitizeSlug(rawSlug);
      } catch {
        return errorReply(reply, 400, "Invalid slug", "INVALID_SLUG");
      }

      try {
        const filePath = postRepoPath(slug);
        const file = await github.getFile(filePath, false);

        if (!file) {
          return errorReply(reply, 404, "Post not found", "POST_NOT_FOUND", { slug });
        }

        const currentMarkdown = decodeBase64ToString(file.content);
        const current = parseMarkdown(currentMarkdown);

        const nextFrontmatter: Record<string, unknown> = {
          ...current.frontmatter,
          draft: false,
        };
        if (!nextFrontmatter["date"]) {
          nextFrontmatter["date"] = today();
        }

        const markdown = stringifyMarkdown({
          frontmatter: nextFrontmatter,
          body: current.body,
        });

        const result = await github.putFileText({
          repoPath: filePath,
          content: markdown,
          message: sanitizeCommitMessage(
            `Publish blog post: ${(nextFrontmatter["title"] as string) || slug}`
          ),
          sha: file.sha,
        });

        return reply.code(200).send({
          ok: true,
          action: "published",
          slug,
          path: filePath,
          url: result.content?.html_url,
          commit: result.commit,
        });
      } catch (err: unknown) {
        app.log.error(err, "POST /posts/:slug/publish failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );

  // ── POST /posts/:slug/attach-media ─────────────────────────────────────────
  // New endpoint: attach an already-uploaded image to a post.
  app.post(
    "/posts/:slug/attach-media",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { slug: rawSlug } = request.params as { slug: string };

      let slug: string;
      try {
        slug = sanitizeSlug(rawSlug);
      } catch {
        return errorReply(reply, 400, "Invalid slug", "INVALID_SLUG");
      }

      const parseResult = attachMediaSchema.safeParse(request.body);
      if (!parseResult.success) {
        return errorReply(reply, 400, "Validation failed", "VALIDATION_ERROR", {
          issues: parseResult.error.issues,
        });
      }

      const { filename, alt, placement, field } = parseResult.data;
      const publicUrl = mediaPublicUrl(slug, filename);

      try {
        const filePath = postRepoPath(slug);
        const file = await github.getFile(filePath, false);

        if (!file) {
          return errorReply(reply, 404, "Post not found", "POST_NOT_FOUND", { slug });
        }

        const currentMarkdown = decodeBase64ToString(file.content);
        const current = parseMarkdown(currentMarkdown);

        let nextFrontmatter = { ...current.frontmatter };
        let nextBody = current.body;

        const imageMarkdown = `![${(alt || filename).replace(/\[|\]/g, "")}](${publicUrl})`;

        if (placement === "frontmatter") {
          nextFrontmatter[field] = publicUrl;
          if (alt) {
            nextFrontmatter["imageAlt"] = alt;
          }
        } else if (placement === "body-top") {
          nextBody = insertImageAtBodyTop(current.body, imageMarkdown);
        } else if (placement === "body-after-first-heading") {
          nextBody = insertImageAfterFirstHeading(current.body, imageMarkdown);
        }

        const markdown = stringifyMarkdown({
          frontmatter: nextFrontmatter,
          body: nextBody,
        });

        const result = await github.putFileText({
          repoPath: filePath,
          content: markdown,
          message: sanitizeCommitMessage(`Attach media to post: ${slug}`),
          sha: file.sha,
        });

        return reply.code(200).send({
          ok: true,
          slug,
          publicUrl,
          placement,
          updated: true,
          sha: result.content?.sha,
          commit: result.commit,
        });
      } catch (err: unknown) {
        app.log.error(err, "POST /posts/:slug/attach-media failed");
        return errorReply(reply, 500, "Internal server error", "SERVER_ERROR", {
          details: (err as Error).message,
        });
      }
    }
  );
}
