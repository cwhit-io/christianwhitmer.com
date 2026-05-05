import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    schema: z.object({
        title: z.string(),
        date: z.date(),
        description: z.string(),
        author: z.string(),
        // Tags are normalized to lowercase to prevent tag bloat
        // e.g., "church-tech", "Church-Tech", "CHURCH-TECH" all become "church-tech"
        tags: z.array(z.string().transform(tag => tag.toLowerCase())).optional(),
        draft: z.boolean().optional(),
        headerImage: z.string().optional(),
        image: z.string().optional(),
    }),
});

export const collections = { blog }; 
