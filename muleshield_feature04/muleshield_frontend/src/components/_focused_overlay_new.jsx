// ─── FocusedNetworkOverlay — chain: CTRL → M1 → M2 → ... → HoneyTrap ─────────
function FocusedNetworkOverlay({ cluster, graphNodes, graphEdges, onClose, onExecute }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const tickRef   = useRef(0)
  const [muleStates, setMuleStates] = useState({})

  // Build node list
  const clusterNodes = (graphNodes || []).filter(
    n => String(n.cluster_id) === String(cluster?.cluster_id)
  )
  const controller = clusterNodes.find(n => n.is_controller) ||
    { id: cluster?.controller_name || 'CTRL', is_controller: true }

  const rawMules = clusterNodes.filter(n => !n.is_controller).length > 0
    ? clusterNodes.filter(n => !n.is_controller)
    : (cluster?.mule_accounts || []).map(id => ({ id, is_controller: false }))

  // Filter edges within this cluster
  const clusterNodeIds = new Set([controller.id, ...rawMules.map(m => m.id)])
  const clusterEdges = (graphEdges || []).filter(
    e => clusterNodeIds.has(e.source) && clusterNodeIds.has(e.target)
  )

  // Build linear chain by following edges from controller
  const chainOrder = (() => {
    if (clusterEdges.length === 0) return rawMules
    const adj = {}
    clusterEdges.forEach(e => {
      if (!adj[e.source]) adj[e.source] = []
      adj[e.source].push(e.target)
    })
    const visited = new Set([controller.id])
    const chain = []
    let cur = controller.id
    for (let i = 0; i < rawMules.length + 1; i++) {
      const nexts = (adj[cur] || []).filter(id => !visited.has(id) && clusterNodeIds.has(id))
      if (!nexts.length) break
      cur = nexts[0]
      visited.add(cur)
      chain.push(rawMules.find(m => m.id === cur) || { id: cur, is_controller: false })
    }
    rawMules.forEach(m => { if (!visited.has(m.id)) chain.push(m) })
    return chain
  })()

  const honeyTrapId = cluster?.honey_trap_account ||
    (chainOrder.length > 0 ? chainOrder[chainOrder.length - 1].id : null)

  const fullChain = [{ id: controller.id, is_controller: true }, ...chainOrder]

  const setMuleAction = (id, action) =>
    setMuleStates(prev => {
      const next = { ...prev }
      if (next[id] === action) delete next[id]
      else next[id] = action
      return next
    })

  const blockedCount = Object.values(muleStates).filter(v => v === 'BLOCK').length

  const fmtAmt = v => {
    if (!v) return '₹0'
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`
    if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`
    return `₹${Math.round(v)}`
  }

  // Canvas draw: horizontal chain CTRL → M1 → M2 → ... → HoneyTrap
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      tickRef.current += 1
      const tick = tickRef.current
      const dpr = window.devicePixelRatio || 1
      const W = canvas.width / dpr
      const H = canvas.height / dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return }

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#0a0a12'
      ctx.fillRect(0, 0, W, H)

      const n = fullChain.length
      if (n === 0) { ctx.restore(); rafRef.current = requestAnimationFrame(draw); return }

      const pad = 80
      const spacing = n > 1 ? (W - pad * 2) / (n - 1) : 0
      const cy = H * 0.42
      const nodeR = 22

      const positions = fullChain.map((node, i) => ({
        x: n === 1 ? W / 2 : pad + i * spacing,
        y: cy,
        node,
      }))

      // Draw chain edges
      for (let i = 0; i < positions.length - 1; i++) {
        const src = positions[i]
        const tgt = positions[i + 1]
        const isHoneyTarget   = tgt.node.id === honeyTrapId
        const isBlockedTarget = muleStates[tgt.node.id] === 'BLOCK'
        const edge = clusterEdges.find(e => e.source === src.node.id && e.target === tgt.node.id)
          || clusterEdges.find(e => e.target === tgt.node.id)
        const amount = edge?.weight || 0
        const count  = edge?.count  || 1
        const color  = isBlockedTarget ? C.nodeBlocked
          : isHoneyTarget ? C.nodeCanary
          : C.secondary

        const x1 = src.x + (src.node.is_controller ? 28 : nodeR)
        const x2 = tgt.x - nodeR
        const y1 = src.y, y2 = tgt.y

        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = isHoneyTarget ? 2 : 1.5
        if (isHoneyTarget) { ctx.setLineDash([6, 4]); ctx.lineDashOffset = -((tick * 0.4) % 16) }
        ctx.globalAlpha = isBlockedTarget ? 0.25 : 0.7
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
        ctx.setLineDash([])

        const dx = x2 - x1, dy = y2 - y1
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 0) {
          const ux = dx / len, uy = dy / len
          const as = 8
          ctx.globalAlpha = isBlockedTarget ? 0.3 : 0.9
          ctx.beginPath()
          ctx.moveTo(x2, y2)
          ctx.lineTo(x2 - as * ux + as * 0.45 * uy, y2 - as * uy - as * 0.45 * ux)
          ctx.lineTo(x2 - as * ux - as * 0.45 * uy, y2 - as * uy + as * 0.45 * ux)
          ctx.closePath(); ctx.fillStyle = color; ctx.fill()

          if (!isBlockedTarget) {
            const t = ((tick * 0.014 + i * 0.3) % 1)
            const px = x1 + dx * t, py = y1 + dy * t
            ctx.globalAlpha = 0.9
            ctx.shadowColor = color; ctx.shadowBlur = 10
            ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2)
            ctx.fillStyle = color; ctx.fill()
            ctx.shadowBlur = 0
          }

          if (amount > 0 || count > 0) {
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 14
            const label = fmtAmt(amount) + (count > 1 ? ` x${count}` : '')
            ctx.font = `700 9px ${fontMono}`
            const tw = ctx.measureText(label).width + 12
            ctx.globalAlpha = 0.92
            ctx.fillStyle = '#0a0a12'
            ctx.beginPath(); ctx.roundRect(mx - tw / 2, my - 9, tw, 17, 4); ctx.fill()
            ctx.strokeStyle = color + '88'; ctx.lineWidth = 1
            ctx.beginPath(); ctx.roundRect(mx - tw / 2, my - 9, tw, 17, 4); ctx.stroke()
            ctx.globalAlpha = 1
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillStyle = color; ctx.fillText(label, mx, my)
          }
        }
        ctx.restore()
      }

      // Draw nodes
      positions.forEach((pos, i) => {
        const { node } = pos
        const isCtrl    = node.is_controller
        const isHoney   = node.id === honeyTrapId && !isCtrl
        const isBlocked = muleStates[node.id] === 'BLOCK'
        const r = isCtrl ? 28 : nodeR

        ctx.save()
        if (isCtrl) {
          const pulse = 1 + 0.05 * Math.sin(tick * 0.04)
          ctx.shadowColor = C.nodeCtrl; ctx.shadowBlur = 24
          drawHexagon(ctx, pos.x, pos.y, r * pulse)
          ctx.fillStyle = C.nodeCtrl; ctx.fill()
          ctx.strokeStyle = '#fff8'; ctx.lineWidth = 1.5; ctx.stroke()
          ctx.globalAlpha = 0.15 + 0.08 * Math.sin(tick * 0.04)
          drawHexagon(ctx, pos.x, pos.y, r * pulse * 1.5)
          ctx.strokeStyle = C.nodeCtrl; ctx.lineWidth = 1; ctx.stroke()
          ctx.globalAlpha = 1
          ctx.font = `700 9px ${fontMono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = '#000'; ctx.fillText('CTRL', pos.x, pos.y)
        } else if (isHoney) {
          const pr = r + 4 + 3 * Math.sin(tick * 0.06)
          ctx.strokeStyle = C.nodeCanary; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.3
          ctx.beginPath(); ctx.arc(pos.x, pos.y, pr, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = 1; ctx.shadowColor = C.nodeCanary; ctx.shadowBlur = 18
          ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
          ctx.fillStyle = C.nodeCanary; ctx.fill()
          ctx.font = `14px ${fontMono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = '#000'; ctx.fillText('🍯', pos.x, pos.y)
        } else if (isBlocked) {
          ctx.shadowColor = C.nodeBlocked; ctx.shadowBlur = 10
          ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
          ctx.fillStyle = C.nodeBlocked; ctx.fill()
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.moveTo(pos.x - 7, pos.y - 7); ctx.lineTo(pos.x + 7, pos.y + 7)
          ctx.moveTo(pos.x + 7, pos.y - 7); ctx.lineTo(pos.x - 7, pos.y + 7)
          ctx.stroke()
        } else {
          ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2)
          ctx.fillStyle = C.nodeActive; ctx.fill()
          ctx.strokeStyle = '#3a2a30'; ctx.lineWidth = 1; ctx.stroke()
        }
        ctx.restore()

        ctx.save()
        ctx.font = `700 9px ${fontGrotesk}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        ctx.fillStyle = isCtrl ? C.nodeCtrl : isHoney ? C.nodeCanary : isBlocked ? C.nodeBlocked : C.textMuted
        const stepLabel = isCtrl ? 'CONTROLLER' : isHoney ? 'HONEY TRAP' : isBlocked ? `M${i} BLOCKED` : `MULE ${i}`
        ctx.fillText(stepLabel, pos.x, pos.y - r - 6)
        ctx.restore()

        ctx.save()
        ctx.font = `9px ${fontMono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.fillStyle = isBlocked ? C.nodeBlocked + 'aa' : isHoney ? C.nodeCanary + 'aa' : C.textMuted + 'aa'
        ctx.fillText(String(node.id).slice(0, 14), pos.x, pos.y + r + 5)
        ctx.restore()

        if (!isCtrl) {
          const inflow = clusterEdges
            .filter(e => e.target === node.id)
            .reduce((s, e) => s + (e.weight || 0), 0)
          if (inflow > 0) {
            ctx.save()
            ctx.font = `700 9px ${fontMono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
            ctx.fillStyle = (isHoney ? C.nodeCanary : isBlocked ? C.nodeBlocked : C.secondary) + 'cc'
            ctx.fillText(fmtAmt(inflow) + ' in', pos.x, pos.y + r + 17)
            ctx.restore()
          }
        }
      })

      // Annotation when mules are blocked
      const blockedIds = Object.entries(muleStates)
        .filter(([, v]) => v === 'BLOCK').map(([k]) => k)
      if (blockedIds.length > 0 && honeyTrapId) {
        ctx.save()
        ctx.font = `700 10px ${fontGrotesk}`
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.fillStyle = C.nodeCanary
        ctx.fillText(
          `${blockedIds.length} mule(s) blocked — controller will reroute to honey trap`,
          W / 2, H * 0.72
        )
        ctx.font = `9px ${fontInter}`; ctx.fillStyle = C.textMuted
        ctx.fillText('Monitor honey trap to capture controller fingerprint', W / 2, H * 0.72 + 16)
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
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = canvas.offsetWidth  * dpr
      canvas.height = canvas.offsetHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        flexShrink: 0, background: C.surface,
        borderBottom: `1px solid ${C.outline}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ marginRight: 4 }}>
          <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 14, color: C.primary }}>
            Cluster {cluster?.cluster_id ?? '—'}
          </div>
          <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMuted, marginTop: 1 }}>
            {controller.id} · {chainOrder.length} mules · chain depth {fullChain.length}
          </div>
        </div>

        {/* Blockable mule pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {chainOrder.filter(m => m.id !== honeyTrapId).map((m, i) => {
            const state = muleStates[m.id]
            return (
              <div key={m.id} style={{
                background: C.surfaceLow,
                border: `1px solid ${state === 'BLOCK' ? C.nodeBlocked : C.outline}`,
                borderRadius: 7, padding: '5px 9px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted }}>M{i + 1}</span>
                <span style={{ fontFamily: fontMono, fontSize: 9, color: C.textMain }}>
                  {String(m.id).slice(0, 12)}
                </span>
                <button onClick={() => setMuleAction(m.id, 'BLOCK')} style={{
                  padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontFamily: fontGrotesk, fontWeight: 700, fontSize: 8,
                  background: state === 'BLOCK' ? C.nodeBlocked : C.surfaceMid,
                  color: state === 'BLOCK' ? '#000' : C.textMuted,
                }}>
                  🚫 BLOCK
                </button>
              </div>
            )
          })}
          {honeyTrapId && (
            <div style={{
              background: C.nodeCanary + '18',
              border: `1px solid ${C.nodeCanary}`,
              borderRadius: 7, padding: '5px 9px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.nodeCanary }}>🍯 HONEY TRAP</span>
              <span style={{ fontFamily: fontMono, fontSize: 9, color: C.nodeCanary }}>
                {String(honeyTrapId).slice(0, 12)}
              </span>
              <span style={{ fontFamily: fontGrotesk, fontSize: 8, color: C.nodeCanary + 'aa' }}>MONITOR</span>
            </div>
          )}
        </div>

        <span style={pill(C.nodeBlocked + '33', C.nodeBlocked)}>{blockedCount} BLOCKED</span>

        <button onClick={() => onExecute(cluster?.cluster_id, muleStates)} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none',
          background: C.primaryCont, color: '#000',
          fontFamily: fontGrotesk, fontWeight: 700, fontSize: 11,
          letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
        }}>
          EXECUTE
        </button>
        <button onClick={onClose} style={{
          background: 'none', border: `1px solid ${C.outline}`,
          borderRadius: 8, color: C.textMuted, cursor: 'pointer',
          fontFamily: fontGrotesk, fontSize: 11, padding: '8px 14px',
        }}>
          ✕ CLOSE
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <div style={{
          position: 'absolute', bottom: 14, right: 16,
          background: 'rgba(19,19,27,0.88)', border: `1px solid ${C.outline}`,
          borderRadius: 8, padding: '8px 14px', backdropFilter: 'blur(6px)',
        }}>
          {[
            { color: C.nodeCtrl,    label: 'Controller' },
            { color: C.secondary,   label: 'Mule (active)' },
            { color: C.nodeBlocked, label: 'Mule (blocked)' },
            { color: C.nodeCanary,  label: 'Honey trap' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              <span style={{ fontFamily: fontInter, fontSize: 10, color: C.textMuted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction flow table */}
      {clusterEdges.length > 0 && (
        <div style={{
          flexShrink: 0, maxHeight: 170, overflowY: 'auto',
          background: C.surface, borderTop: `1px solid ${C.outline}`,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr',
            padding: '6px 20px', background: C.surfaceLow,
            borderBottom: `1px solid ${C.outline}`, position: 'sticky', top: 0,
          }}>
            {['FROM', 'TO', 'AMOUNT', 'x TXN', 'FLOW TYPE'].map(h => (
              <div key={h} style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>{h}</div>
            ))}
          </div>
          {clusterEdges.map((edge, i) => {
            const isCtrlSrc  = edge.source === controller.id
            const isHoneyTgt = edge.target === honeyTrapId
            const isBlockTgt = muleStates[edge.target] === 'BLOCK'
            const flowColor  = isCtrlSrc ? C.nodeCtrl : isHoneyTgt ? C.nodeCanary : isBlockTgt ? C.nodeBlocked : C.primary
            const flowLabel  = isCtrlSrc ? 'CTRL->MULE' : isHoneyTgt ? 'MULE->HONEY' : 'MULE->MULE'
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr',
                padding: '5px 20px', borderBottom: `1px solid ${C.outline}22`,
                background: i % 2 ? C.surfaceLow + '44' : 'transparent',
              }}>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: isCtrlSrc ? C.nodeCtrl : C.textMuted }}>
                  {String(edge.source).slice(0, 18)}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: isHoneyTgt ? C.nodeCanary : isBlockTgt ? C.nodeBlocked : C.textMain }}>
                  {String(edge.target).slice(0, 18)}
                </div>
                <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 11, color: C.secondary }}>
                  {fmtAmt(edge.weight || 0)}
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMuted }}>x{edge.count || 1}</div>
                <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: flowColor, letterSpacing: '0.06em' }}>
                  {flowLabel}
                </div>
              </div>
            )
          })}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr',
            padding: '6px 20px', background: C.surfaceMid, borderTop: `1px solid ${C.outline}`,
          }}>
            <div style={{ fontFamily: fontGrotesk, fontSize: 9, color: C.textMuted, gridColumn: '1/3' }}>TOTAL FLOW</div>
            <div style={{ fontFamily: fontSora, fontWeight: 700, fontSize: 12, color: C.secondary }}>
              {fmtAmt(clusterEdges.reduce((s, e) => s + (e.weight || 0), 0))}
            </div>
            <div style={{ fontFamily: fontMono, fontSize: 10, color: C.textMuted }}>
              x{clusterEdges.reduce((s, e) => s + (e.count || 1), 0)}
            </div>
            <div />
          </div>
        </div>
      )}
    </div>
  )
}

