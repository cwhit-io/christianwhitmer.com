/**
 * routes/cms-auth.ts
 *
 * Session endpoints for the CMS web dashboard.
 *
 *   POST /cms/login    — validate UI credentials, set httpOnly JWT cookie
 *   POST /cms/logout   — clear session cookie
 *   GET  /cms/session  — verify cookie, return blog API token for SPA use
 *
 * The JWT cookie is httpOnly and SameSite=Lax so it is never accessible to JS
 * and cannot be sent by cross-origin forms. The blog API token is returned only
 * to authenticated callers on the /cms/session route.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { timingSafeEqual } from "crypto";
import "@fastify/jwt";
import { config } from "../config.js";

// ── Timing-safe string comparison ─────────────────────────────────────────────

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// ── Middleware: verify CMS session cookie ─────────────────────────────────────

export async function requireCmsSession(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = (request.cookies as Record<string, string | undefined>)["cms_sess"];
  if (!token) {
    return reply.code(401).send({ ok: false, error: "Not authenticated", code: "UNAUTHENTICATED" });
  }
  try {
    request.server.jwt.verify(token);
  } catch {
    return reply.code(401).send({ ok: false, error: "Session expired or invalid", code: "SESSION_EXPIRED" });
  }
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function cmsAuthRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /cms/login ────────────────────────────────────────────────────────
  app.post<{ Body: Record<string, unknown> }>("/cms/login", async (request, reply) => {
    const body = request.body ?? {};
    const username = typeof body["username"] === "string" ? body["username"] : "";
    const password = typeof body["password"] === "string" ? body["password"] : "";

    // Always do both comparisons to prevent timing leaks
    const validUser = config.uiUsername.length > 0 && safeEqual(username, config.uiUsername);
    const validPass = config.uiPassword.length > 0 && safeEqual(password, config.uiPassword);

    if (!validUser || !validPass) {
      // Fixed delay to blunt brute-force timing attacks
      await new Promise<void>((r) => setTimeout(r, 400));
      return reply.code(401).send({ ok: false, error: "Invalid credentials", code: "UNAUTHORIZED" });
    }

    const token = app.jwt.sign({ sub: username }, { expiresIn: "24h" });

    reply.setCookie("cms_sess", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
      secure: process.env["NODE_ENV"] === "production",
    });

    return reply.code(200).send({ ok: true });
  });

  // ── POST /cms/logout ───────────────────────────────────────────────────────
  app.post("/cms/logout", async (_request, reply) => {
    reply.clearCookie("cms_sess", { path: "/" });
    return reply.code(200).send({ ok: true });
  });

  // ── GET /cms/session ───────────────────────────────────────────────────────
  // Returns the blog API token to the authenticated SPA so it never has to
  // store or know the token in advance. Stored in sessionStorage (not
  // localStorage) — cleared when the browser tab is closed.
  app.get("/cms/session", { preHandler: [requireCmsSession] }, async (_request, reply) => {
    return reply.code(200).send({
      ok: true,
      username: config.uiUsername,
      token: config.apiToken,
    });
  });
}
