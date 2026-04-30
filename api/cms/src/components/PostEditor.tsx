import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  MDXEditor,
  toolbarPlugin,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  diffSourcePlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
  InsertImage,
  Separator,
  UndoRedo,
  DiffSourceToggleWrapper,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { getPost, createPost, updatePost, uploadMedia, generateHeroImage } from '../lib/api'

interface Props {
  token: string
  slug: string | null   // null = new post
  onBack: () => void
}

interface FormState {
  title: string
  description: string
  author: string
  date: string
  tags: string
  draft: boolean
  body: string
}

const today = () => new Date().toISOString().slice(0, 10)
const emptyForm = (): FormState => ({
  title: '', description: '', author: '', date: today(), tags: '', draft: true, body: '',
})

export default function PostEditor({ token, slug: initialSlug, onBack }: Props) {
  const [slug, setSlug] = useState<string | null>(initialSlug)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [loading, setLoading] = useState(!!initialSlug)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [genModal, setGenModal] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const editorKey = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Load existing post
  useEffect(() => {
    if (!initialSlug) return
    setLoading(true)
    getPost(token, initialSlug)
      .then(post => {
        const fm = post.frontmatter
        setForm({
          title: String(fm.title ?? ''),
          description: String(fm.description ?? ''),
          author: String(fm.author ?? ''),
          date: fm.date ? String(fm.date).slice(0, 10) : today(),
          tags: Array.isArray(fm.tags) ? (fm.tags as string[]).join(', ') : '',
          draft: typeof fm.draft === 'boolean' ? fm.draft : true,
          body: post.body ?? '',
        })
        if (typeof fm.image === 'string' && fm.image) {
          setImageUrl(fm.image)
        } else if (fm.image && typeof fm.image === 'object') {
          setImageUrl((fm.image as { src?: string }).src ?? null)
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load post'))
      .finally(() => setLoading(false))
  }, [token, initialSlug])

  const field = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }))
    }

  async function save(asDraft: boolean) {
    if (!form.title.trim()) { setError('Title is required'); return }
    setError(null)
    setSaving(true)
    const tags = form.tags.split(',').map(s => s.trim()).filter(Boolean)
    const payload = {
      title: form.title.trim(),
      description: form.description || undefined,
      author: form.author || undefined,
      date: form.date || undefined,
      tags: tags.length ? tags : undefined,
      draft: asDraft,
      body: form.body,
    }
    try {
      if (slug) {
        await updatePost(token, slug, payload)
        setForm(f => ({ ...f, draft: asDraft }))
        showToast(asDraft ? 'Draft saved' : 'Post published!')
      } else {
        const result = await createPost(token, payload)
        setSlug(result.slug)
        setForm(f => ({ ...f, draft: asDraft }))
        showToast('Post created!')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'err')
    } finally {
      setSaving(false)
    }
  }

  const handleFilePick = useCallback(async (file: File) => {
    if (!slug) { showToast('Save the post first to add a header image', 'err'); return }
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'webp').toLowerCase()
      // Always use a timestamped filename so we never conflict with an existing
      // hero image (GitHub returns 422 if you PUT without a SHA).
      const r = await uploadMedia(token, slug, file, `hero-${Date.now()}.${ext}`)
      await updatePost(token, slug, { image: r.url })
      setImageUrl(r.url)
      showToast('Header image updated!')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'err')
    } finally {
      setUploading(false)
    }
  }, [token, slug, showToast])

  // Used by MDXEditor imagePlugin for in-body image uploads
  const imageUploadHandler = useCallback(async (file: File): Promise<string> => {
    if (!slug) {
      showToast('Save the post first to upload images', 'err')
      throw new Error('Post must be saved before uploading images')
    }
    const ext = (file.name.split('.').pop() || 'webp').toLowerCase()
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
    try {
      const r = await uploadMedia(token, slug, file, `${base}-${Date.now()}.${ext}`)
      return r.url
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Image upload failed', 'err')
      throw e
    }
  }, [token, slug, showToast])

  const handleGenerate = useCallback(async () => {
    if (!slug) { showToast('Save the post first to generate an image', 'err'); return }
    if (!genPrompt.trim()) return
    setGenerating(true)
    try {
      const r = await generateHeroImage(token, slug, genPrompt.trim())
      setImageUrl(r.url)
      setGenModal(false)
      setGenPrompt('')
      showToast('Image generated!')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Generation failed', 'err')
    } finally {
      setGenerating(false)
    }
  }, [token, slug, genPrompt, showToast])

  const handleRemoveImage = useCallback(async () => {
    if (!slug) return
    try {
      await updatePost(token, slug, { image: '' })
      setImageUrl(null)
      showToast('Header image removed')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to remove image', 'err')
    }
  }, [token, slug, showToast])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) handleFilePick(f)
  }, [handleFilePick])

  if (loading) {
    return <div className="view"><div className="empty"><span className="spinner" /> Loading post…</div></div>
  }

  return (
    <div className="view doc-view">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="editor-top">
        <button className="ghost btn-sm" onClick={onBack}>← Posts</button>
        <span className="editor-slug-label mono muted">{slug ?? 'New Post'}</span>
        <div style={{ flex: 1 }} />
        <div className="editor-btns">
          <button className="ghost" onClick={() => save(true)} disabled={saving}>
            {saving && <span className="spinner" />}
            {slug ? 'Save' : 'Save Draft'}
          </button>
          <button onClick={() => save(false)} disabled={saving}>
            Publish
          </button>
        </div>
      </div>

      {error && <div className="err-msg doc-err">{error}</div>}

      {/* ── Document ─────────────────────────────────────────────────────── */}
      <div className="doc-editor">

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) { handleFilePick(f); e.target.value = '' }
          }}
        />

        {/* ── Title ──────────────────────────────────────────────────────── */}
        <input
          className="doc-title-input"
          type="text"
          value={form.title}
          onChange={field('title')}
          placeholder="Post title"
          autoFocus={!initialSlug}
        />

        {/* ── Description ────────────────────────────────────────────────── */}
        <input
          className="doc-desc-input"
          type="text"
          value={form.description}
          onChange={field('description')}
          placeholder="A short description shown in previews…"
        />

        {/* ── Meta row ───────────────────────────────────────────────────── */}
        <div className="doc-meta-row">
          <input
            className="doc-meta-field doc-meta-date"
            type="date"
            value={form.date}
            onChange={field('date')}
            title="Publication date"
          />
          <span className="doc-meta-sep" aria-hidden>·</span>
          <input
            className="doc-meta-field"
            type="text"
            value={form.author}
            onChange={field('author')}
            placeholder="Author"
            style={{ width: 120 }}
            title="Author"
          />
          <span className="doc-meta-sep" aria-hidden>·</span>
          <input
            className="doc-meta-field"
            type="text"
            value={form.tags}
            onChange={field('tags')}
            placeholder="tag1, tag2, …"
            style={{ flex: 1, minWidth: 80 }}
            title="Tags (comma-separated)"
          />
          <span className="doc-meta-sep" aria-hidden>·</span>
          <button
            className={`doc-status-pill${form.draft ? ' is-draft' : ' is-published'}`}
            onClick={() => setForm(f => ({ ...f, draft: !f.draft }))}
            title="Toggle draft / published"
          >
            {form.draft ? 'Draft' : 'Published'}
          </button>
        </div>

        {/* ── Hero image ─────────────────────────────────────────────────── */}
        {imageUrl ? (
          <div
            className="doc-hero"
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <img src={imageUrl} alt="Header" className="doc-hero-img" />
            <div className="doc-hero-overlay">
              <button
                className="ghost btn-sm doc-hero-btn"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                ↑ Replace
              </button>
              <button
                className="ghost btn-sm doc-hero-btn"
                onClick={() => setGenModal(true)}
                disabled={uploading}
              >
                ✦ Generate
              </button>
              <button
                className="ghost btn-sm doc-hero-btn doc-hero-btn-remove"
                onClick={handleRemoveImage}
                disabled={uploading}
              >
                ✕ Remove
              </button>
            </div>
            {uploading && (
              <div className="doc-hero-uploading">
                <span className="spinner" /> Uploading…
              </div>
            )}
          </div>
        ) : (
          <div
            className={`doc-hero-empty${dragOver ? ' over' : ''}${!slug ? ' no-slug' : ''}`}
            onClick={() => slug
              ? fileRef.current?.click()
              : showToast('Save the post first to add a header image', 'err')
            }
            onDragOver={e => { e.preventDefault(); if (slug) setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {uploading ? (
              <><span className="spinner" /> Uploading…</>
            ) : (
              <>
                <span className="doc-hero-icon">⊕</span>
                <span className="doc-hero-label">
                  {slug ? 'Add header image' : 'Save post first to add a header image'}
                </span>
                {slug && (
                  <div className="doc-hero-empty-actions">
                    <button
                      className="ghost btn-sm"
                      onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                    >
                      ↑ Upload
                    </button>
                    <button
                      className="ghost btn-sm"
                      onClick={e => { e.stopPropagation(); setGenModal(true) }}
                    >
                      ✦ Generate
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Body ──────────────────────────────────────────────────────────────── */}
        <MDXEditor
          key={editorKey.current}
          className="dark dark-editor doc-mdx-editor"
          markdown={form.body}
          onChange={v => setForm(f => ({ ...f, body: v }))}
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            imagePlugin({ imageUploadHandler }),
            diffSourcePlugin({ viewMode: 'rich-text', readOnlyDiff: false }),
            toolbarPlugin({
              toolbarContents: () => (
                <DiffSourceToggleWrapper>
                  <UndoRedo />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <BlockTypeSelect />
                  <Separator />
                  <ListsToggle />
                  <Separator />
                  <CreateLink />
                  <InsertImage />
                </DiffSourceToggleWrapper>
              ),
            }),
          ]}
        />
      </div>

      {toast && (
        <div className={`toast-fixed toast ${toast.type}`}>{toast.msg}</div>
      )}

      {genModal && (
        <div className="modal-backdrop" onClick={() => !generating && setGenModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <h3>Generate Header Image</h3>
              <button className="modal-close" onClick={() => !generating && setGenModal(false)} disabled={generating}>✕</button>
            </div>
            <div className="modal-body">
              <label htmlFor="gen-prompt">Image prompt</label>
              <textarea
                id="gen-prompt"
                className="gen-prompt-ta"
                rows={4}
                placeholder="Describe the image you want to generate…"
                value={genPrompt}
                onChange={e => setGenPrompt(e.target.value)}
                disabled={generating}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate()
                }}
              />
              <p className="modal-hint">Tip: be descriptive — include style, lighting, and mood. ⌘↵ to generate.</p>
            </div>
            <div className="modal-footer">
              <button className="ghost" onClick={() => setGenModal(false)} disabled={generating}>Cancel</button>
              <button onClick={handleGenerate} disabled={generating || !genPrompt.trim()}>
                {generating ? <><span className="spinner" /> Generating…</> : '✦ Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

