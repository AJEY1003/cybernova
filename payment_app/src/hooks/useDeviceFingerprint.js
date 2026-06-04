/**
 * Collects real device signals from the browser.
 * Canvas hash, WebGL renderer, battery, screen, JA3-style hash.
 */
import { useState, useEffect } from 'react'

function getCanvasHash() {
  try {
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('AUREUS🔐', 2, 15)
    return c.toDataURL().slice(-40)
  } catch { return 'blocked' }
}

function getWebGL() {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl')
    if (!gl) return { vendor: 'unknown', renderer: 'unknown' }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'unknown',
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
    }
  } catch { return { vendor: 'unknown', renderer: 'unknown' } }
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return Math.abs(h).toString(16).padStart(16, '0')
}

export function useDeviceFingerprint() {
  const [fp, setFp] = useState(null)

  useEffect(() => {
    async function collect() {
      const ua = navigator.userAgent
      const screen = { w: window.screen.width, h: window.screen.height, depth: window.screen.colorDepth }
      const hw = { cores: navigator.hardwareConcurrency || 0, memory: navigator.deviceMemory || null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: navigator.language }
      const canvas = getCanvasHash()
      const webgl = getWebGL()

      let battery = null
      try {
        const b = await navigator.getBattery()
        battery = { level: b.level, charging: b.charging }
      } catch { battery = null }

      const deviceFp = hashStr(`${canvas}|${webgl.renderer}|${screen.w}x${screen.h}|${hw.cores}|${hw.tz}`)
      const ja3 = hashStr(`${ua}|${screen.w}x${screen.h}|${webgl.renderer}|${hw.lang}`).slice(0, 16)

      // Emulator detection
      const emulatorFlags = []
      if (battery?.level === 1 && battery?.charging) emulatorFlags.push('BATTERY_ALWAYS_FULL')
      if ((webgl.renderer || '').toLowerCase().includes('swiftshader')) emulatorFlags.push('SOFTWARE_RENDERER')
      if (hw.cores <= 2) emulatorFlags.push('LOW_CPU_CORES')
      if (hw.memory && hw.memory <= 0.5) emulatorFlags.push('LOW_MEMORY')

      setFp({
        device_fingerprint: deviceFp,
        ja3_hash: ja3,
        webgl_renderer: webgl.renderer,
        screen_resolution: `${screen.w}x${screen.h}`,
        cpu_cores: hw.cores,
        battery_level: battery?.level ?? null,
        battery_charging: battery?.charging ?? null,
        timezone: hw.tz,
        language: hw.lang,
        user_agent: ua,
        emulator_flags: emulatorFlags,
        is_emulator: emulatorFlags.length >= 2,
      })
    }
    collect()
  }, [])

  return fp
}
