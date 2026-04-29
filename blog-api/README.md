# christianwhitmer Blog API

Standalone Node.js microservice that manages blog posts and media for [christianwhitmer.com](https://christianwhitmer.com).

- **Posts** stored as `.md` files in `src/content/blog/` on GitHub.
- **Media** stored under `public/images/blog/{slug}/` on GitHub.
- **Image generation** handled server-side via the OpenAI Images API — the caller never receives a raw base64 response.
- Replaces the Cloudflare Worker in `api/`.

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 20 |
| Framework | [Fastify](https://fastify.dev) |
| Validation | [Zod](https://zod.dev) |
| HTTP | Native `fetch` (Node 18+) |
| Language | TypeScript |
| Tests | Vitest |
| Container | Docker / Compose |

---

## Quick start

### Local development

```bash
cd blog-api
cp .env.example .env
# fill in API_TOKEN, GITHUB_TOKEN, OPENAI_API_KEY, etc.

npm install
npm run dev
# → http://localhost:3000/health
```

### Build and run compiled output

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t blog-api .
docker run --env-file .env -p 3000:3000 blog-api
```

### Docker Compose

```bash
cp .env.example .env
# edit .env
docker compose up -d
docker compose logs -f
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in all values.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | | `3000` | HTTP port |
| `API_TOKEN` | ✓ | — | Bearer token for auth |
| `GITHUB_TOKEN` | ✓ | — | GitHub PAT (needs `contents: write`) |
| `GITHUB_OWNER` | ✓ | — | GitHub account/org |
| `GITHUB_REPO` | ✓ | — | Repository name |
| `GITHUB_BRANCH` | | `master` | Branch to read/write |
| `POSTS_BASE_PATH` | | `src/content/blog` | Repository path for posts |
| `DEFAULT_AUTHOR` | | `""` | Default author for new posts |
| `REPO_IMAGE_BASE_PATH` | | `public/images/blog` | Repository path for images |
| `PUBLIC_IMAGE_BASE_PATH` | | `/images/blog` | Public URL prefix for images |
| `MAX_MEDIA_BYTES` | | `2097152` | Max upload size (bytes) |
| `OPENAI_API_KEY` | ✓ | — | OpenAI API key |
| `OPENAI_IMAGE_MODEL` | | `gpt-image-1` | OpenAI model for image generation |
| `DEFAULT_IMAGE_SIZE` | | `1024x1024` | Default image size |
| `DEFAULT_IMAGE_QUALITY` | | `low` | Default image quality |
| `DEFAULT_IMAGE_FORMAT` | | `webp` | Default image format |
| `PROTECT_READS` | | `true` | Require auth on GET /posts endpoints |
| `CORS_ORIGIN` | | `*` | Allowed CORS origin |
| `LOG_LEVEL` | | `info` | Pino log level |

---

## Endpoints

All mutating endpoints require `Authorization: Bearer <API_TOKEN>`.
Read endpoints also require auth by default (`PROTECT_READS=true`).

See [`openapi.yaml`](./openapi.yaml) for full request/response schemas.

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Liveness check |

### Posts

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/posts` | Configurable | List all posts |
| POST | `/posts` | Yes | Create a post |
| GET | `/posts/:slug` | Configurable | Get a post |
| PUT | `/posts/:slug` | Yes | Update a post (merge frontmatter) |
| PATCH | `/posts/:slug` | Yes | Partial update (same as PUT) |
| DELETE | `/posts/:slug` | Yes | Delete a post |
| POST | `/posts/:slug/publish` | Yes | Publish draft (sets `draft: false`) |
| POST | `/posts/:slug/attach-media` | Yes | Attach uploaded media to post |

### Media

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/media` | Yes | Upload media file (base64) |
| GET | `/media/:postSlug` | Configurable | List media for a post |
| DELETE | `/media/:postSlug/:filename` | Yes | Delete media file |
| POST | `/media/generate` | Yes | Generate image with OpenAI → GitHub |
| POST | `/media/generate-and-attach` | Yes | Generate + upload + attach to post |

---

## Example curl commands

### Health check

```bash
curl http://localhost:3000/health
```

### Create a post

```bash
curl -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello World",
    "description": "My first post",
    "body": "## Introduction\n\nHello from the API!",
    "tags": ["intro"],
    "draft": true
  }'
```

### Get a post

```bash
curl http://localhost:3000/posts/hello-world \
  -H "Authorization: Bearer $API_TOKEN"
```

### Publish a post

```bash
curl -X POST http://localhost:3000/posts/hello-world/publish \
  -H "Authorization: Bearer $API_TOKEN"
```

### Upload media

```bash
# Encode an image to base64
B64=$(base64 -w0 hero.webp)

curl -X POST http://localhost:3000/media \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"postSlug\": \"hello-world\",
    \"filename\": \"hero.webp\",
    \"contentType\": \"image/webp\",
    \"contentBase64\": \"$B64\"
  }"
```

### List media

```bash
curl http://localhost:3000/media/hello-world \
  -H "Authorization: Bearer $API_TOKEN"
```

### Delete media

```bash
curl -X DELETE http://localhost:3000/media/hello-world/hero.webp \
  -H "Authorization: Bearer $API_TOKEN"
```

### Generate an image with OpenAI

```bash
curl -X POST http://localhost:3000/media/generate \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "postSlug": "hello-world",
    "filename": "hero.webp",
    "prompt": "A realistic editorial-style hero image for a blog post about technology and faith",
    "size": "1536x1024",
    "quality": "low",
    "outputFormat": "webp"
  }'
```

### Generate and attach in one call

```bash
curl -X POST http://localhost:3000/media/generate-and-attach \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "postSlug": "hello-world",
    "filename": "hero.webp",
    "prompt": "A realistic editorial-style hero image for a blog post about faith and technology",
    "alt": "Hero image for Hello World post",
    "placement": "frontmatter",
    "field": "image"
  }'
```

### Attach media to a post (separate step)

```bash
curl -X POST http://localhost:3000/posts/hello-world/attach-media \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "hero.webp",
    "alt": "Hero image for Hello World post",
    "placement": "frontmatter",
    "field": "image"
  }'
```

---

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check only
npm run lint
```

---

## Cutover plan from Cloudflare Worker

The Cloudflare Worker (`api/`) remains untouched. Follow these steps to migrate:

### 1. Deploy the microservice

On your public server:

```bash
git clone https://github.com/cwhit-io/christianwhitmer.com.git
cd christianwhitmer.com/blog-api
cp .env.example .env
# fill in env vars
docker compose up -d
```

### 2. Smoke test

```bash
BASE_URL=https://your-server.example.com

# Health (public)
curl $BASE_URL/health

# Auth rejection
curl $BASE_URL/posts
# → {"ok":false,"error":"Unauthorized",...}

# Auth success
curl $BASE_URL/posts -H "Authorization: Bearer $API_TOKEN"

# Media list (no posts yet = empty array)
curl $BASE_URL/media/any-slug -H "Authorization: Bearer $API_TOKEN"

# Test image generation (uses real OpenAI + GitHub)
curl -X POST $BASE_URL/media/generate \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"postSlug":"test-cutover","filename":"test.webp","prompt":"A simple test image for API validation"}'
```

### 3. Update your Custom GPT Action

Change the base URL from the Cloudflare Worker URL to the new service URL.

If the Custom GPT Action currently uses:
```
https://christianwhitmer-blog-api.<account>.workers.dev
```

Update it to:
```
https://your-server.example.com
```

No endpoint paths need to change — all routes are preserved.

**Token name difference:** The Cloudflare Worker used `BLOG_API_TOKEN` as the environment variable name. The new service uses `API_TOKEN`. The value (the bearer token itself) does not need to change.

### 4. Verify in production

Run a full create/read/delete cycle against the new service before decommissioning the Worker.

### 5. Decommission the Worker

Only after the microservice is confirmed working in production:

```bash
cd api
wrangler delete  # or simply stop deploying updates
```

The `api/` directory can remain in the repository for reference.

---

## Security notes

- All mutating endpoints require `Authorization: Bearer <API_TOKEN>`.
- `API_TOKEN` must be a strong random value (`openssl rand -hex 32`).
- GitHub token needs `contents: write` on the repository only.
- OpenAI key is never logged or returned to callers.
- Base64 image content is never logged or returned in API responses.
- Slug and filename inputs are sanitized before any path construction.
- Path traversal is prevented by sanitization and rejection of `..`.
- The service runs as a non-root user in the Docker container.
- Set `CORS_ORIGIN` to your domain in production rather than `*`.

---

## Differences from the Cloudflare Worker

| Behaviour | Worker | This service |
|---|---|---|
| Auth required for GET /health | Yes | No (public) |
| Auth required for GET /posts | Yes | Configurable via `PROTECT_READS` |
| Media field name | `data` | `data` (legacy) or `contentBase64` |
| Media response fields | `url`, `markdown` | same + `publicUrl`, `sha` |
| PATCH endpoint | Not present | Added (same logic as PUT) |
| `/posts/:slug/attach-media` | Not present | Added |
| `/media/generate` | Not present | Added |
| `/media/generate-and-attach` | Not present | Added |
| Error response shape | `{ok,error}` | `{ok,error,code,details?}` |
| Commit message prefix | `Add blog post:` | `Create blog post:` |
| Env var name | `BLOG_API_TOKEN` | `API_TOKEN` |
