// @ts-check

import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
/**
 * Inline Vite plugin to copy `src/content/blog` into the site's `dist/blog`
 * during build and to serve files from `src/content/blog` during dev.
 */
function copyBlogAssetsPlugin() {
    const srcDir = path.resolve(process.cwd(), 'src', 'content', 'blog');
    const outDir = 'blog';
    return {
        name: 'copy-blog-assets',
        apply: 'build',
        async buildStart() {
            // copy recursively
            const destRoot = path.resolve(process.cwd(), 'dist', outDir);
            await fs.promises.mkdir(destRoot, { recursive: true });
            async function copyDir(s, d) {
                const entries = await fs.promises.readdir(s, { withFileTypes: true });
                for (const e of entries) {
                    const srcPath = path.join(s, e.name);
                    const destPath = path.join(d, e.name);
                    if (e.isDirectory()) {
                        await fs.promises.mkdir(destPath, { recursive: true });
                        await copyDir(srcPath, destPath);
                    } else {
                        await fs.promises.copyFile(srcPath, destPath);
                    }
                }
            }
            try {
                await copyDir(srcDir, destRoot);
            } catch (err) {
                // ignore if no blog images exist
            }
        },
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                try {
                    if (!req.url.startsWith('/blog/')) return next();
                    const relPath = decodeURIComponent(req.url.replace(/^\/blog\//, ''));
                    const filePath = path.join(srcDir, relPath);
                    const stat = await fs.promises.stat(filePath).catch(() => null);
                    if (!stat || !stat.isFile()) return next();
                    const ext = path.extname(filePath).toLowerCase();
                    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
                    const contentType = types[ext] || 'application/octet-stream';
                    res.setHeader('content-type', contentType);
                    const stream = fs.createReadStream(filePath);
                    stream.pipe(res);
                } catch (e) {
                    next();
                }
            });
        },
    };
}

export default defineConfig({
    site: 'https://christianwhitmer.com',
    output: 'server',
    adapter: cloudflare({ session: false }),
    integrations: [sitemap(), mdx()],
    markdown: {
        shikiConfig: {
            themes: {
                light: 'github-light',
                dark: 'one-dark-pro',
            },
            wrap: false,
            defaultColor: false,
        },
    },
    vite: {
        plugins: [tailwindcss(), copyBlogAssetsPlugin()],
        build: {
            rollupOptions: {
                // These are build-time-only (prerender) — keep out of the Worker bundle
                external: [/\/pagefind\//, 'satori', /^@resvg/, /^resvg/],
            },
        },
    },
});
