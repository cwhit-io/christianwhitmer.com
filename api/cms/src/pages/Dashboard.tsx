import React, { useState, useCallback } from 'react'
import { logout } from '../lib/api'
import PostsList from '../components/PostsList'
import PostEditor from '../components/PostEditor'
import MediaManager from '../components/MediaManager'

type View =
  | { name: 'posts' }
  | { name: 'editor'; slug: string | null }
  | { name: 'media'; postSlug?: string }

interface Props {
  token: string
  user: string
  onLogout: () => void
}

export default function Dashboard({ token, user, onLogout }: Props) {
  const [view, setView] = useState<View>({ name: 'posts' })

  const handleLogout = useCallback(async () => {
    await logout().catch(() => {})
    onLogout()
  }, [onLogout])

  const goToPosts = useCallback(() => setView({ name: 'posts' }), [])
  const openEditor = useCallback((slug: string | null) => setView({ name: 'editor', slug }), [])
  const openMedia = useCallback((postSlug?: string) => setView({ name: 'media', postSlug }), [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">✦ Blog CMS</span>
        <nav className="app-nav">
          <button
            className={`nav-btn${view.name === 'posts' || view.name === 'editor' ? ' active' : ''}`}
            onClick={goToPosts}
          >
            Posts
          </button>
          <button
            className={`nav-btn${view.name === 'media' ? ' active' : ''}`}
            onClick={() => openMedia()}
          >
            Media
          </button>
        </nav>
        <span className="nav-spacer" />
        <span className="hdr-user">{user}</span>
        <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
      </header>

      <main className="app-main">
        {view.name === 'posts' && (
          <PostsList
            token={token}
            onEdit={openEditor}
            onNewPost={() => openEditor(null)}
            onOpenMedia={openMedia}
          />
        )}
        {view.name === 'editor' && (
          <PostEditor
            token={token}
            slug={view.slug}
            onBack={goToPosts}
            onOpenMedia={openMedia}
          />
        )}
        {view.name === 'media' && (
          <MediaManager
            token={token}
            initialSlug={view.postSlug}
            onBack={goToPosts}
          />
        )}
      </main>
    </div>
  )
}
