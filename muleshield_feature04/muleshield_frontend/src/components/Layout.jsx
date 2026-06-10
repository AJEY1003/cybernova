import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { C, lbl } from '../theme'
import { Sun, Moon } from 'lucide-react'

export default function Layout({ children }) {
  const location = useLocation()
  const [isLight, setIsLight] = useState(false)
  
  useEffect(() => {
    if (isLight) {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
  }, [isLight])
  
  const navItems = [
    { path: '/', label: 'DASHBOARD' },
    { path: '/transactions', label: 'TRANSACTIONS' },
    { path: '/security', label: 'SECURITY CENTER' },
    { path: '/chat', label: 'FORENSIC AI' },
    { path: '/ml-dataset', label: 'ML DATASET' }
  ]

  return (
    <div style={{
      display:'flex', height:'100vh', overflow:'hidden', 
      background: C.bg, fontFamily:'Inter,sans-serif', color: C.textMain,
      backgroundImage:'radial-gradient(rgba(48,40,64,0.15) 1px,transparent 1px)',
      backgroundSize:'40px 40px',
      transition: 'background 0.3s'
    }}>
      {/* ── LEFT SIDEBAR ── */}
      <aside style={{
        width: 280, display:'flex', flexDirection:'column', flexShrink:0,
        borderRight:`1px solid ${C.outline}`,
        background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(19,19,27,0.85)', backdropFilter:'blur(12px)', zIndex:40,
        transition: 'background 0.3s, border-color 0.3s'
      }}>
        <div style={{padding:'20px 16px 20px'}}>
          <h1 style={{
            fontFamily:'Sora,sans-serif', fontSize:26, fontWeight:800, 
            color: C.primary, textShadow:`0 0 15px rgba(255,177,192,0.4)`, 
            letterSpacing:'-0.02em', margin:0
          }}>MULESHIELD</h1>
          <p style={{...lbl(), marginBottom:0, marginTop:4}}>PROTOCOL V4.2 ACTIVE</p>
        </div>
        
        <nav style={{flex:1, display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px'}}>
          <p style={{...lbl(), marginTop: 20}}>NAVIGATION</p>
          {navItems.map(item => {
            const active = location.pathname === item.path
            return (
              <Link key={item.path} to={item.path} style={{
                textDecoration: 'none',
                padding: '12px 16px',
                background: active ? (isLight ? 'rgba(214, 51, 108, 0.1)' : 'rgba(255,177,192,0.1)') : 'transparent',
                borderLeft: active ? `3px solid ${C.primary}` : '3px solid transparent',
                color: active ? C.primary : C.textMain,
                fontFamily: 'Space Grotesk,sans-serif',
                fontSize: 12,
                letterSpacing: '0.1em',
                fontWeight: active ? 700 : 500,
                transition: 'all 0.2s ease',
              }}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{padding:'16px', borderTop:`1px solid ${C.outline}`}}>
          <p style={{...lbl(), marginBottom: 4}}>SYSTEM STATUS</p>
          <div style={{display:'flex', alignItems:'center', gap: 8}}>
            <div style={{width:8, height:8, borderRadius:'50%', background: C.secondary, boxShadow:`0 0 8px ${C.secondary}`}}/>
            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color: C.secondary}}>ALL SYSTEMS NOMINAL</span>
          </div>
        </div>
      </aside>

      {/* ── CENTER CONTENT ── */}
      <main style={{flex:1, position:'relative', display:'flex', flexDirection:'column', overflow:'hidden', background: C.bgDeep, transition: 'background 0.3s'}}>
        {/* Top bar */}
        <header style={{
          height: 56, display:'flex', alignItems:'center', justifyContent:'space-between', 
          padding:'0 24px', background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(19,19,27,0.7)', backdropFilter:'blur(12px)', 
          borderBottom:`1px solid ${C.outline}`, zIndex:10, transition: 'background 0.3s, border-color 0.3s'
        }}>
          <div style={{display:'flex', alignItems:'center', gap:20}}>
            <span style={{fontFamily:'Space Grotesk,sans-serif', fontSize:14, color: C.primary, letterSpacing:'0.15em', fontWeight: 600}}>
              {navItems.find(n => n.path === location.pathname)?.label || 'DASHBOARD'}
            </span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:16}}>
            <button 
              onClick={() => setIsLight(!isLight)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', 
                color: C.textMain, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 4, borderRadius: '50%', transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.surfaceMid}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {isLight ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color: C.textMuted, fontWeight: 500}}>OFFICER_429</span>
          </div>
        </header>

        {/* Page Content */}
        <div style={{flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1}}>
          {children}
        </div>
      </main>
    </div>
  )
}

