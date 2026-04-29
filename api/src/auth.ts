/**
 * auth.ts
 *
 * Fastify preHandler hook for bearer-token authentication.
 * Used on all mutating endpoints and, when PROTECT_READS=true, on GET endpoints.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "./config.js";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = request.headers.authorization ?? "";
  const expected = `Bearer ${config.apiToken}`;

  if (header !== expected) {
    return reply.code(401).send({
      ok: false,
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }
}
