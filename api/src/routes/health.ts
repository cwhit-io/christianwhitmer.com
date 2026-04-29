/**
 * routes/health.ts
 *
 * GET /health — public liveness check.
 *
 * In the original Cloudflare Worker, health required auth.
 * Here health is intentionally public so load balancers and monitoring
 * tools can probe it without credentials.
 */

import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    return reply.code(200).send({
      ok: true,
      service: "christianwhitmer-blog-api",
      repo: `${config.githubOwner}/${config.githubRepo}`,
      branch: config.githubBranch,
      postsDir: config.postsBasePath,
      mediaBaseDir: config.repoImageBasePath,
      mediaPublicBase: config.publicImageBasePath,
      maxMediaBytes: config.maxMediaBytes,
    });
  });
}
