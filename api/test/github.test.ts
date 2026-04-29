/**
 * test/github.test.ts
 *
 * Unit tests for the GitHub client with mocked fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config before importing github module
vi.mock("../src/config.js", () => ({
  config: {
    githubToken: "test-token",
    githubOwner: "test-owner",
    githubRepo: "test-repo",
    githubBranch: "main",
  },
}));

// Import after mock
const github = await import("../src/lib/github.js");

// Helper to create a mock Response
function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("github.getFile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a file when GitHub responds 200", async () => {
    const fakeFile = {
      type: "file",
      name: "hello.md",
      path: "src/content/blog/hello.md",
      sha: "abc123",
      content: Buffer.from("# Hello").toString("base64"),
      html_url: "https://github.com/...",
      encoding: "base64",
      size: 7,
      url: "",
      git_url: "",
      download_url: "",
    };

    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, fakeFile));

    const result = await github.getFile("src/content/blog/hello.md");
    expect(result).not.toBeNull();
    expect(result!.sha).toBe("abc123");
    expect(result!.type).toBe("file");
  });

  it("returns null on 404 when throwOnMissing is false", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(404, { message: "Not Found" }));

    const result = await github.getFile("src/content/blog/missing.md", false);
    expect(result).toBeNull();
  });

  it("throws on 404 when throwOnMissing is true", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(404, { message: "Not Found" }));

    await expect(github.getFile("src/content/blog/missing.md")).rejects.toThrow(
      "file not found"
    );
  });

  it("throws on non-200/non-404 status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(403, { message: "Forbidden" })
    );

    await expect(github.getFile("src/content/blog/secret.md", false)).rejects.toThrow(
      "GitHub: failed to get file"
    );
  });
});

describe("github.listDirectory", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns an array of items on 200", async () => {
    const items = [
      { type: "file", name: "hero.webp", path: "public/images/blog/post/hero.webp", sha: "sha1", size: 1024, url: "", html_url: "", git_url: "", download_url: null },
    ];

    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, items));

    const result = await github.listDirectory("public/images/blog/post", false);
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe("hero.webp");
  });

  it("returns null on 404 when throwOnMissing is false", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(404, { message: "Not Found" }));

    const result = await github.listDirectory("public/images/blog/no-post", false);
    expect(result).toBeNull();
  });
});

describe("github.putFileBase64", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("sends a PUT and returns the result on 201", async () => {
    const fakeResult = {
      content: { name: "hero.webp", path: "public/images/blog/post/hero.webp", sha: "newsha", html_url: "https://..." },
      commit: { sha: "commitsha", html_url: "https://...", message: "Upload media" },
    };

    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(201, fakeResult));

    const result = await github.putFileBase64({
      repoPath: "public/images/blog/post/hero.webp",
      contentBase64: "AAAA",
      message: "Upload media: post/hero.webp",
    });

    expect(result.content?.sha).toBe("newsha");
    expect(result.commit.sha).toBe("commitsha");

    // Verify correct fetch call
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/contents/");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body.content).toBe("AAAA");
    expect(body.branch).toBe("main");
  });
});
