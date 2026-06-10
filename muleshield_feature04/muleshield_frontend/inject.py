import sys
path = r'd:\Mule\cybernova_old\muleshield_feature04\muleshield_frontend\src\components\NetworkGraph.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''        {/* Canvas + detail panel */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {/* Legend */}'''

replacement = '''        {/* Canvas + detail panel */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* Node Overlays for Forensic AI Verification */}
          {fullChain.map((node, i) => {
            const isCtrl = node.is_controller;
            const isHoney = node.id === honeyTrapId && !isCtrl;
            const isBlocked = muleStates[node.id] === 'BLOCK';
            if (isHoney || isBlocked) return null;

            const n = fullChain.length;
            const pad = 350;
            const left = n === 1 ? '50%' : `calc(${pad}px + ${i} * (100% - ${pad * 2}px) / ${n - 1})`;
            const color = isCtrl ? C.nodeCtrl : C.secondary;
            const nodeResult = verifyResult?.[node.id];

            return (
              <div key={node.id + '-' + i} style={{ position: 'absolute', left, top: '42%', transform: 'translate(-50%, 65px)', zIndex: 10, width: 140 }}>
                {!nodeResult ? (
                  <button 
                    onClick={() => triggerVerification(node.id)}
                    disabled={verifyLoading}
                    style={{
                      background: color, color: '#13131b', fontWeight: 'bold', padding: '6px 12px',
                      border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, width: '100%',
                      opacity: verifyLoading ? 0.7 : 1, boxShadow: `0 0 10px ${color}55`, transition: 'opacity 0.2s'
                    }}
                  >
                    {verifyLoading ? 'CALLING...' : 'VERIFY SENDER'}
                  </button>
                ) : (
                  <div style={{ background: 'rgba(10,10,18,0.95)', border: `1px solid ${color}66`, padding: '10px 12px', borderRadius: 6, textAlign: 'left', boxShadow: `0 4px 16px rgba(0,0,0,0.8), 0 0 12px ${color}22` }}>
                    <div style={{ color: C.textMuted, fontSize: 8, marginBottom: 2 }}>MULE PROBABILITY</div>
                    <div style={{ color: C.primaryCont, fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>{(nodeResult.mule_prob * 100).toFixed(1)}%</div>
                    <div style={{ color: C.textMuted, fontSize: 8, marginBottom: 2 }}>TRANSCRIPT SNIPPET</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: '#e4e1ed', fontStyle: 'italic', lineHeight: 1.3 }}>
                      "{nodeResult.transcript.slice(0, 35)}..."
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Legend */}'''

if target in text:
    text = text.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('SUCCESS')
else:
    print('TARGET NOT FOUND')
