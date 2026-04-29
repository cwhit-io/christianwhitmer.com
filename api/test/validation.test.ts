/**
 * test/validation.test.ts
 *
 * Unit tests for slug/filename/base64 validation utilities.
 */

import { describe, it, expect } from "vitest";
import {
  slugify,
  sanitizeSlug,
  sanitizeFilename,
  isAllowedMediaFilename,
  isAllowedMediaType,
  cleanBase64,
  estimateBase64Bytes,
  escapeMarkdownAlt,
  today,
} from "../src/lib/validation.js";

// ─── slugify ─────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });

  it("collapses consecutive non-slug chars into a single hyphen", () => {
    expect(slugify("Hello, World! 123")).toBe("hello-world-123");
  });

  it("strips quotes", () => {
    expect(slugify(`"It's a Test"`)).toBe("its-a-test");
  });

  it("returns empty string for all-special input", () => {
    expect(slugify("---!!!---")).toBe("");
  });
});

// ─── sanitizeSlug ─────────────────────────────────────────────────────────────

describe("sanitizeSlug", () => {
  it("returns a valid slug unchanged", () => {
    expect(sanitizeSlug("my-post")).toBe("my-post");
  });

  it("normalises a valid title", () => {
    expect(sanitizeSlug("My Blog Post")).toBe("my-blog-post");
  });

  it("throws on empty input", () => {
    expect(() => sanitizeSlug("")).toThrow("Invalid slug");
  });

  it("throws on all-special input", () => {
    expect(() => sanitizeSlug("!!!")).toThrow("Invalid slug");
  });
});

// ─── sanitizeFilename ─────────────────────────────────────────────────────────

describe("sanitizeFilename", () => {
  it("normalises a typical filename", () => {
    expect(sanitizeFilename("Hero Image.webp")).toBe("hero-image.webp");
  });

  it("preserves valid filenames", () => {
    expect(sanitizeFilename("hero.webp")).toBe("hero.webp");
  });

  it("lowercases extension", () => {
    expect(sanitizeFilename("photo.JPG")).toBe("photo.jpg");
  });

  it("throws on filenames without an extension", () => {
    expect(() => sanitizeFilename("noextension")).toThrow();
  });

  it("throws on filenames with only an extension", () => {
    expect(() => sanitizeFilename(".webp")).toThrow();
  });
});

// ─── isAllowedMediaFilename ───────────────────────────────────────────────────

describe("isAllowedMediaFilename", () => {
  it("allows .webp", () => expect(isAllowedMediaFilename("hero.webp")).toBe(true));
  it("allows .jpg", () => expect(isAllowedMediaFilename("photo.jpg")).toBe(true));
  it("allows .jpeg", () => expect(isAllowedMediaFilename("photo.jpeg")).toBe(true));
  it("allows .png", () => expect(isAllowedMediaFilename("image.png")).toBe(true));
  it("allows .gif", () => expect(isAllowedMediaFilename("anim.gif")).toBe(true));
  it("allows .svg", () => expect(isAllowedMediaFilename("icon.svg")).toBe(true));
  it("allows .pdf", () => expect(isAllowedMediaFilename("doc.pdf")).toBe(true));
  it("rejects .exe", () => expect(isAllowedMediaFilename("virus.exe")).toBe(false));
  it("rejects .sh", () => expect(isAllowedMediaFilename("script.sh")).toBe(false));
});

// ─── isAllowedMediaType ───────────────────────────────────────────────────────

describe("isAllowedMediaType", () => {
  it("allows image/webp", () => expect(isAllowedMediaType("image/webp")).toBe(true));
  it("allows application/pdf", () => expect(isAllowedMediaType("application/pdf")).toBe(true));
  it("rejects application/javascript", () =>
    expect(isAllowedMediaType("application/javascript")).toBe(false));
});

// ─── cleanBase64 ─────────────────────────────────────────────────────────────

describe("cleanBase64", () => {
  it("passes through plain base64 unchanged (minus whitespace)", () => {
    expect(cleanBase64("AAAA")).toBe("AAAA");
  });

  it("strips data-URL prefix", () => {
    expect(cleanBase64("data:image/webp;base64,AAAA")).toBe("AAAA");
  });

  it("strips whitespace", () => {
    expect(cleanBase64("AA\nAA")).toBe("AAAA");
  });

  it("handles data-URL with whitespace in base64 part", () => {
    expect(cleanBase64("data:image/png;base64,AA\nAA")).toBe("AAAA");
  });
});

// ─── estimateBase64Bytes ──────────────────────────────────────────────────────

describe("estimateBase64Bytes", () => {
  it("correctly estimates 3 bytes (4 chars, no padding)", () => {
    // 3 bytes → 4 base64 chars, no padding
    const b64 = Buffer.from([1, 2, 3]).toString("base64");
    expect(estimateBase64Bytes(b64)).toBe(3);
  });

  it("correctly estimates 4 bytes (with one padding char)", () => {
    const b64 = Buffer.from([1, 2, 3, 4]).toString("base64");
    expect(estimateBase64Bytes(b64)).toBe(4);
  });

  it("correctly estimates 2 bytes (with two padding chars)", () => {
    const b64 = Buffer.from([1, 2]).toString("base64");
    expect(estimateBase64Bytes(b64)).toBe(2);
  });
});

// ─── escapeMarkdownAlt ────────────────────────────────────────────────────────

describe("escapeMarkdownAlt", () => {
  it("removes square brackets", () => {
    expect(escapeMarkdownAlt("[hero] image")).toBe("hero image");
  });

  it("trims whitespace", () => {
    expect(escapeMarkdownAlt("  hero  ")).toBe("hero");
  });
});

// ─── today ────────────────────────────────────────────────────────────────────

describe("today", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
