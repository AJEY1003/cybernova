// AppMain.jsx — Main component for MuleShield single-page app
import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { api } from './api'
import { useDeviceFingerprint } from './hooks/useDeviceFingerprint'

const C = {
  bg:'#13131b',bgDeep:'#0a0a12',surface:'#1b1b23',surfaceMid:'#1f1f27',
  surfaceHigh:'#292932',primary:'#ffb1c0',primaryCont:'#ff4c83',
  secondary:'#00e0b3',tertiary:'#e3c630',error:'#ffb4ab',errorCont:'#93000a',
  outline:'#5b3f44',textMain:'#e4e1ed',textMuted:'#e4bdc3',
  nodeCtrl:'#e3c630',nodeCanary:'#00e0b3',nodeBlocked:'#ff4c83',
  nodeActive:'#5b3f44',nodeHit:'#ffb1c0',edgeNormal:'#302840',edgeCanary:'#ff4c83',
}
const lbl = (x={}) => ({ fontFamily:'Space Grotesk,sans-serif',fontSize:10,
  color:'rgba(228,189,195,0.55)',letterSpacing:'0.15em',textTransform:'uppercase',
  display:'block',marginBottom:8,...x })

function computeLayout(nodes,edges,W,H){
  const pos={},N=nodes.length;if(!N)return pos
  nodes.forEach((n,i)=>{const a=(2*Math.PI*i)/N,r=Math.min(W,H)*0.30;pos[n.id]={x:W/2+r*Math.cos(a),y:H/2+r*Math.sin(a),vx:0,vy:0}})
  const k=Math.sqrt((W*H)/N)
  for(let it=0;it<80;it++){
    for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const a=pos[nodes[i].id],b=pos[nodes[j].id],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(Math.sqrt(dx*dx+dy*dy),1),f=(k*k)/d;a.vx-=(dx/d)*f;a.vy-=(dy/d)*f;b.vx+=(dx/d)*f;b.vy+=(dy/d)*f}
    edges.forEach(e=>{const a=pos[e.source],b=pos[e.target];if(!a||!b)return;const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(Math.sqrt(dx*dx+dy*dy),1),f=(d*d)/k*0.08;a.vx+=(dx/d)*f;a.vy+=(dy/d)*f;b.vx-=(dx/d)*f;b.vy-=(dy/d)*f})
    nodes.forEach(n=>{const p=pos[n.id];p.x=Math.max(40,Math.min(W-40,p.x+p.vx*0.5));p.y=Math.max(40,Math.min(H-40,p.y+p.vy*0.5));p.vx*=0.8;p.vy*=0.8})
  }
  return pos
}

function drawGraph(canvas,graphData,posRef,tick){
  if(!canvas||!graphData?.nodes?.length)return
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,pos=posRef.current
  ctx.clearRect(0,0,W,H);ctx.fillStyle=C.bgDeep;ctx.fillRect(0,0,W,H)
  ctx.fillStyle='rgba(48,40,64,0.25)'
  for(let x=0;x<W;x+=40)for(let y=0;y<H;y+=40){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill()}
  [[W*0.3,H*0.35,120,'rgba(255,76,131,0.06)'],[W*0.65,H*0.6,160,'rgba(0,224,179,0.05)']].forEach(([x,y,r,c])=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()})
  graphData.edges?.forEach(e=>{const a=pos[e.source],b=pos[e.target];if(!a||!b)return;const hot=e.is_canary_edge;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=hot?C.edgeCanary:C.edgeNormal;ctx.lineWidth=hot?2:0.8;if(hot){ctx.shadowColor=C.edgeCanary;ctx.shadowBlur=10;ctx.setLineDash([6,4]);ctx.lineDashOffset=-(tick%20)}ctx.stroke();ctx.shadowBlur=0;ctx.setLineDash([]);const ang=Math.atan2(b.y-a.y,b.x-a.x),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx-7*Math.cos(ang-0.4),my-7*Math.sin(ang-0.4));ctx.lineTo(mx-7*Math.cos(ang+0.4),my-7*Math.sin(ang+0.4));ctx.closePath();ctx.fillStyle=hot?C.edgeCanary:C.edgeNormal;ctx.fill()})
  graphData.nodes?.forEach(n=>{const p=pos[n.id];if(!p)return;const isCtrl=n.is_controller,isCanary=n.status==='CANARY',isBlocked=n.status==='BLOCKED',isHit=n.canary_hit,r=isCtrl?18:isCanary?14:9,color=isHit?C.nodeHit:isCtrl?C.nodeCtrl:isCanary?C.nodeCanary:isBlocked?C.nodeBlocked:C.nodeActive;ctx.shadowColor=color;ctx.shadowBlur=isHit?24:isCtrl?16:isCanary?12:6;if(isCanary){const pulse=(Math.sin(tick*0.05)+1)/2;ctx.beginPath();ctx.arc(p.x,p.y,r+8+pulse*8,0,Math.PI*2);ctx.strokeStyle=`rgba(0,224,179,${0.3-pulse*0.2})`;ctx.lineWidth=1.5;ctx.stroke()}if(isCtrl){ctx.beginPath();for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6;i===0?ctx.moveTo(p.x+r*Math.cos(a),p.y+r*Math.sin(a)):ctx.lineTo(p.x+r*Math.cos(a),p.y+r*Math.sin(a))}ctx.closePath();ctx.fillStyle=color+'22';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke()}else{ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=color+'22';ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=isHit?2.5:1.5;ctx.stroke()}ctx.beginPath();ctx.arc(p.x,p.y,r*0.4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=C.textMuted;ctx.font='9px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText(n.id?.length>14?n.id.slice(0,12)+'..':n.id,p.x,p.y+r+13)})
}

export default function AppMain() {
  const canvasRef=useRef(null),posRef=useRef({}),tickRef=useRef(0),rafRef=useRef(null)
  const fp = useDeviceFingerprint()
  const [graphData,setGraphData]=useState(null)
  const [agentStatus,setAgentStatus]=useState(null)
  const [stats,setStats]=useState(null)
  const [transactions,setTransactions]=useState([])
  const [alerts,setAlerts]=useState([])
  const [clusters,setClusters]=useState([])
  const [canaryResult,setCanaryResult]=useState(null)
  const [selectedNode,setSelectedNode]=useState(null)
  const [loading,setLoading]=useState(false)
  const [initDone,setInitDone]=useState(false)
  const [simUpi,setSimUpi]=useState('9800000001@paytm')
  const [simAmount,setSimAmount]=useState('9500')
  const [canaryFlash,setCanaryFlash]=useState(false)
  const [health,setHealth]=useState(null)
  const [activeSection,setActiveSection]=useState('graph') // graph|clusters|cybersec|device|alerts
  const [honeyHits,setHoneyHits]=useState([]) // live honey trap hits from payment app

  const animate=useCallback(()=>{tickRef.current++;drawGraph(canvasRef.current,graphData,posRef,tickRef.current);rafRef.current=requestAnimationFrame(animate)},[graphData])
  useEffect(()=>{rafRef.current=requestAnimationFrame(animate);return()=>cancelAnimationFrame(rafRef.current)},[animate])

  async function fetchAll(){
    try{
      const [gd,as,st,tx,al,cl,hl]=await Promise.all([
        axios.get('/api/graph-network/data').catch(()=>({data:{nodes:[],edges:[]}})),
        axios.get('/api/graph-network/agent-status').catch(()=>({data:{networks:[]}})),
        axios.get('/api/stats').catch(()=>({data:{}})),
        axios.get('/api/upi/transactions?upi=all&limit=8').catch(()=>({data:{transactions:[]}})),
        axios.get('/api/alerts?limit=20').catch(()=>({data:{alerts:[]}})),
        axios.get('/api/clusters').catch(()=>({data:{clusters:[]}})),
        axios.get('/api/health').catch(()=>({data:{}})),
      ])
      setGraphData(gd.data);setAgentStatus(as.data);setStats(st.data)
      setTransactions(tx.data.transactions||[]);setAlerts(al.data.alerts||[])
      setClusters(cl.data.clusters||[]);setHealth(hl.data)
      // Show all alerts that came from live transactions (have trigger_transaction with sender/receiver)
      const newHits = (al.data.alerts||[]).filter(a =>
        a.trigger_transaction?.sender_upi && a.trigger_transaction?.receiver_upi
      )
      setHoneyHits(newHits)
      const canvas=canvasRef.current
      if(canvas&&gd.data.nodes?.length){const pos=computeLayout(gd.data.nodes,gd.data.edges||[],canvas.width,canvas.height);posRef.current=pos}
      if(gd.data.nodes?.some(n=>n.canary_hit)){setCanaryFlash(true);setTimeout(()=>setCanaryFlash(false),3000)}
    }catch(e){console.error(e)}
  }

  async function initPipeline(){
    setLoading(true)
    try{await axios.post('/api/graph-network/init');await axios.post('/api/graph-network/block?n_networks=2');await fetchAll();setInitDone(true)}
    catch(e){console.error(e)}finally{setLoading(false)}
  }

  async function triggerCanary(){
    setLoading(true)
    try{
      const canary=agentStatus?.networks?.[0]?.canary||''
      const r=await axios.post('/api/graph-network/canary-check',{sender_upi:simUpi,receiver_upi:canary,sender_ip:'49.36.100.50',amount:parseFloat(simAmount),isp:'Jio Mobile',device_type:'mobile',is_proxy:false,device_fingerprint:fp?.device_fingerprint||'',ja3_hash:fp?.ja3_hash||''})
      setCanaryResult(r.data);await fetchAll()
    }catch(e){console.error(e)}finally{setLoading(false)}
  }

  function handleCanvasClick(e){
    if(!graphData?.nodes)return
    const canvas=canvasRef.current,rect=canvas.getBoundingClientRect()
    const mx=(e.clientX-rect.left)*(canvas.width/rect.width),my=(e.clientY-rect.top)*(canvas.height/rect.height)
    for(const n of graphData.nodes){const p=posRef.current[n.id];if(!p)continue;const r=n.is_controller?18:n.status==='CANARY'?14:9;if(Math.sqrt((mx-p.x)**2+(my-p.y)**2)<r+6){setSelectedNode(n);return}}
    setSelectedNode(null)
  }

  useEffect(()=>{fetchAll();const iv=setInterval(fetchAll,3000);return()=>clearInterval(iv)},[])

  const controllers=agentStatus?.networks||[]
  const agentLog=agentStatus?.agent_log||[]
  const gStats={nodes:graphData?.nodes?.length||0,mule:graphData?.nodes?.filter(n=>n.is_high_risk)?.length||0,blocked:graphData?.nodes?.filter(n=>n.status==='BLOCKED')?.length||0,canary:graphData?.nodes?.filter(n=>n.status==='CANARY')?.length||0}

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:C.bg,fontFamily:'Inter,sans-serif',color:C.textMain,backgroundImage:'radial-gradient(rgba(48,40,64,0.3) 1px,transparent 1px)',backgroundSize:'40px 40px'}}>

      {/* ── LEFT PANEL ── */}
      <aside style={{width:280,display:'flex',flexDirection:'column',flexShrink:0,borderRight:`1px solid rgba(91,63,68,0.15)`,background:'rgba(19,19,27,0.85)',backdropFilter:'blur(12px)',zIndex:40}}>
        <div style={{padding:'20px 16px 10px'}}>
          <h1 style={{fontFamily:'Sora,sans-serif',fontSize:26,fontWeight:800,color:C.primary,textShadow:`0 0 15px rgba(255,177,192,0.4)`,letterSpacing:'-0.02em',margin:0}}>MULESHIELD</h1>
          <p style={{...lbl(),marginBottom:0,marginTop:4}}>PROTOCOL V4.2 ACTIVE</p>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'0 12px 12px'}}>
          {/* Stats */}
          <div style={{marginBottom:16}}>
            <p style={lbl()}>NETWORK STATUS</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[{l:'NODES',v:gStats.nodes,c:C.secondary},{l:'MULE',v:gStats.mule,c:C.primary,g:true},{l:'BLOCKED',v:gStats.blocked,c:C.error},{l:'CANARY',v:gStats.canary,c:C.secondary}].map(s=>(
                <div key={s.l} style={{background:C.surface,padding:'8px 10px',border:s.g?`1px solid rgba(255,76,131,0.3)`:`1px solid rgba(91,63,68,0.15)`,boxShadow:s.g?'0 0 10px rgba(255,45,120,0.2)':'none'}}>
                  <span style={lbl({marginBottom:2})}>{s.l}</span>
                  <span style={{fontFamily:'Sora,sans-serif',fontSize:20,fontWeight:700,color:s.c}}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Extra stats from API */}
          {stats && (
            <div style={{marginBottom:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[{l:'TRANSACTIONS',v:stats.total_transactions,c:C.secondary},{l:'ALERTS',v:stats.total_alerts,c:C.primary},{l:'CLUSTERS',v:stats.total_clusters,c:C.tertiary},{l:'HIGH CONF',v:stats.high_confidence_alerts,c:C.error}].map(s=>(
                <div key={s.l} style={{background:C.surface,padding:'6px 10px',border:`1px solid rgba(91,63,68,0.1)`}}>
                  <span style={lbl({marginBottom:2,fontSize:9})}>{s.l}</span>
                  <span style={{fontFamily:'Sora,sans-serif',fontSize:16,fontWeight:700,color:s.c}}>{s.v??'—'}</span>
                </div>
              ))}
            </div>
          )}
          {/* Controllers */}
          <div style={{marginBottom:16}}>
            <p style={lbl()}>DETECTED CONTROLLERS</p>
            {controllers.length===0?(
              <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'rgba(228,189,195,0.3)'}}>Run GraphSAGE to detect</p>
            ):controllers.map((net,i)=>(
              <div key={net.cluster_id} style={{background:i===0?'rgba(255,177,192,0.05)':C.surface,borderLeft:i===0?`4px solid ${C.primary}`:`1px solid rgba(91,63,68,0.15)`,padding:'10px 12px',marginBottom:6,boxShadow:i===0?`0 0 12px rgba(255,45,120,0.1)`:'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <h4 style={{fontFamily:'Inter,sans-serif',fontWeight:700,color:i===0?C.primary:C.textMain,margin:0,fontSize:13}}>{net.controller_name}</h4>
                    <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:'rgba(228,189,195,0.5)'}}>RISK: {(net.risk_score*100).toFixed(0)}%</span>
                  </div>
                  <div style={{width:8,height:8,borderRadius:'50%',background:net.canary_hit?C.primary:C.tertiary,boxShadow:`0 0 8px ${net.canary_hit?C.primary:C.tertiary}`}}/>
                </div>
                <div style={{marginTop:4,fontFamily:'JetBrains Mono,monospace',fontSize:10,color:C.textMuted}}>
                  {net.blocked_count} blocked · canary: {net.canary?.slice(0,10)}...
                </div>
                {net.canary_hit&&<div style={{marginTop:6,background:'rgba(255,76,131,0.15)',border:`1px solid rgba(255,76,131,0.4)`,padding:'3px 8px',fontSize:10,fontFamily:'Space Grotesk',letterSpacing:'0.1em',color:C.primary}}>🚨 CANARY HIT</div>}
              </div>
            ))}
          </div>
          {/* Clusters from DBSCAN */}
          {clusters.length>0&&(
            <div style={{marginBottom:16}}>
              <p style={lbl()}>DBSCAN CLUSTERS</p>
              {clusters.map(c=>(
                <div key={c.cluster_id} style={{background:C.surface,border:`1px solid rgba(91,63,68,0.15)`,padding:'8px 12px',marginBottom:6}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:700,color:C.textMain}}>{c.controller_name}</span>
                    <span style={{fontFamily:'Sora,sans-serif',fontSize:12,fontWeight:700,color:C.secondary}}>{(c.confidence_score*100).toFixed(0)}%</span>
                  </div>
                  <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:C.textMuted,marginTop:2}}>
                    {c.account_count} accounts · 🍯 {c.honey_trap_account?.slice(0,12)}...
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Agent Actions */}
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
            <button onClick={initPipeline} disabled={loading} style={{padding:'10px',border:`1px solid ${C.primary}`,background:loading?'transparent':'rgba(255,177,192,0.1)',color:C.primary,fontFamily:'Space Grotesk,sans-serif',fontSize:11,letterSpacing:'0.15em',cursor:'pointer',boxShadow:loading?'none':`0 0 15px rgba(255,45,120,0.3)`,opacity:loading?0.6:1}}>
              {loading?'INITIALIZING...':'▶ RUN GRAPHSAGE'}
            </button>
            <button onClick={()=>axios.post('/api/graph-network/block?n_networks=2').then(fetchAll)} style={{padding:'10px',border:`1px solid ${C.secondary}`,background:'transparent',color:C.secondary,fontFamily:'Space Grotesk,sans-serif',fontSize:11,letterSpacing:'0.15em',cursor:'pointer'}}>
              🔒 BLOCK TOP 2 NETWORKS
            </button>
            <button onClick={()=>axios.post('/api/upi/reset').then(fetchAll)} style={{padding:'8px',border:`1px solid rgba(91,63,68,0.3)`,background:'transparent',color:'rgba(228,189,195,0.4)',fontFamily:'Space Grotesk,sans-serif',fontSize:10,letterSpacing:'0.1em',cursor:'pointer'}}>
              ↺ RESET LEDGER
            </button>
          </div>
        </div>
        {/* Canary Simulation */}
        <div style={{padding:'12px 16px',borderTop:`1px solid rgba(91,63,68,0.15)`,background:'rgba(13,13,22,0.8)'}}>
          <p style={lbl({marginBottom:6})}>CANARY SIMULATION</p>
          <div style={{display:'flex',gap:6,marginBottom:6}}>
            <input value={simUpi} onChange={e=>setSimUpi(e.target.value)} placeholder="UPI_TARGET_0X..." style={{flex:1,background:C.bgDeep,border:'none',borderBottom:`1px solid rgba(91,63,68,0.4)`,color:C.secondary,fontFamily:'JetBrains Mono,monospace',fontSize:11,padding:'4px 6px',outline:'none'}}/>
            <input value={simAmount} onChange={e=>setSimAmount(e.target.value)} style={{width:60,background:C.bgDeep,border:'none',borderBottom:`1px solid rgba(91,63,68,0.4)`,color:C.textMain,fontFamily:'JetBrains Mono,monospace',fontSize:11,padding:'4px 6px',outline:'none'}}/>
          </div>
          <button onClick={triggerCanary} disabled={loading} style={{width:'100%',padding:'6px',background:C.secondary,color:'#002118',fontFamily:'Space Grotesk,sans-serif',fontSize:10,letterSpacing:'0.1em',border:'none',cursor:'pointer',fontWeight:700,opacity:loading?0.6:1}}>
            TRIGGER CANARY
          </button>
        </div>
      </aside>

      {/* ── CENTER PANEL ── */}
      <main style={{flex:1,position:'relative',overflow:'hidden',background:C.bgDeep}}>
        {/* Top bar */}
        <header style={{position:'absolute',top:0,left:0,right:0,height:48,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',background:'rgba(19,19,27,0.7)',backdropFilter:'blur(12px)',borderBottom:`1px solid rgba(91,63,68,0.15)`,zIndex:10}}>
          <div style={{display:'flex',alignItems:'center',gap:20}}>
            <span style={{fontFamily:'Space Grotesk,sans-serif',fontSize:12,color:C.primary,letterSpacing:'0.15em'}}>MULESHIELD AML</span>
            {['GLOBAL VIEW','CRITICAL NODES','INTELLIGENCE'].map((t,i)=>(
              <a key={t} href="#" style={{fontFamily:'Space Grotesk,sans-serif',fontSize:10,color:i===0?C.secondary:'rgba(228,189,195,0.4)',borderBottom:i===0?`1px solid ${C.secondary}`:'none',paddingBottom:2,textDecoration:'none',letterSpacing:'0.1em'}}>{t}</a>
            ))}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:health?.api==='ok'?C.secondary:C.error,boxShadow:`0 0 6px ${health?.api==='ok'?C.secondary:C.error}`}}/>
              <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:'rgba(228,189,195,0.5)'}}>
                {health?.api==='ok'?'ONLINE':'OFFLINE'} · {health?.transaction_count||0} TXN
              </span>
            </div>
            <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:'rgba(228,189,195,0.4)'}}>OFFICER_429</span>
          </div>
        </header>

        {/* Canvas */}
        <canvas ref={canvasRef} width={900} height={600} onClick={handleCanvasClick}
          style={{position:'absolute',top:48,left:0,width:'100%',height:'calc(100% - 48px)',cursor:'crosshair'}}/>

        {/* Canary flash */}
        {canaryFlash&&<div style={{position:'absolute',inset:0,pointerEvents:'none',border:`3px solid ${C.primary}`,boxShadow:`inset 0 0 60px rgba(255,45,120,0.3)`,zIndex:20}}/>}

        {/* Legend */}
        <div style={{position:'absolute',top:60,right:12,background:'rgba(19,19,27,0.9)',backdropFilter:'blur(12px)',border:`1px solid rgba(91,63,68,0.2)`,padding:'12px 14px',zIndex:10}}>
          <p style={lbl()}>LEGEND</p>
          {[{c:C.nodeCtrl,l:'Controller'},{c:C.nodeCanary,l:'Canary'},{c:C.nodeHit,l:'Active Hit'},{c:C.nodeBlocked,l:'Blocked'}].map(x=>(
            <div key={x.l} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
              <div style={{width:10,height:10,background:x.c,borderRadius:2,boxShadow:`0 0 6px ${x.c}`}}/>
              <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:C.textMuted}}>{x.l}</span>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{position:'absolute',top:60,left:12,display:'flex',flexDirection:'column',gap:6,zIndex:10}}>
          {['＋','－','↺','⊟'].map(icon=>(
            <button key={icon} style={{width:34,height:34,background:C.surfaceMid,border:`1px solid rgba(91,63,68,0.2)`,color:C.textMuted,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>{icon}</button>
          ))}
        </div>

        {/* Node detail */}
        {selectedNode&&(
          <div style={{position:'absolute',top:60,left:'50%',transform:'translateX(-50%)',background:'rgba(19,19,27,0.97)',border:`1px solid rgba(255,177,192,0.2)`,padding:16,width:260,zIndex:20}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
              <div>
                <p style={lbl({color:selectedNode.canary_hit?C.primary:C.secondary})}>{selectedNode.status||'ACTIVE'}</p>
                <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:C.textMain,wordBreak:'break-all',margin:0}}>{selectedNode.id}</p>
              </div>
              <button onClick={()=>setSelectedNode(null)} style={{background:'none',border:'none',color:C.textMuted,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:C.textMuted}}>MULE PROBABILITY</span>
                <span style={{fontFamily:'Sora,sans-serif',fontSize:12,fontWeight:700,color:C.primary}}>{((selectedNode.mule_probability||0)*100).toFixed(1)}%</span>
              </div>
              <div style={{background:C.surface,height:4,borderRadius:2}}>
                <div style={{width:`${(selectedNode.mule_probability||0)*100}%`,background:C.primary,height:4,borderRadius:2}}/>
              </div>
            </div>
            {selectedNode.canary_hit&&<div style={{background:'rgba(255,76,131,0.1)',border:`1px solid rgba(255,76,131,0.3)`,padding:'6px 10px',fontSize:10,fontFamily:'Space Grotesk',letterSpacing:'0.1em',color:C.primary}}>🚨 CONTROLLER DETECTED</div>}
            {selectedNode.is_controller&&<div style={{background:'rgba(227,198,48,0.1)',border:`1px solid rgba(227,198,48,0.3)`,padding:'6px 10px',fontSize:10,fontFamily:'Space Grotesk',letterSpacing:'0.1em',color:C.tertiary}}>⚡ CONTROLLER NODE</div>}
          </div>
        )}

        {!initDone&&!loading&&(
          <div style={{position:'absolute',inset:0,top:48,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
            <p style={{color:'rgba(228,189,195,0.3)',fontSize:14,fontFamily:'Inter',textAlign:'center'}}>Click RUN GRAPHSAGE to analyze the mule network</p>
          </div>
        )}
      </main>

      {/* ── RIGHT PANEL ── */}
      <aside style={{width:320,display:'flex',flexDirection:'column',flexShrink:0,borderLeft:`1px solid rgba(91,63,68,0.2)`,background:'rgba(19,19,27,0.85)',backdropFilter:'blur(12px)',zIndex:40}}>
        <div style={{padding:'0 16px',height:48,display:'flex',alignItems:'center',borderBottom:`1px solid rgba(91,63,68,0.15)`,background:'rgba(41,41,50,0.3)'}}>
          <h2 style={{fontFamily:'Space Grotesk,sans-serif',fontSize:11,color:C.secondary,letterSpacing:'0.15em',margin:0}}>📡 LIVE INTELLIGENCE FEED</h2>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:12}}>
          {/* Canary Alert */}
          {(canaryResult?.canary_hit||controllers.some(n=>n.canary_hit))&&(
            <div style={{background:'rgba(255,177,192,0.08)',border:`1px solid ${C.primary}`,padding:14,marginBottom:14,boxShadow:`0 0 20px rgba(255,45,120,0.15)`,position:'relative'}}>
              <div style={{position:'absolute',top:8,right:8,width:8,height:8,borderRadius:'50%',background:C.primary,boxShadow:`0 0 8px ${C.primary}`}}/>
              <p style={lbl()}>CANARY HIT DETECTED</p>
              <h4 style={{fontFamily:'Sora,sans-serif',fontSize:16,fontWeight:700,color:C.textMain,margin:'4px 0 10px'}}>
                {canaryResult?.controller_name||controllers.find(n=>n.canary_hit)?.controller_name||'Controller Activity'}
              </h4>
              {canaryResult?.controller&&(
                <div style={{marginBottom:10}}>
                  {[['UPI HANDLE',canaryResult.controller.upi_handle],['IP ADDRESS',canaryResult.controller.ip_address],['LOCATION',`${canaryResult.controller.location?.city}, ${canaryResult.controller.location?.state}`]].map(([k,v])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:3,fontFamily:'JetBrains Mono,monospace',fontSize:10}}>
                      <span style={{color:C.textMuted}}>{k}</span><span style={{color:C.textMain}}>{v||'—'}</span>
                    </div>
                  ))}
                  <div style={{marginTop:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontFamily:'JetBrains Mono,monospace',fontSize:10,marginBottom:3}}>
                      <span style={{color:C.textMuted}}>CONFIDENCE</span>
                      <span style={{color:C.primary,fontWeight:700}}>{((canaryResult.risk_assessment?.composite_score||0)*100).toFixed(1)}%</span>
                    </div>
                    <div style={{background:C.surface,height:3,borderRadius:2}}>
                      <div style={{width:`${(canaryResult.risk_assessment?.composite_score||0)*100}%`,background:C.primary,height:3,borderRadius:2}}/>
                    </div>
                  </div>
                  {/* Signal breakdown */}
                  {canaryResult.risk_assessment?.signal_breakdown&&(
                    <div style={{marginTop:10}}>
                      {Object.entries(canaryResult.risk_assessment.signal_breakdown).slice(0,5).map(([k,v])=>(
                        <div key={k} style={{marginBottom:5}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontFamily:'JetBrains Mono,monospace',fontSize:9,marginBottom:2}}>
                            <span style={{color:C.textMuted}}>{k.replace(/_/g,' ').toUpperCase()}</span>
                            <span style={{color:C.secondary}}>{((v.value||0)*100).toFixed(0)}%</span>
                          </div>
                          <div style={{background:C.surface,height:2,borderRadius:1}}>
                            <div style={{width:`${(v.value||0)*100}%`,background:C.secondary,height:2,borderRadius:1}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button style={{width:'100%',padding:'8px',background:C.errorCont,color:'#ffdad6',fontFamily:'Space Grotesk,sans-serif',fontSize:11,letterSpacing:'0.15em',border:'none',cursor:'pointer',fontWeight:700}}>FLAG FOR LEA</button>
            </div>
          )}

          {/* 🎯 Honey Trap Hits — live controller intelligence */}
          {honeyHits.length > 0 && (
            <div style={{marginBottom:14}}>
              <p style={lbl({color:C.nodeCanary})}>🎯 HONEY TRAP HITS — CONTROLLER CAPTURED</p>
              {honeyHits.slice(0,3).map((a,i) => {
                const ctrl = a.controller || {}
                const sig = a.evidence?.signal_breakdown || {}
                const txn = a.trigger_transaction || {}
                const isNew = i === 0
                return (
                  <div key={a.alert_id||i} style={{
                    background: isNew ? 'rgba(0,224,179,0.06)' : 'rgba(0,224,179,0.03)',
                    border: `1px solid ${isNew ? C.nodeCanary : 'rgba(0,224,179,0.2)'}`,
                    padding:12, marginBottom:8,
                    boxShadow: isNew ? `0 0 16px rgba(0,224,179,0.12)` : 'none',
                  }}>
                    {/* Header */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <div>
                        <div style={{fontFamily:'Space Grotesk,sans-serif',fontSize:10,color:C.nodeCanary,letterSpacing:'0.12em',marginBottom:2}}>
                          {isNew ? '🔴 LIVE' : '●'} CONTROLLER IDENTIFIED
                        </div>
                        <div style={{fontFamily:'Sora,sans-serif',fontWeight:700,fontSize:13,color:C.textMain}}>
                          {a.matched_cluster?.controller_name || '—'}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:'Sora,sans-serif',fontWeight:700,fontSize:16,color:C.nodeCanary}}>
                          {((a.confidence||0)*100).toFixed(0)}%
                        </div>
                        <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:C.textMuted}}>
                          {a.alert_timestamp?.slice(11,19)}
                        </div>
                      </div>
                    </div>

                    {/* Transaction */}
                    <div style={{background:'rgba(0,0,0,0.3)',borderRadius:4,padding:'6px 8px',marginBottom:8,fontFamily:'JetBrains Mono,monospace',fontSize:10}}>
                      <div style={{color:C.textMuted,marginBottom:2}}>TRANSACTION</div>
                      <div style={{color:C.textMain}}>{txn.sender_upi||ctrl.upi_handle||'—'}</div>
                      <div style={{color:C.outline,margin:'1px 0'}}>↓ ₹{(txn.amount||0).toLocaleString('en-IN')}</div>
                      <div style={{color:C.nodeCanary}}>🍯 {a.mule_network?.honey_trap_account || txn.receiver_upi || '—'}</div>
                      <div style={{color:C.textMuted,marginTop:2,fontSize:9}}>{txn.timestamp?.slice(0,19) || a.alert_timestamp?.slice(0,19)}</div>
                    </div>

                    {/* Hardware / Device fingerprint */}
                    <div style={{marginBottom:8}}>
                      <div style={{fontFamily:'Space Grotesk,sans-serif',fontSize:9,color:C.textMuted,letterSpacing:'0.1em',marginBottom:4}}>DEVICE FINGERPRINT</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                        {[
                          ['FP HASH',  ctrl.device_fingerprint?.slice(0,14)+'…'],
                          ['JA3',      ctrl.ja3_hash?.slice(0,12)+'…'],
                          ['IP',       ctrl.ip_address || '—'],
                          ['ISP',      ctrl.isp || '—'],
                          ['PROXY',    ctrl.proxy_used ? '⚠ YES' : 'No'],
                          ['EMULATOR', (ctrl.emulator_used || ctrl.emulator_flags?.length >= 2) ? '⚠ YES' : 'No'],
                          ['WEBGL',    ctrl.webgl_renderer?.slice(0,22) || '—'],
                          ['SCREEN',   ctrl.screen_resolution || '—'],
                          ['CPU',      ctrl.cpu_cores ? `${ctrl.cpu_cores} cores` : '—'],
                          ['BATTERY',  ctrl.battery_level != null ? `${(ctrl.battery_level*100).toFixed(0)}%${ctrl.battery_charging?' ⚡':''}` : '—'],
                        ].map(([k,v]) => (
                          <div key={k} style={{background:'rgba(0,0,0,0.25)',padding:'3px 6px',borderRadius:3}}>
                            <div style={{fontFamily:'Space Grotesk,sans-serif',fontSize:8,color:C.textMuted,letterSpacing:'0.08em'}}>{k}</div>
                            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:C.nodeCanary,wordBreak:'break-all'}}>{v||'—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Emulator flags */}
                    {ctrl.emulator_flags?.length > 0 && (
                      <div style={{marginBottom:8,display:'flex',flexWrap:'wrap',gap:4}}>
                        {ctrl.emulator_flags.map(f => (
                          <span key={f} style={{fontFamily:'JetBrains Mono,monospace',fontSize:8,color:C.error,background:'rgba(255,180,171,0.1)',border:`1px solid rgba(255,180,171,0.3)`,padding:'1px 5px',borderRadius:3}}>{f}</span>
                        ))}
                      </div>
                    )}

                    {/* Signal bars */}
                    {Object.keys(sig).length > 0 && (
                      <div style={{marginBottom:8}}>
                        <div style={{fontFamily:'Space Grotesk,sans-serif',fontSize:9,color:C.textMuted,letterSpacing:'0.1em',marginBottom:4}}>SIGNAL BREAKDOWN</div>
                        {Object.entries(sig).slice(0,5).map(([k,v]) => {
                          const score = typeof v === 'object' ? (v?.value ?? 0) : (v ?? 0)
                          const pct = score * 100
                          const col = pct>70?C.primaryCont:pct>40?C.tertiary:C.secondary
                          return (
                            <div key={k} style={{marginBottom:3}}>
                              <div style={{display:'flex',justifyContent:'space-between',fontFamily:'JetBrains Mono,monospace',fontSize:9,marginBottom:1}}>
                                <span style={{color:C.textMuted}}>{k.replace(/_/g,' ')}</span>
                                <span style={{color:col}}>{pct.toFixed(0)}%</span>
                              </div>
                              <div style={{background:C.surface,height:2,borderRadius:1}}>
                                <div style={{width:`${pct}%`,background:col,height:2,borderRadius:1,transition:'width 0.5s'}}/>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* LEA ref */}
                    <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:C.textMuted,borderTop:`1px solid rgba(91,63,68,0.2)`,paddingTop:6,marginTop:4}}>
                      LEA: {a.lea_reference || '—'} · {a.matched_cluster?.cluster_id}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Transaction Stream */}
          <div style={{marginBottom:14}}>
            <p style={lbl()}>TRANSACTION STREAM</p>
            {transactions.length===0?(
              <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'rgba(228,189,195,0.3)'}}>No transactions yet</p>
            ):transactions.slice(0,8).map((t,i)=>{
              const v=t.verdict||'CLEAN',isHit=v==='CONTROLLER_IDENTIFIED',isBlocked=v==='BLOCKED_ACCOUNT_HIT'
              const bc=isHit?C.primary:isBlocked?C.error:C.outline
              return(
                <div key={i} style={{background:isHit?'rgba(255,177,192,0.05)':isBlocked?'rgba(255,180,171,0.05)':C.surface,borderLeft:`2px solid ${bc}`,padding:'7px 10px',marginBottom:5,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontFamily:'JetBrains Mono,monospace'}}>
                    <div style={{fontSize:10,color:bc}}>{t.transaction_id?.slice(-10)||`TX_${i}`}_{v.slice(0,6)}</div>
                    <div style={{fontSize:9,color:'rgba(228,189,195,0.4)',marginTop:1}}>{t.sender_upi?.slice(0,10)}.. → {t.receiver_upi?.slice(0,10)}..</div>
                  </div>
                  <span style={{fontFamily:'Sora,sans-serif',fontWeight:700,fontSize:11,color:bc}}>₹{t.amount?.toLocaleString('en-IN')}</span>
                </div>
              )
            })}
          </div>

          {/* Alerts */}
          {alerts.length>0&&(
            <div style={{marginBottom:14}}>
              <p style={lbl()}>RECENT ALERTS</p>
              {alerts.slice(0,3).map((a,i)=>(
                <div key={i} style={{background:'rgba(255,177,192,0.05)',border:`1px solid rgba(255,177,192,0.15)`,padding:'8px 10px',marginBottom:6}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontFamily:'Space Grotesk,sans-serif',fontSize:10,color:C.primary,letterSpacing:'0.1em'}}>{a.alert_type}</span>
                    <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:'rgba(228,189,195,0.4)'}}>{a.alert_timestamp?.slice(11,16)}</span>
                  </div>
                  <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:10,color:C.textMuted}}>
                    {(a.confidence*100).toFixed(0)}% · {a.matched_cluster?.cluster_id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Log Terminal */}
        <div style={{height:180,background:'rgba(0,0,0,0.5)',borderTop:`1px solid rgba(91,63,68,0.15)`,padding:12,display:'flex',flexDirection:'column'}}>
          <p style={lbl({marginBottom:6})}>AGENT_LOG@MULESHIELD_V4</p>
          <div style={{flex:1,overflowY:'auto',fontFamily:'JetBrains Mono,monospace',fontSize:11,color:C.secondary,lineHeight:1.6}}>
            {agentLog.length===0?(
              <><p style={{color:'rgba(0,224,179,0.6)'}}>&gt; Booting graph traversal engine...</p><p style={{color:'rgba(0,224,179,0.4)'}}>&gt; Awaiting initialization...</p><p>&gt; _</p></>
            ):agentLog.map((log,i)=>(
              <p key={i} style={{color:log.action?.includes('CANARY')?C.primary:log.action?.includes('BLOCKED')?C.error:C.secondary,margin:0}}>
                &gt; {log.action}: {JSON.stringify(log).slice(0,55)}...
              </p>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
