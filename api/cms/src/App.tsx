import React, { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App(){
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<string | null>(null)

  return (
    <div>
      {!token ? (
        <Login onSuccess={(t,u)=>{setToken(t); setUser(u)}} />
      ) : (
        <Dashboard apiToken={token} user={user} onLogout={()=>{ setToken(null); setUser(null) }} />
      )}
    </div>
  )
}
