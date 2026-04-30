import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    schema: z.object({
        title: z.string(),
        date: z.date(),
        description: z.string(),
        author: z.string(),
        tags: z.array(z.string()).optional(),
        draft: z.boolean().optional(),
        headerImage: z.string().optional(),
        image: z.string().optional(),
    }),
});

export const collections = { blog }; 
