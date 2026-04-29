import React, { useState } from 'react'

export default function Login({ onSuccess }: { onSuccess: (token: string, user: string) => void }){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault()
    setError(null)
    setLoading(true)
    try{
      const res = await fetch('/cms/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if(!res.ok){
        const data = await res.json().catch(()=>({error:'Login failed'}))
        setError(data?.error || 'Login failed')
        setLoading(false)
        return
      }
      // after login cookie is set; fetch session token
      const s = await fetch('/cms/session')
      if(!s.ok) throw new Error('Failed to get session')
      const body = await s.json()
      onSuccess(body.apiToken || '', username)
    }catch(err:any){
      setError(err?.message || 'Unknown error')
    }finally{setLoading(false)}
  }

  return (
    <main style={{fontFamily:'Inter, system-ui, sans-serif', padding:24, maxWidth:640, margin:'0 auto'}}>
      <h1>CMS Login</h1>
      <form onSubmit={handleSubmit}>
        <label style={{display:'block', marginBottom:8}}>
          <div>Username</div>
          <input value={username} onChange={e=>setUsername(e.target.value)} />
        </label>
        <label style={{display:'block', marginBottom:8}}>
          <div>Password</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
        <div style={{marginTop:12}}>
          <button disabled={loading} type="submit">{loading? 'Signing in...':'Sign in'}</button>
        </div>
        {error && <div style={{color:'crimson', marginTop:12}}>{error}</div>}
      </form>
    </main>
  )
}
