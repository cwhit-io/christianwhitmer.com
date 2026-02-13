import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    schema: z.object({
        title: z.string(),
        date: z.date(),
        description: z.string(),
        author: z.string(),
        headerImage: z.string().optional(),
    }),
});

export const collections = { blog };
