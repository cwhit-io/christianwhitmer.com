import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

export const prerender = true;

export async function getStaticPaths() {
    const posts = await getCollection("blog");
    return posts.map((post) => ({
        params: { slug: post.slug },
        props: { post },
    }));
}

// Cache font at module level so it's only fetched once per build
let cachedFont: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer | null> {
    if (cachedFont) return cachedFont;
    try {
        // Request CSS with an old UA so Google Fonts returns TTF (not WOFF2)
        const css = await fetch(
            "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@700",
            {
                headers: {
                    "User-Agent":
                        "Mozilla/4.0 (compatible; MSIE 4.0; Windows NT)",
                },
            },
        ).then((r) => r.text());

        const urlMatch = css.match(/src: url\(([^)]+)\)/);
        if (urlMatch?.[1]) {
            cachedFont = await fetch(urlMatch[1]).then((r) => r.arrayBuffer());
        }
    } catch {
        // Build continues without custom font — satori falls back to sans-serif
    }
    return cachedFont;
}

// Helper — creates a React-compatible element object for satori
// Null/undefined children are filtered out automatically
function h(
    type: string,
    props: Record<string, unknown>,
    ...children: unknown[]
): unknown {
    const filtered = children.flat(Infinity).filter((c) => c != null);
    return {
        type,
        key: null,
        ref: null,
        props: {
            ...props,
            children:
                filtered.length === 0
                    ? undefined
                    : filtered.length === 1
                        ? filtered[0]
                        : filtered,
        };
    }

    export async function GET({ props }: APIContext) {
        const { post } = props as any;

        const font = await loadFont();

        const title: string = post.data.title ?? "Untitled";
        const description: string = post.data.description ?? "";
        const date: string = post.data.date
            ? (post.data.date as Date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            })
            : "";
        const tags: string[] = post.data.tags ?? [];

        const titleFontSize = title.length > 60 ? 44 : title.length > 40 ? 52 : 60;
        const descClipped =
            description.length > 110
                ? description.slice(0, 110) + "…"
                : description;

        const card = h(
            "div",
            {
                style: {
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    padding: "64px",
                    background: "#1C1C1C",
                    fontFamily: font ? "Roboto Slab, sans-serif" : "sans-serif",
                    position: "relative",
                },
            },
            // Purple top bar
            h("div", {
                style: {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "5px",
                    background: "linear-gradient(90deg, #6F3D8B 0%, #a855f7 100%)",
                },
            }),
            // Subtle background gradient
            h("div", {
                style: {
                    position: "absolute",
                    inset: 0,
                    background:
                        "radial-gradient(ellipse 80% 60% at 90% 110%, rgba(111,61,139,0.18) 0%, transparent 70%)",
                },
            }),
            // Site wordmark
            h(
                "p",
                {
                    style: {
                        color: "#9f67c0",
                        fontSize: "16px",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginBottom: "20px",
                        lineHeight: 1,
                    },
                },
                "christianwhitmer.com",
            ),
            // Title
            h(
                "h1",
                {
                    style: {
                        color: "#EBEBEB",
                        fontSize: `${titleFontSize}px`,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        letterSpacing: "-0.02em",
                        marginBottom: "20px",
                        maxWidth: "960px",
                    },
                },
                title,
            ),
            // Description
            descClipped
                ? h(
                    "p",
                    {
                        style: {
                            color: "#C8C8C8",
                            fontSize: "22px",
                            lineHeight: 1.5,
                            maxWidth: "860px",
                            marginBottom: "28px",
                        },
                    },
                    descClipped,
                )
                : null,
            // Meta row
            h(
                "div",
                {
                    style: {
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                    },
                },
                // Date
                date
                    ? h(
                        "span",
                        { style: { color: "#888", fontSize: "16px" } },
                        date,
                    )
                    : null,
                // Tags
                ...tags.slice(0, 3).map((tag) =>
                    h(
                        "span",
                        {
                            style: {
                                color: "#9f67c0",
                                fontSize: "14px",
                                fontWeight: 600,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                background: "rgba(111,61,139,0.20)",
                                padding: "4px 12px",
                                borderRadius: "999px",
                            },
                        },
                        tag,
                    ),
                ),
            ),
        );

        const svg = await satori(card as any, {
            width: 1200,
            height: 630,
            fonts: font
                ? [
                    {
                        name: "Roboto Slab",
                        data: font,
                        weight: 700,
                        style: "normal",
                    },
                ]
                : [],
        });

        const resvg = new Resvg(svg, {
            fitTo: { mode: "width", value: 1200 },
        });
        const png = resvg.render().asPng();

        return new Response(png, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    }
