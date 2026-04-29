/**
 * lib/frontmatter.ts
 *
 * Parse and serialize Markdown frontmatter.
 *
 * Deliberately avoids a full YAML parser to keep the dependency footprint
 * minimal. Supports the field types used by Astro content collections:
 * strings, booleans, numbers, YYYY-MM-DD dates, and arrays of scalars.
 */

import type { ParsedMarkdown } from "../types/index.js";

// ─── Parse ────────────────────────────────────────────────────────────────────

export function parseMarkdown(markdown: string): ParsedMarkdown {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const endIndex = markdown.indexOf("\n---", 4);
  if (endIndex === -1) {
    return { frontmatter: {}, body: markdown };
  }

  const frontmatterText = markdown.slice(4, endIndex).trim();
  const body = markdown.slice(endIndex + 4).replace(/^\n+/, "");

  return {
    frontmatter: parseSimpleYaml(frontmatterText),
    body,
  };
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let currentArrayKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    // Array item: "  - value"
    const arrayItemMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayItemMatch && currentArrayKey) {
      (result[currentArrayKey] as unknown[]).push(parseYamlValue(arrayItemMatch[1]));
      continue;
    }

    // Key: value or Key: (empty → array start)
    const kvMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const rawValue = kvMatch[2];

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

function parseYamlValue(value: string): unknown {
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

// ─── Serialize ────────────────────────────────────────────────────────────────

export function stringifyMarkdown(input: {
  frontmatter: Record<string, unknown>;
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

function yamlScalar(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);

  const str = String(value);

  // Bare YYYY-MM-DD dates are safe unquoted
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  return JSON.stringify(str);
}

// ─── Build helpers ────────────────────────────────────────────────────────────

export function buildMarkdown(input: {
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

// ─── Image attachment helpers ─────────────────────────────────────────────────

/**
 * Insert image Markdown near the top of a body string.
 * Inserts after the first non-empty line.
 */
export function insertImageAtBodyTop(
  body: string,
  imageMarkdown: string
): string {
  const lines = body.split("\n");
  const firstNonEmpty = lines.findIndex((l) => l.trim() !== "");
  if (firstNonEmpty === -1) {
    return `${imageMarkdown}\n\n${body}`;
  }
  lines.splice(firstNonEmpty + 1, 0, "", imageMarkdown, "");
  return lines.join("\n");
}

/**
 * Insert image Markdown after the first H1 or H2 heading in the body.
 * Falls back to body-top if no heading is found.
 */
export function insertImageAfterFirstHeading(
  body: string,
  imageMarkdown: string
): string {
  const lines = body.split("\n");
  const headingIndex = lines.findIndex((l) => /^#{1,2}\s/.test(l));
  if (headingIndex === -1) {
    return insertImageAtBodyTop(body, imageMarkdown);
  }
  lines.splice(headingIndex + 1, 0, "", imageMarkdown, "");
  return lines.join("\n");
}
