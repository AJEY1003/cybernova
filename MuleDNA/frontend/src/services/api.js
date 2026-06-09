import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
});

export const fraudApi = {
  // Core Banking
  getHealth: () => api.get('/health'),
  getTransactions: () => api.get('/transactions'),
  createAccount: (data) => api.post('/create_account', data),
  addTransaction: (data) => api.post('/add_transaction', data),
  
  // Risk & Alerts
  getRiskScore: (accountId) => api.get(`/risk_score/${accountId}`),
  getAlerts: () => api.get('/alerts'),
  
  // Behavioral
  logActivity: (data) => api.post('/log_activity', data),
  getAccountActivity: (accountId) => api.get(`/activity/${accountId}`),
  
  // Graph (Neo4j)
  syncGraph: () => api.post('/graph/sync'),
  getConnectedAccounts: (accountId) => api.get(`/graph/connected/${accountId}`),
  getClusters: () => axios.get(`${API_BASE}/graph/clusters`),
  getGraphData: () => axios.get(`${API_BASE}/graph/data`),
  tracePath: (sender, receiver) => api.get(`/graph/path/${sender}/${receiver}`),
  
  // Machine Learning
  predictFraud: (data) => api.post('/ml/predict', data),
  getMlStatus: () => api.get('/ml/status'),
};

export const WS_URL = 'ws://localhost:8000/ws/alerts';

export default api;
