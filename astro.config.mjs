// @ts-check

import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

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
        plugins: [tailwindcss()],
        build: {
            rollupOptions: {
                // These are build-time-only (prerender) — keep out of the Worker bundle
                external: [/\/pagefind\//, 'satori', /^@resvg/, /^resvg/],
            },
        },
    },
});
