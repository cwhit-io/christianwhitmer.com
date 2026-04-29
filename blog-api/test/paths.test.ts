/**
 * test/paths.test.ts
 *
 * Unit tests for path construction utilities.
 * Uses vi.mock to avoid loading config (which requires real env vars).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config before importing paths module
vi.mock("../src/config.js", () => ({
  config: {
    postsBasePath: "src/content/blog",
    repoImageBasePath: "public/images/blog",
    publicImageBasePath: "/images/blog",
    maxMediaBytes: 2097152,
  },
}));

// Import after mock
const { postRepoPath, mediaRepoPath, mediaPublicUrl, mediaRepoDir, outputFormatToContentType, fileExtension } =
  await import("../src/lib/paths.js");

describe("postRepoPath", () => {
  it("builds the correct repository path", () => {
    expect(postRepoPath("my-post")).toBe("src/content/blog/my-post.md");
  });

  it("normalizes slug", () => {
    expect(postRepoPath("My Post")).toBe("src/content/blog/my-post.md");
  });
});

describe("mediaRepoPath", () => {
  it("builds the correct repository path", () => {
    expect(mediaRepoPath("my-post", "hero.webp")).toBe(
      "public/images/blog/my-post/hero.webp"
    );
  });
});

describe("mediaPublicUrl", () => {
  it("builds the correct public URL", () => {
    expect(mediaPublicUrl("my-post", "hero.webp")).toBe(
      "/images/blog/my-post/hero.webp"
    );
  });
});

describe("mediaRepoDir", () => {
  it("builds the correct directory path", () => {
    expect(mediaRepoDir("my-post")).toBe("public/images/blog/my-post");
  });
});

describe("outputFormatToContentType", () => {
  it("maps webp", () => expect(outputFormatToContentType("webp")).toBe("image/webp"));
  it("maps png", () => expect(outputFormatToContentType("png")).toBe("image/png"));
  it("maps jpeg", () => expect(outputFormatToContentType("jpeg")).toBe("image/jpeg"));
  it("maps jpg", () => expect(outputFormatToContentType("jpg")).toBe("image/jpeg"));
  it("falls back for unknown", () =>
    expect(outputFormatToContentType("bin")).toBe("application/octet-stream"));
});

describe("fileExtension", () => {
  it("extracts webp", () => expect(fileExtension("hero.webp")).toBe("webp"));
  it("extracts jpg", () => expect(fileExtension("photo.jpg")).toBe("jpg"));
  it("returns empty for no extension", () => expect(fileExtension("noext")).toBe(""));
});
