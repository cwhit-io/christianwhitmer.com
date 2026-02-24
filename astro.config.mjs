// @ts-check

import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    site: 'https://christianwhitmer.com',
    output: 'server',
    adapter: cloudflare(),
    integrations: [sitemap(), mdx()],
    vite: {
        plugins: [tailwindcss()],
    },
});
