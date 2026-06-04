/**
 * useDeviceFingerprint.js
 * Collects real device signals from the browser:
 * - Canvas fingerprint (GPU-level unique)
 * - WebGL renderer (exact GPU model)
 * - Screen + hardware info
 * - Battery level (emulator detection)
 * - JA3-style session hash from browser metadata
 * - Emulator detection heuristics
 */

import { useState, useEffect } from 'react'

function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('MuleShield🔍', 2, 15)
    ctx.fillStyle = 'rgba(102,204,0,0.7)'
    ctx.fillText('MuleShield🔍', 4, 17)
    return canvas.toDataURL().slice(-50) // last 50 chars = unique hash portion
  } catch {
    return 'canvas_blocked'
  }
}

function getWebGLInfo() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return { vendor: 'unknown', renderer: 'unknown' }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    }
  } catch {
    return { vendor: 'unknown', renderer: 'unknown' }
  }
}

function getJA3Hash(webgl, screen, ua) {
  // Simulate JA3-style fingerprint from stable browser attributes
  const raw = `${ua}|${screen.width}x${screen.height}|${webgl.renderer}|${navigator.language}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

function detectEmulator(battery, webgl, hw) {
  const flags = []

  // Battery always 100% + charging = emulator
  if (battery && battery.level === 1 && battery.charging) {
    flags.push('BATTERY_ALWAYS_FULL')
  }

  // Known software renderers used by emulators
  const renderer = (webgl.renderer || '').toLowerCase()
  if (renderer.includes('swiftshader') || renderer.includes('llvmpipe') || renderer.includes('softpipe')) {
    flags.push('SOFTWARE_RENDERER_DETECTED')
  }

  // Very low hardware concurrency = emulator
  if (hw.cores <= 2) flags.push('LOW_CPU_CORES')

  // Very low memory = emulator
  if (hw.memory && hw.memory <= 0.5) flags.push('LOW_DEVICE_MEMORY')

  // No touch support on "mobile" = emulator
  if (!('ontouchstart' in window) && /android|mobile/i.test(navigator.userAgent)) {
    flags.push('NO_TOUCH_ON_MOBILE_UA')
  }

  return {
    is_emulator: flags.length >= 2,
    emulator_flags: flags,
    emulator_risk_score: Math.min(1.0, flags.length * 0.3),
  }
}

export function useDeviceFingerprint() {
  const [fingerprint, setFingerprint] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function collect() {
      const ua = navigator.userAgent
      const screen = {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio || 1,
      }
      const hw = {
        cores: navigator.hardwareConcurrency || 0,
        memory: navigator.deviceMemory || null,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages?.join(',') || '',
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }

      const canvasHash = getCanvasFingerprint()
      const webgl = getWebGLInfo()
      const ja3Hash = getJA3Hash(webgl, screen, ua)

      // Battery API (async)
      let battery = null
      try {
        battery = await navigator.getBattery()
        battery = {
          level: battery.level,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
        }
      } catch {
        battery = null
      }

      const emulator = detectEmulator(battery, webgl, hw)

      // Build stable device fingerprint hash
      const fpRaw = `${canvasHash}|${webgl.renderer}|${screen.width}x${screen.height}|${hw.cores}|${hw.timezone}`
      let fpHash = 0
      for (let i = 0; i < fpRaw.length; i++) {
        fpHash = ((fpHash << 5) - fpHash) + fpRaw.charCodeAt(i)
        fpHash |= 0
      }
      const deviceFingerprint = Math.abs(fpHash).toString(16).padStart(16, '0')

      setFingerprint({
        device_fingerprint: deviceFingerprint,
        ja3_hash: ja3Hash,
        canvas_hash: canvasHash,
        webgl_vendor: webgl.vendor,
        webgl_renderer: webgl.renderer,
        screen_resolution: `${screen.width}x${screen.height}`,
        color_depth: screen.colorDepth,
        pixel_ratio: screen.pixelRatio,
        cpu_cores: hw.cores,
        device_memory_gb: hw.memory,
        platform: hw.platform,
        user_agent: ua,
        language: hw.language,
        timezone: hw.timezone,
        battery_level: battery?.level ?? null,
        battery_charging: battery?.charging ?? null,
        emulator_detection: emulator,
        collected_at: new Date().toISOString(),
      })
      setLoading(false)
    }

    collect()
  }, [])

  return { fingerprint, loading }
}
