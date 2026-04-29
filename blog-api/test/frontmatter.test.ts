/**
 * test/frontmatter.test.ts
 *
 * Unit tests for Markdown frontmatter parse/serialize utilities.
 */

import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  stringifyMarkdown,
  buildMarkdown,
  insertImageAtBodyTop,
  insertImageAfterFirstHeading,
} from "../src/lib/frontmatter.js";

// ─── parseMarkdown ────────────────────────────────────────────────────────────

describe("parseMarkdown", () => {
  it("parses a minimal frontmatter block", () => {
    const md = `---\ntitle: "Hello"\ndraft: false\n---\n\nBody text.`;
    const { frontmatter, body } = parseMarkdown(md);
    expect(frontmatter["title"]).toBe("Hello");
    expect(frontmatter["draft"]).toBe(false);
    expect(body.trim()).toBe("Body text.");
  });

  it("returns empty frontmatter when no --- block", () => {
    const { frontmatter, body } = parseMarkdown("Just a body.");
    expect(frontmatter).toEqual({});
    expect(body).toBe("Just a body.");
  });

  it("parses array fields", () => {
    const md = `---\ntags:\n  - tech\n  - ministry\n---\n\nBody.`;
    const { frontmatter } = parseMarkdown(md);
    expect(frontmatter["tags"]).toEqual(["tech", "ministry"]);
  });

  it("parses boolean values", () => {
    const md = `---\ndraft: true\n---\n\nBody.`;
    const { frontmatter } = parseMarkdown(md);
    expect(frontmatter["draft"]).toBe(true);
  });

  it("parses bare YYYY-MM-DD dates", () => {
    const md = `---\ndate: 2026-04-29\n---\n\nBody.`;
    const { frontmatter } = parseMarkdown(md);
    expect(frontmatter["date"]).toBe("2026-04-29");
  });
});

// ─── stringifyMarkdown ────────────────────────────────────────────────────────

describe("stringifyMarkdown", () => {
  it("round-trips a simple document", () => {
    const doc = {
      frontmatter: { title: "Hello", draft: false, date: "2026-04-29" },
      body: "Body text.",
    };
    const serialized = stringifyMarkdown(doc);
    const parsed = parseMarkdown(serialized);
    expect(parsed.frontmatter["title"]).toBe("Hello");
    expect(parsed.frontmatter["draft"]).toBe(false);
    expect(parsed.frontmatter["date"]).toBe("2026-04-29");
    expect(parsed.body.trim()).toBe("Body text.");
  });

  it("serializes arrays with indented list syntax", () => {
    const md = stringifyMarkdown({
      frontmatter: { tags: ["tech", "ministry"] },
      body: "Body.",
    });
    expect(md).toContain("tags:");
    expect(md).toContain("  - \"tech\"");
    expect(md).toContain("  - \"ministry\"");
  });

  it("skips null/undefined frontmatter values", () => {
    const md = stringifyMarkdown({
      frontmatter: { title: "Hello", image: undefined },
      body: "Body.",
    });
    expect(md).not.toContain("image:");
  });
});

// ─── buildMarkdown ────────────────────────────────────────────────────────────

describe("buildMarkdown", () => {
  it("produces valid frontmatter with all required fields", () => {
    const md = buildMarkdown({
      title: "Test Post",
      description: "A description",
      author: "Christian Whitmer",
      date: "2026-04-29",
      tags: ["tech"],
      draft: true,
      body: "Post body.",
    });
    const parsed = parseMarkdown(md);
    expect(parsed.frontmatter["title"]).toBe("Test Post");
    expect(parsed.frontmatter["draft"]).toBe(true);
    expect(parsed.frontmatter["tags"]).toEqual(["tech"]);
    expect(parsed.body.trim()).toBe("Post body.");
  });
});

// ─── insertImageAtBodyTop ─────────────────────────────────────────────────────

describe("insertImageAtBodyTop", () => {
  it("inserts image after the first non-empty line", () => {
    const body = "First line.\n\nSecond line.";
    const result = insertImageAtBodyTop(body, "![alt](url)");
    expect(result).toContain("First line.");
    expect(result).toContain("![alt](url)");
    // Image should come after first non-empty line
    const lines = result.split("\n");
    const firstLineIdx = lines.findIndex((l) => l.trim() === "First line.");
    const imgIdx = lines.findIndex((l) => l.trim() === "![alt](url)");
    expect(imgIdx).toBeGreaterThan(firstLineIdx);
  });

  it("prepends to empty body", () => {
    const result = insertImageAtBodyTop("", "![alt](url)");
    expect(result).toContain("![alt](url)");
  });
});

// ─── insertImageAfterFirstHeading ─────────────────────────────────────────────

describe("insertImageAfterFirstHeading", () => {
  it("inserts after the first H1 heading", () => {
    const body = "# My Heading\n\nParagraph text.";
    const result = insertImageAfterFirstHeading(body, "![alt](url)");
    const lines = result.split("\n");
    const headingIdx = lines.findIndex((l) => l.trim() === "# My Heading");
    const imgIdx = lines.findIndex((l) => l.trim() === "![alt](url)");
    expect(imgIdx).toBeGreaterThan(headingIdx);
  });

  it("falls back to body-top when no heading exists", () => {
    const body = "No heading here.";
    const result = insertImageAfterFirstHeading(body, "![alt](url)");
    expect(result).toContain("![alt](url)");
  });
});
