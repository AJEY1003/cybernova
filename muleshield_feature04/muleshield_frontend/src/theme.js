// theme.js - Shared colors and styles for MuleShield Dashboard

export const C = {
  bg: 'var(--c-bg)',
  bgDeep: 'var(--c-bgDeep)',
  surface: 'var(--c-surface)',
  surfaceMid: 'var(--c-surfaceMid)',
  surfaceHigh: 'var(--c-surfaceHigh)',
  primary: 'var(--c-primary)',
  primaryCont: 'var(--c-primaryCont)',
  secondary: 'var(--c-secondary)',
  tertiary: 'var(--c-tertiary)',
  error: 'var(--c-error)',
  errorCont: 'var(--c-errorCont)',
  outline: 'var(--c-outline)',
  textMain: 'var(--c-textMain)',
  textMuted: 'var(--c-textMuted)',
  nodeCtrl: 'var(--c-nodeCtrl)',
  nodeCanary: 'var(--c-nodeCanary)',
  nodeBlocked: 'var(--c-nodeBlocked)',
  nodeActive: 'var(--c-nodeActive)',
  nodeHit: 'var(--c-nodeHit)',
  edgeNormal: 'var(--c-edgeNormal)',
  edgeCanary: 'var(--c-edgeCanary)',
}

export const lbl = (x = {}) => ({
  fontFamily: 'Space Grotesk, sans-serif',
  fontSize: 10,
  color: 'var(--c-textMuted)',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 8,
  ...x
})
