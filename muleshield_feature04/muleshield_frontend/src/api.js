import axios from 'axios'

const BASE = '/api'

export const api = {
  health:              () => axios.get(`${BASE}/health`),
  stats:               () => axios.get(`${BASE}/stats`),
  transactions:        (limit=50, ctrl=null) => axios.get(`${BASE}/transactions`, { params: { limit, controller_id: ctrl } }),
  features:            () => axios.get(`${BASE}/features`),
  clusters:            () => axios.get(`${BASE}/clusters`),
  honeyTraps:          () => axios.get(`${BASE}/accounts/honey-traps`),
  blockedAccounts:     () => axios.get(`${BASE}/accounts/blocked`),
  graph:               () => axios.get(`${BASE}/graph`),
  alerts:              (limit=20) => axios.get(`${BASE}/alerts`, { params: { limit } }),
  deviceReuse:         () => axios.get(`${BASE}/cybersecurity/device-reuse`),
  geoVelocity:         () => axios.get(`${BASE}/cybersecurity/geo-velocity`),
  sessionCorrelation:  () => axios.get(`${BASE}/cybersecurity/session-correlation`),
  razorpayOrders:      () => axios.get(`${BASE}/razorpay/orders`),
  createDemoOrders:    () => axios.post(`${BASE}/razorpay/create-demo-orders`),
  updateAccountStatus: (account_id, status) => axios.put(`${BASE}/accounts/status`, { account_id, status }),

  detectHoneyTrap: (txnPayload) => axios.post(`${BASE}/detect/honey-trap`, txnPayload),
}
