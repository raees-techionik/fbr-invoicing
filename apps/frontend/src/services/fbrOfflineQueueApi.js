import axios from 'axios';
import { applyAuthContext } from './companySession';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const queueApi = axios.create({ baseURL: `${API_BASE_URL}/api/queue` });

queueApi.interceptors.request.use(applyAuthContext);

export async function getOfflineQueue(params = {}) {
  const resp = await queueApi.get('/', { params });
  return resp.data.data ?? [];
}

export async function getOfflineQueueSummary() {
  const resp = await queueApi.get('/status');
  return resp.data.data ?? { offline: 0, submitted: 0, upload_failed: 0 };
}

export async function processOfflineQueue() {
  const resp = await queueApi.post('/process');
  return resp.data.data;
}

export async function retryOfflineQueueItem(id) {
  const resp = await queueApi.post(`/retry/${id}`);
  return resp.data.data;
}

export async function enqueueOfflineInvoice(payload) {
  const resp = await queueApi.post('/add', payload);
  return resp.data.data;
}
