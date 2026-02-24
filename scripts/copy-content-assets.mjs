/**
 * Copies any non-markdown assets (images, videos, etc.) from
 * src/content/blog/<slug>/ → public/blog/<slug>/
 * so they are served as static files.
 *
 * Run automatically as part of `npm run build`.
 */

import { readdirSync, statSync, mkdirSync, copyFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('..', import.meta.url));
const contentDir = join(root, 'src', 'content', 'blog');
const publicDir = join(root, 'public', 'blog');

const SKIP_EXTENSIONS = new Set(['.md', '.mdx', '.ts', '.js', '.json']);

let copied = 0;

for (const slug of readdirSync(contentDir)) {
    const slugSrc = join(contentDir, slug);
    if (!statSync(slugSrc).isDirectory()) continue;

    for (const file of readdirSync(slugSrc)) {
        if (SKIP_EXTENSIONS.has(extname(file).toLowerCase())) continue;

        const src = join(slugSrc, file);
        if (!statSync(src).isFile()) continue;

        const destDir = join(publicDir, slug);
        mkdirSync(destDir, { recursive: true });

        const dest = join(destDir, file);
        copyFileSync(src, dest);
        console.log(`  copied: public/blog/${slug}/${file}`);
        copied++;
    }
}

console.log(`copy-content-assets: ${copied} file(s) synced.`);
