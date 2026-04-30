/**
 * routes/status.ts
 *
 * GET /status — public endpoint availability summary (no auth required).
 *   Probes each known endpoint via Fastify inject() and reports HTTP status
 *   codes.  "operational" means a < 500 response (including 401 / 404).
 *
 * GET /logs   — authenticated; returns recent request log entries.
 */

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { getEntries } from "../lib/request-log.js";

type Check = { method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"; url: string; label: string };

const ENDPOINTS: Check[] = [
  { method: "GET",  url: "/health",                    label: "Health check"              },
  { method: "GET",  url: "/posts",                     label: "List posts"                },
  { method: "POST", url: "/posts",                     label: "Create post"               },
  { method: "GET",  url: "/posts/__probe__",           label: "Get post"                  },
  { method: "PUT",  url: "/posts/__probe__",           label: "Update post"               },
  { method: "DELETE", url: "/posts/__probe__",         label: "Delete post"               },
  { method: "POST", url: "/posts/__probe__/publish",   label: "Publish post"              },
  { method: "POST", url: "/posts/__probe__/attach-media", label: "Attach media to post"   },
  { method: "POST", url: "/media",                     label: "Upload media"              },
  { method: "GET",  url: "/media/__probe__",           label: "List media"                },
  { method: "DELETE", url: "/media/__probe__/file.jpg", label: "Delete media"             },
  { method: "POST", url: "/media/generate",            label: "Generate image"            },
  { method: "POST", url: "/media/generate-and-attach", label: "Generate & attach image"   },
  { method: "POST", url: "/cms/login",                 label: "CMS login"                 },
  { method: "POST", url: "/cms/logout",                label: "CMS logout"                },
  { method: "GET",  url: "/cms/session",               label: "CMS session"               },
];

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /status ────────────────────────────────────────────────────────────
  app.get("/status", async (_request, reply) => {
    const checks = await Promise.all(
      ENDPOINTS.map(async (e) => {
        try {
          const start = Date.now();
          const res = await app.inject({ method: e.method, url: e.url });
          const timeMs = Date.now() - start;
          const operational = res.statusCode < 500;
          return {
            label: e.label,
            method: e.method,
            url: e.url,
            statusCode: res.statusCode,
            operational,
            protected: res.statusCode === 401,
            timeMs,
          };
        } catch (err: unknown) {
          return {
            label: e.label,
            method: e.method,
            url: e.url,
            statusCode: null,
            operational: false,
            protected: false,
            timeMs: null,
            error: (err as Error).message,
          };
        }
      })
    );

    const operational = checks.filter((c) => c.operational).length;
    return reply.code(200).send({
      ok: true,
      total: checks.length,
      operational,
      down: checks.length - operational,
      checks,
    });
  });

  // ── GET /logs ──────────────────────────────────────────────────────────────
  app.get(
    "/logs",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const raw = (request.query as Record<string, string>)["limit"];
      const limit = raw ? Math.min(parseInt(raw, 10) || 100, 200) : 100;
      return reply.code(200).send({ ok: true, entries: getEntries(limit) });
    }
  );
}

