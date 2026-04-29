/**
 * routes/ui.ts
 *
 * GET / — serves the full CMS single-page application.
 *
 * Pages: Login → Posts list → Post editor (EasyMDE) → Media manager
 * Auth:  httpOnly JWT cookie issued by POST /cms/login
 */

import type { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0f1117; --surface: #1a1d27; --surface2: #22263a; --surface3: #2a2f45;
  --border: #2e3350; --text: #e2e8f0; --muted: #8892a4; --accent: #6366f1;
  --accent-h: #818cf8; --green: #22c55e; --red: #ef4444; --yellow: #eab308;
  --radius: 8px; --font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mono: "Fira Code", "Cascadia Code", ui-monospace, monospace;
}
body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.6; }
/* ── Login ── */
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 40px; width: 100%; max-width: 360px; }
.login-card h1 { font-size: 22px; font-weight: 700; color: var(--accent-h); margin-bottom: 6px; }
.login-card .sub { color: var(--muted); font-size: 13px; margin-bottom: 28px; }
.login-card .field { margin-bottom: 14px; }
.login-card .field label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 4px; }
.login-card input { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-family: var(--font); font-size: 13px; padding: 8px 12px; outline: none; }
.login-card input:focus { border-color: var(--accent); }
.login-card button[type=submit] { width: 100%; margin-top: 8px; padding: 9px; font-size: 14px; font-weight: 600; }
.err-msg { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.4); border-radius: var(--radius); color: var(--red); font-size: 13px; padding: 8px 12px; margin-bottom: 12px; }
/* ── App Shell ── */
.app-header { display: flex; align-items: center; height: 52px; padding: 0 20px; gap: 8px; background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; }
.brand { font-size: 15px; font-weight: 700; color: var(--accent-h); margin-right: 8px; white-space: nowrap; }
.nav-btn { background: transparent; border: none; border-radius: var(--radius); color: var(--muted); cursor: pointer; font-family: var(--font); font-size: 13px; font-weight: 500; padding: 5px 10px; white-space: nowrap; }
.nav-btn:hover { color: var(--text); background: var(--surface2); }
.nav-btn.active { color: var(--text); background: var(--surface2); }
.nav-spacer { flex: 1; }
.logout-btn { background: transparent; border: 1px solid var(--border); border-radius: var(--radius); color: var(--muted); cursor: pointer; font-family: var(--font); font-size: 12px; padding: 4px 10px; }
.logout-btn:hover { border-color: var(--red); color: var(--red); background: transparent; }
/* ── Generic ── */
.view { max-width: 1240px; margin: 0 auto; padding: 24px 20px; }
.view-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.view-hdr h2 { font-size: 18px; font-weight: 600; }
button { background: var(--accent); border: none; border-radius: var(--radius); color: #fff; cursor: pointer; font-family: var(--font); font-size: 13px; font-weight: 500; padding: 6px 14px; white-space: nowrap; transition: background .15s; }
button:hover { background: var(--accent-h); }
button:disabled { opacity: .4; cursor: default; }
button.ghost { background: transparent; border: 1px solid var(--border); color: var(--muted); }
button.ghost:hover { border-color: var(--accent); color: var(--text); background: transparent; }
button.danger { background: transparent; border: 1px solid transparent; color: var(--red); padding: 3px 8px; font-size: 12px; }
button.danger:hover { background: rgba(239,68,68,.1); }
button.success { background: transparent; border: 1px solid transparent; color: var(--green); padding: 3px 8px; font-size: 12px; }
button.success:hover { background: rgba(34,197,94,.1); }
button.btn-sm { padding: 3px 8px; font-size: 12px; }
.badge { display: inline-block; border-radius: 4px; font-size: 11px; font-weight: 500; padding: 2px 7px; }
.badge.draft { background: rgba(234,179,8,.15); color: var(--yellow); }
.badge.published { background: rgba(34,197,94,.15); color: var(--green); }
.field label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 4px; }
input, textarea, select { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-family: var(--font); font-size: 13px; padding: 6px 10px; outline: none; width: 100%; }
input:focus, textarea:focus, select:focus { border-color: var(--accent); }
textarea { resize: vertical; }
.empty { color: var(--muted); font-size: 13px; text-align: center; padding: 32px 0; }
.spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .6s linear infinite; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
th { text-align: left; padding: 9px 14px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--border); }
td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--surface2); }
.row-actions { display: flex; gap: 4px; align-items: center; }
.toast-wrap { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 200; }
.toast { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-size: 13px; max-width: 320px; padding: 10px 14px; animation: toast-in .2s ease; }
.toast.ok { border-color: var(--green); }
.toast.err { border-color: var(--red); }
@keyframes toast-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
/* ── Editor ── */
.editor-top { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.editor-slug { font-family: var(--mono); font-size: 12px; color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editor-btns { display: flex; gap: 8px; }
.editor-grid { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
.editor-main .meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.editor-main .meta-row .full { grid-column: 1 / -1; }
.editor-main .field { margin-bottom: 0; }
.editor-body-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 6px; }
.editor-sidebar { position: sticky; top: 70px; }
.sb-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 14px; }
.sb-card h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 12px; }
.image-preview { margin-bottom: 10px; }
.image-preview img { max-width: 100%; border-radius: 4px; display: block; }
.image-preview .no-img { color: var(--muted); font-size: 12px; font-style: italic; }
.drop-zone { border: 2px dashed var(--border); border-radius: var(--radius); padding: 16px 12px; text-align: center; color: var(--muted); font-size: 12px; cursor: pointer; transition: border-color .15s, background .15s; }
.drop-zone:hover, .drop-zone.over { border-color: var(--accent); background: rgba(99,102,241,.05); }
.drop-zone a { color: var(--accent-h); text-decoration: none; }
.sb-field { margin-bottom: 8px; }
/* ── Media View ── */
.media-controls { display: flex; gap: 8px; margin-bottom: 18px; align-items: center; }
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-top: 16px; }
.media-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.media-card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: var(--surface2); }
.media-card-meta { padding: 8px; }
.media-card-name { font-size: 11px; font-family: var(--mono); color: var(--muted); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
.media-card-actions { display: flex; gap: 4px; }
.upload-panel, .gen-panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; margin-top: 14px; }
.upload-panel h3, .gen-panel h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 14px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.form-row .full { grid-column: 1 / -1; }
.form-row .field { margin-bottom: 0; }
/* ── EasyMDE overrides ── */
.EasyMDEContainer .CodeMirror { background: var(--surface2); color: var(--text); border-color: var(--border); font-family: var(--mono); font-size: 13px; min-height: 380px; border-radius: 0 0 var(--radius) var(--radius); }
.EasyMDEContainer .CodeMirror-scroll { min-height: 380px; }
.editor-toolbar { background: var(--surface); border-color: var(--border); border-radius: var(--radius) var(--radius) 0 0; }
.editor-toolbar button { color: var(--muted) !important; }
.editor-toolbar button:hover, .editor-toolbar button.active { color: var(--text) !important; background: var(--surface2) !important; border-color: var(--border) !important; }
.editor-toolbar i.separator { border-color: var(--border) !important; }
.editor-preview { background: var(--surface2); color: var(--text); }
.editor-preview h1,.editor-preview h2,.editor-preview h3 { color: var(--text); }
.editor-preview a { color: var(--accent-h); }
.editor-preview code { background: var(--surface3); border-radius: 4px; padding: 1px 5px; }
`;

// ---------------------------------------------------------------------------
// HTML skeleton
// ---------------------------------------------------------------------------
const HTML_BODY = `
<!-- ═══════════════════════ LOGIN ═══════════════════════════════════════════ -->
<div id="page-login">
  <div class="login-wrap">
    <div class="login-card">
      <h1>&#x2726; Blog CMS</h1>
      <p class="sub">Sign in to manage your content</p>
      <div id="login-err" class="err-msg" style="display:none"></div>
      <form id="login-form" autocomplete="on">
        <div class="field"><label>Username</label><input id="l-user" type="text" autocomplete="username" required /></div>
        <div class="field"><label>Password</label><input id="l-pass" type="password" autocomplete="current-password" required /></div>
        <button type="submit" id="login-btn">Sign In</button>
      </form>
    </div>
  </div>
</div>

<!-- ═══════════════════════ APP SHELL ════════════════════════════════════════ -->
<div id="page-app" style="display:none">
  <header class="app-header">
    <span class="brand">&#x2726; Blog CMS</span>
    <button class="nav-btn active" data-page="posts">Posts</button>
    <button class="nav-btn" data-page="media">Media</button>
    <span class="nav-spacer"></span>
    <span id="hdr-user" style="color:var(--muted);font-size:12px;margin-right:8px"></span>
    <button class="logout-btn" id="btn-logout">Sign Out</button>
  </header>

  <!-- ── Posts view ────────────────────────────────────────────── -->
  <div id="view-posts" class="view">
    <div class="view-hdr">
      <h2>Posts</h2>
      <button id="btn-new-post">+ New Post</button>
    </div>
    <table>
      <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Date</th><th></th></tr></thead>
      <tbody id="posts-tbody"><tr><td colspan="5"><div class="empty"><span class="spinner"></span></div></td></tr></tbody>
    </table>
  </div>

  <!-- ── Editor view ───────────────────────────────────────────── -->
  <div id="view-editor" class="view" style="display:none">
    <div class="editor-top">
      <button class="ghost btn-sm" id="btn-editor-back">&#x2190; Posts</button>
      <span class="editor-slug" id="editor-slug-label">New Post</span>
      <div class="editor-btns">
        <button class="ghost" id="btn-save-draft">Save Draft</button>
        <button id="btn-publish">Publish</button>
      </div>
    </div>
    <div class="editor-grid">
      <!-- Left: metadata + body -->
      <div class="editor-main">
        <div class="meta-row">
          <div class="field full"><label>Title *</label><input type="text" id="ef-title" placeholder="Post title" /></div>
          <div class="field full"><label>Description</label><input type="text" id="ef-desc" placeholder="Short description shown in previews" /></div>
          <div class="field"><label>Author</label><input type="text" id="ef-author" placeholder="Leave blank for default" /></div>
          <div class="field"><label>Tags (comma-separated)</label><input type="text" id="ef-tags" placeholder="tag1, tag2" /></div>
          <div class="field"><label>Date</label><input type="date" id="ef-date" /></div>
          <div class="field"><label>Status</label>
            <select id="ef-draft">
              <option value="true">Draft</option>
              <option value="false">Published</option>
            </select>
          </div>
        </div>
        <div class="editor-body-label">Body</div>
        <textarea id="ef-body"></textarea>
      </div>
      <!-- Right: sidebar -->
      <aside class="editor-sidebar">
        <div class="sb-card">
          <h3>Featured Image</h3>
          <div class="image-preview" id="ef-img-preview"><p class="no-img">No image set</p></div>
          <div class="drop-zone" id="ef-drop">
            <input type="file" id="ef-file" accept="image/*,.pdf" style="display:none" />
            Drag &amp; drop or <a href="#" id="ef-browse">browse</a>
          </div>
          <div class="sb-field" style="margin-top:8px"><label>Filename</label><input type="text" id="ef-upload-name" placeholder="hero.webp" /></div>
          <button class="ghost" style="width:100%;margin-top:6px" id="btn-ef-upload">Upload</button>
        </div>
        <div class="sb-card">
          <h3>Generate with AI</h3>
          <div class="sb-field"><label>Prompt *</label><textarea id="ef-gen-prompt" rows="3" placeholder="A realistic editorial hero image for a blog post about..."></textarea></div>
          <div class="sb-field"><label>Filename</label><input type="text" id="ef-gen-name" placeholder="hero.webp" /></div>
          <div class="sb-field"><label>Alt text</label><input type="text" id="ef-gen-alt" placeholder="Descriptive alt text" /></div>
          <div class="sb-field"><label>Size</label>
            <select id="ef-gen-size">
              <option value="">Default</option>
              <option value="1024x1024">1024&#xD7;1024</option>
              <option value="1536x1024">1536&#xD7;1024 (landscape)</option>
              <option value="1024x1536">1024&#xD7;1536 (portrait)</option>
            </select>
          </div>
          <button style="width:100%;margin-top:6px" id="btn-ef-gen">
            <span id="ef-gen-lbl">Generate &amp; Attach</span>
            <span id="ef-gen-spin" style="display:none"><span class="spinner"></span></span>
          </button>
        </div>
      </aside>
    </div>
  </div>

  <!-- ── Media view ────────────────────────────────────────────── -->
  <div id="view-media" class="view" style="display:none">
    <div class="view-hdr"><h2>Media</h2></div>

    <div class="media-controls">
      <input type="text" id="m-slug" placeholder="post-slug" style="max-width:260px" />
      <button id="btn-m-load">Load</button>
    </div>
    <div id="m-grid"></div>

    <!-- Upload panel -->
    <div class="upload-panel">
      <h3>Upload File</h3>
      <div class="form-row">
        <div class="field"><label>Post Slug *</label><input type="text" id="m-up-slug" placeholder="my-post" /></div>
        <div class="field"><label>Filename *</label><input type="text" id="m-up-name" placeholder="hero.webp" /></div>
      </div>
      <div class="drop-zone" id="m-drop">
        <input type="file" id="m-file" accept="image/*,.pdf" style="display:none" />
        Drag &amp; drop or <a href="#" id="m-browse">browse</a>
      </div>
      <button style="margin-top:10px" id="btn-m-upload">Upload</button>
    </div>

    <!-- Generate panel -->
    <div class="gen-panel">
      <h3>Generate with AI</h3>
      <div class="form-row">
        <div class="field"><label>Post Slug *</label><input type="text" id="m-gen-slug" placeholder="my-post" /></div>
        <div class="field"><label>Filename *</label><input type="text" id="m-gen-name" placeholder="hero.webp" /></div>
        <div class="field full"><label>Prompt *</label><textarea id="m-gen-prompt" rows="3" placeholder="A realistic editorial hero image..."></textarea></div>
        <div class="field"><label>Size</label>
          <select id="m-gen-size">
            <option value="">Default</option>
            <option value="1024x1024">1024&#xD7;1024</option>
            <option value="1536x1024">1536&#xD7;1024</option>
            <option value="1024x1536">1024&#xD7;1536</option>
          </select>
        </div>
      </div>
      <button id="btn-m-gen">Generate</button>
    </div>
  </div>
</div>

<div class="toast-wrap" id="toast-wrap"></div>
`;

// ---------------------------------------------------------------------------
// Client-side JavaScript
// All strings use double-quotes. No template literals. No inline event handlers.
// ---------------------------------------------------------------------------
const JS = `
(function () {
  "use strict";

  var TOKEN = "";
  var editSlug = null;
  var mde = null;
  var editorFile = null;
  var mediaFile = null;

  function $(id) { return document.getElementById(id); }

  // ── Toast ──────────────────────────────────────────────────────────────
  function toast(msg, type) {
    type = type || "ok";
    var el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    $("toast-wrap").appendChild(el);
    setTimeout(function () { el.remove(); }, 4000);
  }

  // ── Escape HTML ────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ── API fetch ──────────────────────────────────────────────────────────
  function api(method, path, body) {
    var headers = { "Content-Type": "application/json" };
    if (TOKEN) headers["Authorization"] = "Bearer " + TOKEN;
    var opts = { method: method, headers: headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }

  // ── Auth ───────────────────────────────────────────────────────────────
  function checkSession() {
    TOKEN = sessionStorage.getItem("cms_tok") || "";
    if (TOKEN) { showApp(); return; }
    fetch("/cms/session").then(function (r) {
      if (r.ok) {
        r.json().then(function (d) {
          TOKEN = d.token || "";
          sessionStorage.setItem("cms_tok", TOKEN);
          $("hdr-user").textContent = d.username || "";
          showApp();
        });
      } else {
        showLogin();
      }
    }).catch(function () { showLogin(); });
  }

  function doLogin(username, password) {
    return fetch("/cms/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password })
    }).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (d) { throw new Error(d.error || "Login failed"); });
      }
      return fetch("/cms/session").then(function (r2) {
        return r2.json().then(function (d) {
          TOKEN = d.token || "";
          sessionStorage.setItem("cms_tok", TOKEN);
          $("hdr-user").textContent = d.username || "";
          showApp();
        });
      });
    });
  }

  function doLogout() {
    fetch("/cms/logout", { method: "POST" }).catch(function () {});
    sessionStorage.removeItem("cms_tok");
    TOKEN = "";
    showLogin();
  }

  // ── Page switching ─────────────────────────────────────────────────────
  function showLogin() {
    $("page-login").style.display = "";
    $("page-app").style.display = "none";
  }

  function showApp() {
    $("page-login").style.display = "none";
    $("page-app").style.display = "";
    showView("posts");
    loadPosts();
  }

  function showView(name) {
    ["posts", "editor", "media"].forEach(function (v) {
      var el = $("view-" + v);
      if (el) el.style.display = v === name ? "" : "none";
    });
    document.querySelectorAll(".nav-btn[data-page]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-page") === name);
    });
  }

  // ── Posts list ─────────────────────────────────────────────────────────
  function loadPosts() {
    var tb = $("posts-tbody");
    tb.innerHTML = "<tr><td colspan='5'><div class='empty'><span class='spinner'></span></div></td></tr>";
    api("GET", "/posts").then(function (r) {
      if (r.status === 401) { doLogout(); return; }
      var posts = (r.data && r.data.posts) ? r.data.posts : [];
      if (!posts.length) {
        tb.innerHTML = "<tr><td colspan='5'><div class='empty'>No posts yet. Create your first one!</div></td></tr>";
        return;
      }
      tb.innerHTML = "";
      posts.forEach(function (p) {
        var isDraft = !!p.draft;
        var tr = document.createElement("tr");
        tr.innerHTML = [
          "<td><strong>" + esc(p.title || p.slug) + "</strong></td>",
          "<td style='font-family:var(--mono);font-size:12px;color:var(--muted)'>" + esc(p.slug) + "</td>",
          "<td><span class='badge " + (isDraft ? "draft" : "published") + "'>" + (isDraft ? "Draft" : "Published") + "</span></td>",
          "<td style='font-size:12px;color:var(--muted)'>" + esc(p.date ? String(p.date).slice(0,10) : "—") + "</td>",
          "<td><div class='row-actions'>",
            "<button class='ghost btn-sm' data-action='edit' data-slug='" + esc(p.slug) + "'>Edit</button>",
            isDraft ? "<button class='success btn-sm' data-action='publish' data-slug='" + esc(p.slug) + "'>Publish</button>" : "",
            "<button class='danger btn-sm' data-action='del-post' data-slug='" + esc(p.slug) + "'>Delete</button>",
          "</div></td>"
        ].join("");
        tb.appendChild(tr);
      });
    }).catch(function () {
      tb.innerHTML = "<tr><td colspan='5'><div class='empty' style='color:var(--red)'>Failed to load posts</div></td></tr>";
    });
  }

  // ── Editor ─────────────────────────────────────────────────────────────
  function openEditor(slug) {
    editSlug = slug || null;
    showView("editor");

    // Init EasyMDE once
    if (!mde) {
      mde = new EasyMDE({
        element: $("ef-body"),
        spellChecker: false,
        autosave: { enabled: false },
        toolbar: [
          "bold","italic","heading","|",
          "quote","unordered-list","ordered-list","|",
          "link","image","|",
          "preview","side-by-side","fullscreen","|","guide"
        ],
        status: ["lines","words","cursor"]
      });
    } else {
      setTimeout(function () { if (mde && mde.codemirror) mde.codemirror.refresh(); }, 20);
    }

    if (slug) {
      $("editor-slug-label").textContent = slug;
      $("btn-save-draft").textContent = "Save";
      api("GET", "/posts/" + encodeURIComponent(slug)).then(function (r) {
        if (!r.ok) { toast("Failed to load post", "err"); return; }
        var fm = r.data.frontmatter || {};
        $("ef-title").value = fm.title || "";
        $("ef-desc").value = fm.description || "";
        $("ef-author").value = fm.author || "";
        $("ef-tags").value = (Array.isArray(fm.tags) ? fm.tags : []).join(", ");
        $("ef-date").value = fm.date ? String(fm.date).slice(0,10) : "";
        $("ef-draft").value = fm.draft ? "true" : "false";
        mde.value(r.data.body || "");
        renderImagePreview(fm.image);
      });
    } else {
      $("editor-slug-label").textContent = "New Post";
      $("btn-save-draft").textContent = "Save Draft";
      $("ef-title").value = "";
      $("ef-desc").value = "";
      $("ef-author").value = "";
      $("ef-tags").value = "";
      $("ef-date").value = new Date().toISOString().slice(0,10);
      $("ef-draft").value = "true";
      if (mde) mde.value("");
      renderImagePreview(null);
    }
  }

  function renderImagePreview(image) {
    var url = typeof image === "string" ? image : (image && image.src ? image.src : "");
    var el = $("ef-img-preview");
    if (url) {
      el.innerHTML = "<img src='" + esc(url) + "' alt='featured' />";
    } else {
      el.innerHTML = "<p class='no-img'>No image set</p>";
    }
  }

  function savePost(publish) {
    var title = $("ef-title").value.trim();
    if (!title) { toast("Title is required", "err"); return; }
    var tags = $("ef-tags").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var payload = {
      title: title,
      description: $("ef-desc").value || undefined,
      author: $("ef-author").value || undefined,
      tags: tags.length ? tags : undefined,
      date: $("ef-date").value || undefined,
      body: mde ? mde.value() : "",
      draft: publish ? false : ($("ef-draft").value === "true")
    };

    if (editSlug) {
      api("PUT", "/posts/" + encodeURIComponent(editSlug), payload).then(function (r) {
        if (r.ok) {
          toast(publish ? "Published!" : "Saved!");
          if (publish) $("ef-draft").value = "false";
          loadPosts();
        } else {
          toast((r.data && r.data.error) || "Save failed", "err");
        }
      });
    } else {
      api("POST", "/posts", payload).then(function (r) {
        if (r.ok) {
          editSlug = r.data.slug || null;
          if (editSlug) $("editor-slug-label").textContent = editSlug;
          toast(publish ? "Published!" : "Post created!");
          loadPosts();
        } else {
          toast((r.data && r.data.error) || "Create failed", "err");
        }
      });
    }
  }

  // ── Editor image upload ────────────────────────────────────────────────
  function setupEditorDrop() {
    var zone = $("ef-drop");
    var fileIn = $("ef-file");
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("over"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault(); zone.classList.remove("over");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) selectEditorFile(f);
    });
    $("ef-browse").addEventListener("click", function (e) { e.preventDefault(); fileIn.click(); });
    fileIn.addEventListener("change", function () {
      if (fileIn.files && fileIn.files[0]) selectEditorFile(fileIn.files[0]);
    });
  }

  function selectEditorFile(f) {
    editorFile = f;
    if (!$("ef-upload-name").value) {
      $("ef-upload-name").value = f.name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
    }
    $("ef-drop").textContent = "Selected: " + f.name;
  }

  function uploadEditorFile() {
    if (!editSlug) { toast("Save the post first to get a slug", "err"); return; }
    if (!editorFile) { toast("Select a file first", "err"); return; }
    var name = $("ef-upload-name").value.trim();
    if (!name) { toast("Enter a filename", "err"); return; }
    var btn = $("btn-ef-upload");
    btn.disabled = true;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var b64Parts = ev.target.result.split(",");
      var b64 = b64Parts.length > 1 ? b64Parts[1] : b64Parts[0];
      api("POST", "/media", {
        postSlug: editSlug, filename: name,
        contentType: editorFile.type || "image/webp",
        contentBase64: b64, alt: name
      }).then(function (r) {
        btn.disabled = false;
        if (r.ok) {
          var url = (r.data && (r.data.url || r.data.publicUrl)) || "";
          toast("Uploaded: " + name);
          if (url) renderImagePreview(url);
        } else {
          toast((r.data && r.data.error) || "Upload failed", "err");
        }
      });
    };
    reader.readAsDataURL(editorFile);
  }

  // ── Editor AI generate ─────────────────────────────────────────────────
  function generateEditorImage() {
    if (!editSlug) { toast("Save the post first to get a slug", "err"); return; }
    var prompt = $("ef-gen-prompt").value.trim();
    if (!prompt) { toast("Enter a prompt", "err"); return; }
    var name = $("ef-gen-name").value.trim() || "hero.webp";
    var alt = $("ef-gen-alt").value.trim() || name;
    var size = $("ef-gen-size").value;
    var btn = $("btn-ef-gen");
    btn.disabled = true;
    $("ef-gen-lbl").style.display = "none";
    $("ef-gen-spin").style.display = "";
    var payload = { postSlug: editSlug, filename: name, prompt: prompt, alt: alt, placement: "frontmatter", field: "image" };
    if (size) payload.size = size;
    api("POST", "/media/generate-and-attach", payload).then(function (r) {
      btn.disabled = false;
      $("ef-gen-lbl").style.display = "";
      $("ef-gen-spin").style.display = "none";
      if (r.ok) {
        var url = (r.data && (r.data.url || r.data.publicUrl)) || "";
        toast("Image generated and attached!");
        if (url) renderImagePreview(url);
      } else {
        toast((r.data && r.data.error) || "Generation failed", "err");
      }
    });
  }

  // ── Media view ─────────────────────────────────────────────────────────
  function loadMediaGrid() {
    var slug = $("m-slug").value.trim();
    if (!slug) return;
    var grid = $("m-grid");
    grid.innerHTML = "<div class='empty'><span class='spinner'></span></div>";
    api("GET", "/media/" + encodeURIComponent(slug)).then(function (r) {
      var items = (r.data && (r.data.media || r.data.files)) || [];
      if (!items.length) { grid.innerHTML = "<div class='empty'>No media for this post</div>"; return; }
      grid.innerHTML = "";
      var mg = document.createElement("div");
      mg.className = "media-grid";
      items.forEach(function (m) {
        var url = m.url || m.publicUrl || "";
        var name = m.filename || m.name || "";
        var card = document.createElement("div");
        card.className = "media-card";
        card.innerHTML = [
          "<img src='" + esc(url) + "' alt='" + esc(name) + "' loading='lazy' />",
          "<div class='media-card-meta'>",
            "<span class='media-card-name'>" + esc(name) + "</span>",
            "<div class='media-card-actions'>",
              "<button class='ghost btn-sm' data-action='copy-url' data-url='" + esc(url) + "'>Copy</button>",
              "<button class='danger btn-sm' data-action='del-media' data-slug='" + esc(slug) + "' data-filename='" + esc(name) + "'>Del</button>",
            "</div>",
          "</div>"
        ].join("");
        mg.appendChild(card);
      });
      grid.appendChild(mg);
    });
  }

  function setupMediaDrop() {
    var zone = $("m-drop");
    var fileIn = $("m-file");
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("over"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault(); zone.classList.remove("over");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) selectMediaFile(f);
    });
    $("m-browse").addEventListener("click", function (e) { e.preventDefault(); fileIn.click(); });
    fileIn.addEventListener("change", function () {
      if (fileIn.files && fileIn.files[0]) selectMediaFile(fileIn.files[0]);
    });
  }

  function selectMediaFile(f) {
    mediaFile = f;
    if (!$("m-up-name").value) $("m-up-name").value = f.name;
    $("m-drop").textContent = "Selected: " + f.name;
  }

  function uploadMediaFile() {
    var slug = $("m-up-slug").value.trim();
    var name = $("m-up-name").value.trim();
    if (!slug) { toast("Enter a post slug", "err"); return; }
    if (!mediaFile) { toast("Select a file first", "err"); return; }
    if (!name) { toast("Enter a filename", "err"); return; }
    var btn = $("btn-m-upload");
    btn.disabled = true;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var b64Parts = ev.target.result.split(",");
      var b64 = b64Parts.length > 1 ? b64Parts[1] : b64Parts[0];
      api("POST", "/media", {
        postSlug: slug, filename: name,
        contentType: mediaFile.type || "image/webp",
        contentBase64: b64, alt: name
      }).then(function (r) {
        btn.disabled = false;
        if (r.ok) {
          toast("Uploaded!");
          if ($("m-slug").value === slug) loadMediaGrid();
        } else {
          toast((r.data && r.data.error) || "Upload failed", "err");
        }
      });
    };
    reader.readAsDataURL(mediaFile);
  }

  function generateMediaImage() {
    var slug = $("m-gen-slug").value.trim();
    var prompt = $("m-gen-prompt").value.trim();
    var name = $("m-gen-name").value.trim() || "hero.webp";
    if (!slug) { toast("Enter a post slug", "err"); return; }
    if (!prompt) { toast("Enter a prompt", "err"); return; }
    var size = $("m-gen-size").value;
    var btn = $("btn-m-gen");
    btn.disabled = true;
    var payload = { postSlug: slug, filename: name, prompt: prompt };
    if (size) payload.size = size;
    api("POST", "/media/generate", payload).then(function (r) {
      btn.disabled = false;
      if (r.ok) {
        toast("Image generated!");
        if ($("m-slug").value === slug) loadMediaGrid();
      } else {
        toast((r.data && r.data.error) || "Generation failed", "err");
      }
    });
  }

  // ── Event delegation ───────────────────────────────────────────────────
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (btn) {
      var action = btn.getAttribute("data-action");
      var slug = btn.getAttribute("data-slug");
      var fname = btn.getAttribute("data-filename");
      var url = btn.getAttribute("data-url");
      if (action === "edit") {
        openEditor(slug);
      } else if (action === "publish") {
        if (!confirm("Publish post: " + slug + "?")) return;
        api("POST", "/posts/" + encodeURIComponent(slug) + "/publish").then(function (r) {
          if (r.ok) { toast("Published!"); loadPosts(); }
          else toast((r.data && r.data.error) || "Failed to publish", "err");
        });
      } else if (action === "del-post") {
        if (!confirm("Delete '" + slug + "'? This cannot be undone.")) return;
        api("DELETE", "/posts/" + encodeURIComponent(slug)).then(function (r) {
          if (r.ok) { toast("Deleted."); loadPosts(); }
          else toast("Delete failed", "err");
        });
      } else if (action === "del-media") {
        if (!confirm("Delete " + fname + "?")) return;
        api("DELETE", "/media/" + encodeURIComponent(slug) + "/" + encodeURIComponent(fname)).then(function (r) {
          if (r.ok) { toast("Deleted."); loadMediaGrid(); }
          else toast("Delete failed", "err");
        });
      } else if (action === "copy-url") {
        navigator.clipboard.writeText(url).then(function () { toast("URL copied!"); }).catch(function () { toast("Copy failed", "err"); });
      }
    }
    var navBtn = e.target.closest("[data-page]");
    if (navBtn) {
      var page = navBtn.getAttribute("data-page");
      showView(page);
      if (page === "posts") loadPosts();
      if (page === "media") loadMediaGrid();
    }
  });

  // ── Static event listeners ─────────────────────────────────────────────
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = $("login-btn");
    var err = $("login-err");
    btn.disabled = true;
    err.style.display = "none";
    doLogin($("l-user").value, $("l-pass").value).catch(function (ex) {
      err.textContent = ex.message || "Login failed";
      err.style.display = "";
      btn.disabled = false;
    });
  });

  $("btn-logout").addEventListener("click", function () { doLogout(); });
  $("btn-new-post").addEventListener("click", function () { openEditor(null); });
  $("btn-editor-back").addEventListener("click", function () { showView("posts"); loadPosts(); });
  $("btn-save-draft").addEventListener("click", function () { savePost(false); });
  $("btn-publish").addEventListener("click", function () { savePost(true); });
  $("btn-ef-upload").addEventListener("click", function () { uploadEditorFile(); });
  $("btn-ef-gen").addEventListener("click", function () { generateEditorImage(); });
  $("btn-m-load").addEventListener("click", function () { loadMediaGrid(); });
  $("m-slug").addEventListener("keydown", function (e) { if (e.key === "Enter") loadMediaGrid(); });
  $("btn-m-upload").addEventListener("click", function () { uploadMediaFile(); });
  $("btn-m-gen").addEventListener("click", function () { generateMediaImage(); });

  setupEditorDrop();
  setupMediaDrop();
  checkSession();
})();
`;

// ---------------------------------------------------------------------------
// Assemble final HTML
// ---------------------------------------------------------------------------
function buildHtml(): string {
  return [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"UTF-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
    "  <title>Blog CMS</title>",
    "  <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css\" />",
    "  <style>" + CSS + "</style>",
    "</head>",
    "<body>",
    HTML_BODY,
    "  <script src=\"https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.js\"></script>",
    "  <script>" + JS + "</script>",
    "</body>",
    "</html>",
  ].join("\n");
}

const HTML = buildHtml();

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------
export async function uiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_request, reply) => {
    return reply
      .code(200)
      .header("Content-Type", "text/html; charset=utf-8")
      .send(HTML);
  });
}
