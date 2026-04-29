import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getPost, createPost, updatePost, generateAndAttach, uploadMedia } from '../lib/api'

interface Props {
  token: string
  slug: string | null   // null = new post
  onBack: () => void
  onOpenMedia: (postSlug: string) => void
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
  title: '',
  description: '',
  author: '',
  date: today(),
  tags: '',
  draft: true,
  body: '',
})

export default function PostEditor({ token, slug: initialSlug, onBack, onOpenMedia }: Props) {
  const [slug, setSlug] = useState<string | null>(initialSlug)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [loading, setLoading] = useState(!!initialSlug)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Image sidebar state
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [genPrompt, setGenPrompt] = useState('')
  const [genFilename, setGenFilename] = useState('hero.webp')
  const [genSize, setGenSize] = useState('')
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadFileRef = useRef<HTMLInputElement>(null)
  const [uploadFilename, setUploadFilename] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

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
          title: (fm.title as string) || '',
          description: (fm.description as string) || '',
          author: (fm.author as string) || '',
          date: fm.date ? String(fm.date).slice(0, 10) : today(),
          tags: Array.isArray(fm.tags) ? (fm.tags as string[]).join(', ') : '',
          draft: typeof fm.draft === 'boolean' ? fm.draft : true,
          body: post.body || '',
        })
        // Extract image URL from frontmatter
        if (typeof fm.image === 'string') {
          setImageUrl(fm.image)
        } else if (fm.image && typeof fm.image === 'object') {
          const img = fm.image as { src?: string }
          setImageUrl(img.src || null)
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load post'))
      .finally(() => setLoading(false))
  }, [token, initialSlug])

  const field = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = key === 'draft' ? e.target.value === 'true' : e.target.value
    setForm(f => ({ ...f, [key]: value }))
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

  // Drag-and-drop for file upload
  useEffect(() => {
    const zone = dropRef.current
    if (!zone) return
    const onDragOver = (e: DragEvent) => { e.preventDefault(); zone.classList.add('over') }
    const onDragLeave = () => zone.classList.remove('over')
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      zone.classList.remove('over')
      const f = e.dataTransfer?.files?.[0]
      if (f) pickFile(f)
    }
    zone.addEventListener('dragover', onDragOver)
    zone.addEventListener('dragleave', onDragLeave)
    zone.addEventListener('drop', onDrop)
    return () => {
      zone.removeEventListener('dragover', onDragOver)
      zone.removeEventListener('dragleave', onDragLeave)
      zone.removeEventListener('drop', onDrop)
    }
  }, [])

  function pickFile(file: File) {
    setSelectedFile(file)
    if (!uploadFilename) {
      setUploadFilename(file.name.toLowerCase().replace(/[^a-z0-9.-]/g, '-'))
    }
  }

  async function handleUpload() {
    if (!slug) { showToast('Save the post first to get a slug', 'err'); return }
    if (!selectedFile) { showToast('Select a file first', 'err'); return }
    const filename = uploadFilename.trim() || selectedFile.name
    setUploading(true)
    try {
      const result = await uploadMedia(token, slug, selectedFile, filename)
      setImageUrl(result.url)
      showToast('Image uploaded!')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'err')
    } finally {
      setUploading(false)
    }
  }

  async function handleGenerate() {
    if (!slug) { showToast('Save the post first to get a slug', 'err'); return }
    if (!genPrompt.trim()) { showToast('Enter a prompt', 'err'); return }
    const filename = genFilename.trim() || 'hero.webp'
    setGenerating(true)
    try {
      const result = await generateAndAttach(token, slug, filename, genPrompt.trim(), genSize || undefined)
      setImageUrl(result.url)
      showToast('Image generated and attached!')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Generation failed', 'err')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="view">
        <div className="empty"><span className="spinner" /> Loading post…</div>
      </div>
    )
  }

  return (
    <div className="view">
      {/* Top bar */}
      <div className="editor-top">
        <button className="ghost btn-sm" onClick={onBack}>← Posts</button>
        <span className="editor-slug-label mono muted">
          {slug ? slug : 'New Post'}
        </span>
        {slug && (
          <button className="ghost btn-sm" onClick={() => onOpenMedia(slug)}>
            Media →
          </button>
        )}
        <div className="editor-btns">
          <button className="ghost" onClick={() => save(true)} disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {slug ? 'Save' : 'Save Draft'}
          </button>
          <button onClick={() => save(false)} disabled={saving}>
            Publish
          </button>
        </div>
      </div>

      {error && <div className="err-msg" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="editor-grid">
        {/* Left: metadata + body */}
        <div className="editor-main">
          <div className="meta-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="ef-title">Title *</label>
              <input id="ef-title" type="text" value={form.title} onChange={field('title')} placeholder="Post title" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="ef-desc">Description</label>
              <input id="ef-desc" type="text" value={form.description} onChange={field('description')} placeholder="Short description shown in previews" />
            </div>
            <div className="field">
              <label htmlFor="ef-author">Author</label>
              <input id="ef-author" type="text" value={form.author} onChange={field('author')} placeholder="Leave blank for default" />
            </div>
            <div className="field">
              <label htmlFor="ef-tags">Tags (comma-separated)</label>
              <input id="ef-tags" type="text" value={form.tags} onChange={field('tags')} placeholder="tag1, tag2" />
            </div>
            <div className="field">
              <label htmlFor="ef-date">Date</label>
              <input id="ef-date" type="date" value={form.date} onChange={field('date')} />
            </div>
            <div className="field">
              <label htmlFor="ef-draft">Status</label>
              <select id="ef-draft" value={form.draft ? 'true' : 'false'} onChange={field('draft')}>
                <option value="true">Draft</option>
                <option value="false">Published</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="ef-body">Body (Markdown)</label>
            <textarea
              id="ef-body"
              value={form.body}
              onChange={field('body')}
              rows={24}
              placeholder="Write your post in Markdown…"
              style={{ fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.6 }}
            />
          </div>
        </div>

        {/* Right: image sidebar */}
        <aside className="editor-sidebar">
          {/* Featured image preview */}
          <div className="sb-card">
            <h3>Featured Image</h3>
            <div className="image-preview">
              {imageUrl
                ? <img src={imageUrl} alt="featured" />
                : <p className="no-img">No image set</p>
              }
            </div>
          </div>

          {/* Upload */}
          <div className="sb-card">
            <h3>Upload Image</h3>
            <div
              ref={dropRef}
              className="drop-zone"
              onClick={() => uploadFileRef.current?.click()}
            >
              <input
                ref={uploadFileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
              />
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Drag & drop or click to browse'}
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="ef-upload-name">Filename</label>
              <input
                id="ef-upload-name"
                type="text"
                value={uploadFilename}
                onChange={e => setUploadFilename(e.target.value)}
                placeholder="hero.webp"
              />
            </div>
            <button
              className="ghost"
              style={{ width: '100%', marginTop: 8 }}
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? <><span className="spinner" /> Uploading…</> : 'Upload'}
            </button>
          </div>

          {/* AI Generate */}
          <div className="sb-card">
            <h3>Generate with AI</h3>
            <div className="field">
              <label htmlFor="ef-gen-prompt">Prompt *</label>
              <textarea
                id="ef-gen-prompt"
                rows={3}
                value={genPrompt}
                onChange={e => setGenPrompt(e.target.value)}
                placeholder="A realistic editorial hero image for…"
              />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="ef-gen-file">Filename</label>
              <input
                id="ef-gen-file"
                type="text"
                value={genFilename}
                onChange={e => setGenFilename(e.target.value)}
                placeholder="hero.webp"
              />
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="ef-gen-size">Size</label>
              <select id="ef-gen-size" value={genSize} onChange={e => setGenSize(e.target.value)}>
                <option value="">Default</option>
                <option value="1024x1024">1024×1024</option>
                <option value="1536x1024">1536×1024 (landscape)</option>
                <option value="1024x1536">1024×1536 (portrait)</option>
              </select>
            </div>
            <button
              style={{ width: '100%', marginTop: 8 }}
              onClick={handleGenerate}
              disabled={generating || !genPrompt.trim()}
            >
              {generating ? <><span className="spinner" /> Generating…</> : 'Generate & Attach'}
            </button>
          </div>
        </aside>
      </div>

      {toast && (
        <div className={`toast-fixed toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
