export interface Env {
  BLOG_API_TOKEN: string;
  GITHUB_TOKEN: string;

  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  POSTS_DIR: string;
  DEFAULT_AUTHOR: string;
}

type PostInput = {
  title?: unknown;
  description?: unknown;
  body?: unknown;
  author?: unknown;
  date?: unknown;
  tags?: unknown;
  headerImage?: unknown;
  slug?: unknown;
  overwrite?: unknown;
};

type CreatePostPayload = {
  title: string;
  description: string;
  body: string;
  author: string;
  date: string;
  tags?: string[];
  headerImage?: string;
  slug: string;
  overwrite: boolean;
};

type ApiError = {
  error: string;
  details?: unknown;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      }

      const url = new URL(request.url);

      if (url.pathname === "/health" && request.method === "GET") {
        const authResponse = requireAuth(request, env);
        if (authResponse) return authResponse;

        return json({
          ok: true,
          service: "christianwhitmer-blog-api",
          repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          branch: env.GITHUB_BRANCH,
          postsDir: env.POSTS_DIR,
        });
      }

      if (url.pathname === "/posts" && request.method === "POST") {
        const authResponse = requireAuth(request, env);
        if (authResponse) return authResponse;

        return await createPost(request, env);
      }

      return json(
        {
          error: "Not found",
          availableRoutes: ["GET /health", "POST /posts"],
        },
        404,
      );
    } catch (error) {
      return json(
        {
          error: "Internal server error",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
};

async function createPost(request: Request, env: Env): Promise<Response> {
  let rawInput: PostInput;

  try {
    rawInput = await request.json<PostInput>();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const validation = validatePostInput(rawInput, env);

  if ("error" in validation) {
    return json(validation, 400);
  }

  const post = validation;

  const filePath = `${trimSlashes(env.POSTS_DIR)}/${post.slug}.md`;
  const markdown = buildMarkdown(post);

  const existingFile = await getGitHubFile(env, filePath);

  if (existingFile.exists && !post.overwrite) {
    return json(
      {
        error: "Post already exists",
        path: filePath,
        hint: "Use a different slug or send overwrite: true",
      },
      409,
    );
  }

  const commitMessage = existingFile.exists
    ? `Update blog post: ${post.title}`
    : `Add blog post: ${post.title}`;

  const githubResult = await putGitHubFile(env, {
    path: filePath,
    content: markdown,
    message: commitMessage,
    sha: existingFile.sha,
  });

  return json(
    {
      ok: true,
      action: existingFile.exists ? "updated" : "created",
      title: post.title,
      slug: post.slug,
      path: filePath,
      url: `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/blob/${env.GITHUB_BRANCH}/${filePath}`,
      commit: githubResult.commit,
    },
    existingFile.exists ? 200 : 201,
  );
}

function validatePostInput(
  input: PostInput,
  env: Env,
): CreatePostPayload | ApiError {
  const title = asString(input.title);
  const description = asString(input.description);
  const body = asString(input.body);
  const author = asString(input.author) || env.DEFAULT_AUTHOR;
  const date = asDateString(input.date) || todayIsoDate();
  const slug = sanitizeSlug(asString(input.slug) || slugify(title));
  const overwrite = input.overwrite === true;

  if (!title) {
    return { error: "Missing required field: title" };
  }

  if (!description) {
    return { error: "Missing required field: description" };
  }

  if (!body) {
    return { error: "Missing required field: body" };
  }

  if (!author) {
    return { error: "Missing required field: author" };
  }

  if (!slug) {
    return { error: "Could not generate valid slug from title" };
  }

  const tagsResult = parseTags(input.tags);

  if ("error" in tagsResult) {
    return tagsResult;
  }

  const headerImage = asString(input.headerImage);

  return {
    title,
    description,
    body,
    author,
    date,
    tags: tagsResult.tags,
    headerImage: headerImage || undefined,
    slug,
    overwrite,
  };
}

function buildMarkdown(post: CreatePostPayload): string {
  const lines: string[] = [];

  lines.push("---");
  lines.push(`title: ${yamlString(post.title)}`);
  lines.push(`date: ${post.date}`);
  lines.push(`description: ${yamlString(post.description)}`);
  lines.push(`author: ${yamlString(post.author)}`);

  if (post.tags && post.tags.length > 0) {
    lines.push("tags:");
    for (const tag of post.tags) {
      lines.push(`  - ${yamlString(tag)}`);
    }
  }

  if (post.headerImage) {
    lines.push(`headerImage: ${yamlString(post.headerImage)}`);
  }

  lines.push("---");
  lines.push("");
  lines.push(post.body.trim());
  lines.push("");

  return lines.join("\n");
}

async function getGitHubFile(
  env: Env,
  path: string,
): Promise<{ exists: boolean; sha?: string }> {
  const url = githubContentsUrl(env, path);

  const response = await fetch(url, {
    method: "GET",
    headers: githubHeaders(env),
  });

  if (response.status === 404) {
    return { exists: false };
  }

  if (!response.ok) {
    const body = await safeReadJson(response);
    throw new Error(
      `GitHub file lookup failed: ${response.status} ${JSON.stringify(body)}`,
    );
  }

  const data = await response.json<{ sha?: string }>();

  return {
    exists: true,
    sha: data.sha,
  };
}

async function putGitHubFile(
  env: Env,
  options: {
    path: string;
    content: string;
    message: string;
    sha?: string;
  },
): Promise<{ commit?: unknown; content?: unknown }> {
  const url = githubContentsUrl(env, options.path);

  const body: Record<string, unknown> = {
    message: options.message,
    content: toBase64(options.content),
    branch: env.GITHUB_BRANCH,
  };

  if (options.sha) {
    body.sha = options.sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(env),
    body: JSON.stringify(body),
  });

  const data = await safeReadJson(response);

  if (!response.ok) {
    throw new Error(
      `GitHub commit failed: ${response.status} ${JSON.stringify(data)}`,
    );
  }

  return data as { commit?: unknown; content?: unknown };
}

function githubContentsUrl(env: Env, path: string): string {
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodedPath}?ref=${encodeURIComponent(
    env.GITHUB_BRANCH,
  )}`;
}

function githubHeaders(env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "christianwhitmer-blog-api",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function requireAuth(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.BLOG_API_TOKEN}`;

  if (!env.BLOG_API_TOKEN) {
    return json({ error: "BLOG_API_TOKEN is not configured" }, 500);
  }

  if (authHeader !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  return null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...CORS_HEADERS,
    },
  });
}

async function safeReadJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function asString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function asDateString(value: unknown): string | null {
  const raw = asString(value);

  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseTags(value: unknown): { tags?: string[] } | ApiError {
  if (value === undefined || value === null) {
    return {};
  }

  if (!Array.isArray(value)) {
    return { error: "tags must be an array of strings" };
  }

  const tags = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return { tags };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function sanitizeSlug(value: string): string {
  return slugify(value);
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
