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
import { createRequire } from "module";
import path from "path";
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

  // ── Static CMS assets (if built) ────────────────────────────────────────
  try {
    const cmsDist = path.join(process.cwd(), "cms", "dist");

    // Only register @fastify/static if the installed plugin's peerDependency
    // for fastify is compatible with the app's fastify version. Some images
    // may install an older plugin that expects Fastify v4 and will throw
    // a plugin version mismatch during registration.
    // Create a `require` function compatible with both ESM and CommonJS
    const getRequire = (): any => {
      // access import.meta.url via eval to avoid TS compile-time use of import.meta
      const importMetaUrl = eval("typeof import !== 'undefined' && typeof import.meta !== 'undefined' ? import.meta.url : undefined");
      if (importMetaUrl) {
        return createRequire(importMetaUrl);
      }
      // @ts-ignore - `require` is available in CommonJS builds
      return require;
    };
    const require: any = getRequire();
    let staticPkg: any = null;
    try {
      staticPkg = require("@fastify/static/package.json");
    } catch (e) {
      // package not present in this environment
    }

    const fastifyRange = staticPkg?.peerDependencies?.fastify;
    if (fastifyRange && /5/.test(String(fastifyRange))) {
      app.register(fastifyStatic, {
        root: cmsDist,
        prefix: "/cms/",
      });

      // History API fallback for SPA routes under /cms
      app.get("/cms/*", (_req, reply) => reply.sendFile("index.html"));
    } else {
      app.log.warn("Skipping @fastify/static registration; incompatible plugin fastify peer dep: %s", String(fastifyRange));
    }
  } catch (err) {
    // ignore if static can't be registered at runtime
    app.log.warn("CMS static serving not enabled: %s", String(err));
  }

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

  // ── Routes ────────────────────────────────────────────────────────────────
  app.register(uiRoutes);
  app.register(cmsAuthRoutes);
  app.register(healthRoutes);
  app.register(postsRoutes);
  app.register(mediaRoutes);

  return app;
}
