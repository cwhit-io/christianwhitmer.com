/**
 * routes/ui.ts
 *
 * Convenience redirect: GET / → /cms/
 * The React CMS SPA is served from cms/dist via @fastify/static (registered in app.ts).
 */

import type { FastifyInstance } from "fastify";

export async function uiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_request, reply) => reply.redirect("/cms/", 302));
}
