export interface Env {
  BLOG_API_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const auth = request.headers.get("Authorization");

    if (auth !== `Bearer ${env.BLOG_API_TOKEN}`) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "christianwhitmer-blog-api",
        repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
        branch: env.GITHUB_BRANCH,
      });
    }

    return Response.json(
      { ok: false, error: "Not found" },
      { status: 404 }
    );
  },
};
