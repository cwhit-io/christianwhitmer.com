/**
 * lib/github.ts
 *
 * Reusable client for the GitHub Contents API.
 *
 * All paths passed in must be pre-validated. This module does NOT validate
 * slugs or filenames — callers are responsible for that.
 */

import { config } from "../config.js";
import type {
  GitHubContentFile,
  GitHubContentDirItem,
  GitHubPutResult,
  GitHubDeleteResult,
} from "../types/index.js";

const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "christianwhitmer-blog-api";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
}

/**
 * Build the Contents API URL for a given repository path.
 * The ?ref= param pins reads to the configured branch.
 */
function contentsUrl(repoPath: string): string {
  // Encode each path segment individually so slashes are preserved
  const encodedPath = repoPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const branch = encodeURIComponent(config.githubBranch);
  return `${GITHUB_API_BASE}/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodedPath}?ref=${branch}`;
}

/**
 * Build the Contents API write/delete URL (no ?ref= param — branch goes in body).
 */
function contentsWriteUrl(repoPath: string): string {
  const encodedPath = repoPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${GITHUB_API_BASE}/repos/${config.githubOwner}/${config.githubRepo}/contents/${encodedPath}`;
}

/** Perform a fetch and parse JSON, throwing with context on failure */
async function githubFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<{ status: number; data: T }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...buildHeaders(),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { status: response.status, data: data as T };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve a single file from the repository.
 * Returns null when the file is not found and throwOnMissing is false.
 */
export async function getFile(
  repoPath: string,
  throwOnMissing = true
): Promise<GitHubContentFile | null> {
  const { status, data } = await githubFetch<unknown>(contentsUrl(repoPath));

  if (status === 404) {
    if (!throwOnMissing) return null;
    throw new Error(`GitHub: file not found: ${repoPath}`);
  }

  if (status !== 200) {
    throw new Error(
      `GitHub: failed to get file ${repoPath}: ${status} ${JSON.stringify(data)}`
    );
  }

  const item = data as Record<string, unknown>;
  if (Array.isArray(data) || item["type"] !== "file") {
    throw new Error(`GitHub: path is not a file: ${repoPath}`);
  }

  return data as GitHubContentFile;
}

/**
 * List the contents of a directory.
 * Returns null when the directory is not found and throwOnMissing is false.
 */
export async function listDirectory(
  repoPath: string,
  throwOnMissing = true
): Promise<GitHubContentDirItem[] | null> {
  const { status, data } = await githubFetch<unknown>(contentsUrl(repoPath));

  if (status === 404) {
    if (!throwOnMissing) return null;
    throw new Error(`GitHub: directory not found: ${repoPath}`);
  }

  if (status !== 200) {
    throw new Error(
      `GitHub: failed to list directory ${repoPath}: ${status} ${JSON.stringify(data)}`
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(`GitHub: path is not a directory: ${repoPath}`);
  }

  return data as GitHubContentDirItem[];
}

/**
 * Create or update a text file.
 * Pass sha to update an existing file; omit to create a new one.
 */
export async function putFileText(params: {
  repoPath: string;
  content: string; // raw UTF-8 string
  message: string;
  sha?: string;
}): Promise<GitHubPutResult> {
  const contentBase64 = Buffer.from(params.content, "utf-8").toString("base64");
  return putFileBase64({
    repoPath: params.repoPath,
    contentBase64,
    message: params.message,
    sha: params.sha,
  });
}

/**
 * Create or update a file using a pre-encoded base64 string.
 * This is used for binary media uploads and OpenAI-generated images.
 */
export async function putFileBase64(params: {
  repoPath: string;
  contentBase64: string;
  message: string;
  sha?: string;
}): Promise<GitHubPutResult> {
  const body: Record<string, unknown> = {
    message: params.message,
    content: params.contentBase64,
    branch: config.githubBranch,
  };
  if (params.sha) body["sha"] = params.sha;

  const { status, data } = await githubFetch<GitHubPutResult>(
    contentsWriteUrl(params.repoPath),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (status !== 200 && status !== 201) {
    throw new Error(
      `GitHub: failed to write file ${params.repoPath}: ${status} ${JSON.stringify(data)}`
    );
  }

  return data as GitHubPutResult;
}

/**
 * Delete a file from the repository. The SHA is required by the GitHub API.
 */
export async function deleteFile(params: {
  repoPath: string;
  message: string;
  sha: string;
}): Promise<GitHubDeleteResult> {
  const body = {
    message: params.message,
    sha: params.sha,
    branch: config.githubBranch,
  };

  const { status, data } = await githubFetch<GitHubDeleteResult>(
    contentsWriteUrl(params.repoPath),
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (status !== 200) {
    throw new Error(
      `GitHub: failed to delete file ${params.repoPath}: ${status} ${JSON.stringify(data)}`
    );
  }

  return data as GitHubDeleteResult;
}

/**
 * Convenience: get only the SHA for an existing file.
 * Returns null if the file does not exist.
 */
export async function getFileSha(repoPath: string): Promise<string | null> {
  const file = await getFile(repoPath, false);
  return file ? file.sha : null;
}
