/**
 * routes/ui.ts
 *
 * GET / — serves a simple single-page dashboard for the blog API.
 */

import type { FastifyInstance } from "fastify";

const HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog API</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f1117;
      --surface: #1a1d27;
      --surface2: #22263a;
      --border: #2e3350;
      --text: #e2e8f0;
      --muted: #8892a4;
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --green: #22c55e;
      --red: #ef4444;
      --yellow: #eab308;
      --radius: 8px;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --mono: "Fira Code", "Cascadia Code", monospace;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 14px;
      line-height: 1.6;
      min-height: 100vh;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      gap: 16px;
    }

    header h1 {
      font-size: 16px;
      font-weight: 600;
      color: var(--accent-hover);
      white-space: nowrap;
    }

    .token-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      max-width: 480px;
    }

    .token-row label {
      color: var(--muted);
      white-space: nowrap;
      font-size: 12px;
    }

    input[type="password"], input[type="text"], input[type="search"], textarea, select {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text);
      font-family: var(--font);
      font-size: 13px;
      padding: 6px 10px;
      outline: none;
      width: 100%;
    }

    input:focus, textarea:focus, select:focus {
      border-color: var(--accent);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--muted);
      flex-shrink: 0;
    }
    .status-dot.ok { background: var(--green); }
    .status-dot.err { background: var(--red); }

    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      gap: 24px;
    }

    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      gap: 8px;
    }

    .section-header h2 {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--muted);
    }

    .section-body {
      padding: 18px;
    }

    button {
      background: var(--accent);
      border: none;
      border-radius: var(--radius);
      color: #fff;
      cursor: pointer;
      font-family: var(--font);
      font-size: 13px;
      font-weight: 500;
      padding: 6px 14px;
      white-space: nowrap;
      transition: background .15s;
    }

    button:hover { background: var(--accent-hover); }
    button:disabled { opacity: .4; cursor: default; }

    button.ghost {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    button.ghost:hover { border-color: var(--accent); color: var(--text); background: transparent; }

    button.danger {
      background: transparent;
      border: 1px solid transparent;
      color: var(--red);
      padding: 4px 8px;
      font-size: 12px;
    }
    button.danger:hover { background: rgba(239,68,68,.1); }

    button.success {
      background: transparent;
      border: 1px solid transparent;
      color: var(--green);
      padding: 4px 8px;
      font-size: 12px;
    }
    button.success:hover { background: rgba(34,197,94,.1); }

    .health-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    .health-item {
      background: var(--surface2);
      border-radius: var(--radius);
      padding: 12px;
    }

    .health-item .key {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .05em;
      margin-bottom: 4px;
    }

    .health-item .val {
      font-family: var(--mono);
      font-size: 12px;
      word-break: break-all;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      padding: 8px 12px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .05em;
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface2); }

    .badge {
      display: inline-block;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 7px;
    }
    .badge.draft { background: rgba(234,179,8,.15); color: var(--yellow); }
    .badge.published { background: rgba(34,197,94,.15); color: var(--green); }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-grid .full { grid-column: 1 / -1; }

    .field label {
      display: block;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .05em;
      margin-bottom: 4px;
    }

    textarea { resize: vertical; min-height: 100px; }

    .toast-wrap {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 100;
    }

    .toast {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text);
      font-size: 13px;
      max-width: 340px;
      padding: 10px 16px;
      animation: slide-in .2s ease;
    }
    .toast.ok { border-color: var(--green); }
    .toast.err { border-color: var(--red); }

    @keyframes slide-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .empty { color: var(--muted); font-size: 13px; padding: 16px 0; }

    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin .6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .row-actions { display: flex; gap: 4px; align-items: center; }

    details summary {
      cursor: pointer;
      color: var(--muted);
      font-size: 12px;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    details summary::before { content: "▶"; font-size: 10px; transition: transform .15s; }
    details[open] summary::before { transform: rotate(90deg); }
    details .inner { margin-top: 16px; }
  </style>
</head>
<body>

<header>
  <h1>✦ Blog API</h1>
  <div class="token-row">
    <label for="token-input">Bearer token</label>
    <input id="token-input" type="password" placeholder="API_TOKEN" autocomplete="off" />
    <div class="status-dot" id="auth-dot" title="Not verified"></div>
  </div>
  <button id="refresh-btn" class="ghost">Refresh</button>
</header>

<main>

  <!-- Health -->
  <div class="section">
    <div class="section-header">
      <h2>Health</h2>
      <span id="health-status" class="badge draft">—</span>
    </div>
    <div class="section-body">
      <div class="health-grid" id="health-grid"><span class="empty">Loading…</span></div>
    </div>
  </div>

  <!-- Posts -->
  <div class="section">
    <div class="section-header">
      <h2>Posts</h2>
      <button id="new-post-btn">+ New Post</button>
    </div>
    <div id="posts-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Slug</th>
            <th>Title</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="posts-body"><tr><td colspan="5" class="empty" style="text-align:center">Loading…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- New / Edit Post form -->
  <div class="section" id="post-form-section" style="display:none">
    <div class="section-header">
      <h2 id="post-form-title">New Post</h2>
      <button id="post-form-close" class="ghost">✕ Cancel</button>
    </div>
    <div class="section-body">
      <form id="post-form" autocomplete="off">
        <div class="form-grid">
          <div class="field full">
            <label>Title *</label>
            <input type="text" id="pf-title" required placeholder="My Post Title" />
          </div>
          <div class="field full">
            <label>Description</label>
            <input type="text" id="pf-description" placeholder="Short description" />
          </div>
          <div class="field">
            <label>Author</label>
            <input type="text" id="pf-author" placeholder="Leave blank for default" />
          </div>
          <div class="field">
            <label>Tags (comma-separated)</label>
            <input type="text" id="pf-tags" placeholder="tag1, tag2" />
          </div>
          <div class="field full">
            <label>Body (Markdown) *</label>
            <textarea id="pf-body" rows="8" required placeholder="## Hello\n\nPost content here…"></textarea>
          </div>
          <div class="field">
            <label>Draft?</label>
            <select id="pf-draft">
              <option value="true">Yes — save as draft</option>
              <option value="false">No — publish immediately</option>
            </select>
          </div>
        </div>
        <div style="margin-top:16px; display:flex; gap:8px">
          <button type="submit" id="pf-submit">Create Post</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Media -->
  <div class="section">
    <div class="section-header">
      <h2>Media</h2>
    </div>
    <div class="section-body">
      <details>
        <summary>List media for a post</summary>
        <div class="inner">
          <div style="display:flex; gap:8px; margin-bottom:12px">
            <input type="text" id="media-slug-input" placeholder="post-slug" style="max-width:240px" />
            <button id="media-list-btn">List</button>
          </div>
          <div id="media-list-result"></div>
        </div>
      </details>

      <details style="margin-top:16px">
        <summary>Generate image with OpenAI</summary>
        <div class="inner">
          <div class="form-grid">
            <div class="field">
              <label>Post Slug *</label>
              <input type="text" id="gen-slug" placeholder="my-post" />
            </div>
            <div class="field">
              <label>Filename *</label>
              <input type="text" id="gen-filename" placeholder="hero.webp" />
            </div>
            <div class="field full">
              <label>Prompt *</label>
              <textarea id="gen-prompt" rows="3" placeholder="A realistic editorial hero image for a blog post about…"></textarea>
            </div>
            <div class="field">
              <label>Size</label>
              <select id="gen-size">
                <option value="">default</option>
                <option value="1024x1024">1024×1024</option>
                <option value="1536x1024">1536×1024</option>
                <option value="1024x1536">1024×1536</option>
              </select>
            </div>
            <div class="field">
              <label>Quality</label>
              <select id="gen-quality">
                <option value="">default</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
            <div class="field">
              <label>Also attach to post?</label>
              <select id="gen-attach">
                <option value="no">No — generate only</option>
                <option value="yes">Yes — generate &amp; attach</option>
              </select>
            </div>
            <div class="field" id="gen-alt-wrap" style="display:none">
              <label>Alt text</label>
              <input type="text" id="gen-alt" placeholder="Descriptive alt text" />
            </div>
          </div>
          <div style="margin-top:12px; display:flex; gap:8px; align-items:center">
            <button id="gen-submit">Generate</button>
            <span id="gen-spinner" style="display:none"><span class="spinner"></span></span>
          </div>
          <div id="gen-result" style="margin-top:12px"></div>
        </div>
      </details>
    </div>
  </div>

</main>

<div class="toast-wrap" id="toast-wrap"></div>

<script>
  const $ = id => document.getElementById(id);
  const BASE = window.location.origin;

  // ── Token ─────────────────────────────────────────────────────────────────
  const tokenInput = $('token-input');
  tokenInput.value = localStorage.getItem('api_token') || '';
  tokenInput.addEventListener('input', () => {
    localStorage.setItem('api_token', tokenInput.value);
    $('auth-dot').className = 'status-dot';
  });

  function getToken() { return tokenInput.value.trim(); }

  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    $('toast-wrap').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  async function apiFetch(path, opts = {}) {
    const res = await fetch(BASE + path, {
      headers: authHeaders(),
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  // ── Health ────────────────────────────────────────────────────────────────
  async function loadHealth() {
    try {
      const { res, data } = await apiFetch('/health');
      const badge = $('health-status');
      if (res.ok) {
        badge.textContent = 'OK';
        badge.className = 'badge published';
      } else {
        badge.textContent = 'ERROR';
        badge.className = 'badge draft';
      }
      const grid = $('health-grid');
      grid.innerHTML = '';
      for (const [k, v] of Object.entries(data)) {
        if (k === 'ok') continue;
        const item = document.createElement('div');
        item.className = 'health-item';
        item.innerHTML = '<div class="key">' + escHtml(k) + '</div><div class="val">' + escHtml(String(v)) + '</div>';
        grid.appendChild(item);
      }
    } catch (e) {
      $('health-status').textContent = 'UNREACHABLE';
      $('health-grid').innerHTML = '<span class="empty">Could not reach /health</span>';
    }
  }

  // ── Posts ─────────────────────────────────────────────────────────────────
  async function loadPosts() {
    const tbody = $('posts-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center"><span class="spinner"></span></td></tr>';

    const { res, data } = await apiFetch('/posts');

    if (res.status === 401) {
      $('auth-dot').className = 'status-dot err';
      tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center;color:var(--red)">Unauthorized — enter your API token above</td></tr>';
      return;
    }

    $('auth-dot').className = 'status-dot ok';

    const posts = Array.isArray(data) ? data : (data.posts ?? []);

    if (!posts.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty" style="text-align:center">No posts yet</td></tr>';
      return;
    }

    tbody.innerHTML = posts.map(p => {
      const isDraft = p.frontmatter?.draft ?? p.draft ?? false;
      const title = escHtml(p.frontmatter?.title ?? p.title ?? p.slug ?? '—');
      const date = p.frontmatter?.pubDate ?? p.frontmatter?.date ?? p.pubDate ?? '';
      return \`<tr>
        <td style="font-family:var(--mono);font-size:12px">\${escHtml(p.slug)}</td>
        <td>\${title}</td>
        <td><span class="badge \${isDraft ? 'draft' : 'published'}">\${isDraft ? 'Draft' : 'Published'}</span></td>
        <td style="color:var(--muted);font-size:12px">\${date ? escHtml(String(date).slice(0,10)) : '—'}</td>
        <td>
          <div class="row-actions">
            \${isDraft ? \`<button class="success" onclick="publishPost('\${escAttr(p.slug)}')">Publish</button>\` : ''}
            <button class="danger" onclick="deletePost('\${escAttr(p.slug)}')">Delete</button>
          </div>
        </td>
      </tr>\`;
    }).join('');
  }

  async function publishPost(slug) {
    if (!confirm('Publish "' + slug + '"?')) return;
    const { res } = await apiFetch('/posts/' + encodeURIComponent(slug) + '/publish', { method: 'POST' });
    if (res.ok) { toast('Published ' + slug); loadPosts(); }
    else toast('Failed to publish', 'err');
  }

  async function deletePost(slug) {
    if (!confirm('Delete "' + slug + '"? This cannot be undone.')) return;
    const { res } = await apiFetch('/posts/' + encodeURIComponent(slug), { method: 'DELETE' });
    if (res.ok) { toast('Deleted ' + slug); loadPosts(); }
    else toast('Failed to delete', 'err');
  }

  // ── New Post form ─────────────────────────────────────────────────────────
  $('new-post-btn').addEventListener('click', () => {
    $('post-form-section').style.display = '';
    $('post-form-section').scrollIntoView({ behavior: 'smooth' });
  });

  $('post-form-close').addEventListener('click', () => {
    $('post-form-section').style.display = 'none';
  });

  $('post-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('pf-submit');
    btn.disabled = true;

    const tags = $('pf-tags').value.split(',').map(s => s.trim()).filter(Boolean);
    const body = {
      title: $('pf-title').value,
      description: $('pf-description').value || undefined,
      author: $('pf-author').value || undefined,
      tags: tags.length ? tags : undefined,
      body: $('pf-body').value,
      draft: $('pf-draft').value === 'true',
    };

    const { res, data } = await apiFetch('/posts', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    btn.disabled = false;

    if (res.ok) {
      toast('Post created: ' + (data.slug ?? ''));
      $('post-form').reset();
      $('post-form-section').style.display = 'none';
      loadPosts();
    } else {
      toast(data.error ?? 'Failed to create post', 'err');
    }
  });

  // ── Media list ────────────────────────────────────────────────────────────
  $('media-list-btn').addEventListener('click', async () => {
    const slug = $('media-slug-input').value.trim();
    if (!slug) return;
    const result = $('media-list-result');
    result.innerHTML = '<span class="spinner"></span>';
    const { res, data } = await apiFetch('/media/' + encodeURIComponent(slug));
    if (!res.ok) {
      result.innerHTML = '<span style="color:var(--red)">' + escHtml(data.error ?? 'Error') + '</span>';
      return;
    }
    const files = Array.isArray(data) ? data : (data.files ?? []);
    if (!files.length) { result.innerHTML = '<span class="empty">No media</span>'; return; }
    result.innerHTML = '<table><thead><tr><th>Filename</th><th>URL</th><th></th></tr></thead><tbody>' +
      files.map(f => {
        const url = escHtml(f.url ?? f.publicUrl ?? '');
        const name = escHtml(f.filename ?? f.name ?? '');
        return '<tr><td style="font-family:var(--mono);font-size:12px">' + name + '</td>' +
          '<td><a href="' + url + '" target="_blank" style="color:var(--accent-hover)">' + url + '</a></td>' +
          '<td><button class="danger" onclick="deleteMedia(\'' + escAttr(slug) + '\',\'' + escAttr(f.filename ?? f.name ?? '') + '\')">Delete</button></td></tr>';
      }).join('') +
    '</tbody></table>';
  });

  async function deleteMedia(slug, filename) {
    if (!confirm('Delete ' + filename + '?')) return;
    const { res } = await apiFetch('/media/' + encodeURIComponent(slug) + '/' + encodeURIComponent(filename), { method: 'DELETE' });
    if (res.ok) { toast('Deleted ' + filename); $('media-list-btn').click(); }
    else toast('Failed to delete', 'err');
  }

  // ── Generate image ────────────────────────────────────────────────────────
  $('gen-attach').addEventListener('change', () => {
    $('gen-alt-wrap').style.display = $('gen-attach').value === 'yes' ? '' : 'none';
  });

  $('gen-submit').addEventListener('click', async () => {
    const slug = $('gen-slug').value.trim();
    const filename = $('gen-filename').value.trim();
    const prompt = $('gen-prompt').value.trim();
    if (!slug || !filename || !prompt) { toast('Slug, filename and prompt are required', 'err'); return; }

    const attach = $('gen-attach').value === 'yes';
    const endpoint = attach ? '/media/generate-and-attach' : '/media/generate';

    const body = {
      postSlug: slug,
      filename,
      prompt,
      size: $('gen-size').value || undefined,
      quality: $('gen-quality').value || undefined,
    };
    if (attach) {
      body.alt = $('gen-alt').value || undefined;
      body.placement = 'frontmatter';
      body.field = 'image';
    }

    $('gen-submit').disabled = true;
    $('gen-spinner').style.display = '';
    $('gen-result').innerHTML = '';

    const { res, data } = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });

    $('gen-submit').disabled = false;
    $('gen-spinner').style.display = 'none';

    if (res.ok) {
      const url = data.url ?? data.publicUrl ?? '';
      toast('Image generated');
      $('gen-result').innerHTML = url
        ? '<div style="margin-top:8px"><a href="' + escHtml(url) + '" target="_blank" style="color:var(--accent-hover)">' + escHtml(url) + '</a></div>'
        : '';
    } else {
      toast(data.error ?? 'Generation failed', 'err');
    }
  });

  // ── Refresh ───────────────────────────────────────────────────────────────
  $('refresh-btn').addEventListener('click', () => { loadHealth(); loadPosts(); });

  // ── Utils ─────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escAttr(str) {
    return String(str).replace(/'/g,"\\'");
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  loadHealth();
  loadPosts();
</script>
</body>
</html>`;

export async function uiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_request, reply) => {
    return reply
      .code(200)
      .header("Content-Type", "text/html; charset=utf-8")
      .send(HTML);
  });
}
