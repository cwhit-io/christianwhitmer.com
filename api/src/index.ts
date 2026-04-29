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
  title?: string;
  description?: string;
  author?: string;
  date?: string;
  tags?: string[];
  body?: string;
  slug?: string;
  draft?: boolean;
};

type ParsedMarkdown = {
  frontmatter: Record<string, any>;
  body: string;
};

type GitHubContentFile = {
  type: "file";
  encoding: string;
  size: number;
  name: string;
  path: string;
  content: string;
  sha: string;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
};

type GitHubContentDirItem = {
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  name: string;
  path: string;
  sha: string;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

      const authError = authenticate(request, env);
      if (authError) return authError;

      const url = new URL(request.url);
      const path = normalizePath(url.pathname);
      const method = request.method.toUpperCase();

      // GET /health
      if (method === "GET" && path === "/health") {
        return json({
          ok: true,
          service: "christianwhitmer-blog-api",
          repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          branch: env.GITHUB_BRANCH,
          postsDir: env.POSTS_DIR,
        });
      }

      // GET /posts
      if (method === "GET" && path === "/posts") {
        const posts = await listPosts(env);
        return json({
          ok: true,
          count: posts.length,
          posts,
        });
      }

      // POST /posts
      if (method === "POST" && path === "/posts") {
        const input = await readJson<PostInput>(request);

        if (!input.title) {
          return json({ ok: false, error: "Missing required field: title" }, 400);
        }

        if (!input.description) {
          return json({ ok: false, error: "Missing required field: description" }, 400);
        }

        if (!input.body) {
          return json({ ok: false, error: "Missing required field: body" }, 400);
        }

        const slug = sanitizeSlug(input.slug || slugify(input.title));
        const filePath = postPath(env, slug);

        const existing = await getGitHubFile(env, filePath, false);
        if (existing) {
          return json(
            {
              ok: false,
              error: "Post already exists",
              slug,
              path: filePath,
            },
            409
          );
        }

        const markdown = buildMarkdown({
          title: input.title,
          description: input.description,
          author: input.author || env.DEFAULT_AUTHOR,
          date: input.date || today(),
          tags: input.tags || [],
          draft: input.draft ?? false,
          body: input.body,
        });

        const result = await putGitHubFile(env, {
          path: filePath,
          content: markdown,
          message: `Add blog post: ${input.title}`,
        });

        return json(
          {
            ok: true,
            action: "created",
            title: input.title,
            slug,
            path: filePath,
            url: result.content?.html_url,
            commit: result.commit,
          },
          201
        );
      }

      const postMatch = path.match(/^\/posts\/([a-z0-9-]+)$/);
      const publishMatch = path.match(/^\/posts\/([a-z0-9-]+)\/publish$/);

      // GET /posts/:slug
      if (method === "GET" && postMatch) {
        const slug = sanitizeSlug(postMatch[1]);
        const filePath = postPath(env, slug);
        const file = await getGitHubFile(env, filePath, false);

        if (!file) {
          return json({ ok: false, error: "Post not found", slug }, 404);
        }

        const markdown = decodeBase64(file.content);
        const parsed = parseMarkdown(markdown);

        return json({
          ok: true,
          slug,
          path: filePath,
          sha: file.sha,
          url: file.html_url,
          frontmatter: parsed.frontmatter,
          body: parsed.body,
          markdown,
        });
      }

      // PUT /posts/:slug
      if (method === "PUT" && postMatch) {
        const slug = sanitizeSlug(postMatch[1]);
        const filePath = postPath(env, slug);
        const file = await getGitHubFile(env, filePath, false);

        if (!file) {
          return json({ ok: false, error: "Post not found", slug }, 404);
        }

        const input = await readJson<PostInput>(request);
        const currentMarkdown = decodeBase64(file.content);
        const current = parseMarkdown(currentMarkdown);

        const mergedFrontmatter = {
          ...current.frontmatter,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.author !== undefined ? { author: input.author } : {}),
          ...(input.date !== undefined ? { date: input.date } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.draft !== undefined ? { draft: input.draft } : {}),
        };

        const nextBody = input.body !== undefined ? input.body : current.body;

        const markdown = stringifyMarkdown({
          frontmatter: mergedFrontmatter,
          body: nextBody,
        });

        const result = await putGitHubFile(env, {
          path: filePath,
          content: markdown,
          message: `Update blog post: ${mergedFrontmatter.title || slug}`,
          sha: file.sha,
        });

        return json({
          ok: true,
          action: "updated",
          slug,
          path: filePath,
          url: result.content?.html_url,
          commit: result.commit,
        });
      }

      // DELETE /posts/:slug
      if (method === "DELETE" && postMatch) {
        const slug = sanitizeSlug(postMatch[1]);
        const filePath = postPath(env, slug);
        const file = await getGitHubFile(env, filePath, false);

        if (!file) {
          return json({ ok: false, error: "Post not found", slug }, 404);
        }

        const result = await deleteGitHubFile(env, {
          path: filePath,
          message: `Delete blog post: ${slug}`,
          sha: file.sha,
        });

        return json({
          ok: true,
          action: "deleted",
          slug,
          path: filePath,
          commit: result.commit,
        });
      }

      // POST /posts/:slug/publish
      if (method === "POST" && publishMatch) {
        const slug = sanitizeSlug(publishMatch[1]);
        const filePath = postPath(env, slug);
        const file = await getGitHubFile(env, filePath, false);

        if (!file) {
          return json({ ok: false, error: "Post not found", slug }, 404);
        }

        const currentMarkdown = decodeBase64(file.content);
        const current = parseMarkdown(currentMarkdown);

        const nextFrontmatter = {
          ...current.frontmatter,
          draft: false,
        };

        if (!nextFrontmatter.date) {
          nextFrontmatter.date = today();
        }

        const markdown = stringifyMarkdown({
          frontmatter: nextFrontmatter,
          body: current.body,
        });

        const result = await putGitHubFile(env, {
          path: filePath,
          content: markdown,
          message: `Publish blog post: ${nextFrontmatter.title || slug}`,
          sha: file.sha,
        });

        return json({
          ok: true,
          action: "published",
          slug,
          path: filePath,
          url: result.content?.html_url,
          commit: result.commit,
        });
      }

      return json(
        {
          ok: false,
          error: "Not found",
          method,
          path,
        },
        404
      );
    } catch (error: any) {
      return json(
        {
          ok: false,
          error: "Internal server error",
          details: error?.message || String(error),
        },
        500
      );
    }
  },
};

function authenticate(request: Request, env: Env): Response | null {
  const header = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.BLOG_API_TOKEN}`;

  if (!env.BLOG_API_TOKEN) {
    return json({ ok: false, error: "BLOG_API_TOKEN is not configured" }, 500);
  }

  if (header !== expected) {
    return json({ ok: false, error: "Unauthorized" }, 401);
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

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname || "/";
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json<T>();
  } catch {
    throw new Error("Invalid JSON request body");
  }
}

function githubHeaders(env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "christianwhitmer-blog-api",
  };
}

function githubContentsUrl(env: Env, path: string): string {
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const branch = encodeURIComponent(env.GITHUB_BRANCH);

  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodedPath}?ref=${branch}`;
}

async function githubRequest<T>(
  env: Env,
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...githubHeaders(env),
      ...(init.headers || {}),
    },
  });

  const text = await response.text();

  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `GitHub request failed: ${response.status} ${JSON.stringify(data)}`
    );
  }

  return data as T;
}

async function getGitHubFile(
  env: Env,
  path: string,
  throwOnMissing = true
): Promise<GitHubContentFile | null> {
  const response = await fetch(githubContentsUrl(env, path), {
    headers: githubHeaders(env),
  });

  if (response.status === 404 && !throwOnMissing) {
    return null;
  }

  const text = await response.text();

  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      `GitHub file lookup failed: ${response.status} ${JSON.stringify(data)}`
    );
  }

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`GitHub path is not a file: ${path}`);
  }

  return data as GitHubContentFile;
}

async function listPostDirectory(env: Env): Promise<GitHubContentDirItem[]> {
  const url = githubContentsUrl(env, env.POSTS_DIR);
  const data = await githubRequest<GitHubContentDirItem[]>(env, url);

  if (!Array.isArray(data)) {
    throw new Error(`POSTS_DIR is not a directory: ${env.POSTS_DIR}`);
  }

  return data;
}

async function listPosts(env: Env) {
  const items = await listPostDirectory(env);

  const markdownFiles = items.filter(
    (item) => item.type === "file" && item.name.endsWith(".md")
  );

  const posts = await Promise.all(
    markdownFiles.map(async (item) => {
      const file = await getGitHubFile(env, item.path);
      if (!file) return null;

      const markdown = decodeBase64(file.content);
      const parsed = parseMarkdown(markdown);
      const slug = item.name.replace(/\.md$/, "");

      return {
        slug,
        path: item.path,
        sha: file.sha,
        url: file.html_url,
        title: parsed.frontmatter.title || slug,
        description: parsed.frontmatter.description || "",
        author: parsed.frontmatter.author || "",
        date: parsed.frontmatter.date || "",
        tags: parsed.frontmatter.tags || [],
        draft: parsed.frontmatter.draft ?? false,
      };
    })
  );

  return posts
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return dateB.localeCompare(dateA);
    });
}

async function putGitHubFile(
  env: Env,
  params: {
    path: string;
    content: string;
    message: string;
    sha?: string;
  }
): Promise<any> {
  const url = githubContentsUrl(env, params.path).replace(
    `?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`,
    ""
  );

  return githubRequest(env, url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: params.message,
      content: encodeBase64(params.content),
      branch: env.GITHUB_BRANCH,
      ...(params.sha ? { sha: params.sha } : {}),
    }),
  });
}

async function deleteGitHubFile(
  env: Env,
  params: {
    path: string;
    message: string;
    sha: string;
  }
): Promise<any> {
  const url = githubContentsUrl(env, params.path).replace(
    `?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`,
    ""
  );

  return githubRequest(env, url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: params.message,
      sha: params.sha,
      branch: env.GITHUB_BRANCH,
    }),
  });
}

function postPath(env: Env, slug: string): string {
  return `${env.POSTS_DIR.replace(/\/$/, "")}/${slug}.md`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeSlug(value: string): string {
  const slug = slugify(value);

  if (!slug) {
    throw new Error("Invalid slug");
  }

  return slug;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildMarkdown(input: {
  title: string;
  description: string;
  author: string;
  date: string;
  tags: string[];
  draft: boolean;
  body: string;
}): string {
  return stringifyMarkdown({
    frontmatter: {
      title: input.title,
      description: input.description,
      author: input.author,
      date: input.date,
      tags: input.tags,
      draft: input.draft,
    },
    body: input.body,
  });
}

function stringifyMarkdown(input: {
  frontmatter: Record<string, any>;
  body: string;
}): string {
  const lines = ["---"];

  for (const [key, value] of Object.entries(input.frontmatter)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${yamlScalar(item)}`);
      }
      continue;
    }

    lines.push(`${key}: ${yamlScalar(value)}`);
  }

  lines.push("---");
  lines.push("");
  lines.push(input.body.trim());
  lines.push("");

  return lines.join("\n");
}

function yamlScalar(value: any): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);

  const stringValue = String(value);

  // Keep simple YYYY-MM-DD dates unquoted.
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  return JSON.stringify(stringValue);
}

function parseMarkdown(markdown: string): ParsedMarkdown {
  if (!markdown.startsWith("---\n")) {
    return {
      frontmatter: {},
      body: markdown,
    };
  }

  const endIndex = markdown.indexOf("\n---", 4);

  if (endIndex === -1) {
    return {
      frontmatter: {},
      body: markdown,
    };
  }

  const frontmatterText = markdown.slice(4, endIndex).trim();
  const body = markdown.slice(endIndex + 4).replace(/^\n+/, "");

  return {
    frontmatter: parseSimpleYaml(frontmatterText),
    body,
  };
}

function parseSimpleYaml(yaml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yaml.split("\n");

  let currentArrayKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) continue;

    const arrayItemMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayItemMatch && currentArrayKey) {
      result[currentArrayKey].push(parseYamlValue(arrayItemMatch[1]));
      continue;
    }

    const keyValueMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!keyValueMatch) continue;

    const key = keyValueMatch[1];
    const rawValue = keyValueMatch[2];

    if (rawValue === undefined || rawValue === "") {
      result[key] = [];
      currentArrayKey = key;
    } else {
      result[key] = parseYamlValue(rawValue);
      currentArrayKey = null;
    }
  }

  return result;
}

function parseYamlValue(value: string): any {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function decodeBase64(value: string): string {
  const clean = value.replace(/\n/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}
