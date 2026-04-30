import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export const prerender = true;

export async function GET(context: APIContext) {
    const posts = await getCollection('blog');

    return rss({
        title: "Christian Whitmer's Blog",
        description:
            'Thoughts, projects, and updates on web development and technology.',
        site: context.site!,
        items: posts
            .filter((post) => !post.data.draft)
            .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
            .map((post) => ({
                title: post.data.title,
                pubDate: post.data.date,
                description: post.data.description,
                link: `/blog/${post.id}/`,
            })),
    });
}
