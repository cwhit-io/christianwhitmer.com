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
import { healthRoutes } from "./routes/health.js";
import { postsRoutes } from "./routes/posts.js";
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
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(error.statusCode ?? 500).send({
      ok: false,
      error: error.message || "Internal server error",
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

  // ── Routes ────────────────────────────────────────────────────────────────
  app.register(uiRoutes);
  app.register(cmsAuthRoutes);
  app.register(healthRoutes);
  app.register(postsRoutes);
  app.register(mediaRoutes);

  return app;
}
