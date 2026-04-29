/**
 * config.ts
 *
 * Validates required environment variables at startup and exports a typed
 * config object. The process will exit immediately if any required variable
 * is missing, preventing subtle runtime failures.
 */

import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] FATAL: Required environment variable "${name}" is not set.`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// Read once so we can reuse as JWT secret fallback without a circular reference.
const _apiToken = requireEnv("API_TOKEN");
const _uiPassword = requireEnv("UI_PASSWORD");

export const config = {
  port: parseInt(optionalEnv("PORT", "3000"), 10),

  // Auth
  apiToken: _apiToken,

  // GitHub
  githubToken: requireEnv("GITHUB_TOKEN"),
  githubOwner: requireEnv("GITHUB_OWNER"),
  githubRepo: requireEnv("GITHUB_REPO"),
  githubBranch: optionalEnv("GITHUB_BRANCH", "master"),

  // Post storage — matches existing Worker POSTS_DIR
  postsBasePath: optionalEnv("POSTS_BASE_PATH", "src/content/blog"),

  // Default author for new posts
  defaultAuthor: optionalEnv("DEFAULT_AUTHOR", ""),

  // Media storage
  repoImageBasePath: optionalEnv("REPO_IMAGE_BASE_PATH", "public/images/blog"),
  publicImageBasePath: optionalEnv("PUBLIC_IMAGE_BASE_PATH", "/images/blog"),
  maxMediaBytes: parseInt(optionalEnv("MAX_MEDIA_BYTES", String(2 * 1024 * 1024)), 10),

  // OpenAI
  openaiApiKey: requireEnv("OPENAI_API_KEY"),
  openaiImageModel: optionalEnv("OPENAI_IMAGE_MODEL", "gpt-image-1"),
  defaultImageSize: optionalEnv("DEFAULT_IMAGE_SIZE", "1024x1024"),
  defaultImageQuality: optionalEnv("DEFAULT_IMAGE_QUALITY", "low"),
  defaultImageFormat: optionalEnv("DEFAULT_IMAGE_FORMAT", "webp"),

  // Read protection — set to "true" to require auth on GET /posts and GET /posts/:slug
  protectReads: optionalEnv("PROTECT_READS", "true") === "true",

  // CMS UI auth (username/password for the web dashboard)
  uiUsername: optionalEnv("UI_USERNAME", "admin"),
  uiPassword: _uiPassword,

  // JWT secret for CMS session cookies — defaults to the API token value
  jwtSecret: optionalEnv("JWT_SECRET", _apiToken),
} as const;

export type Config = typeof config;
