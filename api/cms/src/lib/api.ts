// Typed API client for the CMS

export interface Post {
  slug: string
  path: string
  sha: string
  title: string
  description: string
  author: string
  date: string
  tags: string[]
  draft: boolean
}

export interface PostDetail {
  slug: string
  path: string
  sha: string
  frontmatter: {
    title?: string
    description?: string
    author?: string
    date?: string
    tags?: string[]
    draft?: boolean
    image?: string | { src?: string }
    [key: string]: unknown
  }
  body: string
  markdown: string
}

export interface MediaItem {
  name: string
  filename: string
  path: string
  url: string
  publicUrl: string
  githubUrl?: string
  size?: number
  sha?: string
}

export interface CreatePostInput {
  title: string
  description?: string
  author?: string
  date?: string
  tags?: string[]
  draft?: boolean
  body?: string
  slug?: string
}

export interface UpdatePostInput {
  title?: string
  description?: string
  author?: string
  date?: string
  tags?: string[]
  draft?: boolean
  body?: string
  /** Set to a URL to update the featured image; set to "" to remove it. */
  image?: string
}

function authHeaders(token: string, withBody = false): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (withBody) headers['Content-Type'] = 'application/json'
  return headers
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((data['error'] as string) || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch('/cms/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  await handleResponse<{ ok: boolean }>(res)
}

export async function logout(): Promise<void> {
  await fetch('/cms/logout', { method: 'POST' })
}

export async function getSession(): Promise<{ username: string; token: string }> {
  const res = await fetch('/cms/session')
  return handleResponse<{ ok: boolean; username: string; token: string }>(res)
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function listPosts(token: string): Promise<Post[]> {
  const res = await fetch('/posts', { headers: authHeaders(token) })
  const data = await handleResponse<{ ok: boolean; posts: Post[] }>(res)
  return data.posts || []
}

export async function getPost(token: string, slug: string): Promise<PostDetail> {
  const res = await fetch(`/posts/${encodeURIComponent(slug)}`, { headers: authHeaders(token) })
  return handleResponse<PostDetail>(res)
}

export async function createPost(token: string, body: CreatePostInput): Promise<{ slug: string }> {
  const res = await fetch('/posts', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
  })
  return handleResponse<{ ok: boolean; slug: string }>(res)
}

export async function updatePost(token: string, slug: string, body: UpdatePostInput): Promise<void> {
  const res = await fetch(`/posts/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
  })
  await handleResponse<{ ok: boolean }>(res)
}

export async function deletePost(token: string, slug: string): Promise<void> {
  const res = await fetch(`/posts/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  await handleResponse<{ ok: boolean }>(res)
}

export async function publishPost(token: string, slug: string): Promise<void> {
  const res = await fetch(`/posts/${encodeURIComponent(slug)}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  await handleResponse<{ ok: boolean }>(res)
}

// ── Media ─────────────────────────────────────────────────────────────────────

export async function listMedia(token: string, postSlug: string): Promise<MediaItem[]> {
  const res = await fetch(`/media/${encodeURIComponent(postSlug)}`, { headers: authHeaders(token) })
  const data = await handleResponse<{ ok: boolean; media: MediaItem[] }>(res)
  return data.media || []
}

export async function deleteMedia(token: string, postSlug: string, filename: string): Promise<void> {
  const res = await fetch(`/media/${encodeURIComponent(postSlug)}/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  await handleResponse<{ ok: boolean }>(res)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      // Strip the data:...;base64, prefix
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function generateHeroImage(
  token: string,
  postSlug: string,
  prompt: string,
): Promise<{ url: string }> {
  const ext = 'webp'
  const filename = `hero-${Date.now()}.${ext}`
  const res = await fetch('/media/generate-and-attach', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({
      postSlug,
      filename,
      prompt,
      outputFormat: ext,
      size: '1536x1024',
      attachAs: 'header',
    }),
  })
  const data = await handleResponse<{ ok: boolean; publicUrl: string; url?: string }>(res)
  return { url: data.publicUrl || data.url || '' }
}

export async function uploadMedia(
  token: string,
  postSlug: string,
  file: File,
  filename: string,
): Promise<{ url: string; markdown: string }> {
  const contentBase64 = await fileToBase64(file)
  const res = await fetch('/media', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({
      postSlug,
      filename,
      contentType: file.type || 'image/webp',
      contentBase64,
      alt: filename,
    }),
  })
  const data = await handleResponse<{ ok: boolean; url: string; publicUrl: string; markdown: string }>(res)
  return { url: data.publicUrl || data.url, markdown: data.markdown }
}

function extToOutputFormat(filename: string): 'png' | 'jpeg' | 'webp' {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'png'
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  return 'webp'
}

export async function generateImage(
  token: string,
  postSlug: string,
  filename: string,
  prompt: string,
  size?: string,
): Promise<{ url: string }> {
  const outputFormat = extToOutputFormat(filename)
  const res = await fetch('/media/generate', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({
      postSlug,
      filename,
      prompt,
      outputFormat,
      ...(size ? { size } : {}),
    }),
  })
  const data = await handleResponse<{ ok: boolean; publicUrl: string }>(res)
  return { url: data.publicUrl }
}

export async function generateAndAttach(
  token: string,
  postSlug: string,
  filename: string,
  prompt: string,
  size?: string,
): Promise<{ url: string }> {
  const outputFormat = extToOutputFormat(filename)
  const res = await fetch('/media/generate-and-attach', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({
      postSlug,
      filename,
      prompt,
      outputFormat,
      placement: 'frontmatter',
      field: 'image',
      ...(size ? { size } : {}),
    }),
  })
  const data = await handleResponse<{ ok: boolean; publicUrl: string }>(res)
  return { url: data.publicUrl }
}

// ── Status & Logs ─────────────────────────────────────────────────────────────

export interface StatusCheck {
  label: string
  method: string
  url: string
  statusCode: number | null
  operational: boolean
  protected: boolean
  timeMs: number | null
  error?: string
}

export interface StatusResponse {
  ok: boolean
  total: number
  operational: number
  down: number
  checks: StatusCheck[]
}

export interface LogEntry {
  timestamp: string
  method: string
  url: string
  statusCode: number
  responseTimeMs: number
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch('/status')
  return handleResponse<StatusResponse>(res)
}

export async function getLogs(token: string, limit = 100): Promise<LogEntry[]> {
  const res = await fetch(`/logs?limit=${limit}`, { headers: authHeaders(token) })
  const data = await handleResponse<{ ok: boolean; entries: LogEntry[] }>(res)
  return data.entries || []
}
