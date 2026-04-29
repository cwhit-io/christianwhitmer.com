// Shared TypeScript types for the blog API

// ─── GitHub Contents API ─────────────────────────────────────────────────────

export interface GitHubContentFile {
  type: "file";
  encoding: string;
  size: number;
  name: string;
  path: string;
  content: string; // base64-encoded
  sha: string;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
}

export interface GitHubContentDirItem {
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  name: string;
  path: string;
  sha: string;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
}

export interface GitHubPutResult {
  content: {
    name: string;
    path: string;
    sha: string;
    html_url: string;
  } | null;
  commit: {
    sha: string;
    html_url: string;
    message: string;
  };
}

export interface GitHubDeleteResult {
  commit: {
    sha: string;
    html_url: string;
    message: string;
  };
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface PostListItem {
  slug: string;
  path: string;
  sha: string;
  url: string;
  title: string;
  description: string;
  author: string;
  date: string;
  tags: string[];
  draft: boolean;
}

// ─── Media ───────────────────────────────────────────────────────────────────

export interface MediaListItem {
  name: string;
  filename: string;
  path: string;
  url: string;
  publicUrl: string;
  githubUrl: string;
  size: number;
  sha: string;
}

// ─── OpenAI Image Generation ─────────────────────────────────────────────────

export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export type ImageQuality = "low" | "medium" | "high" | "auto";
export type ImageOutputFormat = "png" | "jpeg" | "webp";

export interface GenerateImageInput {
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
  outputFormat?: ImageOutputFormat;
}

export interface GenerateImageResult {
  b64: string;
  model: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

// ─── Error responses ─────────────────────────────────────────────────────────

export interface ApiError {
  ok: false;
  error: string;
  code: string;
  details?: unknown;
}
