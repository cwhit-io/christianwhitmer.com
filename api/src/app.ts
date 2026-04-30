/**
 * app.ts
 *
 * Fastify application factory. Registers plugins and routes.
 * Kept separate from server.ts so the app can be imported in tests.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import path from "path";
import { healthRoutes } from "./routes/health.js";
import { statusRoutes } from "./routes/status.js";
import { postsRoutes } from "./routes/posts.js";
import { pushEntry } from "./lib/request-log.js";
import { mediaRoutes } from "./routes/media.js";
import { uiRoutes } from "./routes/ui.js";
import { cmsAuthRoutes } from "./routes/cms-auth.js";
import { config } from "./config.js";

export function buildApp(opts: { logger?: boolean | object } = {}) {
  const app = Fastify({
    logger: opts.logger ?? {
      level: process.env["LOG_LEVEL"] ?? "info",
      transport:
        process.env["NODE_ENV"] !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ── CORS ──────────────────────────────────────────────────────────────────
  // Allow any origin by default. Restrict with CORS_ORIGIN env var if needed.
  app.register(cors, {
    origin: process.env["CORS_ORIGIN"] ?? "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  // ── JWT + Cookie (for CMS dashboard sessions) ─────────────────────────────
  app.register(fastifyJwt, { secret: config.jwtSecret });
  app.register(fastifyCookie);

  // ── Global error handler ──────────────────────────────────────────────────
  app.setErrorHandler((error: any, _request, reply) => {
    app.log.error(error);
    const status = error && (error.statusCode ?? error.status) ? (error.statusCode ?? error.status) : 500;
    const message = (error && (error.message || error.msg)) || "Internal server error";
    reply.code(status).send({
      ok: false,
      error: message,
      code: "SERVER_ERROR",
    });
  });

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      ok: false,
      error: "Not found",
      code: "NOT_FOUND",
    });
  });

  // ── Request logging ───────────────────────────────────────────────────────
  // Skip monitoring endpoints to avoid noise in the log.
  const SKIP_LOG = new Set(["/status", "/logs"]);
  app.addHook("onResponse", (request, reply, done) => {
    if (!SKIP_LOG.has(request.routeOptions?.url ?? request.url)) {
      pushEntry({
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: Math.round(reply.elapsedTime ?? 0),
      });
    }
    done();
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  // Serve React CMS SPA from cms/dist at /cms/
  app.register(fastifyStatic, {
    root: path.join(__dirname, "..", "cms", "dist"),
    prefix: "/cms/",
    decorateReply: false,
  });

  app.register(uiRoutes);
  app.register(cmsAuthRoutes);
  app.register(statusRoutes);
  app.register(healthRoutes);
  app.register(postsRoutes);
  app.register(mediaRoutes);

  return app;
}
