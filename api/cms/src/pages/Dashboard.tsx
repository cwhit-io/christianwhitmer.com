import React from 'react'

export default function Dashboard({ apiToken, user, onLogout }:{ apiToken:string, user:string|null, onLogout:()=>void }){
  return (
    <div style={{fontFamily:'Inter, system-ui, sans-serif', padding:24}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>CMS Dashboard</h2>
        <div>
          <strong>{user}</strong>
          <button style={{marginLeft:12}} onClick={async ()=>{ await fetch('/cms/logout',{method:'POST'}); onLogout() }}>Logout</button>
        </div>
      </header>

      <section style={{marginTop:24}}>
        <h3>Your API Token</h3>
        <pre style={{background:'#f6f8fa', padding:12, overflowX:'auto'}}>{apiToken}</pre>
        <p>Use this token for API requests from the editor.</p>
      </section>

      <section style={{marginTop:24}}>
        <h3>Coming soon</h3>
        <p>Posts list, editor, and media manager will be added here.</p>
      </section>
    </div>
  )
}
