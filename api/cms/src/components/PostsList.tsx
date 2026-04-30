import React, { useState, useEffect, useCallback } from 'react'
import { listPosts, deletePost, publishPost, type Post } from '../lib/api'

interface Props {
  token: string
  onEdit: (slug: string) => void
  onNewPost: () => void
}

export default function PostsList({ token, onEdit, onNewPost }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPosts(await listPosts(token))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  async function handleDelete(slug: string) {
    if (!confirm(`Delete "${slug}"? This cannot be undone.`)) return
    try {
      await deletePost(token, slug)
      showToast('Post deleted')
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', 'err')
    }
  }

  async function handlePublish(slug: string) {
    if (!confirm(`Publish "${slug}"?`)) return
    try {
      await publishPost(token, slug)
      showToast('Post published!')
      load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Publish failed', 'err')
    }
  }

  return (
    <div className="view">
      <div className="view-hdr">
        <h2>Posts</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ghost" onClick={load} title="Refresh">↻ Refresh</button>
          <button onClick={onNewPost}>+ New Post</button>
        </div>
      </div>

      {loading && (
        <div className="empty"><span className="spinner" /> Loading…</div>
      )}

      {error && !loading && (
        <div className="err-msg">{error}</div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="empty">No posts yet. Create your first one!</div>
      )}

      {!loading && posts.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Date</th>
              <th style={{ width: 200 }}></th>
            </tr>
          </thead>
          <tbody>
            {posts.map(p => (
              <tr key={p.slug}>
                <td>
                  <strong>{p.title || p.slug}</strong>
                  {p.description && (
                    <div className="post-desc">{p.description}</div>
                  )}
                </td>
                <td className="mono muted">{p.slug}</td>
                <td>
                  <span className={`badge ${p.draft ? 'draft' : 'published'}`}>
                    {p.draft ? 'Draft' : 'Published'}
                  </span>
                </td>
                <td className="muted">{p.date ? String(p.date).slice(0, 10) : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="ghost btn-sm" onClick={() => onEdit(p.slug)}>Edit</button>
                    {p.draft && (
                      <button className="success btn-sm" onClick={() => handlePublish(p.slug)}>Publish</button>
                    )}
                    <button className="danger btn-sm" onClick={() => handleDelete(p.slug)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {toast && (
        <div className={`toast-fixed toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
