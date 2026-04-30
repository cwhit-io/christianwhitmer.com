import React, { useState, useCallback } from 'react'
import { logout } from '../lib/api'
import PostsList from '../components/PostsList'
import PostEditor from '../components/PostEditor'
import StatusPage from './StatusPage'

type View =
  | { name: 'posts' }
  | { name: 'editor'; slug: string | null }
  | { name: 'status' }

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
  const goToStatus = useCallback(() => setView({ name: 'status' }), [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">ChristianWhitmer.com</span>
        <nav className="app-nav">
          <button
            className={`nav-btn${view.name === 'posts' || view.name === 'editor' ? ' active' : ''}`}
            onClick={goToPosts}
          >
            Posts
          </button>
          <button
            className={`nav-btn${view.name === 'status' ? ' active' : ''}`}
            onClick={goToStatus}
          >
            Status
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
          />
        )}
        {view.name === 'editor' && (
          <PostEditor
            token={token}
            slug={view.slug}
            onBack={goToPosts}
          />
        )}
        {view.name === 'status' && (
          <StatusPage token={token} />
        )}
      </main>
    </div>
  )
}
