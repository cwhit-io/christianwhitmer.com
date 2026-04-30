import type { FastifyInstance } from "fastify";

type Check = { method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; url: string };

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  const endpoints: Check[] = [
    { method: 'GET', url: '/' },
    { method: 'GET', url: '/health' },
    { method: 'GET', url: '/posts' },
    { method: 'POST', url: '/posts' },
    { method: 'GET', url: '/posts/non-existent-slug' },
    { method: 'POST', url: '/media' },
    { method: 'GET', url: '/media/test-slug' },
    { method: 'POST', url: '/media/generate' },
    { method: 'POST', url: '/media/generate-and-attach' },
    { method: 'GET', url: '/cms/session' },
    { method: 'POST', url: '/cms/login' },
  ];

  app.get('/status', async (_request, reply) => {
    const results = await Promise.all(
      endpoints.map(async (e) => {
        try {
          const start = Date.now();
          const res = await app.inject({ method: e.method, url: e.url });
          const elapsed = Date.now() - start;

          return {
            method: e.method,
            url: e.url,
            statusCode: res.statusCode,
            ok: res.statusCode >= 200 && res.statusCode < 400,
            protected: res.statusCode === 401,
            timeMs: elapsed,
          };
        } catch (err: unknown) {
          return {
            method: e.method,
            url: e.url,
            ok: false,
            error: (err as Error).message,
          };
        }
      })
    );

    const up = results.filter((r: any) => r.ok).length;
    return reply.code(200).send({ ok: true, total: results.length, up, checks: results });
  });
}
