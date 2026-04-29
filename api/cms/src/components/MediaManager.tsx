import React, { useState, useEffect, useRef, useCallback } from 'react'
import { listMedia, deleteMedia, uploadMedia, generateImage, type MediaItem } from '../lib/api'

interface Props {
  token: string
  initialSlug?: string
  onBack: () => void
}

export default function MediaManager({ token, initialSlug, onBack }: Props) {
  const [postSlug, setPostSlug] = useState(initialSlug ?? '')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFilename, setUploadFilename] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Generate state
  const [genSlug, setGenSlug] = useState(initialSlug ?? '')
  const [genFilename, setGenFilename] = useState('hero.webp')
  const [genPrompt, setGenPrompt] = useState('')
  const [genSize, setGenSize] = useState('')
  const [generating, setGenerating] = useState(false)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const loadMedia = useCallback(async (slug: string) => {
    if (!slug.trim()) return
    setLoading(true)
    try {
      setMedia(await listMedia(token, slug.trim()))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load media', 'err')
    } finally {
      setLoading(false)
    }
  }, [token, showToast])

  useEffect(() => {
    if (initialSlug) loadMedia(initialSlug)
  }, [initialSlug, loadMedia])

  // Drag and drop setup
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
    setUploadFile(file)
    if (!uploadFilename) setUploadFilename(file.name.toLowerCase().replace(/[^a-z0-9.-]/g, '-'))
  }

  async function handleUpload() {
    if (!postSlug.trim()) { showToast('Enter a post slug', 'err'); return }
    if (!uploadFile) { showToast('Select a file first', 'err'); return }
    const filename = uploadFilename.trim() || uploadFile.name
    setUploading(true)
    try {
      await uploadMedia(token, postSlug.trim(), uploadFile, filename)
      showToast('Uploaded!')
      setUploadFile(null)
      setUploadFilename('')
      if (postSlug.trim() === postSlug.trim()) loadMedia(postSlug)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'err')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(slug: string, filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return
    try {
      await deleteMedia(token, slug, filename)
      showToast('Deleted')
      loadMedia(postSlug)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', 'err')
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      showToast('URL copied!')
    } catch {
      showToast('Copy failed', 'err')
    }
  }

  async function handleGenerate() {
    if (!genSlug.trim()) { showToast('Enter a post slug', 'err'); return }
    if (!genPrompt.trim()) { showToast('Enter a prompt', 'err'); return }
    const filename = genFilename.trim() || 'hero.webp'
    setGenerating(true)
    try {
      await generateImage(token, genSlug.trim(), filename, genPrompt.trim(), genSize || undefined)
      showToast('Image generated!')
      if (postSlug === genSlug) loadMedia(postSlug)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Generation failed', 'err')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="view">
      <div className="view-hdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="ghost btn-sm" onClick={onBack}>← Posts</button>
          <h2>Media</h2>
        </div>
      </div>

      {/* Slug picker */}
      <div className="media-controls">
        <input
          type="text"
          value={postSlug}
          onChange={e => setPostSlug(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadMedia(postSlug)}
          placeholder="post-slug"
          style={{ maxWidth: 280 }}
        />
        <button onClick={() => loadMedia(postSlug)}>Load</button>
      </div>

      {/* Media grid */}
      {loading && <div className="empty"><span className="spinner" /> Loading…</div>}
      {!loading && postSlug && media.length === 0 && (
        <div className="empty">No media for this post yet</div>
      )}
      {media.length > 0 && (
        <div className="media-grid">
          {media.map(item => (
            <div key={item.filename} className="media-card">
              <img
                src={item.url}
                alt={item.filename}
                loading="lazy"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="media-card-meta">
                <span className="media-card-name mono">{item.filename}</span>
                {item.size != null && (
                  <span className="media-card-size muted">{(item.size / 1024).toFixed(1)} KB</span>
                )}
                <div className="media-card-actions">
                  <button className="ghost btn-sm" onClick={() => copyUrl(item.url)}>Copy URL</button>
                  <button className="danger btn-sm" onClick={() => handleDelete(postSlug, item.filename)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload panel */}
      <div className="panel" style={{ marginTop: 24 }}>
        <h3>Upload File</h3>
        <div className="form-row">
          <div className="field">
            <label htmlFor="m-up-slug">Post Slug *</label>
            <input
              id="m-up-slug"
              type="text"
              value={postSlug}
              onChange={e => setPostSlug(e.target.value)}
              placeholder="my-post"
            />
          </div>
          <div className="field">
            <label htmlFor="m-up-name">Filename *</label>
            <input
              id="m-up-name"
              type="text"
              value={uploadFilename}
              onChange={e => setUploadFilename(e.target.value)}
              placeholder="hero.webp"
            />
          </div>
        </div>
        <div
          ref={dropRef}
          className="drop-zone"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
          />
          {uploadFile ? `Selected: ${uploadFile.name}` : 'Drag & drop or click to browse'}
        </div>
        <button
          style={{ marginTop: 10 }}
          onClick={handleUpload}
          disabled={uploading || !uploadFile}
        >
          {uploading ? <><span className="spinner" /> Uploading…</> : 'Upload'}
        </button>
      </div>

      {/* AI Generate panel */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Generate with AI</h3>
        <div className="form-row">
          <div className="field">
            <label htmlFor="m-gen-slug">Post Slug *</label>
            <input
              id="m-gen-slug"
              type="text"
              value={genSlug}
              onChange={e => setGenSlug(e.target.value)}
              placeholder="my-post"
            />
          </div>
          <div className="field">
            <label htmlFor="m-gen-name">Filename *</label>
            <input
              id="m-gen-name"
              type="text"
              value={genFilename}
              onChange={e => setGenFilename(e.target.value)}
              placeholder="hero.webp"
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="m-gen-prompt">Prompt *</label>
            <textarea
              id="m-gen-prompt"
              rows={3}
              value={genPrompt}
              onChange={e => setGenPrompt(e.target.value)}
              placeholder="A realistic editorial hero image for a blog post about…"
            />
          </div>
          <div className="field">
            <label htmlFor="m-gen-size">Size</label>
            <select id="m-gen-size" value={genSize} onChange={e => setGenSize(e.target.value)}>
              <option value="">Default</option>
              <option value="1024x1024">1024×1024</option>
              <option value="1536x1024">1536×1024 (landscape)</option>
              <option value="1024x1536">1024×1536 (portrait)</option>
            </select>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={generating || !genPrompt.trim()}>
          {generating ? <><span className="spinner" /> Generating…</> : 'Generate'}
        </button>
      </div>

      {toast && (
        <div className={`toast-fixed toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
