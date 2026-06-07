/**
 * NetworkGraph.jsx — MuleShield AML Main Page
 * 3-panel layout: Left (controllers) | Center (live canvas) | Right (intelligence)
 * Uses ResizeObserver, devicePixelRatio, cluster grid layout, RAF animation loop.
 * All styles are inline — no Tailwind classes.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import axios from 'axios'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

const PIE_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444']

// ─── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:          '#0a0a12',
  surface:     '#13131b',
  surfaceLow:  '#1b1b23',
  surfaceMid:  '#1f1f27',
  primary:     '#ffb1c0',
  primaryCont: '#ff4c83',
  secondary:   '#00e0b3',
  tertiary:    '#e3c630',
  error:       '#ffb4ab',
  outline:     '#5b3f44',
  textMain:    '#e4e1ed',
  textMuted:   '#e4bdc3',
  nodeCtrl:    '#e3c630',
  nodeCanary:  '#00e0b3',
  nodeBlocked: '#ff4c83',
  nodeActive:  '#5b3f44',
  nodeHit:     '#ffb1c0',
  edgeNormal:  'rgba(91,63,68,0.5)',
  edgeCanary:  '#ff4c83',
}

// ─── Font helpers ──────────────────────────────────────────────────────────────
const fontSora   = "'Sora', sans-serif"
const fontInter  = "'Inter', sans-serif"
const fontGrotesk= "'Space Grotesk', sans-serif"
const fontMono   = "'JetBrains Mono', monospace"

// ─── computeLayout — called ONCE per resize, positions never recomputed on data refresh ──
function computeLayout(nodes, _edges, W, H) {
  const pos = {}
  if (!nodes || !nodes.length || W <= 0 || H <= 0) return pos

  const clusters = {}
  nodes.forEach(n => {
    const cid = String(n.cluster_id ?? 'none')
    if (!clusters[cid]) clusters[cid] = []
    clusters[cid].push(n)
  })

  const clusterIds = Object.keys(clusters)
  // Up to 4 clusters in 2x2 grid with fixed centers
  const centers = [
    { x: W * 0.28, y: H * 0.32 },
    { x: W * 0.72, y: H * 0.32 },
    { x: W * 0.28, y: H * 0.68 },
    { x: W * 0.72, y: H * 0.68 },
  ]

  clusterIds.forEach((cid, ci) => {
    const center = centers[ci] || { x: W * 0.5, y: H * 0.5 }
    const cx = center.x
    const cy = center.y
    const clusterNodes = clusters[cid]
    const ctrl = clusterNodes.find(n => n.is_controller)
    const mules = clusterNodes.filter(n => !n.is_controller)

    if (ctrl) pos[ctrl.id] = { x: cx, y: cy }
    mules.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(mules.length, 1)
      pos[n.id] = {
        x: cx + 100 * Math.cos(angle),
        y: cy + 100 * Math.sin(angle),
      }
    })
  })

  return pos
}

// ─── drawHexagon helper ────────────────────────────────────────────────────────
function drawHexagon(ctx, x, y, r) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const px = x + r * Math.cos(a)
    const py = y + r * Math.sin(a)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
}

// ─── drawGraph — pure canvas draw, no state ───────────────────────────────────
function drawGraph(canvas, graphData, posRef, tick) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const W = canvas.width / dpr
  const H = canvas.height / dpr

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)

  if (!graphData || !graphData.nodes || !graphData.nodes.length) {
    ctx.restore()
    return
  }

  const nodes = graphData.nodes
  const edges = graphData.edges || []
  const pos = posRef.current

  // ── Draw edges ──────────────────────────────────────────────────────────────
  edges.forEach(edge => {
    const src = pos[edge.source]
    const tgt = pos[edge.target]
    if (!src || !tgt) return

    const isCanary = edge.is_canary
    ctx.save()
    ctx.strokeStyle = isCanary ? C.edgeCanary : C.edgeNormal
    ctx.lineWidth = isCanary ? 2.5 : 1.5
    if (isCanary) {
      ctx.setLineDash([6, 4])
      ctx.lineDashOffset = -((tick * 0.5) % 16)
    } else {
      ctx.setLineDash([])
    }
    ctx.globalAlpha = isCanary ? 0.85 : 0.45

    ctx.beginPath()
    ctx.moveTo(src.x, src.y)
    ctx.lineTo(tgt.x, tgt.y)
    ctx.stroke()

    // Arrow head
    const dx = tgt.x - src.x
    const dy = tgt.y - src.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len > 0) {
      const ux = dx / len
      const uy = dy / len
      // Offset arrow to edge of target node (larger nodes now)
      const tgtIsCtrl = graphData.nodes.find(n => n.id === edge.target)?.is_controller
      const nodeR = tgtIsCtrl ? 22 : 14
      const ax = tgt.x - ux * nodeR
      const ay = tgt.y - uy * nodeR
      const arrowSize = isCanary ? 9 : 7
      ctx.setLineDash([])
      ctx.globalAlpha = isCanary ? 0.9 : 0.6
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax - arrowSize * ux + arrowSize * 0.5 * uy, ay - arrowSize * uy - arrowSize * 0.5 * ux)
      ctx.lineTo(ax - arrowSize * ux - arrowSize * 0.5 * uy, ay - arrowSize * uy + arrowSize * 0.5 * ux)
      ctx.closePath()
      ctx.fillStyle = isCanary ? C.edgeCanary : C.edgeNormal
      ctx.fill()

      // Flow particle along edge — shows money movement direction
      const particleT = ((tick * 0.012) % 1)
      const px = src.x + dx * particleT
      const py = src.y + dy * particleT
      ctx.globalAlpha = isCanary ? 0.9 : 0.5
      ctx.shadowColor = isCanary ? C.edgeCanary : C.secondary
      ctx.shadowBlur = isCanary ? 10 : 6
      ctx.beginPath()
      ctx.arc(px, py, isCanary ? 3.5 : 2.5, 0, Math.PI * 2)
      ctx.fillStyle = isCanary ? C.edgeCanary : C.secondary
      ctx.fill()
      ctx.shadowBlur = 0
    }
    ctx.restore()
  })

  // ── Draw nodes ──────────────────────────────────────────────────────────────
  nodes.forEach(node => {
    const p = pos[node.id]
    if (!p) return

    const isCtrl    = node.is_controller
    const isCanary  = node.is_canary
    const isBlocked = node.is_blocked
    const muleProb  = node.mule_probability ?? 0
    const r = isCtrl ? 30 : isCanary ? 22 : 18

    ctx.save()
    if (isCtrl) {
      const pulse = 1 + 0.06 * Math.sin(tick * 0.04)
      ctx.shadowColor = C.nodeCtrl
      ctx.shadowBlur = 20
      drawHexagon(ctx, p.x, p.y, r * pulse)
      ctx.fillStyle = C.nodeCtrl
      ctx.fill()
      ctx.strokeStyle = '#fff8'
      ctx.lineWidth = 1.5
      ctx.stroke()
      // Outer glow ring
      ctx.globalAlpha = 0.2 + 0.1 * Math.sin(tick * 0.04)
      drawHexagon(ctx, p.x, p.y, r * pulse * 1.4)
      ctx.strokeStyle = C.nodeCtrl
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.globalAlpha = 1
    } else if (isCanary) {
      const pulseR = r + 4 + 3 * Math.sin(tick * 0.06)
      ctx.strokeStyle = C.nodeCanary
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.35
      ctx.beginPath()
      ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.shadowColor = C.nodeCanary
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = C.nodeCanary
      ctx.fill()
    } else if (isBlocked) {
      ctx.shadowColor = C.nodeBlocked
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = C.nodeBlocked
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = muleProb > 0.7 ? C.nodeHit : C.nodeActive
      ctx.fill()
      ctx.strokeStyle = muleProb > 0.7 ? C.primaryCont : '#3a2a30'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.restore()

    // Label
    ctx.save()
    ctx.font = `9px ${fontMono}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(228,189,195,0.65)'
    ctx.fillText(node.id ? String(node.id).slice(0, 10) : '', p.x, p.y + r + 3)
    ctx.restore()

    // Mule probability bar
    if (!isCtrl && muleProb > 0) {
      const barW = 20, barH = 3
      const bx = p.x - barW / 2
      const by = p.y + r + 14
      ctx.save()
      ctx.fillStyle = '#2a1a20'
      ctx.fillRect(bx, by, barW, barH)
      ctx.fillStyle = muleProb > 0.7 ? C.primaryCont : muleProb > 0.4 ? C.tertiary : C.secondary
      ctx.fillRect(bx, by, barW * muleProb, barH)
      ctx.restore()
    }
  })
}

// ─── Shared inline style helpers ──────────────────────────────────────────────
const pill = (bg, color) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 99,
  background: bg,
  color,
  fontSize: 10,
  fontFamily: fontGrotesk,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
})

const btn = (bg, color, extra = {}) => ({
  display: 'block',
  width: '100%',
  padding: '9px 0',
  borderRadius: 8,
  border: 'none',
  background: bg,
  color,
  fontFamily: fontGrotesk,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  ...extra,
})

const card = (extra = {}) => ({
  background: C.surfaceLow,
  border: `1px solid ${C.outline}`,
  borderRadius: 10,
  padding: '10px 12px',
  marginBottom: 8,
  ...extra,
})

// ─── FocusedNetworkOverlay — chain: CTRL → M1 → M2 → ... → HoneyTrap ─────────
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
                  { label:'TOTAL IN',  value:fmtAmt(muleTransactions.filter(t=>t.account_id===selectedMule&&t.receiver_upi).reduce((s,t)=>s+(t.amount||0),0)), color:C.secondary },
                  { label:'TOTAL OUT', value:fmtAmt(muleTransactions.filter(t=>t.account_id===selectedMule&&t.sender_upi&&t.sender_upi!==muleTransactions.find(x=>x.account_id===selectedMule)?.receiver_upi).reduce((s,t)=>s+(t.amount||0),0)), color:C.primaryCont },
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
                const muleUpiHandle = muleTransactions.find(t => t.account_id === selectedMule)?.receiver_upi || selectedMule
                const isIn = tx.receiver_upi === muleUpiHandle
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
                      <span style={{ fontFamily:fontSora, fontWeight:700, fontSize:14, color:isIn?C.secondary:C.primaryCont }}>{fmtAmt(tx.amount||0)}</span>
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

// ─── ClusterPanel overlay ──────────────────────────────────────────────────────
function ClusterPanelOverlay({ network, onClose, onExecute }) {
  const [muleStates, setMuleStates] = useState({})

  const setMuleAction = (id, action) =>
    setMuleStates(prev => ({ ...prev, [id]: action }))

  const mules = network?.mule_accounts || []

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.outline}`,
        borderRadius: 14, padding: 24, width: 420, maxHeight: '80vh',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 15, color: C.primary }}>
            Cluster {network?.cluster_id ?? '—'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        {mules.length === 0 && (
          <p style={{ color: C.textMuted, fontFamily: fontInter, fontSize: 13 }}>No mule accounts in this cluster.</p>
        )}
        {mules.map(m => (
          <div key={m.id} style={card({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 })}>
            <span style={{ fontFamily: fontMono, fontSize: 11, color: C.textMain, flex: 1 }}>{m.id}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['BLOCK', 'HONEY_TRAP', 'ACTIVE'].map(action => (
                <button key={action} onClick={() => setMuleAction(m.id, action)} style={{
                  padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: fontGrotesk, fontWeight: 700, fontSize: 10,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  background: muleStates[m.id] === action
                    ? (action === 'BLOCK' ? C.primaryCont : action === 'HONEY_TRAP' ? C.tertiary : C.secondary)
                    : C.surfaceMid,
                  color: muleStates[m.id] === action ? '#000' : C.textMuted,
                }}>
                  {action}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => onExecute(network?.cluster_id, muleStates)}
          style={btn(C.primaryCont, '#000', { marginTop: 12 })}
        >
          EXECUTE
        </button>
      </div>
    </div>
  )
}

// ─── Main NetworkGraph component ───────────────────────────────────────────────
export default function NetworkGraph() {
  const [graphData, setGraphData]       = useState(null)
  const [agentStatus, setAgentStatus]   = useState(null)
  const [transactions, setTransactions] = useState([])
  const [canaryResult, setCanaryResult] = useState(null)
  const [selectedNet, setSelectedNet]   = useState(null)
  const [focusedCluster, setFocusedCluster] = useState(null)
  const [loading, setLoading]           = useState(false)
  const [statusMsg, setStatusMsg]       = useState('')
  const [stats, setStats]               = useState(null)
  const [clusters, setClusters]         = useState([])
  const [alerts, setAlerts]             = useState([])
  const [activeTab, setActiveTab]       = useState('Overview')

  const canvasRef   = useRef(null)
  const containerRef= useRef(null)
  const posRef      = useRef({})
  const rafRef      = useRef(null)
  const tickRef     = useRef(0)
  const graphRef    = useRef(null)  // mirror of graphData for RAF closure

  // ── Fetch helpers ────────────────────────────────────────────────────────────
  const fetchGraph = useCallback(async () => {
    try {
      const r = await axios.get('/api/graph-network/data')
      const data = r.data
      setGraphData(() => {
        // Only add new nodes to posRef, never recompute existing positions
        if (posRef.current && data?.nodes) {
          const canvas = canvasRef.current
          const dpr = window.devicePixelRatio || 1
          const W = canvas ? canvas.width / dpr : 0
          const H = canvas ? canvas.height / dpr : 0
          if (W > 0 && H > 0) {
            const newNodes = data.nodes.filter(n => !posRef.current[n.id])
            if (newNodes.length > 0) {
              const newPos = computeLayout(newNodes, data.edges || [], W, H)
              posRef.current = { ...posRef.current, ...newPos }
            }
          }
        }
        return data
      })
    } catch (_) {}
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const r = await axios.get('/api/graph-network/agent-status')
      setAgentStatus(r.data)
    } catch (_) {}
    try {
      const s = await axios.get('/api/stats')
      setStats(s.data)
    } catch (_) {}
    try {
      const c = await axios.get('/api/clusters')
      setClusters(c.data?.clusters || [])
    } catch (_) {}
    try {
      const al = await axios.get('/api/alerts?limit=5')
      setAlerts(al.data?.alerts || [])
    } catch (_) {}
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      // Fetch both synthetic transactions and live UPI transactions
      const [synth, live] = await Promise.all([
        axios.get('/api/transactions?limit=100'),
        axios.get('/api/upi/transactions?upi=all&limit=20').catch(() => ({ data: { transactions: [] } })),
      ])
      const synthTxns = synth.data?.transactions || []
      const liveTxns  = live.data?.transactions || []
      // Merge, live first
      setTransactions([...liveTxns, ...synthTxns])
    } catch (_) {}
  }, [])

  const initPipeline = useCallback(async () => {
    setLoading(true)
    setStatusMsg('Initialising pipeline…')
    try {
      await axios.post('/api/graph-network/init')
      setStatusMsg('Running GraphSAGE…')
      await axios.post('/api/graph-network/block?n_networks=2')
      setStatusMsg('Done.')
      await fetchGraph()
      await fetchStatus()
    } catch (e) {
      setStatusMsg('Error: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }, [fetchGraph, fetchStatus])

  const triggerCanary = useCallback(async () => {
    try {
      const r = await axios.post('/api/graph-network/canary-check')
      setCanaryResult(r.data)
    } catch (_) {}
  }, [])

  const executeSelectiveBlock = useCallback(async (clusterId, muleStates) => {
    try {
      await axios.post('/api/network/selective-block', { cluster_id: clusterId, actions: muleStates })
      setSelectedNet(null)
      await fetchGraph()
      await fetchStatus()
    } catch (_) {}
  }, [fetchGraph, fetchStatus])

  // ── Initial data load + polling ──────────────────────────────────────────────
  useEffect(() => {
    fetchGraph()
    fetchStatus()
    fetchTransactions()
    const id = setInterval(() => {
      fetchGraph()
      fetchStatus()
      fetchTransactions()
    }, 8000)
    return () => clearInterval(id)
  }, [fetchGraph, fetchStatus, fetchTransactions])

  // ── Keep graphRef in sync for RAF closure ────────────────────────────────────
  useEffect(() => {
    graphRef.current = graphData
  }, [graphData])

  // ── ResizeObserver — sync canvas size, compute layout once ──────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width <= 0 || height <= 0) continue

        const canvas = canvasRef.current
        if (!canvas) continue

        const dpr = window.devicePixelRatio || 1
        canvas.width  = Math.round(width  * dpr)
        canvas.height = Math.round(height * dpr)

        // Recompute full layout on resize
        const data = graphRef.current
        if (data?.nodes?.length) {
          posRef.current = computeLayout(data.nodes, data.edges || [], width, height)
        }
      }
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // ── Canvas click — hit-test nodes ────────────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const mx = (e.clientX - rect.left) * (canvas.width  / rect.width)  / dpr
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height) / dpr

    const data = graphRef.current
    if (!data?.nodes) return

    for (const node of data.nodes) {
      const p = posRef.current[node.id]
      if (!p) continue
      const r = node.is_controller ? 30 : node.is_canary ? 22 : 18
      const dx = mx - p.x
      const dy = my - p.y
      if (dx * dx + dy * dy <= (r + 4) * (r + 4)) {
        // Find the network for this node's cluster
        const nets = agentStatus?.networks || []
        const net = nets.find(n => String(n.cluster_id) === String(node.cluster_id))
        // Also find the full cluster data from DBSCAN clusters
        const clusterData = clusters.find(c => String(c.cluster_id) === String(node.cluster_id))
        setSelectedNet(net || { cluster_id: node.cluster_id, mule_accounts: [] })
        // Open focused layered view — use clusterData or build minimal object
        setFocusedCluster(clusterData || {
          cluster_id: node.cluster_id,
          controller_name: node.id,
          mule_accounts: [],
        })
        return
      }
    }
  }, [agentStatus])

  // ── RAF animation loop — cancel/restart when graphData changes ───────────────
  useEffect(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const loop = () => {
      tickRef.current += 1
      drawGraph(canvasRef.current, graphRef.current, posRef, tickRef.current)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [graphData])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const nodes       = graphData?.nodes || []
  const nodeCount   = nodes.length
  const muleCount   = nodes.filter(n => !n.is_controller).length
  const blockedCount= nodes.filter(n => n.is_blocked).length
  const canaryCount = nodes.filter(n => n.is_canary).length
  const networks    = agentStatus?.networks || []
  const agentLog    = agentStatus?.agent_log || []
  const hasCanaryHit= canaryResult?.canary_hit || networks.some(n => n.canary_hit)

  const pieData = useMemo(() => {
    return clusters.map(c => ({
      name: c.controller_name,
      value: c.account_count || c.accounts?.length || 0
    }))
  }, [clusters])

  const txChartData = useMemo(() => {
    const vols = {}
    transactions.forEach(t => {
      const v = t.verdict || t.status || 'CLEAN'
      vols[v] = (vols[v] || 0) + (t.amount || 0)
    })
    return Object.keys(vols).map(k => ({
      name: k.replace(/_/g, ' '),
      volume: vols[k],
      color: k === 'CONTROLLER_IDENTIFIED' ? C.primaryCont : k === 'BLOCKED_ACCOUNT_HIT' ? C.error : C.secondary
    }))
  }, [transactions])

  const alertChartData = useMemo(() => {
    const counts = {}
    alerts.forEach(a => {
      const type = a.alert_type || 'Unknown'
      counts[type] = (counts[type] || 0) + 1
    })
    return Object.keys(counts).map(k => ({
      name: k.replace(/_/g, ' '),
      count: counts[k],
      color: k.includes('Honey Trap') || k.includes('HONEY_TRAP') ? C.tertiary : C.primaryCont
    }))
  }, [alerts])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.outline}; border-radius: 4px; }
      `}</style>

      {/* Root layout */}
      <div style={{
        display: 'flex', height: '100vh', width: '100vw',
        background: C.bg, overflow: 'hidden',
        fontFamily: fontInter, color: C.textMain,
      }}>

        {/* ══════════════════════════════════════════════════════════════════════
            LEFT PANEL — 280px
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{
          width: 280, flexShrink: 0,
          background: C.surface,
          borderRight: `1px solid ${C.outline}`,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Brand */}
          <div style={{ padding: '20px 18px 14px', borderBottom: `1px solid ${C.outline}` }}>
            <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 18, color: C.primary, letterSpacing: '0.04em' }}>
              🛡 MULESHIELD
            </div>
            <div style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.12em', marginTop: 2 }}>
              AML GRAPH INTELLIGENCE
            </div>
          </div>

          {/* Network status grid */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.outline}` }}>
            <div style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>
              NETWORK STATUS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'NODES',   value: nodeCount,    color: C.secondary },
                { label: 'MULE',    value: muleCount,    color: C.primary },
                { label: 'BLOCKED', value: blockedCount, color: C.primaryCont },
                { label: 'CANARY',  value: canaryCount,  color: C.nodeCanary },
              ].map(s => (
                <div key={s.label} style={{
                  background: C.surfaceLow, borderRadius: 8, padding: '8px 10px',
                  border: `1px solid ${C.outline}`,
                }}>
                  <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>{s.label}</div>
                  <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 22, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                </div>
              ))}
            </div>
            {/* Extra stats row — TRANSACTIONS, ALERTS, CLUSTERS, HIGH CONF */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              {[
                { label: 'TRANSACTIONS', value: stats?.total_transactions ?? 500, color: '#a5b4fc' },
                { label: 'ALERTS',       value: stats?.total_alerts ?? 0,         color: C.primary },
                { label: 'CLUSTERS',     value: stats?.total_clusters ?? 4,       color: C.tertiary },
                { label: 'HIGH CONF',    value: stats?.high_confidence_alerts ?? 0, color: C.primaryCont },
              ].map(s => (
                <div key={s.label} style={{
                  background: C.surfaceLow, borderRadius: 8, padding: '6px 10px',
                  border: `1px solid ${C.outline}`,
                }}>
                  <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>{s.label}</div>
                  <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 18, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Detected controllers */}
          <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>
              DETECTED CONTROLLERS
            </div>
            {networks.length === 0 ? (
              [0, 1, 2].map(i => (
                <div key={i} style={card({ opacity: 0.45 })}>
                  <div style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted }}>— awaiting scan —</div>
                </div>
              ))
            ) : (
              networks.map(net => (
                <div key={net.cluster_id} style={card({ cursor: 'pointer' })}
                  onClick={() => setSelectedNet(net)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: fontMono, fontSize: 11, color: C.tertiary }}>
                      Cluster {net.cluster_id}
                    </span>
                    {net.is_blocked && <span style={pill(C.primaryCont, '#000')}>BLOCKED</span>}
                    {net.canary_hit && <span style={pill(C.nodeCanary, '#000')}>HIT</span>}
                  </div>
                  <div style={{ fontFamily: fontInter, fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    {net.mule_count ?? net.mule_accounts?.length ?? 0} mules · risk {net.risk_score ? (net.risk_score * 100).toFixed(0) + '%' : '—'}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DBSCAN Clusters section */}
          <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.outline}` }}>
            <div style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>
              DBSCAN CLUSTERS
            </div>
            {clusters.length === 0 ? (
              <div style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted }}>Run GraphSAGE to detect clusters</div>
            ) : clusters.map(c => (
              <div key={c.cluster_id} style={{
                background: C.surfaceLow, borderRadius: 6, padding: '8px 10px',
                border: `1px solid ${C.outline}`, marginBottom: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: fontInter, fontWeight: 600, fontSize: 12, color: C.textMain }}>
                    {c.controller_name}
                  </span>
                  <span style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 12, color: C.secondary }}>
                    {((c.confidence_score || 0) * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMuted, marginTop: 3 }}>
                  {c.account_count} accounts · 🍯 {c.honey_trap_account?.slice(-10)}...
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ padding: '14px 18px', borderTop: `1px solid ${C.outline}` }}>
            <button
              onClick={initPipeline}
              disabled={loading}
              style={btn(C.primaryCont, '#000', { marginBottom: 8, opacity: loading ? 0.6 : 1 })}
            >
              {loading ? statusMsg || 'RUNNING…' : '▶ RUN GRAPHSAGE'}
            </button>
            <button
              onClick={() => axios.post('/api/graph-network/block?n_networks=2').then(fetchStatus)}
              style={btn(C.tertiary, '#000', { marginBottom: 8 })}
            >
              🚫 BLOCK TOP 2 NETWORKS
            </button>
            <button
              onClick={() => axios.post('/api/upi/reset').then(fetchStatus)}
              style={btn(C.outline, C.textMain, { marginBottom: 0, background: 'transparent', border: `1px solid ${C.outline}` })}
            >
              ↺ RESET LEDGER
            </button>
          </div>

          {/* Canary simulation footer */}
          <div style={{ padding: '10px 18px 16px', borderTop: `1px solid ${C.outline}` }}>
            <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 8 }}>
              CANARY SIMULATION
            </div>
            <button onClick={triggerCanary} style={btn(C.nodeCanary, '#000')}>
              🐦 TRIGGER CANARY CHECK
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            CENTER PANEL — flex-1
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header bar */}
          <div style={{
            height: 52, flexShrink: 0,
            background: C.surface,
            borderBottom: `1px solid ${C.outline}`,
            display: 'flex', alignItems: 'center',
            padding: '0 20px', gap: 24,
          }}>
            <span style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 13, color: C.primary }}>
              LIVE NETWORK GRAPH
            </span>
            <nav style={{ display: 'flex', gap: 16 }}>
              {['Overview', 'Clusters', 'Transactions', 'Alerts'].map(tab => (
                <span key={tab} onClick={() => setActiveTab(tab)} style={{
                  fontFamily: fontGrotesk, fontSize: 11,
                  color: activeTab === tab ? C.secondary : C.textMuted,
                  cursor: 'pointer', letterSpacing: '0.06em',
                  padding: '4px 0',
                  borderBottom: activeTab === tab ? `2px solid ${C.secondary}` : '2px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  {tab.toUpperCase()}
                </span>
              ))}
            </nav>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: graphData ? C.secondary : C.outline,
                display: 'inline-block',
              }} />
              <span style={{ fontFamily: fontMono, fontSize: 10, color: C.textMuted }}>
                {graphData ? 'LIVE' : 'CONNECTING'}
              </span>
            </div>
          </div>

          {/* Canvas container — always mounted, hidden on non-Overview tabs to preserve layout */}
          <div
            ref={containerRef}
            style={{ flex: activeTab === 'Overview' ? 1 : 0, width: '100%', position: 'relative', overflow: 'hidden', display: activeTab === 'Overview' ? 'block' : 'none' }}
          >
            {/* Background image */}
            <img
              src="/graph-bg.jpg"
              alt=""
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', opacity: 0.6, zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                zIndex: 2, cursor: 'crosshair',
              }}
            />

            {/* Legend overlay — top-right */}
            <div style={{
              position: 'absolute', top: 14, right: 14,
              zIndex: 10,
              background: 'rgba(19,19,27,0.88)',
              border: `1px solid ${C.outline}`,
              borderRadius: 10, padding: '10px 14px',
              backdropFilter: 'blur(6px)',
            }}>
              <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 8 }}>
                LEGEND
              </div>
              {[
                { color: C.nodeCtrl,    label: 'Controller (hex)' },
                { color: C.nodeCanary,  label: 'Canary node' },
                { color: C.nodeBlocked, label: 'Blocked' },
                { color: C.nodeHit,     label: 'High-risk mule' },
                { color: C.nodeActive,  label: 'Active mule' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: fontInter, fontSize: 10, color: C.textMuted }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Controls overlay — top-left */}
            <div style={{
              position: 'absolute', top: 14, left: 14,
              zIndex: 10,
              background: 'rgba(19,19,27,0.88)',
              border: `1px solid ${C.outline}`,
              borderRadius: 10, padding: '10px 14px',
              backdropFilter: 'blur(6px)',
            }}>
              <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 6 }}>
                CONTROLS
              </div>
              <div style={{ fontFamily: fontInter, fontSize: 10, color: C.textMuted, lineHeight: 1.7 }}>
                Click node → cluster detail<br />
                Auto-refresh every 8s
              </div>
            </div>

            {/* Empty state */}
            {!graphData && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12,
              }}>
                <div style={{ fontFamily: fontSora, fontSize: 16, color: C.textMuted }}>
                  Awaiting graph data…
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 11, color: C.outline }}>
                  Run GraphSAGE to populate the network
                </div>
              </div>
            )}
          </div>
          {/* end canvas container */}

          {/* ── CLUSTERS TAB ── */}
          {activeTab === 'Clusters' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: C.bg, minHeight: 0 }}>
              <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 16, color: C.primary, marginBottom: 20 }}>
                DBSCAN Cluster Analysis
              </div>

              {clusters.length > 0 && (
                <div style={{ background: C.surface, border: `1px solid ${C.outline}`, borderRadius: 10, padding: 18, marginBottom: 20, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>ACCOUNTS PER CLUSTER</span>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={5} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: C.surfaceLow, border: `1px solid ${C.outline}`, borderRadius: 8, fontSize: 12, fontFamily: fontMono, color: '#fff' }} itemStyle={{ color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {clusters.length === 0 ? (
                <div style={{ fontFamily: fontMono, fontSize: 13, color: C.textMuted }}>
                  Run GraphSAGE to detect clusters
                </div>
              ) : clusters.map(c => (
                <div key={c.cluster_id} style={{
                  background: C.surface, border: `1px solid ${C.outline}`,
                  borderRadius: 10, padding: 18, marginBottom: 14,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 15, color: C.textMain }}>{c.controller_name}</div>
                      <div style={{ fontFamily: fontMono, fontSize: 11, color: C.textMuted, marginTop: 3 }}>{c.cluster_id}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 22, color: C.secondary }}>
                        {((c.confidence_score || 0) * 100).toFixed(0)}%
                      </div>
                      <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>CONFIDENCE</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {[
                      { label: 'ACCOUNTS', value: c.account_count },
                      { label: 'BLOCKED', value: Object.values(c.account_statuses || {}).filter(s => s === 'BLOCKED').length },
                      { label: 'HONEY TRAP', value: 1 },
                    ].map(s => (
                      <div key={s.label} style={{ background: C.surfaceLow, borderRadius: 6, padding: '8px 10px', border: `1px solid ${C.outline}` }}>
                        <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>{s.label}</div>
                        <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 18, color: C.tertiary }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 6 }}>FINGERPRINT</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(c.controller_fingerprint || {}).map(([k, v]) => (
                      <span key={k} style={{ background: C.surfaceLow, border: `1px solid ${C.outline}`, borderRadius: 4, padding: '3px 8px', fontFamily: fontMono, fontSize: 10, color: C.textMuted }}>
                        {k.replace(/_/g, ' ')}: <span style={{ color: C.textMain }}>{String(v)}</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontFamily: fontMono, fontSize: 10, color: C.nodeCanary }}>
                    🍯 Honey Trap: {c.honey_trap_account}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TRANSACTIONS TAB ── */}
          {activeTab === 'Transactions' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: C.bg, minHeight: 0 }}>
              <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 16, color: C.primary, marginBottom: 20 }}>
                Transaction Ledger
              </div>

              {transactions.length > 0 && (
                <div style={{ width: '100%', height: 160, marginBottom: 24 }}>
                  <span style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>VOLUME BY VERDICT</span>
                  <ResponsiveContainer>
                    <BarChart data={txChartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{fontSize: 9, fill: C.textMuted, fontFamily: fontGrotesk}} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <RechartsTooltip contentStyle={{ background: C.surfaceLow, border: `1px solid ${C.outline}`, borderRadius: 8, fontSize: 12, fontFamily: fontMono, color: '#fff' }} itemStyle={{ color: C.secondary }} formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
                      <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                        {txChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{ background: C.surface, border: `1px solid ${C.outline}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 0, padding: '10px 16px', background: C.surfaceLow, borderBottom: `1px solid ${C.outline}` }}>
                  {['TXN ID', 'FROM', 'TO', 'AMOUNT', 'STATUS'].map(h => (
                    <div key={h} style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>{h}</div>
                  ))}
                </div>
                {transactions.length === 0 ? (
                  <div style={{ padding: 24, fontFamily: fontMono, fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
                    No transactions yet
                  </div>
                ) : transactions.slice(0, 50).map((tx, i) => {
                  const v = tx.verdict || tx.status || 'CLEAN'
                  const isHigh = v === 'CONTROLLER_IDENTIFIED'
                  const isBlocked = v === 'BLOCKED_ACCOUNT_HIT'
                  const color = isHigh ? C.primaryCont : isBlocked ? C.error : C.textMuted
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 0, padding: '10px 16px', borderBottom: `1px solid ${C.outline}`, background: isHigh ? 'rgba(255,76,131,0.05)' : 'transparent' }}>
                      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMuted }}>{(tx.transaction_id || '').slice(-10)}</div>
                      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMain }}>{(tx.sender_upi || '').slice(0, 14)}</div>
                      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMain }}>{(tx.receiver_upi || '').slice(0, 14)}</div>
                      <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 11, color: C.secondary }}>₹{(tx.amount || 0).toLocaleString()}</div>
                      <div style={{ fontFamily: fontGrotesk, fontSize: 9, color, letterSpacing: '0.06em' }}>{v.replace(/_/g, ' ')}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ALERTS TAB ── */}
          {activeTab === 'Alerts' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: C.bg, minHeight: 0 }}>
              <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 16, color: C.primary, marginBottom: 20 }}>
                Alert Feed
              </div>

              {alerts.length > 0 && (
                <div style={{ width: '100%', height: 180, marginBottom: 24 }}>
                  <span style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>ALERTS BY TYPE</span>
                  <ResponsiveContainer>
                    <BarChart data={alertChartData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 9, fill: C.textMuted, fontFamily: fontGrotesk}} axisLine={false} tickLine={false} width={140} />
                      <RechartsTooltip cursor={{fill: C.surfaceLow}} contentStyle={{ background: C.surfaceLow, border: `1px solid ${C.outline}`, borderRadius: 8, fontSize: 12, fontFamily: fontMono, color: '#fff' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                        {alertChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {alerts.length === 0 ? (
                <div style={{ fontFamily: fontMono, fontSize: 13, color: C.textMuted }}>No alerts generated yet</div>
              ) : alerts.map((a, i) => {
                const isHigh = a.confidence_tier === 'HIGH_CONFIDENCE'
                const color = isHigh ? C.primaryCont : C.tertiary
                return (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${isHigh ? C.primaryCont : C.outline}`, borderRadius: 10, padding: 16, marginBottom: 12, boxShadow: isHigh ? `0 0 16px rgba(255,76,131,0.15)` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: fontGrotesk, fontSize: 10, color, letterSpacing: '0.1em', marginBottom: 4 }}>{a.alert_type}</div>
                        <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 14, color: C.textMain }}>{a.matched_cluster?.controller_name || a.matched_cluster?.cluster_id || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 20, color }}>{((a.confidence || 0) * 100).toFixed(0)}%</div>
                        <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>{a.confidence_tier}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                      {[
                        { label: 'UPI', value: a.controller?.upi_handle },
                        { label: 'IP', value: a.controller?.ip_address },
                        { label: 'ISP', value: a.controller?.isp },
                        { label: 'PROXY', value: a.controller?.proxy_used ? 'YES ⚠' : 'No' },
                        { label: 'LOCATION', value: `${a.location?.city || '—'}, ${a.location?.state || '—'}` },
                        { label: 'ACTION', value: a.recommended_action },
                      ].map(r => (
                        <div key={r.label} style={{ background: C.surfaceLow, borderRadius: 6, padding: '6px 10px', border: `1px solid ${C.outline}` }}>
                          <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>{r.label}</div>
                          <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMain }}>{r.value || '—'}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontFamily: fontMono, fontSize: 9, color: C.textMuted }}>
                      LEA Ref: {a.lea_reference} · {a.alert_timestamp?.slice(0, 16)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            RIGHT PANEL — 320px
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{
          width: 320, flexShrink: 0,
          background: C.surface,
          borderLeft: `1px solid ${C.outline}`,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.outline}` }}>
            <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 13, color: C.primary }}>
              Live Intelligence Feed
            </div>
            <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>
              REAL-TIME AML SIGNALS
            </div>
          </div>

          {/* Canary alert section */}
          {hasCanaryHit && (
            <div style={{
              margin: '12px 14px 0',
              background: 'rgba(255,76,131,0.12)',
              border: `1px solid ${C.primaryCont}`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>🚨</span>
                <span style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 12, color: C.primaryCont }}>
                  CANARY TRIGGERED
                </span>
              </div>
              {canaryResult?.hit_accounts?.map(acc => (
                <div key={acc} style={{ fontFamily: fontMono, fontSize: 10, color: C.error, marginBottom: 2 }}>
                  ↳ {acc}
                </div>
              ))}
              {networks.filter(n => n.canary_hit).map(n => (
                <div key={n.cluster_id} style={{ fontFamily: fontMono, fontSize: 10, color: C.error, marginBottom: 2 }}>
                  ↳ Cluster {n.cluster_id} hit
                </div>
              ))}
            </div>
          )}

          {/* 🎯 Honey Trap Hit — live controller hardware from payment app */}
          {(() => {
            const hits = (alerts || []).filter(a => a.trigger_transaction && a.trigger_transaction.sender_upi && a.trigger_transaction.receiver_upi)
            if (!hits.length) return null
            const a = hits[0], ctrl = a.controller || {}, txn = a.trigger_transaction || {}
            const sig = a.evidence && a.evidence.signal_breakdown ? a.evidence.signal_breakdown : {}
            return (
              <div style={{ margin: "0 14px 14px", background: "rgba(0,224,179,0.06)", border: "1px solid " + C.nodeCanary, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.nodeCanary, letterSpacing: "0.12em" }}>�� HONEY TRAP HIT</span>
                  <span style={{ fontFamily: fontMono, fontSize: 9, color: C.textMuted }}>{a.alert_timestamp && a.alert_timestamp.slice(11,19)}</span>
                </div>
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "6px 8px", marginBottom: 8, fontFamily: fontMono, fontSize: 10 }}>
                  <div style={{ color: C.textMain }}>{txn.sender_upi || ctrl.upi_handle || "—"}</div>
                  <div style={{ color: C.outline, margin: "2px 0" }}>{"↓ ₹" + ((txn.amount || 0).toLocaleString("en-IN"))}</div>
                  <div style={{ color: C.nodeCanary }}>{"🍯 " + (a.mule_network && a.mule_network.honey_trap_account ? a.mule_network.honey_trap_account : txn.receiver_upi || "—")}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                  {[
                    ["FP", ctrl.device_fingerprint && ctrl.device_fingerprint.slice(0,14)],
                    ["JA3", ctrl.ja3_hash && ctrl.ja3_hash.slice(0,12)],
                    ["IP", ctrl.ip_address],
                    ["ISP", ctrl.isp],
                    ["WEBGL", ctrl.webgl_renderer && ctrl.webgl_renderer.slice(0,22)],
                    ["SCREEN", ctrl.screen_resolution],
                    ["CPU", ctrl.cpu_cores ? ctrl.cpu_cores + " cores" : null],
                    ["BATTERY", ctrl.battery_level != null ? Math.round(ctrl.battery_level*100) + "%" + (ctrl.battery_charging ? " ⚡" : "") : null],
                  ].filter(function(x){ return x[1] }).map(function(x){ return (
                    <div key={x[0]} style={{ background: "rgba(0,0,0,0.25)", padding: "3px 6px", borderRadius: 3 }}>
                      <div style={{ fontFamily: fontGrotesk, fontSize: 8, color: C.textMuted }}>{x[0]}</div>
                      <div style={{ fontFamily: fontMono, fontSize: 9, color: C.nodeCanary, wordBreak: "break-all" }}>{x[1]}</div>
                    </div>
                  )})}
                </div>
                {Object.keys(sig).length > 0 && (
                  <div>
                    <div style={{ fontFamily: fontGrotesk, fontSize: 8, color: C.textMuted, letterSpacing: "0.1em", marginBottom: 4 }}>SIGNALS</div>
                    {Object.entries(sig).slice(0,4).map(function(entry){
                      var k = entry[0], v = entry[1]
                      var score = typeof v === "object" ? (v && v.value != null ? v.value : 0) : (v || 0)
                      var pct = score * 100
                      var col = pct > 70 ? C.primaryCont : pct > 40 ? C.tertiary : C.secondary
                      return (
                        <div key={k} style={{ marginBottom: 3 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fontMono, fontSize: 8, marginBottom: 1 }}>
                            <span style={{ color: C.textMuted }}>{k.replace(/_/g," ")}</span>
                            <span style={{ color: col }}>{pct.toFixed(0) + "%"}</span>
                          </div>
                          <div style={{ background: C.surfaceLow, height: 2, borderRadius: 1 }}>
                            <div style={{ width: pct + "%", background: col, height: 2, borderRadius: 1 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {hits.length > 1 && <div style={{ fontFamily: fontMono, fontSize: 9, color: C.textMuted, marginTop: 6, textAlign: "center" }}>{"+" + (hits.length-1) + " more"}</div>}
              </div>
            )
          })()}

          {/* Transaction stream */}
          <div style={{ padding: '14px 18px 0' }}>
            <div style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>
              TRANSACTION STREAM
            </div>
            {(transactions.length === 0 ? Array(4).fill(null) : transactions.slice(0, 8)).map((tx, i) => (
              <div key={i} style={card({ padding: '8px 10px' })}>
                {tx ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMain }}>
                        {tx.sender_upi || tx.from || '—'} → {tx.receiver_upi || tx.to || '—'}
                      </div>
                      <div style={{ fontFamily: fontInter, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                        {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 12, color: C.secondary }}>
                        ₹{tx.amount?.toLocaleString() || '—'}
                      </div>
                      {tx.risk_score != null && (
                        <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: tx.risk_score > 0.7 ? C.primaryCont : C.textMuted }}>
                          {(tx.risk_score * 100).toFixed(0)}% risk
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontFamily: fontMono, fontSize: 10, color: C.outline }}>— awaiting transactions —</div>
                )}
              </div>
            ))}
          </div>

          {/* Recent Alerts section */}
          <div style={{ padding: '14px 18px 0' }}>
            <div style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>
              RECENT ALERTS
            </div>
            {(alerts.length === 0 ? [
              { alert_type: 'UNRELATED_TRANSACTION', confidence: 0.29, matched_cluster: { cluster_id: 'CTRL_CLUSTER_001' }, alert_timestamp: '' },
              { alert_type: 'UNRELATED_TRANSACTION', confidence: 0.46, matched_cluster: { cluster_id: 'CTRL_CLUSTER_001' }, alert_timestamp: '' },
              { alert_type: 'UNRELATED_TRANSACTION', confidence: 0.33, matched_cluster: { cluster_id: 'CTRL_CLUSTER_001' }, alert_timestamp: '' },
            ] : alerts.slice(0, 5)).map((a, i) => {
              const isHigh = a.confidence > 0.8
              const isMed  = a.confidence > 0.5
              const color  = isHigh ? C.primaryCont : isMed ? C.tertiary : C.textMuted
              return (
                <div key={i} style={card({ padding: '7px 10px', marginBottom: 5, borderLeft: `2px solid ${color}` })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: fontGrotesk, fontSize: 9, color, letterSpacing: '0.08em' }}>
                      {a.alert_type?.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontFamily: fontMono, fontSize: 9, color: C.textMuted }}>
                      {a.alert_timestamp ? new Date(a.alert_timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <div style={{ fontFamily: fontMono, fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                    {((a.confidence || 0) * 100).toFixed(0)}% · {a.matched_cluster?.cluster_id || '—'}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Agent log terminal */}
          <div style={{ padding: '14px 18px 18px', flex: 1 }}>
            <div style={{ fontFamily: fontGrotesk, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 10 }}>
              AGENT LOG
            </div>
            <div style={{
              background: '#0a0a0f',
              border: `1px solid ${C.outline}`,
              borderRadius: 8, padding: '10px 12px',
              minHeight: 140, maxHeight: 220, overflowY: 'auto',
            }}>
              {(agentLog.length === 0 ? [
                '> system initialised',
                '> awaiting graph data…',
                '> run GraphSAGE to begin',
              ] : agentLog).map((line, i) => (
                <div key={i} style={{
                  fontFamily: fontMono, fontSize: 10,
                  color: typeof line === 'string' && line.includes('BLOCK') ? C.primaryCont
                       : typeof line === 'string' && line.includes('canary') ? C.nodeCanary
                       : C.textMuted,
                  lineHeight: 1.7,
                }}>
                  {typeof line === 'string' ? line : JSON.stringify(line)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Focused network overlay — full-screen layered view */}
      {focusedCluster && (
        <FocusedNetworkOverlay
          cluster={focusedCluster}
          graphNodes={graphData?.nodes || []}
          graphEdges={graphData?.edges || []}
          transactions={transactions}
          onClose={() => setFocusedCluster(null)}
          onExecute={(clusterId, muleStates) => {
            executeSelectiveBlock(clusterId, muleStates)
            setFocusedCluster(null)
          }}
        />
      )}

      {/* Cluster panel overlay (legacy — kept for left-panel controller clicks) */}
      {selectedNet && !focusedCluster && (
        <ClusterPanelOverlay
          network={selectedNet}
          onClose={() => setSelectedNet(null)}
          onExecute={executeSelectiveBlock}
        />
      )}
    </>
  )
}

