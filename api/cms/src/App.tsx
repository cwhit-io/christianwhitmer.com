import React, { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { getSession } from './lib/api'

export default function App() {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  // Try to restore session from the httpOnly cookie on first load
  useEffect(() => {
    getSession()
      .then(({ token: t, username: u }) => {
        setToken(t)
        setUser(u)
      })
      .catch(() => {
        // No active session — show login
      })
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
      </div>
    )
  }

  return token ? (
    <Dashboard
      token={token}
      user={user ?? ''}
      onLogout={() => {
        setToken(null)
        setUser(null)
      }}
    />
  ) : (
    <Login
      onSuccess={(t, u) => {
        setToken(t)
        setUser(u)
      }}
    />
  )
}
