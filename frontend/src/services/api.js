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
  login: (identifier, password) =>
    api.post('/auth/login', { identifier, password }),
  getMe: () => api.get('/auth/me'),
  seed: () => api.post('/auth/seed'),
  listFaculty: () => api.get('/auth/faculty'),
  createFaculty: (data) => api.post('/auth/faculty', data),
};

// ── Subjects API ─────────────────────────────────────────────
export const subjectsAPI = {
  list: (params) => api.get('/subjects', { params }),
  create: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`),
};

// ── Students API ─────────────────────────────────────────────
export const studentsAPI = {
  list: (params) => api.get('/students', { params }),
  meta: () => api.get('/students/meta'),
  get: (id) => api.get(`/students/${id}`),
  stats: (id) => api.get(`/students/${id}/stats`),
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
  getHistory: (params) => api.get('/attendance/history', { params }),
  getStudentHistory: (studentId, params) =>
    api.get(`/attendance/student/${studentId}`, { params }),
  getMyHistory: (params) => api.get('/attendance/me', { params }),
  updateAttendance: (attendanceId, data) =>
    api.put(`/attendance/${attendanceId}`, data),
  listSessions: (params) => api.get('/attendance/sessions', { params }),
};

// ── Reports API ──────────────────────────────────────────────
export const reportsAPI = {
  getSummary: (params) =>
    api.get('/reports/attendance-summary', { params }),
  studentWise: (params) => api.get('/reports/student-wise', { params }),
  sectionWise: () => api.get('/reports/section-wise'),
  branchWise: () => api.get('/reports/branch-wise'),
  subjectWise: () => api.get('/reports/subject-wise'),
  studentSubjectWise: (studentId) => api.get(`/reports/student/${studentId}/subject-wise`),
  exportCSV: (params) =>
    api.get('/reports/export', { params, responseType: 'blob' }),
};

export default api;
