/**
 * Axios API client with JWT interceptors.
 * Automatically attaches auth token and handles 401 redirects.
 */

import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request Interceptor: attach JWT ──────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: handle 401 ─────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth API ─────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  seed: () => api.post('/auth/seed'),
};

// ── Students API ─────────────────────────────────────────────
export const studentsAPI = {
  list: (params) => api.get('/students', { params }),
  get: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
};

// ── Face Registration API ────────────────────────────────────
export const facesAPI = {
  register: (studentId, formData) =>
    api.post(`/students/${studentId}/faces`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 min timeout for processing
    }),
  getStatus: (studentId) =>
    api.get(`/students/${studentId}/faces/status`),
};

// ── Attendance API ───────────────────────────────────────────
export const attendanceAPI = {
  startSession: (data) => api.post('/attendance/session/start', data),
  getSessionStatus: (sessionId) =>
    api.get(`/attendance/session/${sessionId}/status`),
  stopSession: (sessionId) =>
    api.post(`/attendance/session/${sessionId}/stop`),
  getSessionResults: (sessionId) =>
    api.get(`/attendance/session/${sessionId}/results`),
  getToday: (params) => api.get('/attendance/today', { params }),
  getStudentHistory: (studentId, params) =>
    api.get(`/attendance/student/${studentId}`, { params }),
  updateAttendance: (attendanceId, data) =>
    api.put(`/attendance/${attendanceId}`, data),
  listSessions: (params) => api.get('/attendance/sessions', { params }),
};

// ── Reports API ──────────────────────────────────────────────
export const reportsAPI = {
  getSummary: (params) =>
    api.get('/reports/attendance-summary', { params }),
  exportCSV: () =>
    api.get('/reports/export', { responseType: 'blob' }),
};

export default api;
