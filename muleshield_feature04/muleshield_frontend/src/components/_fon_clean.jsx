function FocusedNetworkOverlay({ cluster, graphNodes, graphEdges, transactions, onClose, onExecute }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const tickRef   = useRef(0)
  const [muleStates, setMuleStates]           = useState({})
  const [selectedMule, setSelectedMule]       = useState(null)
  const [muleTransactions, setMuleTransactions] = useState([])
  const [muleLoading, setMuleLoading]         = useState(false)

  // Fetch transactions for selected mule
  useEffect(() => {
    if (!selectedMule) { setMuleTransactions([]); return }
    setMuleLoading(true)
    axios.get(`/api/transactions?limit=200`)
      .then(r => {
        const all = r.data?.transactions || []
        const filtered = all.filter(t =>
          t.account_id === selectedMule ||
          t.sender_upi === selectedMule ||
          t.receiver_upi === selectedMule
        )
        if (filtered.length > 0) { setMuleTransactions(filtered); return }
        // fallback: passed transactions prop
        const fb = (transactions || []).filter(t =>
          t.account_id === selectedMule ||
          t.sender_upi === selectedMule ||
          t.receiver_upi === selectedMule
        )
        setMuleTransactions(fb)
      })
      .catch(() => {
        const fb = (transactions || []).filter(t =>
          t.account_id === selectedMule ||
          t.sender_upi === selectedMule ||
          t.receiver_upi === selectedMule
        )
        setMuleTransactions(fb)
      })
      .finally(() => setMuleLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMule])

  // Build node list
  const clusterNodes = (graphNodes || []).filter(n => String(n.cluster_id) === String(cluster?.cluster_id))
  const controller = clusterNodes.find(n => n.is_controller) || { id: cluster?.controller_name || 'CTRL', is_controller: true }
  const rawMules = clusterNodes.filter(n => !n.is_controller).length > 0
    ? clusterNodes.filter(n => !n.is_controller)
    : (cluster?.mule_accounts || []).map(id => ({ id, is_controller: false }))

  const clusterNodeIds = new Set([controller.id, ...rawMules.map(m => m.id)])
  const clusterEdges = (graphEdges || []).filter(e => clusterNodeIds.has(e.source) && clusterNodeIds.has(e.target))

  // Honey trap always last
  const honeyTrapId = cluster?.honey_trap_account || null

  const chainOrder = (() => {
    const nonHoney = rawMules.filter(m => m.id !== honeyTrapId)
    if (clusterEdges.length === 0) return nonHoney
    const adj = {}
    clusterEdges.forEach(e => { if (!adj[e.source]) adj[e.source] = []; adj[e.source].push(e.target) })
    const visited = new Set([controller.id])
    if (honeyTrapId) visited.add(honeyTrapId)
    const chain = []
    let cur = controller.id
    for (let i = 0; i < nonHoney.length + 1; i++) {
      const nexts = (adj[cur] || []).filter(id => !visited.has(id) && clusterNodeIds.has(id))
      if (!nexts.length) break
      cur = nexts[0]; visited.add(cur)
      chain.push(rawMules.find(m => m.id === cur) || { id: cur, is_controller: false })
    }
    nonHoney.forEach(m => { if (!visited.has(m.id)) chain.push(m) })
    return chain
  })()

  const honeyNode = honeyTrapId ? (rawMules.find(m => m.id === honeyTrapId) || { id: honeyTrapId, is_controller: false }) : null
  const fullChain = [{ id: controller.id, is_controller: true }, ...chainOrder, ...(honeyNode ? [honeyNode] : [])]

  const setMuleAction = (id, action) => setMuleStates(prev => {
    const next = { ...prev }
    if (next[id] === action) delete next[id]; else next[id] = action
    return next
  })

  const blockedCount = Object.values(muleStates).filter(v => v === 'BLOCK').length

  const fmtAmt = v => {
    if (!v) return '₹0'
    if (v >= 1e7) return `₹${(v/1e7).toFixed(1)}Cr`
    if (v >= 1e5) return `₹${(v/1e5).toFixed(1)}L`
    if (v >= 1e3) return `₹${(v/1e3).toFixed(1)}K`
    return `₹${Math.round(v)}`
  }

  // Canvas draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => {
      tickRef.current += 1
      const tick = tickRef.current
      const dpr = window.devicePixelRatio || 1
      const W = canvas.width / dpr, H = canvas.height / dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return }
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H)
      const n = fullChain.length
      if (n === 0) { ctx.restore(); rafRef.current = requestAnimationFrame(draw); return }
      const pad = 80, spacing = n > 1 ? (W - pad*2)/(n-1) : 0
      const cy = H * 0.42, nodeR = 22
      const positions = fullChain.map((node, i) => ({ x: n===1 ? W/2 : pad+i*spacing, y: cy, node }))

      // Edges with flow cut logic
      let flowCut = false
      for (let i = 0; i < positions.length - 1; i++) {
        const src = positions[i], tgt = positions[i+1]
        const isHoneyTarget = tgt.node.id === honeyTrapId
        const isBlockedTarget = muleStates[tgt.node.id] === 'BLOCK'
        const isBlockedSource = muleStates[src.node.id] === 'BLOCK'
        if (isBlockedSource) flowCut = true
        const flowActive = !flowCut && !isBlockedTarget
        const edge = clusterEdges.find(e => e.source===src.node.id && e.target===tgt.node.id) || clusterEdges.find(e => e.target===tgt.node.id)
        const amount = edge?.weight || 0, count = edge?.count || 1
        const color = (isBlockedTarget||flowCut) ? C.nodeBlocked : isHoneyTarget ? C.nodeCanary : C.secondary
        const x1 = src.x+(src.node.is_controller?28:nodeR), x2 = tgt.x-nodeR, y1=src.y, y2=tgt.y
        ctx.save()
        ctx.strokeStyle = color; ctx.lineWidth = isHoneyTarget ? 2 : 1.5
        if (isHoneyTarget && flowActive) { ctx.setLineDash([6,4]); ctx.lineDashOffset = -((tick*0.4)%16) }
        ctx.globalAlpha = (isBlockedTarget||flowCut) ? 0.18 : 0.7
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.setLineDash([])
        const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy)
        if (len > 0) {
          const ux=dx/len, uy=dy/len, asz=8
          ctx.globalAlpha = (isBlockedTarget||flowCut) ? 0.2 : 0.9
          ctx.beginPath(); ctx.moveTo(x2,y2)
          ctx.lineTo(x2-asz*ux+asz*0.45*uy, y2-asz*uy-asz*0.45*ux)
          ctx.lineTo(x2-asz*ux-asz*0.45*uy, y2-asz*uy+asz*0.45*ux)
          ctx.closePath(); ctx.fillStyle=color; ctx.fill()
          if (flowActive) {
            const t=((tick*0.014+i*0.3)%1), px=x1+dx*t, py=y1+dy*t
            ctx.globalAlpha=0.9; ctx.shadowColor=color; ctx.shadowBlur=10
            ctx.beginPath(); ctx.arc(px,py,4,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); ctx.shadowBlur=0
          }
          if (amount > 0) {
            const mx=(x1+x2)/2, my=(y1+y2)/2-14
            const label=fmtAmt(amount)+(count>1?` x${count}`:'')
            ctx.font=`700 9px ${fontMono}`
            const tw=ctx.measureText(label).width+12
            ctx.globalAlpha=(isBlockedTarget||flowCut)?0.3:0.92; ctx.fillStyle='#0a0a12'
            ctx.beginPath(); ctx.roundRect(mx-tw/2,my-9,tw,17,4); ctx.fill()
            ctx.strokeStyle=color+'88'; ctx.lineWidth=1
            ctx.beginPath(); ctx.roundRect(mx-tw/2,my-9,tw,17,4); ctx.stroke()
            ctx.globalAlpha=(isBlockedTarget||flowCut)?0.35:1
            ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=color; ctx.fillText(label,mx,my)
          }
        }
        ctx.restore()
        if (isBlockedTarget) flowCut = true
      }

      // Nodes
      positions.forEach((pos, i) => {
        const { node } = pos
        const isCtrl=node.is_controller, isHoney=node.id===honeyTrapId&&!isCtrl, isBlocked=muleStates[node.id]==='BLOCK'
        const r = isCtrl ? 28 : nodeR
        ctx.save()
        if (isCtrl) {
          const pulse=1+0.05*Math.sin(tick*0.04)
          ctx.shadowColor=C.nodeCtrl; ctx.shadowBlur=24; drawHexagon(ctx,pos.x,pos.y,r*pulse)
          ctx.fillStyle=C.nodeCtrl; ctx.fill(); ctx.strokeStyle='#fff8'; ctx.lineWidth=1.5; ctx.stroke()
          ctx.globalAlpha=0.15+0.08*Math.sin(tick*0.04); drawHexagon(ctx,pos.x,pos.y,r*pulse*1.5)
          ctx.strokeStyle=C.nodeCtrl; ctx.lineWidth=1; ctx.stroke(); ctx.globalAlpha=1
          ctx.font=`700 9px ${fontMono}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#000'; ctx.fillText('CTRL',pos.x,pos.y)
        } else if (isHoney) {
          const pr=r+4+3*Math.sin(tick*0.06)
          ctx.strokeStyle=C.nodeCanary; ctx.lineWidth=1.5; ctx.globalAlpha=0.3
          ctx.beginPath(); ctx.arc(pos.x,pos.y,pr,0,Math.PI*2); ctx.stroke()
          ctx.globalAlpha=1; ctx.shadowColor=C.nodeCanary; ctx.shadowBlur=18
          ctx.beginPath(); ctx.arc(pos.x,pos.y,r,0,Math.PI*2); ctx.fillStyle=C.nodeCanary; ctx.fill()
          ctx.font=`14px ${fontMono}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#000'; ctx.fillText('🍯',pos.x,pos.y)
        } else if (isBlocked) {
          ctx.shadowColor=C.nodeBlocked; ctx.shadowBlur=10
          ctx.beginPath(); ctx.arc(pos.x,pos.y,r,0,Math.PI*2); ctx.fillStyle=C.nodeBlocked; ctx.fill()
          ctx.strokeStyle='#000'; ctx.lineWidth=2.5
          ctx.beginPath(); ctx.moveTo(pos.x-7,pos.y-7); ctx.lineTo(pos.x+7,pos.y+7)
          ctx.moveTo(pos.x+7,pos.y-7); ctx.lineTo(pos.x-7,pos.y+7); ctx.stroke()
        } else {
          ctx.beginPath(); ctx.arc(pos.x,pos.y,r,0,Math.PI*2); ctx.fillStyle=C.nodeActive; ctx.fill()
          ctx.strokeStyle='#3a2a30'; ctx.lineWidth=1; ctx.stroke()
        }
        ctx.restore()
        ctx.save()
        ctx.font=`700 9px ${fontGrotesk}`; ctx.textAlign='center'; ctx.textBaseline='bottom'
        ctx.fillStyle=isCtrl?C.nodeCtrl:isHoney?C.nodeCanary:isBlocked?C.nodeBlocked:C.textMuted
        ctx.fillText(isCtrl?'CONTROLLER':isHoney?'HONEY TRAP':isBlocked?`M${i} BLOCKED`:`MULE ${i}`, pos.x, pos.y-r-6)
        ctx.restore()
        ctx.save()
        ctx.font=`9px ${fontMono}`; ctx.textAlign='center'; ctx.textBaseline='top'
        ctx.fillStyle=(isBlocked?C.nodeBlocked:isHoney?C.nodeCanary:C.textMuted)+'aa'
        ctx.fillText(String(node.id).slice(0,14), pos.x, pos.y+r+5)
        if (!isCtrl) {
          const inflow=clusterEdges.filter(e=>e.target===node.id).reduce((s,e)=>s+(e.weight||0),0)
          if (inflow>0) { ctx.font=`700 9px ${fontMono}`; ctx.fillStyle=(isHoney?C.nodeCanary:isBlocked?C.nodeBlocked:C.secondary)+'cc'; ctx.fillText(fmtAmt(inflow)+' in',pos.x,pos.y+r+17) }
        }
        ctx.restore()
      })

      // Annotation when blocked
      const blockedIds=Object.entries(muleStates).filter(([,v])=>v==='BLOCK').map(([k])=>k)
      if (blockedIds.length>0 && honeyTrapId) {
        ctx.save(); ctx.font=`700 10px ${fontGrotesk}`; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillStyle=C.nodeCanary
        ctx.fillText(`${blockedIds.length} mule(s) blocked — controller will reroute to honey trap`, W/2, H*0.72)
        ctx.font=`9px ${fontInter}`; ctx.fillStyle=C.textMuted
        ctx.fillText('Monitor honey trap to capture controller fingerprint', W/2, H*0.72+16)
        ctx.restore()
      }
      ctx.restore()
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muleStates, fullChain.length, clusterEdges.length, honeyTrapId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => { const dpr=window.devicePixelRatio||1; canvas.width=canvas.offsetWidth*dpr; canvas.height=canvas.offsetHeight*dpr }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.92)', display:'flex', flexDirection:'column' }}>

      {/* Top bar */}
      <div style={{ flexShrink:0, background:C.surface, borderBottom:`1px solid ${C.outline}`, padding:'10px 20px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div style={{ minWidth:150 }}>
          <div style={{ fontFamily:fontSora, fontWeight:700, fontSize:14, color:C.primary }}>Cluster {cluster?.cluster_id ?? '—'}</div>
          <div style={{ fontFamily:fontMono, fontSize:10, color:C.textMuted, marginTop:1 }}>{controller.id} · {chainOrder.length} mules</div>
        </div>
        <span style={{ fontFamily:fontGrotesk, fontSize:9, color:C.textMuted, letterSpacing:'0.1em', whiteSpace:'nowrap' }}>BLOCK MULES:</span>
        {chainOrder.filter(m => m.id !== honeyTrapId).map((m, i) => {
          const isBlocked = muleStates[m.id] === 'BLOCK'
          const isSelected = selectedMule === m.id
          return (
            <button key={m.id}
              onClick={() => { setMuleAction(m.id, 'BLOCK'); setSelectedMule(prev => prev === m.id ? null : m.id) }}
              title={isBlocked ? 'Click to view details / unblock' : 'Click to block this mule'}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 14px', borderRadius:8, cursor:'pointer', border:`2px solid ${isBlocked ? C.nodeBlocked : isSelected ? C.secondary : '#3a2a30'}`, background:isBlocked ? 'rgba(255,76,131,0.15)' : C.surfaceLow, transition:'all 0.15s', outline:'none', boxShadow:isBlocked?`0 0 10px ${C.nodeBlocked}55`:'none' }}>
              <span style={{ width:10, height:10, borderRadius:'50%', flexShrink:0, background:isBlocked?C.nodeBlocked:C.nodeActive, boxShadow:isBlocked?`0 0 8px ${C.nodeBlocked}`:'none', transition:'all 0.15s' }} />
              <span style={{ fontFamily:fontGrotesk, fontSize:9, color:C.textMuted }}>M{i+1}</span>
              <span style={{ fontFamily:fontMono, fontSize:10, color:isBlocked?C.nodeBlocked:C.textMain }}>{String(m.id).slice(0,13)}</span>
              <span style={{ fontFamily:fontGrotesk, fontWeight:700, fontSize:9, letterSpacing:'0.08em', textTransform:'uppercase', color:isBlocked?C.nodeBlocked:C.textMuted, padding:'2px 6px', borderRadius:4, background:isBlocked?C.nodeBlocked+'22':C.surfaceMid, border:`1px solid ${isBlocked?C.nodeBlocked+'66':C.outline}` }}>
                {isBlocked ? '🚫 BLOCKED' : '+ BLOCK'}
              </span>
            </button>
          )
        })}
        {honeyTrapId && (
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 14px', borderRadius:8, border:`2px solid ${C.nodeCanary}`, background:C.nodeCanary+'15' }}>
            <span style={{ fontSize:14 }}>🍯</span>
            <span style={{ fontFamily:fontGrotesk, fontSize:9, color:C.nodeCanary, letterSpacing:'0.08em' }}>HONEY TRAP</span>
            <span style={{ fontFamily:fontMono, fontSize:10, color:C.nodeCanary }}>{String(honeyTrapId).slice(0,14)}</span>
            <span style={{ fontFamily:fontGrotesk, fontSize:8, color:C.nodeCanary+'aa', padding:'2px 6px', borderRadius:4, background:C.nodeCanary+'22', border:`1px solid ${C.nodeCanary}44` }}>MONITOR</span>
          </div>
        )}
        <div style={{ flex:1 }} />
        <div style={{ background:C.nodeBlocked+'22', border:`1px solid ${C.nodeBlocked}`, borderRadius:8, padding:'5px 12px', textAlign:'center', minWidth:56 }}>
          <div style={{ fontFamily:fontSora, fontWeight:700, fontSize:20, color:C.nodeBlocked, lineHeight:1 }}>{blockedCount}</div>
          <div style={{ fontFamily:fontGrotesk, fontSize:8, color:C.nodeBlocked+'aa', letterSpacing:'0.1em' }}>BLOCKED</div>
        </div>
        <button onClick={() => onExecute(cluster?.cluster_id, muleStates)} style={{ padding:'10px 20px', borderRadius:8, border:'none', background:blockedCount>0?C.primaryCont:C.surfaceMid, color:blockedCount>0?'#000':C.textMuted, fontFamily:fontGrotesk, fontWeight:700, fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', cursor:blockedCount>0?'pointer':'default', transition:'all 0.2s', boxShadow:blockedCount>0?`0 0 14px ${C.primaryCont}55`:'none' }}>
          ▶ EXECUTE BLOCK
        </button>
        <button onClick={onClose} style={{ padding:'10px 14px', borderRadius:8, border:`1px solid ${C.outline}`, background:'none', color:C.textMuted, cursor:'pointer', fontFamily:fontGrotesk, fontSize:11 }}>✕ CLOSE</button>
      </div>

      {/* Canvas + detail panel */}
      <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }} />
        {/* Legend */}
        <div style={{ position:'absolute', bottom:14, right:16, background:'rgba(19,19,27,0.88)', border:`1px solid ${C.outline}`, borderRadius:8, padding:'8px 14px', backdropFilter:'blur(6px)' }}>
          {[{color:C.nodeCtrl,label:'Controller'},{color:C.secondary,label:'Mule (active)'},{color:C.nodeBlocked,label:'Mule (blocked)'},{color:C.nodeCanary,label:'Honey trap'}].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
              <span style={{ width:9, height:9, borderRadius:'50%', background:l.color, flexShrink:0 }} />
              <span style={{ fontFamily:fontInter, fontSize:10, color:C.textMuted }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Blocked account detail panel */}
        {selectedMule && (
          <div style={{ position:'absolute', top:0, right:0, bottom:0, width:360, background:C.surface, borderLeft:`1px solid ${C.nodeBlocked}55`, display:'flex', flexDirection:'column', zIndex:10, boxShadow:'-6px 0 32px rgba(0,0,0,0.6)' }}>
            <div style={{ padding:'14px 16px', borderBottom:`1px solid ${C.outline}`, background:C.nodeBlocked+'18', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontFamily:fontGrotesk, fontSize:9, color:C.nodeBlocked, letterSpacing:'0.12em', marginBottom:4 }}>🚫 BLOCKED ACCOUNT</div>
                  <div style={{ fontFamily:fontMono, fontSize:11, color:C.textMain, wordBreak:'break-all' }}>{selectedMule}</div>
                </div>
                <button onClick={() => setSelectedMule(null)} style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', fontSize:16, padding:'0 0 0 8px', flexShrink:0 }}>✕</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginTop:10 }}>
                {[
                  { label:'TOTAL IN',  value:fmtAmt(muleTransactions.filter(t=>t.receiver_upi===selectedMule||t.account_id===selectedMule).reduce((s,t)=>s+(t.amount||0),0)), color:C.secondary },
                  { label:'TOTAL OUT', value:fmtAmt(muleTransactions.filter(t=>t.sender_upi===selectedMule).reduce((s,t)=>s+(t.amount||0),0)), color:C.primaryCont },
                  { label:'TXN COUNT', value:muleTransactions.length, color:C.tertiary },
                ].map(s => (
                  <div key={s.label} style={{ background:C.surfaceLow, borderRadius:6, padding:'6px 8px', border:`1px solid ${C.outline}` }}>
                    <div style={{ fontFamily:fontGrotesk, fontSize:8, color:C.textMuted, letterSpacing:'0.1em' }}>{s.label}</div>
                    <div style={{ fontFamily:fontSora, fontWeight:700, fontSize:15, color:s.color, lineHeight:1.1 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              <div style={{ padding:'7px 16px', fontFamily:fontGrotesk, fontSize:9, color:C.textMuted, letterSpacing:'0.1em', background:C.surfaceLow, borderBottom:`1px solid ${C.outline}`, position:'sticky', top:0 }}>
                TRANSACTION HISTORY
              </div>
              {muleLoading ? (
                <div style={{ padding:24, fontFamily:fontMono, fontSize:11, color:C.textMuted, textAlign:'center' }}>Loading…</div>
              ) : muleTransactions.length === 0 ? (
                <div style={{ padding:24, fontFamily:fontMono, fontSize:11, color:C.textMuted, textAlign:'center' }}>No transactions found</div>
              ) : muleTransactions.slice(0,30).map((tx, i) => {
                const isIn = tx.receiver_upi === selectedMule || (tx.account_id === selectedMule && !tx.sender_upi)
                const ts = tx.timestamp ? new Date(tx.timestamp) : null
                const verdict = tx.verdict || tx.status || ''
                const risk = tx.risk_score
                const riskColor = verdict==='CONTROLLER_IDENTIFIED'?C.primaryCont:verdict==='BLOCKED_ACCOUNT_HIT'?C.nodeBlocked:verdict==='SUSPECTED_MULE_TRANSACTION'?C.tertiary:C.textMuted
                return (
                  <div key={i} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.outline}22`, background:i%2?C.surfaceLow+'44':'transparent' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                      <span style={{ fontFamily:fontGrotesk, fontSize:9, fontWeight:700, letterSpacing:'0.08em', padding:'2px 7px', borderRadius:4, background:isIn?C.secondary+'22':C.primaryCont+'22', color:isIn?C.secondary:C.primaryCont, border:`1px solid ${isIn?C.secondary+'55':C.primaryCont+'55'}` }}>
                        {isIn ? '⬇ IN' : '⬆ OUT'}
                      </span>
                      <span style={{ fontFamily:fontSora, fontWeight:700, fontSize:14, color:isIn?C.secondary:C.primaryCont }}>{isIn?'+':'-'}{fmtAmt(tx.amount||0)}</span>
                    </div>
                    <div style={{ fontFamily:fontMono, fontSize:10, color:C.textMuted, marginBottom:4 }}>
                      <span style={{ color:C.textMain }}>{(tx.sender_upi||'—').slice(0,20)}</span>
                      <span style={{ color:C.outline, margin:'0 5px' }}>→</span>
                      <span style={{ color:C.textMain }}>{(tx.receiver_upi||'—').slice(0,20)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontFamily:fontMono, fontSize:9, color:C.textMuted }}>{ts?ts.toLocaleString('en-IN',{dateStyle:'short',timeStyle:'medium'}):'—'}</span>
                      <span style={{ fontFamily:fontMono, fontSize:9, color:C.outline }}>#{(tx.transaction_id||'').slice(-8)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      {verdict?<span style={{ fontFamily:fontGrotesk, fontSize:8, color:riskColor, letterSpacing:'0.06em' }}>{verdict.replace(/_/g,' ')}</span>:<span/>}
                      {risk!=null&&<span style={{ fontFamily:fontMono, fontSize:9, color:risk>0.7?C.primaryCont:risk>0.4?C.tertiary:C.textMuted }}>risk {(risk*100).toFixed(0)}%</span>}
                    </div>
                    {(tx.sender_ip||tx.device_type||tx.isp)&&(
                      <div style={{ marginTop:4, fontFamily:fontMono, fontSize:9, color:C.textMuted+'88' }}>{[tx.device_type,tx.sender_ip,tx.isp].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Transaction flow table */}
      {clusterEdges.length > 0 && (
        <div style={{ flexShrink:0, maxHeight:170, overflowY:'auto', background:C.surface, borderTop:`1px solid ${C.outline}` }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1fr 1fr 1fr', padding:'6px 20px', background:C.surfaceLow, borderBottom:`1px solid ${C.outline}`, position:'sticky', top:0 }}>
            {['FROM','TO','AMOUNT','x TXN','FLOW TYPE'].map(h => <div key={h} style={{ fontFamily:fontGrotesk, fontSize:9, color:C.textMuted, letterSpacing:'0.1em' }}>{h}</div>)}
          </div>
          {clusterEdges.map((edge, i) => {
            const isCtrlSrc=edge.source===controller.id, isHoneyTgt=edge.target===honeyTrapId, isBlockTgt=muleStates[edge.target]==='BLOCK'
            const flowColor=isCtrlSrc?C.nodeCtrl:isHoneyTgt?C.nodeCanary:isBlockTgt?C.nodeBlocked:C.primary
            const flowLabel=isCtrlSrc?'CTRL→MULE':isHoneyTgt?'MULE→HONEY':'MULE→MULE'
            return (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1fr 1fr 1fr', padding:'5px 20px', borderBottom:`1px solid ${C.outline}22`, background:i%2?C.surfaceLow+'44':'transparent' }}>
                <div style={{ fontFamily:fontMono, fontSize:10, color:isCtrlSrc?C.nodeCtrl:C.textMuted }}>{String(edge.source).slice(0,18)}</div>
                <div style={{ fontFamily:fontMono, fontSize:10, color:isHoneyTgt?C.nodeCanary:isBlockTgt?C.nodeBlocked:C.textMain }}>{String(edge.target).slice(0,18)}</div>
                <div style={{ fontFamily:fontSora, fontWeight:700, fontSize:11, color:C.secondary }}>{fmtAmt(edge.weight||0)}</div>
                <div style={{ fontFamily:fontMono, fontSize:10, color:C.textMuted }}>x{edge.count||1}</div>
                <div style={{ fontFamily:fontGrotesk, fontSize:9, color:flowColor, letterSpacing:'0.06em' }}>{flowLabel}</div>
              </div>
            )
          })}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr 1fr 1fr 1fr', padding:'6px 20px', background:C.surfaceMid, borderTop:`1px solid ${C.outline}` }}>
            <div style={{ fontFamily:fontGrotesk, fontSize:9, color:C.textMuted, gridColumn:'1/3' }}>TOTAL FLOW</div>
            <div style={{ fontFamily:fontSora, fontWeight:700, fontSize:12, color:C.secondary }}>{fmtAmt(clusterEdges.reduce((s,e)=>s+(e.weight||0),0))}</div>
            <div style={{ fontFamily:fontMono, fontSize:10, color:C.textMuted }}>x{clusterEdges.reduce((s,e)=>s+(e.count||1),0)}</div>
            <div />
          </div>
        </div>
      )}
    </div>
  )
}

